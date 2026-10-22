// 파일 책임: 필터 제출 오류를 보관하며 확정값 변경·초기화 때 이전 오류를 제거한다.
import { useState } from 'react';
import { validateDateRange } from './search';
export interface FilterIssue {
  readonly field: string;
  readonly code: string;
}
/** 화면 규칙을 최신 초안에 실행하고 성공한 제출만 허용한다. */
export function useFilterValidation<T>(
  values: T,
  resetKey: unknown,
  check: (values: T) => readonly FilterIssue[]
) {
  const [stored, setStored] = useState<{ key: unknown; issues: readonly FilterIssue[] }>({
    key: resetKey,
    issues: [],
  });
  const current = Object.is(stored.key, resetKey) ? stored : { key: resetKey, issues: [] };
  if (current !== stored) setStored(current);
  return {
    issues: current.issues,
    validate: () => {
      const issues = check(values);
      setStored({ key: resetKey, issues });
      return issues.length === 0;
    },
    clear: () => setStored({ key: resetKey, issues: [] }),
  };
}
/** 두 프로젝트의 기간 필터에 같은 검증과 오류 수명을 연결한다. 업무별 최대 기간은 정하지 않는다. */
export function useDateRangeValidation(
  start: string | undefined,
  end: string | undefined,
  resetKey: unknown
) {
  const validation = useFilterValidation({ start, end }, resetKey, (range) => {
    const code = validateDateRange(range.start, range.end);
    return code ? [{ field: 'period', code }] : [];
  });
  return { ...validation, error: validation.issues[0]?.code };
}
