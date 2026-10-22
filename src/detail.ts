// 파일 책임: 필수 단건 조회의 데이터·대기·오류 우선순위를 판정한다.
export interface RequiredQueryFacts<T> {
  readonly data: T | undefined;
  readonly isPending: boolean;
}
export type RecordErrorPlacement = 'local' | 'not-found' | 'incident' | 'none';
export type RequiredRecordOutcome<T> =
  | { readonly kind: 'ready'; readonly data: T }
  | { readonly kind: 'pending' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'error' }
  | { readonly kind: 'delegated'; readonly outcome: 'none' | 'incident' };

/** 앱 오류는 위임하고 삭제 응답은 캐시보다 우선하며, 일반 재조회 실패는 데이터를 보존한다. */
export function resolveRequiredRecord<T>(
  facts: RequiredQueryFacts<T>,
  errorPlacement: RecordErrorPlacement = 'local',
): RequiredRecordOutcome<T> {
  if (errorPlacement === 'incident') return { kind: 'delegated', outcome: 'incident' };
  if (errorPlacement === 'not-found') return { kind: 'not-found' };
  if (facts.data !== undefined) return { kind: 'ready', data: facts.data };
  if (errorPlacement === 'none') return { kind: 'delegated', outcome: 'none' };
  if (facts.isPending) return { kind: 'pending' };
  return { kind: 'error' };
}
