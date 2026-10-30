// 파일 책임: 조건부 칸의 표시·제출 투영과 줄 정체성을 따른 기준선 복원을 소유한다.
import { evaluate, getBy, setBy, type AnyFormApi, type DeepKeys, type DeepValue } from '@tanstack/react-form';
import { useLayoutEffect, useRef } from 'react';
import { followRows, rowMark } from './rows';
import { writeFormValues } from './references';

/** 현재 값으로 계산한 칸의 표시 여부와 프로젝트 서버가 받는 빈 값. */
export type ConditionalField<T> = {
  [K in DeepKeys<T> & string]: { readonly field: K; readonly visible: boolean; readonly emptyValue: DeepValue<T, K> }
}[DeepKeys<T> & string];

/** 숨긴 부모 아래 칸도 같은 숨김 상태다. */
export function fieldIsHidden<T>(fields: readonly ConditionalField<T>[], name: string): boolean {
  return fields.some(({ field, visible }) => !visible && (name === field || name.startsWith(`${field}.`) || name.startsWith(`${field}[`)));
}

/** 폼 원시 값은 보존하고 숨긴 칸에만 선언한 빈 값을 넣는다. */
export function projectConditionalFields<T>(values: T, fields: readonly ConditionalField<T>[]): T {
  let next = values;
  // 자식보다 부모를 나중에 비워 부모의 빈 값이 최종 제출에 남게 한다.
  for (const { field, visible, emptyValue } of [...fields].sort((a, b) => b.field.length - a.field.length)) {
    if (!visible) next = setBy(next, field, emptyValue);
  }
  return next;
}

/** 줄 작업 뒤에도 같은 줄의 최초 값·저장 값을 보존하고 숨김→보임 전환에만 복원한다. */
export function useConditionalFields<T>(
  form: AnyFormApi,
  identity: unknown,
  baseline: T,
  baselineMark: number,
  fields: ((values: T) => readonly ConditionalField<T>[]) | undefined,
) {
  const latest = useRef({ identity, baseline, baselineMark, fields });
  latest.current = { identity, baseline, baselineMark, fields };
  const history = useRef({ identity, baseline, mark: rowMark(form), originals: new Map<string, unknown>(), visible: new Map<string, boolean>() });

  /** 이전 위치의 상태를 키트 줄 작업 기록에 따라 지금 위치로 옮긴다. */
  function moveMap<V>(entries: Map<string, V>, since: number): Map<string, V> {
    const moved = new Map<string, V>();
    for (const [field, value] of entries) {
      const now = followRows(form, field, since);
      if (now !== undefined) moved.set(now, value);
    }
    return moved;
  }

  /** 최신 줄 위치와 기준선을 읽고 다시 보인 칸만 원래 값으로 되돌린다. */
  function reconcile() {
    const current = latest.current;
    const old = history.current;
    const same = Object.is(old.identity, current.identity);
    let originals = same ? moveMap(old.originals, old.mark) : new Map<string, unknown>();
    const visible = same ? moveMap(old.visible, old.mark) : new Map<string, boolean>();
    if (!same || old.baseline !== current.baseline || originals.size === 0) {
      const saved = moveMap(new Map((current.fields?.(current.baseline) ?? []).map(({ field }) => [field, getBy(current.baseline, field)])), current.baselineMark);
      originals = new Map([...originals, ...saved]);
    }
    const declarations = current.fields?.(form.state.values as T) ?? [];
    const names = new Set(declarations.map(({ field }) => field));
    for (const field of originals.keys()) if (!names.has(field as DeepKeys<T> & string)) originals.delete(field);
    let values = form.state.values;
    const nextVisible = new Map<string, boolean>();
    for (const { field } of declarations) {
      if (!originals.has(field)) originals.set(field, getBy(values, field));
      const shown = !fieldIsHidden(declarations, field);
      nextVisible.set(field, shown);
      if (shown && visible.get(field) === false) values = setBy(values, field, originals.get(field));
    }
    history.current = { identity: current.identity, baseline: current.baseline, mark: rowMark(form), originals, visible: nextVisible };
    if (!evaluate(values, form.state.values)) writeFormValues(form, values);
    // 숨긴 칸에 남은 blur·서버 오류가 표시나 다음 제출을 막지 않게 한다.
    for (const name of Object.keys(form.state.fieldMeta)) {
      if (fieldIsHidden(declarations, name) && form.getFieldMeta(name)?.errors.length) {
        form.setFieldMeta(name, (meta) => ({ ...meta, errorMap: {}, errorSourceMap: {} }));
      }
    }
  }
  useLayoutEffect(reconcile);
  return { reconcile };
}
