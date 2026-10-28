// 파일 책임: TanStack QueryClient를 키트 규칙(재시도 대상·실패 알림 한 번·선언한 무효화·세션 전환 시 비움)으로 만든다.
import {
  MutationCache,
  QueryCache,
  QueryClient,
  type DefaultOptions,
  type Mutation,
  type Query,
  type QueryKey,
} from '@tanstack/react-query';
import { isRequestFailure, type FailureKind } from './failure';
import type { Credentials, Session } from './session';

/** 자동 재시도 대상. 나머지(429·contract 포함)는 자동 재시도하지 않는다. */
const RETRYABLE: ReadonlySet<FailureKind> = new Set(['network', 'timeout', 'server-error']);

/** 알림의 출처. 무엇을 어디에 보일지는 프로젝트가 출처로 고른다. */
export type FailureSource =
  | { readonly kind: 'query'; readonly query: Query<unknown, unknown, unknown> }
  | { readonly kind: 'mutation'; readonly mutation: Mutation<unknown, unknown, unknown> };

/**
 * mutation meta에 선언한다: `meta: { invalidates: [key, …] }`.
 * `sensitive: true`는 비밀번호처럼 보관하면 안 되는 입력값이 든 쓰기다. 성공이든 실패든 끝나면 요청 보관소의 기록을 지운다.
 */
export interface WriteMeta {
  readonly invalidates?: readonly QueryKey[];
  readonly sensitive?: boolean;
}

function invalidatesOf(mutation: Mutation<unknown, unknown, unknown>): readonly QueryKey[] {
  return ((mutation.options.meta ?? {}) as WriteMeta).invalidates ?? [];
}

function isCancelled(error: unknown): boolean {
  return isRequestFailure(error) && error.kind === 'cancelled';
}

/**
 * QueryClient를 만든다. retry는 조회 자동 재시도 횟수(프로젝트 값). notify는 조회·쓰기의 최종 실패를 출처와 함께
 * 한 번 받는 단일 통로다(취소·이전 세션의 쓰기 제외). 표시 방식·대상 선별·화면과의 중복 회피는 프로젝트가 정한다.
 */
export function createQueryClient<C extends Credentials>({
  session,
  retry,
  notify,
  queries,
}: {
  readonly session: Session<C>;
  readonly retry: number;
  readonly notify?: (failure: unknown, source: FailureSource) => void;
  /** staleTime·retryDelay 등 프로젝트 수치. retry는 위 규칙이 정한다. */
  readonly queries?: Omit<NonNullable<DefaultOptions['queries']>, 'retry'>;
}): QueryClient {
  const startedIn = new WeakMap<object, number>();

  /** 쓰기를 시작한 세션에서만 후속 효과를 낸다: 실패 알림, 그리고 성공·반영 여부 미확정일 때 선언한 무효화. */
  function afterWrite(mutation: Mutation<unknown, unknown, unknown>, error: unknown) {
    if (startedIn.get(mutation) !== session.generation()) return;
    if (error !== undefined && !isCancelled(error)) notify?.(error, { kind: 'mutation', mutation });
    if (error !== undefined && !(isRequestFailure(error) && error.resultUnknown)) return;
    for (const queryKey of invalidatesOf(mutation)) void queryClient.invalidateQueries({ queryKey });
  }

  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (!isCancelled(error)) notify?.(error, { kind: 'query', query });
      },
    }),
    mutationCache: new MutationCache({
      onMutate: (_variables, mutation) => {
        startedIn.set(mutation, session.generation());
      },
      onSuccess: (_data, _variables, _result, mutation) => afterWrite(mutation, undefined),
      onError: (error, _variables, _result, mutation) => afterWrite(mutation, error),
    }),
    defaultOptions: {
      queries: {
        ...queries,
        retry: (failureCount, error) =>
          failureCount < retry && isRequestFailure(error) && RETRYABLE.has(error.kind),
      },
      mutations: { retry: false },
    },
  });

  // meta.sensitive 쓰기는 끝나면 보관소에서 입력값 기록을 지운다. gcTime 0은 화면이 쓰기를 지켜보는 동안 지우지 않아 직접 지운다.
  const writes = queryClient.getMutationCache();
  writes.subscribe((event) => {
    if (event.type !== 'updated' || (event.mutation.options.meta as WriteMeta | undefined)?.sensitive !== true) return;
    if (event.action.type !== 'success' && event.action.type !== 'error') return;
    const { mutation } = event;
    // 알림·무효화·결과 전달이 입력값을 읽는 일이 끝난 다음에 지우도록 한 틱 미룬다.
    setTimeout(() => writes.remove(mutation), 0);
  });

  // 세션이 바뀌면 이전 세션의 데이터 노출과 결과 반영을 막는다. 서버에서 이미 실행된 쓰기의 취소는 보장하지 않는다.
  // 정리 구독이라 앱의 종료 안내·이동보다 먼저 돈다.
  session.subscribe(() => {
    void queryClient.cancelQueries();
    queryClient.clear();
  }, 'cleanup');
  return queryClient;
}
