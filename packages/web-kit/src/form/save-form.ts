/** 폼의 검증·제출·확인·저장과 완료 처리의 수명을 소유한다. */
// 파일 책임: 등록·수정 폼의 제출 → (확인) → 저장 → 기준선/실패 반영 수명을 TanStack Form 위에서 소유한다.
import {
  evaluate,
  getBy,
  revalidateLogic,
  setBy,
  useForm,
  useSelector,
  type DeepKeys,
  type ReactFormExtendedApi,
  type StandardSchemaV1,
} from '@tanstack/react-form';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { isRequestFailure, type FieldError } from '../failure';
import { followRows, rowMark } from './rows';

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
  /**
   * 서버 필드 오류를 폼 경로와 표시 문구로 바꾼다. undefined면 붙이지 않는다.
   * 돌려준 경로는 제출 때 기준이다. 그 뒤 키트 줄 작업으로 줄이 옮겨졌으면 키트가 지금 위치로 옮긴다.
   */
  readonly fieldError?: (error: FieldError) => { readonly field: DeepKeys<TInput>; readonly message: string } | undefined;
  /** 오류 필드가 접힌 영역에 있으면 focus 전에 펼친다. */
  readonly reveal?: (fields: readonly string[]) => void;
  /**
   * 실패 하나가 "입력 탓"이라 입력을 고치면 사라져야 하는지 정한다(예: 로그인 아이디·비밀번호 불일치). 기본은 사라지지 않는다.
   * true를 돌려준 실패는 지금 입력이 실패한 제출 때 입력과 달라지는 순간부터 failure·unattachedFieldErrors에서 빠진다.
   * 연결 실패처럼 입력과 무관한 실패는 false로 두면 고쳐도 남는다. 입력을 제출 때 값으로 되돌리면 다시 보인다.
   */
  readonly clearFailureOnEdit?: (failure: unknown) => boolean;
  /**
   * 이 폼의 저장이 끝난 뒤 저장 함수의 결과로 한 번 실행한다(이동·알림). 늦은 결과에는 실행하지 않는다.
   * 끝날 때까지(Promise면 settle까지) 단계는 `saved`라 다시 저장할 수 없다. 실패하면 `completionFailure`가 되고
   * `complete()`가 이것만 다시 실행한다(저장 요청은 다시 나가지 않는다).
   */
  readonly onSaved?: (result: TResult) => unknown;
  /** true면 저장 성공 뒤 `saved`에서 멈추고, 사용자가 확인해 `complete()`를 부를 때 onSaved를 실행한다(저장 완료 확인창). */
  readonly acknowledge?: boolean;
}

export type SaveStage<TInput> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'confirming'; readonly values: TInput }
  | { readonly kind: 'saving'; readonly values: TInput }
  /** 저장은 끝났고 완료 처리(onSaved)를 기다리거나 실행 중이거나 실패했다. 이 동안 제출은 잠긴다. */
  | { readonly kind: 'saved'; readonly completing: boolean };

const lockedFields = new WeakMap<object, Map<string, number>>();

/**
 * 고칠 수 없는(disabled) 칸이라고 알린다. 그 칸은 오류를 숨기므로, 서버 필드 오류가 그 칸으로 대응되어도 칸에 붙은 것으로 세지 않고
 * 붙지 못한 오류(폼 한 줄)로 보낸다. 칸 부품이 마운트 동안 부르고 돌려준 함수로 푼다.
 */
export function lockField(form: object, field: string): () => void {
  const key = (form as { readonly store: object }).store;
  let locked = lockedFields.get(key);
  if (locked === undefined) {
    locked = new Map();
    lockedFields.set(key, locked);
  }
  const map = locked;
  map.set(field, (map.get(field) ?? 0) + 1);
  return () => {
    const count = (map.get(field) ?? 1) - 1;
    if (count <= 0) map.delete(field);
    else map.set(field, count);
  };
}

