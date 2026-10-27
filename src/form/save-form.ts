/** 폼의 검증·제출·확인·저장과 완료 처리의 수명을 소유한다. */
// 파일 책임: 등록·수정 폼의 제출 → (확인) → 저장 → 기준선/실패 반영 수명을 TanStack Form 위에서 소유한다.
import { evaluate, getBy, revalidateLogic, useForm, useSelector, type DeepKeys, type StandardSchemaV1 } from '@tanstack/react-form';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { isRequestFailure, type FieldError } from '../failure';

export interface SaveFormOptions<TInput, TOutput, TResult = { readonly saved?: TInput } | void> {
  /** 입력 → 저장 값 동기 검증. zod 4 등 Standard Schema 구현이면 되고, 비동기 검증(async refine 등)은 받지 않는다. */
  readonly schema: StandardSchemaV1<TInput, TOutput>;
  /** 편집 대상. 등록이면 기본값. id가 바뀌면 새 폼, 같은 id의 새 values는 원본 재도착이다. */
  readonly source: { readonly id: unknown; readonly values: TInput };
  /** true면 유효한 제출이 확인 대기로 가고 confirm()이 같은 S로 저장한다. */
  readonly confirm?: boolean;
  /**
   * 저장 작업. 서버가 저장 결과를 주면 폼 값으로 바꿔 saved로 돌려준다(없으면 제출한 S가 저장 결과다).
   * 그 밖의 결과(새 id·토큰 등)도 함께 돌려주면 onSaved가 받는다.
   */
  readonly save: (values: TOutput, submitted: TInput) => Promise<TResult>;
  /** 서버 필드 오류를 폼 경로와 표시 문구로 바꾼다. undefined면 붙이지 않는다. */
  readonly fieldError?: (error: FieldError) => { readonly field: DeepKeys<TInput>; readonly message: string } | undefined;
  /** 오류 필드가 접힌 영역에 있으면 focus 전에 펼친다. */
  readonly reveal?: (fields: readonly string[]) => void;
  /** 이 폼의 저장이 끝난 직후 저장 함수의 결과로 한 번 실행한다(이동·알림). 늦은 결과에는 실행하지 않는다. */
  readonly onSaved?: (result: TResult) => void;
}

export type SaveStage<TInput> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'confirming'; readonly values: TInput }
  | { readonly kind: 'saving'; readonly values: TInput };

/** 폼 하나의 입력 control id. 라벨·오류·focus가 같은 id를 쓴다. */
export function formFieldControlId(formId: string, field: string): string {
  return `form-${formId}-field-${encodeURIComponent(field)}`;
}

/**
 * 제출·확인·저장 수명을 소유한다. 실패는 분류하지 않고 그대로 failure로 둔다(취소만 제외).
 * 성공하면 저장 결과가 기준선이 되고, 저장 중 입력이 바뀌지 않았을 때만 입력에도 반영한다.
 * 늦은 결과는 고정한 레코드·폼 수명이 같을 때만 반영한다.
 */
