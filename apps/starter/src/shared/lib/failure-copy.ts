// 파일 책임: 실패 하나에서 화면 문구 키를 고른다. 서버 resultMessage는 쓰지 않고 결과 코드 표의 messageKey → 실패 종류 순으로 고른다.
import { isRequestFailure } from '@boosterlab/web-kit/failure';

/** 실패 → 번역 키. 반영 여부 미확정이면 그 사실을 먼저 알린다. */
export function failureCopyKey(failure: unknown): string {
  if (!isRequestFailure(failure)) return 'failure.unknown';
  if (failure.resultUnknown) return 'failure.resultUnknown';
  if (failure.messageKey !== undefined) return failure.messageKey;
  if (failure.kind === 'cancelled') return 'failure.unknown';
  return `failure.kind.${failure.kind}`;
}