function isLocked(form: object, field: string): boolean {
  return lockedFields.get((form as { readonly store: object }).store)?.has(field) === true;
}

/** Standard Schema 오류 경로 → 폼 경로('a.b[0].c'). */
function issuePath(path: readonly (PropertyKey | { readonly key: PropertyKey })[] | undefined): string {
  let out = '';
  for (const segment of path ?? []) {
    const key = typeof segment === 'object' ? segment.key : segment;
    out += typeof key === 'number' ? `[${key}]` : out === '' ? String(key) : `.${String(key)}`;
  }
  return out;
}

const FILE_KINDS = new Set(['empty', 'existing', 'selected', 'removed']);

/** 칸의 빈 값: 문자열 '', 목록 [], 체크 false, 파일 칸 비어 있음, 그 밖은 undefined. */
function emptyLike(value: unknown): unknown {
  if (typeof value === 'string') return '';
  if (Array.isArray(value)) return [];
  if (typeof value === 'boolean') return false;
  if (typeof value === 'object' && value !== null && 'kind' in value && FILE_KINDS.has(String(value.kind))) return { kind: 'empty' };
  return undefined;
}

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
): SaveFormEditor<TInput, TResult> {
  const latest = useRef(options);
  latest.current = options;
  const { source } = options;
  const [defaults, setDefaults] = useState(source.values);
  const [baseline, setBaselineState] = useState(source.values);
  const baselineRef = useRef(source.values);
  const [completionFailure, setCompletionFailure] = useState<unknown>();
  const [stage, setStageState] = useState<SaveStage<TInput>>({ kind: 'idle' });
  /** 마지막 저장 실패와, 그중 필드에 붙이지 못한 서버 필드 오류. 둘은 함께 바뀐다. */
  const [rejection, setRejection] = useState<
    | {
        readonly failure: unknown;
        readonly unattached: readonly FieldError[];
        /** 입력을 고치면 이 실패를 지워야 할 때만 그 실패를 낸 제출의 입력이다. */
        readonly clearWhenEdited?: { readonly submitted: TInput };
      }
    | undefined
  >(undefined);
  const stageRef = useRef(stage);
  /** 지금 진행 중인 제출. 잠금이자 늦은 결과를 거르는 기준 하나다. 레코드가 바뀌면 비운다. */
  const submission = useRef<object | undefined>(undefined);
  const mounted = useRef(false);
  const identity = useRef(source.id);
  const decided = useRef(source.values);
  const pendingOutput = useRef<TOutput | undefined>(undefined);
  /** 확인 대기 중인 제출 값을 고정한 순간의 줄 작업 기록 위치. */
  const pendingMark = useRef(0);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** 저장이 성공해 완료 처리를 기다리는 결과. 완료 처리를 다시 시도할 때 같은 결과를 쓴다. */
  const savedResult = useRef<{ readonly result: TResult; readonly identity: unknown } | undefined>(undefined);

  const form = useForm({
    defaultValues: defaults,
    onSubmitMeta: undefined as object | undefined,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: options.schema },
    onSubmit: async ({ value, meta }) => {
      if (meta === undefined || !isCurrent(meta)) return;
      // TanStack Form은 값을 바꿀 때마다 새 객체를 만든다. 제출 순간의 참조가 곧 고정된 S다(File 등은 그대로 유지).
      const submitted = value;
      const mark = rowMark(form);
      const result = await latest.current.schema['~standard'].validate(submitted);
      if (!isCurrent(meta) || result.issues !== undefined) return;
      if (latest.current.confirm === true) {
        pendingOutput.current = result.value;
        pendingMark.current = mark;
        setStage({ kind: 'confirming', values: submitted });
        return;
      }
      await execute(meta, submitted, result.value, mark);
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
  /** 필수 판정 캐시. 값이 바뀌면 새로 판정한다. */
  const requiredCache = useRef<{ values: unknown; fields: Map<string, boolean> }>({ values: undefined, fields: new Map() });

  /**
   * 칸이 필수인가: 지금 값에서 그 칸만 비워 schema로 검증했을 때 그 칸에 오류가 나면 필수다. 필수 표시의 출처는 schema 하나다.
   * 다른 칸 값에 따른 조건부 필수도 같은 검증으로 나온다(다른 칸 오류가 있어도 돌도록 쓴 규칙이어야 한다 — skill 「필수 표시」).
   */
  function isRequired(field: string): boolean {
    const current = form.state.values;
    if (requiredCache.current.values !== current) requiredCache.current = { values: current, fields: new Map() };
    const known = requiredCache.current.fields.get(field);
    if (known !== undefined) return known;
    const probe = setBy(current, field, emptyLike(getBy(current, field)));
    const result = latest.current.schema['~standard'].validate(probe);
    const required = !(result instanceof Promise) && (result.issues ?? []).some((issue) => issuePath(issue.path) === field);
    requiredCache.current.fields.set(field, required);
    return required;
  }

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

  /**
   * 제출 값과 지금 값이 같은 필드에만 서버 오류를 붙인다. 붙인 필드와 붙이지 못한 오류를 돌려준다.
   * 배열 경로는 제출 뒤 줄 작업(mark 이후 기록)을 따라 지금 위치로 옮긴다. 그 줄이 지워졌으면 붙이지 않는다.
   */
  function attachFieldErrors(error: unknown, submitted: TInput, mark: number) {
    const attached: string[] = [];
    const unattached: FieldError[] = [];
    if (!isRequestFailure(error)) return { attached, unattached };
    for (const item of error.fieldErrors) {
      const target = latest.current.fieldError?.(item);
      const now = target === undefined ? undefined : (followRows(form, target.field, mark) as DeepKeys<TInput> | undefined);
      // 화면에 없는 칸(등록되지 않은 필드)·고칠 수 없는 칸에는 붙여도 보이지 않으므로 붙이지 못한 오류로 남긴다.
      if (
        target === undefined ||
        now === undefined ||
        form.getFieldMeta(now) === undefined ||
        isLocked(form, now) ||
        !evaluate(getBy(form.state.values, now), getBy(submitted, target.field))
      ) {
        unattached.push(item);
        continue;
      }
      form.setFieldMeta(now, (meta) => ({
        ...meta,
        errorMap: { ...meta.errorMap, onServer: target.message },
      }));
      attached.push(now);
    }
    return { attached, unattached };
  }

  /** 저장 한 번. 이 제출이 아직 현재 제출일 때만 결과를 반영한다. */
  async function execute(token: object, submitted: TInput, output: TOutput, mark: number) {
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
      const { attached, unattached } = attachFieldErrors(error, submitted, mark);
      const clearWhenEdited = latest.current.clearFailureOnEdit?.(error) === true ? { submitted } : undefined;
      setRejection({ failure: error, unattached, clearWhenEdited });
      focusFirst(attached);
      return;
    }
    if (!current()) return;
    const declared =
      typeof result === 'object' && result !== null && 'saved' in result ? (result as { readonly saved?: TInput }).saved : undefined;
    const saved = declared ?? submitted;
    savedResult.current = { result, identity: identity.current };
    flushSync(() => {
      if (evaluate(form.state.values, submitted)) replace(saved);
      else setBaseline(saved);
      setStage({ kind: 'saved', completing: false });
    });
    if (latest.current.acknowledge !== true) await complete();
  }

  /**
   * 저장 성공 뒤 완료 처리(onSaved)를 한 번 실행한다. 저장 완료 확인과 완료 실패 뒤 다시 시도가 같은 길이다.
   * 저장 요청은 다시 보내지 않는다. 성공하면 idle로 돌아가고, 실패하면 saved에 남아 제출을 잠근 채 다시 시도를 기다린다.
   */
  async function complete() {
    const pending = savedResult.current;
    const now = stageRef.current;
    if (pending === undefined || now.kind !== 'saved' || now.completing) return;
    const stillHere = () => mounted.current && savedResult.current === pending && Object.is(identity.current, pending.identity);
    setStage({ kind: 'saved', completing: true });
    setCompletionFailure(undefined);
    try {
      await latest.current.onSaved?.(pending.result);
    } catch (error: unknown) {
      if (!stillHere()) return;
      setStage({ kind: 'saved', completing: false });
      setCompletionFailure(error);
      return;
    }
    if (!stillHere()) return;
    savedResult.current = undefined;
    setStage({ kind: 'idle' });
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
      await execute(token, requested.values, output, pendingMark.current);
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
      savedResult.current = undefined;
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

  // 입력을 고치면 지우기로 한 실패는 지금 입력이 제출 때 입력과 달라진 동안 보이지 않는다.
  const visibleRejection =
    rejection?.clearWhenEdited !== undefined && !evaluate(values, rejection.clearWhenEdited.submitted) ? undefined : rejection;

  const failure = visibleRejection?.failure;
  const unattached = visibleRejection?.unattached ?? [];
  // 서버가 지목한 필드 오류가 모두 칸에 붙은 검증 실패는 칸이 이미 알린다. 그 밖의 실패만 폼 수준에 남는다.
  const allAttached =
    isRequestFailure(failure) && failure.kind === 'validation' && failure.fieldErrors.length > 0 && unattached.length === 0;

  return {
    form,
    identity: source.id,
    acknowledge: options.acknowledge === true,
    stage,
    /** 저장 실패 원본. 표시 방식은 화면이 kind로 정한다. */
    failure,
    /** 폼 수준(한 줄)에 보일 실패. 모든 필드 오류가 칸에 붙었으면 undefined다. */
    formFailure: allAttached ? undefined : failure,
    /** 저장은 성공했지만 완료 후 이동·알림이 실패했다. 재저장 실패와 구분한다. */
    completionFailure,
    /** 필드에 붙이지 못한 서버 필드 오류(저장 중 바뀐 필드·폼 경로로 바꾸지 못한 것). 폼 수준 표시의 근거다. */
    unattachedFieldErrors: unattached,
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
    isRequired: (field: DeepKeys<TInput>) => isRequired(field),
    submit,
    confirm,
    cancel,
    complete,
  };
}

/** useSaveForm이 돌려주는 편집 상태. `/form/ui`의 `<Form editor>`가 이 모양을 읽는다. */
export interface SaveFormEditor<TInput, TResult = unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 검증기 타입 인자 12개는 화면이 알 필요가 없다.
  readonly form: ReactFormExtendedApi<TInput, any, any, any, any, any, any, any, any, any, any, any>;
  /** 편집 대상 식별(source.id). 바뀌면 진행 중이던 이탈 허가가 무효가 된다. */
  readonly identity: unknown;
  /** 저장 성공 뒤 사용자 확인을 기다리는가(acknowledge 값). */
  readonly acknowledge: boolean;
  readonly stage: SaveStage<TInput>;
  readonly failure: unknown;
  readonly formFailure: unknown;
  readonly completionFailure: unknown;
  readonly unattachedFieldErrors: readonly FieldError[];
  readonly baseline: TInput;
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly getState: () => { readonly stage: SaveStage<TInput>['kind']; readonly isDirty: boolean; readonly isSaving: boolean };
  readonly fieldId: (field: DeepKeys<TInput>) => string;
  /** 필수 표시(별표·aria-required): 그 칸만 비운 지금 값을 schema가 거부하는가. */
  readonly isRequired: (field: DeepKeys<TInput>) => boolean;
  readonly submit: () => Promise<void>;
  readonly confirm: () => Promise<void>;
  readonly cancel: () => void;
  readonly complete: () => Promise<void>;
  /** 타입 위치만 쓰는 표식. 저장 결과 타입을 부품까지 잇는다. */
  readonly __result?: TResult;
}
