// 파일 책임: 업무 화면의 mock handler와 그 mock 상태를 mock 서버에 잇는 한 곳. 업무를 더하면 여기에 handler와 상태를 더한다.
// 이 검사 앱은 키트 예시 업무(상품·회원·약관·공연·작성 예제)를 잇는다. pnpm starter:create로 만든 새 프로젝트는 빈 목록에서 시작한다.
import type { HttpHandler } from 'msw';
import { exampleDb } from './examples/example-db';
import { exampleHandlers } from './examples/example-handlers';
import type { FeatureMockState } from './server-state';

export const featureHandlers: readonly HttpHandler[] = exampleHandlers;
export const featureMockStates: readonly FeatureMockState[] = [exampleDb];
