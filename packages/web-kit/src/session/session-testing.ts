// 파일 책임: 소비 프로젝트의 저장 adapter가 저장 실패·다른 탭 변경에서도 세션을 과거 값으로 되돌리지 않는지 공개 세션 동작으로 검사한다.
import { createSession, type Credentials, type SessionStore, type StoredSession } from './session';

/** 실제 adapter를 격리된 저장소에 연결한 검사 환경. 운영 저장소나 실제 자격증명을 사용하지 않는다. */
export interface SessionStoreAdapterFixture<C extends Credentials = Credentials> {
  readonly store: SessionStore<C>;
  /** 지정한 합성 토큰에 프로젝트가 요구하는 필수 필드까지 채운다. 실제 자격증명은 넣지 않는다. */
  readonly credentials: (accessToken: string) => C;
  /** 이 탭의 이후 영속 저장/삭제만 실패시키며, adapter의 메모리 처리는 그대로 둔다. */
  readonly failWrites: () => void;
  /** 다른 탭의 성공한 저장(또는 삭제)과 그 알림을 함께 재현한다. 이 탭의 failWrites와 독립이다. */
  readonly externalWrite: (value: StoredSession<C> | null) => void;
  /** 구독과 가짜 저장소를 정리한다. 검사 실패 때도 호출된다. */
  readonly dispose: () => void;
}

/** 토큰 원문을 오류 메시지에 넣지 않고 검사 조건만 알린다. */
function requireCondition(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[web-kit/testing] SessionStore: ${message}`);
}

/**
 * 빈 저장소에서 시작한다. 저장 실패 뒤 두 번 재발급해 과거 토큰 복귀를 잡고,
 * 다른 탭 변경·삭제와 이 탭 종료 뒤 read 결과·구독 해제를 확인한다.
 * 저장소 읽기 자체가 불가능할 때의 유지/종료 정책, 서버 인증·쿠키 격리는 검사하지 않는다.
 */
export async function checkSessionStoreAdapter<C extends Credentials>(createFixture: () => SessionStoreAdapterFixture<C>): Promise<void> {
  const fixture = createFixture();
  let unsubscribe = () => undefined as void;
  let disposeSession = () => undefined as void;
  try {
    requireCondition(fixture.store.read() === null, 'fixture must start empty');
    let notifications = 0;
    unsubscribe = fixture.store.subscribe(() => {
      notifications += 1;
    });
    let reissues = 0;
    const session = createSession({
      store: fixture.store,
      reissue: async () => fixture.credentials(`web-kit-check-rotation-${++reissues}`),
    });
    disposeSession = session.dispose;
    session.start(fixture.credentials('web-kit-check-initial'));
    const initial = session.current();
    requireCondition(initial !== null, 'start did not create a session');
    requireCondition(fixture.store.read()?.sessionId === initial?.sessionId, 'successful write was not readable');
    requireCondition(notifications === 0, 'local write was reported as an external change');

    fixture.failWrites();
    const generation = session.generation();
    const first = await session.refresh(generation, 'web-kit-check-initial');
    const second = await session.refresh(generation, first);
    requireCondition(reissues === 2 && first !== second, 'failed write made refresh reuse stale credentials');
    requireCondition(session.current()?.credentials.accessToken === second, 'refresh did not keep its latest result');

    const rotation: StoredSession<C> = {
      sessionId: initial!.sessionId,
      credentials: fixture.credentials('web-kit-check-external-rotation'),
    };
    fixture.externalWrite(rotation);
    requireCondition(
      session.current()?.credentials.accessToken === rotation.credentials.accessToken,
      'external write was ignored or changed',
    );
    requireCondition(session.generation() === generation, 'external rotation changed the session generation');
    requireCondition(notifications === 1, 'external rotation must notify once');

    const external: StoredSession<C> = {
      sessionId: 'web-kit-check-other-session',
      credentials: fixture.credentials('web-kit-check-other-token'),
    };
    fixture.externalWrite(external);
    requireCondition(
      session.current()?.sessionId === external.sessionId &&
        session.current()?.credentials.accessToken === external.credentials.accessToken,
      'external write was ignored or changed after a failed local write',
    );
    requireCondition(notifications === 2, 'external write must notify once');
    session.end();
    requireCondition(session.current() === null && fixture.store.read() === null, 'failed deletion revived an ended session');
    requireCondition(notifications === 2, 'local end was reported as an external change');

    fixture.externalWrite(external);
    fixture.externalWrite(null);
    requireCondition(session.current() === null && fixture.store.read() === null, 'external deletion was ignored');
    requireCondition(notifications === 4, 'external changes must each notify once');
    unsubscribe();
    unsubscribe = () => undefined;
    fixture.externalWrite(external);
    requireCondition(notifications === 4, 'unsubscribed listener was called');
  } finally {
    try {
      unsubscribe();
      disposeSession();
    } finally {
      fixture.dispose();
    }
  }
}
