// 파일 책임: 목록 다운로드(엑셀 등)의 흐름 — 누른 순간 대상(선택 ID 또는 확정 검색)을 고정하고, 진행 중 재실행을 막고, 실패를 보존한다.
// 무엇을 요청할지(서버 요청 변환)·파일 이름·저장·완료 안내는 소비자의 run이 맡는다.
import { useEffect, useRef, useState } from 'react';
import { useLifetime, useVisit } from '../lifetime';

/**
 * 다운로드 대상. criteria는 마지막으로 확정(조회)한 조건이며 입력만 하고 검색하지 않은 초안은 들어가지 않는다.
 * selected의 ids는 누른 순간의 선택(화면 행 순서)이다. 서버가 선택 다운로드에도 조건을 받으면 criteria를 함께 쓴다.
 */
export type DownloadTarget<S> =
  | { readonly kind: 'selected'; readonly ids: readonly string[]; readonly criteria: S }
  | { readonly kind: 'all'; readonly criteria: S };

export type DownloadKind = DownloadTarget<unknown>['kind'];

/** 다운로드가 읽는 목록 상태(useList 결과의 일부). */
export interface DownloadSource<S> {
  readonly criteria: S;
  readonly isCurrent: boolean;
  readonly selection: { readonly selectedIds: readonly string[] };
}

/** 실행 함수가 받는 진행 도구. */
export interface DownloadStep {
  /**
   * 시작한 로그인이 끝나거나 바뀌면 끊긴다(실행 수명을 연결한 앱). 요청에 넘기고, 받은 파일을 쓰기 직전에도 `signal.aborted`를 확인해
   * 이전 로그인의 파일을 저장하지 않는다. 화면(방문)이 바뀌는 것으로는 끊기지 않는다.
   */
  readonly signal: AbortSignal;
}

/** 다운로드 진행 상태. failed는 다음 시작이나 clear 전까지 남는다. */
export type DownloadState = { readonly kind: 'idle' } | { readonly kind: 'running' } | { readonly kind: 'failed'; readonly failure: unknown };

/** 이 종류를 지금 시작할 수 없는 이유. 없으면 undefined. */
export type DownloadBlock = 'running' | 'stale' | 'no-selection';

/**
 * 목록 하나의 다운로드 흐름. run은 고정된 대상을 받아 파일을 받고 저장까지 끝낸 뒤 resolve한다(실패는 throw).
 * 이전 조건 결과를 보이는 동안(isCurrent 거짓)은 대상이 지금 화면과 달라 시작하지 않는다.
 * 실행 수명(lifetime.ts)을 따른다: 방문이 바뀌어도 실행은 끝까지 가고(받은 파일은 run이 저장한다), 실패는 앱에 알린다.
 * 앱이 직접 알렸거나('handled') 방문이 바뀌었으면 여기 state에 실패를 남기지 않는다. 남아 있던 실패도 방문이 바뀌면 지운다.
 */
export function useListDownload<S>(
  list: DownloadSource<S>,
  options: { readonly run: (target: DownloadTarget<S>, step: DownloadStep) => Promise<void> },
) {
  const [state, setState] = useState<DownloadState>({ kind: 'idle' });
  const lock = useRef(false);
  const mounted = useRef(true);
  const latest = useRef({ list, options });
  latest.current = { list, options };
  const lifetime = useLifetime();
  const visit = useVisit();
  const [seenVisit, setSeenVisit] = useState(visit);
  if (seenVisit !== visit) {
    setSeenVisit(visit);
    if (state.kind === 'failed') setState({ kind: 'idle' });
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** 지금 이 종류를 시작할 수 없는 이유. */
  function blockOf(kind: DownloadKind, source: DownloadSource<S> = list): DownloadBlock | undefined {
    if (lock.current || state.kind === 'running') return 'running';
    if (!source.isCurrent) return 'stale';
    if (kind === 'selected' && source.selection.selectedIds.length === 0) return 'no-selection';
    return undefined;
  }

  /** 누른 순간의 대상으로 실행한다. 시작하지 못하면 false. */
  async function start(kind: DownloadKind): Promise<boolean> {
    const source = latest.current.list;
    if (blockOf(kind, source) !== undefined) return false;
    const target: DownloadTarget<S> =
      kind === 'selected' ? { kind, ids: [...source.selection.selectedIds], criteria: source.criteria } : { kind, criteria: source.criteria };
    lock.current = true;
    setState({ kind: 'running' });
    const execution = lifetime.begin('download');
    const login = new AbortController();
    const stopWatching = execution.onLoginEnd(() => login.abort());
    try {
      await latest.current.options.run(target, { signal: login.signal });
      if (mounted.current) setState({ kind: 'idle' });
      return true;
    } catch (failure) {
      // 이 화면이 아직 그 실패를 보일 수 있는가. 방문이 바뀌었으면 같은 부품이 남아 있어도 새 방문에 실패를 쓰지 않는다.
      const shown = mounted.current && execution.here();
      const answer = execution.fail(failure, shown);
      if (mounted.current) setState(shown && answer !== 'handled' ? { kind: 'failed', failure } : { kind: 'idle' });
      return false;
    } finally {
      stopWatching();
      lock.current = false;
    }
  }

  return {
    state,
    blockOf: (kind: DownloadKind) => blockOf(kind),
    start,
    clear: () => setState((prev) => (prev.kind === 'failed' ? { kind: 'idle' } : prev)),
  };
}
