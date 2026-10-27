// 파일 책임: 저장 adapter 검사가 정상 구현은 통과시키고 과거 토큰 복귀·외부 변경 누락·종료 복구를 실제로 잡는지 확인한다.
import { describe, expect, it, vi } from 'vitest';
import { checkSessionStoreAdapter, type SessionStoreAdapterFixture } from '@boosterlab/web-kit/testing/session';
import type { Credentials, StoredSession } from '../src/session';

type Defect = 'stale-read' | 'ignore-external' | 'wrong-external-token' | 'revive-ended' | 'local-notification' | 'unsubscribe';

/** 영속 저장과 논리 값을 분리한 대역. defect는 검사 자체가 위반을 잡는지 확인하는 반례다. */
function fixture<C extends Credentials>(credentials: (accessToken: string) => C, defect?: Defect): SessionStoreAdapterFixture<C> {
  type Value = StoredSession<C> | null;
  let persisted: Value = null;
  let memory: Value = null;
  let failed = false;
  let behind = false;
  const listeners = new Set<(value: Value) => void>();
  return {
    credentials,
    store: {
      read: () => (defect === 'stale-read' || (defect === 'revive-ended' && memory === null) ? persisted : behind ? memory : persisted),
      write: (value) => {
        memory = value;
        behind = failed;
        if (!failed) persisted = value;
        if (defect === 'local-notification') for (const listener of listeners) listener(value);
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          if (defect !== 'unsubscribe') listeners.delete(listener);
        };
      },
    },
    failWrites: () => {
      failed = true;
    },
    externalWrite: (value) => {
      persisted = value;
      if (defect === 'ignore-external') return;
      behind = false;
      memory = value;
      for (const listener of listeners)
        listener(
          defect === 'wrong-external-token' && value !== null
            ? { ...value, credentials: { ...value.credentials, accessToken: 'synthetic-wrong' } }
            : value,
        );
    },
    dispose: () => listeners.clear(),
  };
}

describe('SessionStore adapter 검사', () => {
  it('저장 실패 때 최신 값을 유지하고 다른 탭의 실제 변경을 따르는 adapter는 통과한다', async () => {
    await expect(checkSessionStoreAdapter(() => fixture((accessToken) => ({ accessToken })))).resolves.toBeUndefined();
  });

  it('프로젝트 필수 자격 필드를 가진 실제 타입을 변환 없이 검사한다', async () => {
    const credentials = vi.fn((accessToken: string) => ({ accessToken, loginId: 'synthetic-user' }));
    const setup = fixture(credentials);
    const write = vi.fn(setup.store.write);
    await checkSessionStoreAdapter(() => ({ ...setup, store: { ...setup.store, write } }));
    expect(write.mock.calls.filter(([value]) => value !== null).map(([value]) => value?.credentials.loginId)).toEqual([
      'synthetic-user',
      'synthetic-user',
      'synthetic-user',
    ]);
  });

  it.each([
    ['stale-read', 'stale credentials'],
    ['ignore-external', 'external write was ignored'],
    ['wrong-external-token', 'external write was ignored or changed'],
    ['revive-ended', 'revived an ended session'],
    ['local-notification', 'local write'],
    ['unsubscribe', 'unsubscribed listener'],
  ] as const)('%s 위반을 거절한다', async (defect, message) => {
    await expect(checkSessionStoreAdapter(() => fixture((accessToken) => ({ accessToken }), defect))).rejects.toThrow(message);
  });

  it('위반으로 중단되어도 검사 환경을 정리한다', async () => {
    const setup = fixture((accessToken) => ({ accessToken }), 'stale-read');
    const dispose = vi.fn(setup.dispose);
    await expect(checkSessionStoreAdapter(() => ({ ...setup, dispose }))).rejects.toThrow();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
