// 파일 책임: 접을 수 있는 폼 구역의 규칙 — 구역 칸(정확한 경로나 접두)으로 센 오류 수와 열림 상태, 거절된 제출의 구역 펼침.
// 열림은 사용자가 열고 닫는 평범한 상태다(처음엔 펼침, 닫혀도 칸은 마운트). 제출이 거절될 때마다(클라이언트 검증 실패, 서버 필드 오류 도착, 화면 절차 거절 FormRejection)
// useSaveForm이 실패한 칸 목록으로 revealFormSections를 부르고, 그 칸을 가진 구역이 모두 펼쳐진다. 제출 횟수 같은 기록은 두지 않는다. 포커스는 펼친 뒤 useSaveForm이 화면 순서 첫 오류 칸에 옮긴다. UI는 import하지 않는다.
import { useStore, type AnyFormApi } from '@tanstack/react-form';
import { useLayoutEffect, useState } from 'react';

/** 칸 경로가 구역 칸 목록에 들어가는가. 목록의 각 항목은 정확한 경로이거나 그 아래 경로(`a.b`, `a[0]`)의 접두다. */
export function inSection(fields: readonly string[], path: string): boolean {
  return fields.some((field) => path === field || path.startsWith(`${field}.`) || path.startsWith(`${field}[`));
}

/** 구역 칸 중 오류가 있는 칸 수(클라이언트·서버 오류 모두). */
export function sectionErrorCount(
  fieldMeta: Readonly<Record<string, { readonly errors?: readonly unknown[] } | undefined>>,
  fields: readonly string[],
): number {
  return Object.entries(fieldMeta).filter(([path, meta]) => (meta?.errors?.length ?? 0) > 0 && inSection(fields, path)).length;
}

type Revealer = (failed: readonly string[]) => void;

/** 폼(저장소)마다 마운트된 구역의 펼침 함수. */
const revealers = new WeakMap<object, Set<Revealer>>();

const storeOf = (form: object) => (form as { readonly store: object }).store;

/**
 * 거절된 제출 하나를 알린다: 실패한 칸을 가진 구역을 모두 펼친다. useSaveForm이 거절(클라이언트 검증 실패·서버 필드 오류 도착·
 * save가 던진 FormRejection)마다 포커스 직전에 부른다. 공개하지 않는다 — 화면 절차의 거절은 FormRejection으로 같은 길을 탄다.
 */
export function revealFormSections(form: object, failed: readonly string[]): void {
  if (failed.length === 0) return;
  for (const reveal of revealers.get(storeOf(form)) ?? []) reveal(failed);
}

export interface FormSectionState {
  readonly open: boolean;
  readonly errorCount: number;
  readonly toggle: () => void;
}

/** 구역 하나의 열림·오류 수. `form`은 useSaveForm의 form이다(키트 Form 밖의 폼도 같다). */
export function useFormSection(form: AnyFormApi, fields: readonly string[]): FormSectionState {
  const errorCount = useStore(form.store, (state) => sectionErrorCount(state.fieldMeta, fields));
  const [open, setOpen] = useState(true);
  useLayoutEffect(() => {
    const store = storeOf(form);
    let set = revealers.get(store);
    if (set === undefined) {
      set = new Set();
      revealers.set(store, set);
    }
    const own = set;
    const reveal: Revealer = (failed) => {
      if (failed.some((path) => inSection(fields, path))) setOpen(true);
    };
    own.add(reveal);
    return () => {
      own.delete(reveal);
    };
  }, [form, fields]);
  return { open, errorCount, toggle: () => setOpen((current) => !current) };
}
