// 파일 책임: web-kit 초기 연결의 유일한 진입점. 세션 수명·요청 처리·QueryClient를 이 앱의 저장 위치·공개 경로·헤더·재발급 계약에 연결한다.
// 생성 endpoint(orval)는 여기의 apiRequest(= http.request) 하나로 호출된다. adapter 구현(저장소·재발급)은 짧아서 이 파일에 함께 둔다.
import { createResultCodeTable, isRequestFailure, RequestFailure, readEnvelope, toRequestFailure } from '@boosterlab/web-kit';
import { createHttp, type Http, type Unwrapped, type ResponseContract } from '@boosterlab/web-kit/http';
import { createQueryClient } from '@boosterlab/web-kit/query';
import { createSession, type Credentials } from '@boosterlab/web-kit/session';
import { createBrowserSessionStore } from '@boosterlab/web-kit/session/browser';
import { z } from 'zod';
import type { AxiosRequestConfig } from 'axios';
import { signOut } from '@/features/auth/api/auth';
import { env } from './env';
import { i18n } from './i18n';
import { notices } from './notices';

/**
 * 결과 코드 표: 서버 enum에 있는 행만 옮겨 적는다. 아래 두 행은 **예시**다.
 * 실제 서버의 결과 코드 enum으로 교체하고, 이름만 보고 행을 더하지 않는다(web-kit-http 스킬).
 */
export const resultCodes = createResultCodeTable([
  // 예시: 다른 곳에서 로그인해 이 세션이 끝났다는 서버 코드. 재발급으로 회복되지 않는다.
  { status: 401, code: 4012, messageKey: 'failure.code.sessionEnded', endsSession: true },
  // 예시: 요청한 대상이 없다는 서버 코드.
  { status: 404, code: 4040, kind: 'not-found', messageKey: 'failure.code.notExist' },
]);

/** localStorage에 두는 저장 key. 실제 값은 로그·응답에 남기지 않는다. */
const STORAGE_KEY = 'app.session';

/** 예시 제품은 저장소 읽기 불가 때 현재 탭의 로그인 상태를 유지한다. */
const store = createBrowserSessionStore({
  key: STORAGE_KEY,
  credentials: z.object({ accessToken: z.string() }),
  unreadable: 'memory',
});

/** 세션 밖 요청: 로그인 전·재발급·로그아웃. 토큰이 자동으로 실리지 않고, 실패가 세션을 건드리지 않는다. */
const PUBLIC_PATHS = ['/api/auth/sign-in', '/api/auth/reissue', '/api/auth/sign-out'];
export const REISSUE_PATH = '/api/auth/reissue';

/** 재발급 응답 data에서 access 토큰을 읽는다. 없으면 계약 불일치(contract)다. */
function readAccessToken(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'accessToken' in data && typeof data.accessToken === 'string' && data.accessToken !== '')
    return data.accessToken;
  throw new RequestFailure({ kind: 'contract', status: 200 });
}

export const session = createSession<Credentials>({
  store,
  // refresh 토큰은 httpOnly 쿠키(서버 계약)라 본문이 없다. 공개 요청으로 보낸다.
  reissue: async () => ({ accessToken: readAccessToken(await http.request<unknown>({ url: REISSUE_PATH, method: 'POST' })) }),
  // 로그아웃·유휴 종료 뒤 키트가 잡아 둔 토큰으로 한 번 보낸다. 실패해도 로컬 종료는 그대로다.
  signOut: (credentials) => signOut(credentials.accessToken),
});

/** 이 프로젝트의 응답 봉투와 코드 의미를 공통 성공·실패로 바꾼다. */
const readAppResponse: ResponseContract['read'] = (body, status, requestId) =>
  status >= 200 && status < 300
    ? readEnvelope(body, resultCodes, requestId)
    : { ok: false, failure: toRequestFailure({ type: 'response', body, status, requestId }, resultCodes) };

export const http: Http = createHttp({
  session,
  response: { read: readAppResponse },
  isPublic: (config) => PUBLIC_PATHS.some((path) => config.url === path),
  // 운영 헤더: 화면 언어.
  prepare: (headers) => {
    headers.set('Accept-Language', i18n.language);
  },
  defaults: {
    baseURL: env.VITE_API_BASE_URL,
    timeout: env.VITE_API_TIMEOUT_MS,
    // Content-Type은 고정하지 않는다. axios가 본문으로 정한다(객체 → JSON, FormData → multipart). 고정하면 파일 업로드가 JSON으로 바뀐다.
  },
});

/** orval mutator. 생성된 endpoint 함수는 모두 이 함수(= http.request)로 나간다. */
export const apiRequest = <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<Unwrapped<T>> =>
  http.request<T>(config, options);

export const queryClient = createQueryClient({
  session,
  retry: 2,
  queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  // 알림 예시: 화면이 자기 자리에 보이는 실패(목록·상세·폼)와 겹치지 않게, 권한 거절만 전역 안내로 띄운다.
  notify: (failure) => {
    if (isRequestFailure(failure) && failure.kind === 'forbidden') notices.push('failure.kind.forbidden');
  },
});
