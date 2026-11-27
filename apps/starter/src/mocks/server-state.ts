// 파일 책임: mock 서버 전체 상태(인증 + 업무 mock 상태)를 한 번에 되돌리고 저장·복원한다. 테스트 준비와 브라우저 mock이 쓴다.
import { mockDb, type MockAuthSnapshot } from './db';
import { featureMockStates } from './feature-mocks';

/** 업무 mock 상태 하나: 테스트마다 처음으로 되돌리고, 브라우저 mock이 새로 고침 뒤에도 같은 서버로 보이게 저장·복원한다. */
export interface FeatureMockState {
  reset(): void;
  snapshot(): unknown;
  restore(snapshot: never): void;
}

/** 브라우저 mock이 localStorage에 두는 모양. 업무 상태는 featureMockStates 순서대로다. */
export interface MockServerSnapshot {
  readonly auth: MockAuthSnapshot;
  readonly features: unknown[];
}

export const mockServerState = {
  reset() {
    mockDb.reset();
    for (const state of featureMockStates) state.reset();
  },
  snapshot(): MockServerSnapshot {
    return { auth: mockDb.snapshot(), features: featureMockStates.map((state) => state.snapshot()) };
  },
  restore(snapshot: MockServerSnapshot) {
    // 저장한 뒤 업무 목록이 바뀌었으면(모양이 다르면) 처음 상태로 둔다.
    if (snapshot.features?.length !== featureMockStates.length) throw new Error('mock 상태 모양이 바뀌었습니다');
    mockDb.restore(snapshot.auth);
    featureMockStates.forEach((state, index) => state.restore(snapshot.features[index] as never));
  },
};
