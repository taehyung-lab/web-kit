// 파일 책임: meta.sensitive로 선언한 쓰기의 입력값 기록이, 화면(쓰기를 지켜보는 구독)이 열려 있어도 끝난 뒤 보관소에서 사라지는지,
// 그동안 오류 전달·화면 상태·다시 시도가 그대로인지 검사한다.
import { MutationObserver, type MutationCache, type QueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../src/query';
import { createSession, type SessionStore, type StoredSession } from '../src/session';

const SECRET = 'p@ssw0rd-example';
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function session() {
  let value: StoredSession<{ accessToken: string }> | null = null;
  const store: SessionStore<{ accessToken: string }> = {
    read: () => value,
    write: (next) => {
      value = next;
    },
    subscribe: () => () => undefined,
  };
  const created = createSession({ store, reissue: vi.fn() });
  created.start({ accessToken: 't' });
  return created;
}

const clients: QueryClient[] = [];
function client() {
  const queryClient = createQueryClient({ session: session(), retry: 0 });
  clients.push(queryClient);
  return queryClient;
}
afterEach(() => {
  clients.splice(0).forEach((queryClient) => queryClient.clear());
});

/** 보관소에 남은 쓰기 중 입력값에 비밀번호가 든 것. */
function recordsWithSecret(cache: MutationCache) {
  return cache.getAll().filter((mutation) => JSON.stringify(mutation.state.variables ?? null).includes(SECRET));
}

/** 화면이 열려 있는 상태: 쓰기를 지켜보는 구독이 붙어 있다. */
function openScreen<TData, TError, TVariables>(queryClient: QueryClient, options: UseMutationOptions<TData, TError, TVariables>) {
  const observer = new MutationObserver<TData, TError, TVariables>(queryClient, options);
  observer.subscribe(() => undefined);
  return observer;
}

describe('meta.sensitive 쓰기: 화면을 열어 둔 채', () => {
  it('성공하면 입력값 기록이 보관소에서 사라지고 화면의 성공 상태는 그대로다', async () => {
    const queryClient = client();
    const observer = openScreen(queryClient, { meta: { sensitive: true }, mutationFn: async (_: { password: string }) => 'ok' });

    await observer.mutate({ password: SECRET });
    await tick();

    expect(recordsWithSecret(queryClient.getMutationCache())).toHaveLength(0);
    expect(observer.getCurrentResult().isSuccess).toBe(true);
  });

  it('실패하면 오류는 호출한 쪽에 그대로 던져지고, 기록은 사라지며, 화면의 오류 상태는 남는다', async () => {
    const queryClient = client();
    const observer = openScreen(queryClient, {
      meta: { sensitive: true },
      mutationFn: async (_: { password: string }) => {
        throw new Error('boom');
      },
    });

    await expect(observer.mutate({ password: SECRET })).rejects.toThrow('boom');
    await tick();

    expect(recordsWithSecret(queryClient.getMutationCache())).toHaveLength(0);
    expect((observer.getCurrentResult().error as Error | null)?.message).toBe('boom');
  });

  it('실패한 뒤 다시 시도하면 새 쓰기가 성공하고 그 기록도 사라진다', async () => {
    const queryClient = client();
    let attempt = 0;
    const observer = openScreen(queryClient, {
      meta: { sensitive: true },
      mutationFn: async (_: { password: string }) => {
        attempt += 1;
        if (attempt === 1) throw new Error('first failed');
        return 'ok';
      },
    });

    await expect(observer.mutate({ password: SECRET })).rejects.toThrow('first failed');
    await tick();
    await expect(observer.mutate({ password: SECRET })).resolves.toBe('ok');
    await tick();

    expect(recordsWithSecret(queryClient.getMutationCache())).toHaveLength(0);
  });

  it('보내는 동안에는 기록이 있고, 끝나면 사라진다', async () => {
    const queryClient = client();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const observer = openScreen(queryClient, { meta: { sensitive: true }, mutationFn: async (_: { password: string }) => gate });

    const pending = observer.mutate({ password: SECRET });
    await tick();
    expect(recordsWithSecret(queryClient.getMutationCache())).toHaveLength(1);

    release();
    await pending;
    await tick();
    expect(recordsWithSecret(queryClient.getMutationCache())).toHaveLength(0);
  });

  it('invalidates와 함께 선언해도 무효화는 그대로 실행된다', async () => {
    const queryClient = client();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const observer = openScreen(queryClient, {
      meta: { sensitive: true, invalidates: [['things']] },
      mutationFn: async (_: { password: string }) => {
        throw Object.assign(new Error('unknown'), {});
      },
    });
    await observer.mutate({ password: SECRET }).catch(() => undefined);
    await tick();
    expect(invalidate).not.toHaveBeenCalled(); // 일반 오류는 무효화 대상이 아니다(resultUnknown일 때만)
    const ok = openScreen(queryClient, { meta: { sensitive: true, invalidates: [['things']] }, mutationFn: async (_: { password: string }) => 'ok' });
    await ok.mutate({ password: SECRET });
    await tick();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['things'] });
    expect(recordsWithSecret(queryClient.getMutationCache())).toHaveLength(0);
  });
});

describe('선언하지 않은 쓰기와 gcTime 0만의 한계(대조)', () => {
  it('선언하지 않은 쓰기의 기록은 지우지 않는다(범위는 선언한 쓰기뿐)', async () => {
    const queryClient = client();
    const observer = openScreen(queryClient, { mutationFn: async (_: { password: string }) => 'ok' });

    await observer.mutate({ password: SECRET });
    await tick();

    expect(recordsWithSecret(queryClient.getMutationCache())).toHaveLength(1);
  });

  it('gcTime: 0만으로는 화면이 열려 있는 동안 기록이 남는다 — 그래서 끝난 쓰기를 직접 지운다', async () => {
    const queryClient = client();
    const observer = openScreen(queryClient, { gcTime: 0, mutationFn: async (_: { password: string }) => 'ok' });

    await observer.mutate({ password: SECRET });
    await tick();

    expect(recordsWithSecret(queryClient.getMutationCache())).toHaveLength(1);
  });
});