export function useSaveForm<TInput, TOutput, TResult = { readonly saved?: TInput } | void>(
  options: SaveFormOptions<TInput, TOutput, TResult>,
) {
  const latest = useRef(options);
  latest.current = options;
  const { source } = options;
  const [defaults, setDefaults] = useState(source.values);
  const [baseline, setBaselineState] = useState(source.values);
  const baselineRef = useRef(source.values);
  const [completionFailure, setCompletionFailure] = useState<unknown>();
  const [stage, setStageState] = useState<SaveStage<TInput>>({ kind: 'idle' });
  /** 마지막 저장 실패와, 그중 필드에 붙이지 못한 서버 필드 오류. 둘은 함께 바뀐다. */
  const [rejection, setRejection] = useState<{ readonly failure: unknown; readonly unattached: readonly FieldError[] } | undefined>(
    undefined,
  );
  const stageRef = useRef(stage);
  /** 지금 진행 중인 제출. 잠금이자 늦은 결과를 거르는 기준 하나다. 레코드가 바뀌면 비운다. */
  const submission = useRef<object | undefined>(undefined);
  const mounted = useRef(false);
  const identity = useRef(source.id);
  const decided = useRef(source.values);
  const pendingOutput = useRef<TOutput | undefined>(undefined);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const form = useForm({
    defaultValues: defaults,
    onSubmitMeta: undefined as object | undefined,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: options.schema },
    onSubmit: async ({ value, meta }) => {
      if (meta === undefined || !isCurrent(meta)) return;
      // TanStack Form은 값을 바꿀 때마다 새 객체를 만든다. 제출 순간의 참조가 곧 고정된 S다(File 등은 그대로 유지).
      const submitted = value;
      const result = await latest.current.schema['~standard'].validate(submitted);
      if (!isCurrent(meta) || result.issues !== undefined) return;
      if (latest.current.confirm === true) {
        pendingOutput.current = result.value;
        setStage({ kind: 'confirming', values: submitted });
        return;
      }
      await execute(meta, submitted, result.value);
    },
    onSubmitInvalid: ({ formApi, meta }) => {
      if (meta === undefined || !isCurrent(meta)) return;
      const invalid = Object.keys(formApi.state.fieldMeta).filter(
        (name) => (formApi.getFieldMeta(name as DeepKeys<TInput>)?.errors.length ?? 0) > 0,
      );
      focusFirst(invalid);
    },
  });
  const values = useSelector(form.store, (state) => state.values);

  /** 렌더 이전 이탈 판정도 최신 저장 기준선을 읽게 한다. */
  function setBaseline(next: TInput) {
    baselineRef.current = next;
    setBaselineState(next);
  }

  /** 제출이 시작된 폼 수명과 현재 대상이 같은지 비동기 경계마다 확인한다. */
  function isCurrent(token: object) {
    return mounted.current && submission.current === token && Object.is(identity.current, latest.current.source.id);
  }

  /** 렌더 전 연속 호출도 최신 단계를 보게 한다. */
  function setStage(next: SaveStage<TInput>) {
    stageRef.current = next;
    setStageState(next);
  }

  function cancelFocus() {
    clearTimeout(focusTimer.current);
    focusTimer.current = undefined;
  }

  /** 펼친 뒤 disabled가 풀린 다음 작업에서 화면 순서의 첫 필드로 focus한다. */
  function focusFirst(fields: readonly string[]) {
    cancelFocus();
    if (fields.length === 0 || !mounted.current) return;
    const { reveal } = latest.current;
    if (reveal !== undefined) flushSync(() => reveal(fields));
    focusTimer.current = setTimeout(() => {
      focusTimer.current = undefined;
      if (!mounted.current) return;
      const elements = fields
        .map((field) => document.getElementById(formFieldControlId(form.formId, field)))
        .filter((element): element is HTMLElement => element !== null)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      elements[0]?.focus();
    }, 0);
  }

  function clearServerErrors() {
    for (const name of Object.keys(form.state.fieldMeta) as DeepKeys<TInput>[]) {
      if (form.getFieldMeta(name)?.errorMap.onServer === undefined) continue;
      form.setFieldMeta(name, (meta) => ({ ...meta, errorMap: { ...meta.errorMap, onServer: undefined } }));
    }
  }

  /** 제출 값과 지금 값이 같은 필드에만 서버 오류를 붙인다. 붙인 필드와 붙이지 못한 오류를 돌려준다. */
  function attachFieldErrors(error: unknown, submitted: TInput) {
    const attached: string[] = [];
    const unattached: FieldError[] = [];
    if (!isRequestFailure(error)) return { attached, unattached };
    for (const item of error.fieldErrors) {
      const target = latest.current.fieldError?.(item);
      if (target === undefined || !evaluate(getBy(form.state.values, target.field), getBy(submitted, target.field))) {
        unattached.push(item);
        continue;
      }
      form.setFieldMeta(target.field, (meta) => ({
        ...meta,
        errorMap: { ...meta.errorMap, onServer: target.message },
      }));
      attached.push(target.field);
    }
    return { attached, unattached };
  }

  /** 저장 한 번. 이 제출이 아직 현재 제출일 때만 결과를 반영한다. */
  async function execute(token: object, submitted: TInput, output: TOutput) {
    const current = () => isCurrent(token);
    if (!current()) return;
    setStage({ kind: 'saving', values: submitted });
    let result: TResult;
    try {
      result = await latest.current.save(output, submitted);
    } catch (error: unknown) {
      if (!current()) return;
      setStage({ kind: 'idle' });
      if (isRequestFailure(error) && error.kind === 'cancelled') return;
      const { attached, unattached } = attachFieldErrors(error, submitted);
      setRejection({ failure: error, unattached });
      focusFirst(attached);
      return;
    }
    if (!current()) return;
    const declared =
      typeof result === 'object' && result !== null && 'saved' in result ? (result as { readonly saved?: TInput }).saved : undefined;
    const saved = declared ?? submitted;
    flushSync(() => {
      if (evaluate(form.state.values, submitted)) replace(saved);
      else setBaseline(saved);
      setStage({ kind: 'idle' });
    });
    try {
      await latest.current.onSaved?.(result);
    } catch (error: unknown) {
      if (current()) setCompletionFailure(error);
    }
  }

  /** 검증 → 확인 대기 또는 저장. 진행 중·확인 대기 중에는 다시 들어가지 않는다. */
  async function submit() {
    if (submission.current !== undefined || stageRef.current.kind !== 'idle') return;
    const token = {};
    submission.current = token;
    cancelFocus();
    clearServerErrors();
    setRejection(undefined);
    setCompletionFailure(undefined);
    try {
      // 이미 떠 있는 blur 오류가 있으면 TanStack 제출은 전체 검증 없이 멈춘다. 필드 단위 blur 검증과 폼 검증을
      // 먼저 다시 돌려, 고친 값의 오류는 지우고 남은 오류는 모두 보인다.
      await form.validateAllFields('blur');
      if (!isCurrent(token)) return;
      await form.validate('blur');
      if (!isCurrent(token)) return;
      await form.validate('submit');
      if (!isCurrent(token)) return;
      await form.handleSubmit(token);
    } finally {
      release(token);
    }
  }

  /** 확인창에 보여 준 S로 저장한다. */
  async function confirm() {
    const requested = stageRef.current;
    const output = pendingOutput.current;
    if (submission.current !== undefined || requested.kind !== 'confirming' || output === undefined) return;
    const token = {};
    submission.current = token;
    pendingOutput.current = undefined;
    try {
      await execute(token, requested.values, output);
    } finally {
      release(token);
    }
  }

  /** 자기 제출일 때만 잠금을 푼다. 이전 제출의 늦은 종료는 새 제출을 건드리지 않는다. */
  function release(token: object) {
    if (submission.current === token) submission.current = undefined;
  }

  /** 실행 전 확인만 취소한다. */
  function cancel() {
    if (submission.current !== undefined || stageRef.current.kind !== 'confirming') return;
    pendingOutput.current = undefined;
    setStage({ kind: 'idle' });
  }

  // 레코드가 바뀌면 진행 중 결과를 버리고 새 원본으로 시작한다. 같은 레코드면 원본 재도착 규칙을 따른다.
  useLayoutEffect(() => {
    if (!Object.is(identity.current, source.id)) {
      identity.current = source.id;
      decided.current = source.values;
      submission.current = undefined;
      pendingOutput.current = undefined;
      cancelFocus();
      setStage({ kind: 'idle' });
      setRejection(undefined);
      setCompletionFailure(undefined);
      replace(source.values);
      return;
    }
    if (stage.kind !== 'idle' || evaluate(decided.current, source.values)) return;
    decided.current = source.values;
    if (evaluate(form.state.values, baseline)) replace(source.values);
  });

  function replace(next: TInput) {
    flushSync(() => setDefaults(next));
    form.reset(next);
    setBaseline(next);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelFocus();
    };
  }, []);

  return {
    form,
    stage,
    /** 저장 실패 원본. 표시 방식은 화면이 kind로 정한다. */
    failure: rejection?.failure,
    /** 저장은 성공했지만 완료 후 이동·알림이 실패했다. 재저장 실패와 구분한다. */
    completionFailure,
    /** 필드에 붙이지 못한 서버 필드 오류(저장 중 바뀐 필드·폼 경로로 바꾸지 못한 것). 폼 수준 표시의 근거다. */
    unattachedFieldErrors: rejection?.unattached ?? [],
    /** 기준선(마지막으로 확정된 원본 또는 저장 결과). 차이로 요청을 만드는 화면이 읽는다. 바꾸지 않는다. */
    baseline,
    /** 현재 입력이 기준선과 다른가. */
    isDirty: !evaluate(values, baseline),
    isSaving: stage.kind === 'saving',
    /** 같은 이벤트 안의 이동도 현재 입력과 기준선으로 판정한다. */
    getState: () => ({
      stage: stageRef.current.kind,
      isDirty: !evaluate(form.state.values, baselineRef.current),
      isSaving: stageRef.current.kind === 'saving',
    }),
    fieldId: (field: DeepKeys<TInput>) => formFieldControlId(form.formId, field),
    submit,
    confirm,
    cancel,
  };
}
