// 파일 책임: mock 서버 응답의 공통 모양(Spring 봉투), 브라우저 mock의 응답 지연, 보호 경로의 401 판정. 인증·업무 handler가 함께 쓴다.
import { delay, HttpResponse, type DefaultBodyType } from 'msw';
import { mockDb } from './db';

export const API = '*/api';

/** 브라우저 mock에서만 응답을 조금 늦춰 대기 상태를 볼 수 있게 한다. */
export async function latency() {
  if (typeof window !== 'undefined' && import.meta.env.MODE === 'mock') await delay(mockDb.latencyMs);
}

export function envelope(status: number, resultCode: number, resultMessage: string, data: DefaultBodyType) {
  return HttpResponse.json({ header: { resultCode, resultMessage }, data }, { status });
}
export const ok = (data: DefaultBodyType) => envelope(200, 200, 'OK', data);

export function bearer(request: Request): string | undefined {
  return request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? undefined;
}

/** 보호 경로 공통: 토큰이 없거나 만료면 401. */
export function unauthorized(request: Request) {
  return mockDb.isValidToken(bearer(request)) ? undefined : envelope(401, 4010, 'Access token expired', null);
}
