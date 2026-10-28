// 파일 책임: 접을 수 있는 폼 구역의 규칙 — 구역 칸(정확한 경로나 접두)으로 센 오류 수와 열림 상태.
// 처음엔 펼침. 제출(클라이언트 검증 실패·서버 필드 오류) 뒤 그 구역에 오류가 있으면 연다. 제출이 연 구역은 오류를 고쳐도 열린 채 두고,
// 그 뒤 사용자가 닫으면 다음 제출까지 닫힌 채 둔다(1.5 form-accordion openSections). 오류는 폼 저장소를 동기로 구독해
// useSaveForm이 setTimeout(0)으로 예약한 첫 오류 포커스보다 먼저 구역이 열린다. UI는 import하지 않는다.
import { useStore, type AnyFormApi } from '@tanstack/react-form';
import { useState } from 'react';

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

export interface FormSectionState {
  readonly open: boolean;
  readonly errorCount: number;
  readonly toggle: () => void;
}

/** 구역 하나의 열림·오류 수. `form`은 useSaveForm의 form이다(키트 Form 밖의 폼도 같다). */
export function useFormSection(form: AnyFormApi, fields: readonly string[]): FormSectionState {
  const attempts = useStore(form.store, (state) => state.submissionAttempts);
  const errorCount = useStore(form.store, (state) => sectionErrorCount(state.fieldMeta, fields));
  /** 사용자가 마지막으로 정한 열림과 그때의 제출 시도 횟수. */
  const [choice, setChoice] = useState<{ readonly open: boolean; readonly attempt: number } | undefined>();
  /** 제출 뒤 오류로 연 제출 시도 횟수. 사용자가 그 뒤에 정한 열림이 없으면 열린 채 둔다. */
  const [opened, setOpened] = useState(0);
  const decidedAt = choice?.attempt ?? 0;
  const forced = errorCount > 0 && attempts > decidedAt;
  // 이전 렌더에서 온 정보를 기억하는 렌더 중 갱신(같은 값이면 다시 부르지 않는다).
  if (forced && opened !== attempts) setOpened(attempts);
  const open = forced || opened > decidedAt || (choice?.open ?? true);
  return { open, errorCount, toggle: () => setChoice({ open: !open, attempt: attempts }) };
}
