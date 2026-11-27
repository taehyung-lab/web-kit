// 파일 책임: openapi/sample.json 계약을 흉내 내는 msw handler 목록. 인증(로그인·재발급·로그아웃)은 여기, 업무 화면의 handler는 feature-mocks가 잇는다.
import { http } from 'msw';
import { mockDb } from './db';
import { featureHandlers } from './feature-mocks';
import { API, bearer, envelope, latency, ok } from './respond';

export const handlers = [
  http.post(`${API}/auth/sign-in`, async ({ request }) => {
    await latency();
    const body = (await request.json()) as { loginId?: string; password?: string };
    if (body.loginId !== 'admin' || body.password !== 'password') return envelope(401, 4011, 'Bad credentials', null);
    return ok({ accessToken: mockDb.issueToken() });
  }),

  http.post(`${API}/auth/reissue`, async () => {
    await latency();
    if (!mockDb.refreshValid) return envelope(401, 4013, 'Refresh token expired', null);
    return ok({ accessToken: mockDb.issueToken() });
  }),

  http.post(`${API}/auth/sign-out`, ({ request }) => {
    const token = bearer(request);
    if (token !== undefined) mockDb.revokeToken(token);
    mockDb.refreshValid = false;
    return ok(null);
  }),

  ...featureHandlers,
];
