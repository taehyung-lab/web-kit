// 파일 책임: 실행 수명. 요청 하나의 결과를 누구에게 전달할지 정한다.
//  - 화면에 그려지는 것(조회 결과·확인창·완료 처리·오류 표시)은 그 요청을 시작한 **방문**의 것이다. 방문이 바뀌면 전달하지 않는다.
//  - 사용자가 시킨 일(쓰기·파일)의 결과는 시작한 **로그인**의 것이다. 방문이 바뀌어도 실패를 앱에 한 번 알린다(here: false).
// 키트는 "방문이 무엇인지"(주소·탭·창)와 "실패를 어떻게 보일지"(창·토스트·문구)를 모른다. 앱이 leave·arrive로 방문을 알리고,
// onFailure로 실패 하나를 직접 맡을지('handled') 그 자리에 둘지('local') 답한다. 연결하지 않으면 방문은 바뀌지 않고 실패는 그 자리에 남는다.
import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { isRequestFailure } from './failure';

/** 수명이 조회 보관소에서 쓰는 만큼의 모양. 폼만 쓰는 소비자가 조회 라이브러리를 끌어오지 않도록 타입을 직접 적는다(TanStack QueryClient가 맞는다). */
interface LifetimeQuery {
  readonly state: { readonly fetchStatus: string; readonly status: string };
  readonly meta?: Record<string, unknown>;
  readonly isActive: () => boolean;
  readonly cancel: (options: { revert: boolean }) => Promise<unknown>;
  readonly reset: () => void;
}
interface LifetimeQueryClient {
  getQueryCache(): {
    subscribe(listener: (event: { readonly type: string; readonly query: LifetimeQuery; readonly action?: { readonly type: string; readonly error?: unknown } }) => void): unknown;
    getAll(): LifetimeQuery[];
  };
  refetchQueries(filters: { predicate: (query: LifetimeQuery) => boolean; type: 'active' }): Promise<unknown>;
}

/**
 * 실패가 난 자리. page는 화면 본문 조회(`progress: 'page'`로 선언한 목록·단건), detail은 그 밖의 조회(선택지 등),
 * action은 저장·확인창 실행·목록 일괄 작업, download는 목록 다운로드다.
 */
export type FailurePlace = 'page' | 'detail' | 'action' | 'download';

export interface FailureReport {
  readonly place: FailurePlace;
  /** 이 실패를 시작한 화면이 지금도 보이는가. false면 화면은 이미 떠났고 그 자리에 보일 곳이 없다. */
  readonly here: boolean;
}

/** handled: 앱이 직접 알렸다(그 자리에 다시 그리지 않는다). local: 그 자리의 기본 표시에 맡긴다. */
export type FailureAnswer = 'handled' | 'local';

/** 실행 한 건. 시작한 방문과 로그인을 기억한다. */
export interface Execution {
  /** 시작한 방문이 지금 방문이고 로그인도 그대로인가. */
  readonly here: () => boolean;
  /**
   * 실패를 앱에 알린다. shown은 이 자리가 지금도 실패를 보일 수 있는가(부품이 살아 있고 대상이 같음)다.
   * 'handled'면 이 자리에 그리지 않는다. 화면을 떠났으면(here가 거짓) 앱에 알린 뒤 항상 'handled'다.
   * 취소와 이전 로그인의 실패는 앱에 알리지 않는다.
   */
  readonly fail: (failure: unknown, shown: boolean) => FailureAnswer;
}

export interface Lifetime {
  /** 앱: 방문이 끝나기 시작했다(승인된 주소 변경의 시작). 거부된 이탈에는 부르지 않는다. */
  readonly leave: () => void;
  /** 앱: 새 방문의 화면이 자리 잡았다. */
  readonly arrive: () => void;
  /** 지금 방문 번호. 방문이 바뀔 때마다 달라진다. */
  readonly visit: () => number;
  /** 방문이 바뀌면 부른다. */
  readonly subscribe: (listener: () => void) => () => void;
  readonly begin: (place: FailurePlace) => Execution;
  /** 앱이 직접 알린 실패인가. 실패 문구를 고르는 자리가 다시 그리지 않으려고 묻는다. */
  readonly isHandled: (failure: unknown) => boolean;
}

/** 본문 조회 표시. `progress: 'page'`로 선언한 useList·useRecord가 조회 meta에 붙인다. */
export const PAGE_QUERY_META = { lifetimePlace: 'page' } as const;

function isCancelled(failure: unknown): boolean {
  return isRequestFailure(failure) && failure.kind === 'cancelled';
}

/**
 * 실행 수명 하나를 만든다. 앱 조립에서 한 번 만들어 `LifetimeProvider`로 내려 주고, router의 주소 변경에 leave·arrive를 연결한다.
 * session을 주면 로그인한 상태에서 시작한 실행이 로그인이 끝나거나 바뀐 뒤 끝났을 때 어디에도 전달하지 않는다. queryClient를 주면 조회 결과도 방문을 따른다:
 * 방문이 바뀌면 이전 방문의 진행 중 조회를 취소하고 오류 상태를 지우며, 새 화면이 자리 잡으면 그 가운데 필요한 것만 다시 받는다.
 */
