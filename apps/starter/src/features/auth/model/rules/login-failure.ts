// 파일 책임: 로그인 실패의 의미(순수 판정). 자격증명 거절(401)만 입력 아래 한 줄 문구로 보이고, 그 밖은 실패 종류 문구를 쓴다.
import { isRequestFailure } from '@boosterlab/web-kit/failure';

/** 자격증명 거절이면 그 문구 키, 아니면 undefined(공용 실패 문구를 쓴다). */
export function loginFailureCopyKey(failure: unknown): string | undefined {
  return isRequestFailure(failure) && failure.kind === 'unauthorized' ? 'auth.credentialRejected' : undefined;
}
