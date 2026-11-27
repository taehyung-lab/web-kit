// 파일 책임: 업무 화면의 mock handler와 그 mock 상태를 mock 서버에 잇는 한 곳. 업무를 더하면 여기에 handler와 상태를 더한다.
// 아직 업무 화면이 없어 mock 서버는 인증(mocks/handlers.ts)만 답한다.
import type { HttpHandler } from 'msw';
import type { FeatureMockState } from './server-state';

export const featureHandlers: readonly HttpHandler[] = [];
export const featureMockStates: readonly FeatureMockState[] = [];