export function createLifetime({
  session,
  queryClient,
  onFailure,
}: {
  readonly session?: { readonly generation: () => number; readonly current: () => unknown };
  readonly queryClient?: LifetimeQueryClient;
  readonly onFailure?: (failure: unknown, report: FailureReport) => FailureAnswer;
} = {}): Lifetime {
  let visit = 0;
  let settled = true;
  const listeners = new Set<() => void>();
  const handled = new WeakSet<object>();
  /** 지금 로그인. 로그인하지 않았으면 undefined다. */
  const login = () => (session === undefined || session.current() === null ? undefined : session.generation());

  function report(failure: unknown, place: FailurePlace, here: boolean): FailureAnswer {
    const answer = onFailure?.(failure, { place, here }) ?? 'local';
    if (answer === 'handled' && typeof failure === 'object' && failure !== null) handled.add(failure);
    return here ? answer : 'handled';
  }

  // ── 조회 결과와 방문 ──
  /** 조회 실행(queryFn 한 번)을 시작한 방문. */
  const fetchVisit = new WeakMap<LifetimeQuery, number>();
  let leftBehind = new Set<LifetimeQuery>();
  queryClient?.getQueryCache().subscribe((event) => {
    const { query, action } = event;
    if (event.type !== 'updated' || action === undefined) return;
    if (action.type === 'fetch') fetchVisit.set(query, visit);
    // 지금 화면이 쓰는 조회가 이 방문에서 시작해 이 방문에서 실패한 것만 알린다.
    // 이동 중(새 화면이 자리 잡기 전)에 끝난 실패는 떠나는 화면의 것이다. 새 화면이 그 조회를 쓰면 다시 받아 그 응답으로 판정한다.
    if (action.type !== 'error' || isCancelled(action.error)) return;
    if (!query.isActive() || !settled || fetchVisit.get(query) !== visit) return;
    report(action.error, query.meta?.['lifetimePlace'] === 'page' ? 'page' : 'detail', true);
  });

  return {
    leave() {
      visit += 1;
      settled = false;
      if (queryClient !== undefined) {
        leftBehind = new Set(
          queryClient
            .getQueryCache()
            .getAll()
            .filter((query) => fetchVisit.get(query) !== visit)
            .filter((query) => query.state.fetchStatus !== 'idle' || query.state.status === 'error'),
        );
        for (const query of leftBehind) {
          // 진행 중이거나 연결을 기다리는 실행은 취소한다. 이어지면 이전 방문의 결과가 새 방문의 결과가 된다.
          if (query.state.fetchStatus !== 'idle') void query.cancel({ revert: true });
          else query.reset();
        }
      }
      for (const listener of [...listeners]) listener();
    },
    arrive() {
      settled = true;
      const waiting = leftBehind;
      leftBehind = new Set();
      // 떠날 때 정리한 조회 가운데 새 화면이 쓰는데 아무도 받고 있지 않은 것만 다시 받는다(같은 부품이 이어 쓰이는 경우).
      if (waiting.size > 0)
        void queryClient?.refetchQueries({
          predicate: (query) => waiting.has(query) && query.state.fetchStatus === 'idle',
          type: 'active',
        });
    },
    visit: () => visit,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    begin(place) {
      const startedVisit = visit;
      const startedLogin = login();
      // 로그인 없이 시작한 실행(로그인 화면의 요청)은 그 실행이 세션을 여는 것이라 로그인으로 가르지 않는다.
      const sameLogin = () => startedLogin === undefined || login() === startedLogin;
      const here = () => visit === startedVisit && sameLogin();
      return {
        here,
        fail(failure, shown) {
          if (isCancelled(failure)) return 'local';
          // 로그인이 바뀌었으면 받을 사람이 없다. 어디에도 전달하지 않는다.
          if (!sameLogin()) return 'handled';
          return report(failure, place, shown && here());
        },
      };
    },
    isHandled: (failure) => typeof failure === 'object' && failure !== null && handled.has(failure),
  };
}

/** 연결하지 않은 앱의 수명: 방문은 바뀌지 않고 실패는 그 자리에 남는다(이전 동작). */
const detached = createLifetime();
const LifetimeContext = createContext<Lifetime>(detached);

/** 앱 조립에 한 번 둔다. 이 아래의 키트 hook(저장 폼·확인창·목록·다운로드·단건)이 이 수명을 따른다. */
export function LifetimeProvider({ lifetime, children }: { readonly lifetime: Lifetime; readonly children: ReactNode }) {
  return createElement(LifetimeContext.Provider, { value: lifetime }, children);
}

export function useLifetime(): Lifetime {
  return useContext(LifetimeContext);
}

/** 지금 방문 번호. 방문이 바뀌면 다시 그린다. 화면에 열어 둔 안내를 방문과 함께 닫을 때 쓴다. */
export function useVisit(): number {
  const lifetime = useLifetime();
  return useSyncExternalStore(lifetime.subscribe, lifetime.visit, lifetime.visit);
}
