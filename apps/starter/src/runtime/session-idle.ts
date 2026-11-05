// 파일 책임: 소비 검사에서 프로젝트가 고른 연장 요청·헤더와 키트 타이머를 연결한다. 실제 서버 정책의 기본값은 두지 않는다.
import { createIdleTimer, type IdlePolicy, type ServerTimeSample } from '@boosterlab/web-kit/session/idle';
import type { Http, HttpResponse } from '@boosterlab/web-kit/http';
import type { Credentials, Session } from '@boosterlab/web-kit/session';
import type { AxiosRequestConfig } from 'axios';

/** 자기 요청 응답의 마감을 전역 변수 없이 돌려준다. 운영에 붙일 때 요청 경로와 헤더 계약을 프로젝트가 제공한다. */
export function createStarterIdle({ session, http, key, policy, request, sample }: {
  readonly session: Session<Credentials>;
  readonly http: Http;
  readonly key: string;
  readonly policy: IdlePolicy;
  readonly request: AxiosRequestConfig;
  readonly sample: (response: HttpResponse<unknown>) => ServerTimeSample | null;
}) {
  return createIdleTimer({
    session, key, policy,
    extend: async () => sample(await http.requestWithResponse(request)),
  });
}
