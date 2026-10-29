// 파일 책임: 폼 안 원본 ID와 참조 칸의 무결성, 변경 확인과 취소 수명을 관리한다.
import { evaluate, getBy, setBy, type AnyFormApi, type DeepKeys } from '@tanstack/react-form';
import { useLayoutEffect, useRef, useState } from 'react';

/** 업무 관계와 문구는 프로젝트가 선언한다. 원본 이름은 ID와 별개로 현재 값에서 표시한다. */
export interface FormReference<T> {
  readonly source: (values: T) => readonly string[];
  readonly fields: (values: T) => readonly (DeepKeys<T> & string)[];
  readonly onRemove?: 'clear' | 'block' | 'validate';
  readonly message: string;
}

export interface ReferenceIssue {
  readonly field: string;
  readonly message: string;
}
export interface ReferenceChange {
  readonly count: number;
  readonly confirm: () => void;
  readonly cancel: () => void;
}

type Commit = (values: unknown) => void | Promise<void>;
type ChangeHandler = (values: unknown, commit: Commit) => Promise<void>;
const handlers = new WeakMap<object, ChangeHandler>();

/** 키트 칸과 줄 작업이 값 반영 전에 같은 참조 판정을 거친다. */
export function requestFormChange(form: AnyFormApi, values: unknown, commit: Commit): Promise<void> {
  const handler = handlers.get(form.store);
  return handler === undefined ? Promise.resolve(commit(values)) : handler(values, commit);
}

/** 바뀐 루트 값만 반영한다. 호출자는 한 화면 갱신 안에서 원본과 참조를 함께 쓴다. */
export function writeFormValues(form: AnyFormApi, values: unknown): void {
  for (const [name, value] of Object.entries(values as Record<string, unknown>)) {
    if (!evaluate(form.getFieldValue(name), value)) form.setFieldValue(name, value as never, { dontValidate: true });
  }
}

/** 참조 칸에서 실제 ID만 얻는다. 빈 단일 값은 참조가 아니다. */
function ids(value: unknown): readonly string[] {
  return typeof value === 'string'
    ? value === ''
      ? []
      : [value]
    : Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item !== '')
      : [];
}

/** 직접 값 변경이나 서버 원본도 두 저장의 마지막 검사에서 끊긴 참조를 거절한다. */
export function referenceIssues<T>(values: T, rules: readonly FormReference<T>[]): readonly ReferenceIssue[] {
  return rules.flatMap((rule) => {
    const available = new Set(rule.source(values));
    return rule
      .fields(values)
      .filter((field) => ids(getBy(values, field)).some((id) => !available.has(id)))
      .map((field) => ({ field, message: rule.message }));
  });
}

/** 변경 후보에 남는 참조만 정리하며, 그 정리로 끊기는 다음 관계도 함께 찾는다. */
function planChange<T>(before: T, proposed: T, rules: readonly FormReference<T>[]) {
  let values = proposed;
  const affected = new Set<string>();
  let again = true;
  while (again) {
    again = false;
    for (const rule of rules) {
      const previous = new Set(rule.source(before));
      const available = new Set(rule.source(values));
      const removed = (id: string) => previous.has(id) && !available.has(id);
      for (const field of rule.fields(values)) {
        const value = getBy(values, field);
        if (!ids(value).some(removed)) continue;
        if (rule.onRemove === 'block') return { values: before, count: 0, blocked: rule.message };
        if (rule.onRemove === 'validate') continue;
        affected.add(field);
        values = setBy(values, field, Array.isArray(value) ? value.filter((id) => !removed(id)) : '');
        again = true;
      }
    }
  }
  return { values, count: affected.size, blocked: undefined };
}

/** 확인 중 어떤 값 변경도 이전 요청을 무효화한다. 같은 값으로 되돌려도 되살리지 않는다. */
export function useFormReferences<T>(form: AnyFormApi, identity: unknown, rules: readonly FormReference<T>[], canChange: () => boolean) {
  const latest = useRef({ rules, identity, canChange });
  latest.current = { rules, identity, canChange };
  const revision = useRef(0);
  const pending = useRef<{ revision: number; identity: unknown; values: T; commit: Commit; settle: () => void } | undefined>(undefined);
  const [change, setChange] = useState<ReferenceChange>();
  const [failure, setFailure] = useState<string>();

  /** 아직 적용하지 않은 변경을 버리고 기다리는 줄 작업을 끝낸다. */
  function cancel() {
    const old = pending.current;
    pending.current = undefined;
    setChange(undefined);
    old?.settle();
  }

  useLayoutEffect(() => {
    let previous = form.state.values;
    const unsubscribe = form.store.subscribe(() => {
      if (previous === form.state.values) return;
      previous = form.state.values;
      revision.current += 1;
      cancel();
      setFailure(undefined);
    });
    const handle: ChangeHandler = async (proposed, commit) => {
      cancel();
      setFailure(undefined);
      const plan = planChange(form.state.values as T, proposed as T, latest.current.rules);
      if (plan.blocked !== undefined) {
        setFailure(plan.blocked);
        return;
      }
      if (plan.count === 0) {
        await commit(plan.values);
        return;
      }
      if (!latest.current.canChange()) return;
      await new Promise<void>((settle) => {
        const item = { revision: revision.current, identity: latest.current.identity, values: plan.values, commit, settle };
        pending.current = item;
        setChange({
          count: plan.count,
          cancel,
          confirm: () => {
            if (
              pending.current !== item ||
              item.revision !== revision.current ||
              !Object.is(item.identity, latest.current.identity) ||
              !latest.current.canChange()
            ) {
              cancel();
              return;
            }
            pending.current = undefined;
            setChange(undefined);
            void Promise.resolve(item.commit(item.values)).finally(settle);
          },
        });
      });
    };
    handlers.set(form.store, handle);
    return () => {
      unsubscribe.unsubscribe();
      if (handlers.get(form.store) === handle) handlers.delete(form.store);
      const old = pending.current;
      pending.current = undefined;
      old?.settle();
    };
  }, [form.store]);
  useLayoutEffect(cancel, [identity]);
  return { change, failure, isPending: () => pending.current !== undefined, cancel };
}
