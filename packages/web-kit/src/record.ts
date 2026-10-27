// 파일 책임: 상세·수정 원본 단건 조회를 네 내용 상태(대기·없음·실패·준비됨)로 판정한다. 화면은 다시 판정하지 않는다.
import { keepPreviousData, useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { isRequestFailure, type RequestFailure } from './failure';

/** 준비됨에만 딸리는 갱신 사실. 갱신 실패는 내용을 지우지 않는다. */
export interface RecordRefresh {
  readonly refreshing: boolean;
  /** 마지막 재조회 실패. 없으면 undefined. */
  readonly failure: unknown;
  readonly retry: () => void;
}

export type RecordState<T> =
  | { readonly kind: 'pending' }
  /**
   * 확인된 not-found 또는 이 레코드 조회 자체의 forbidden. 표시 방식은 프로젝트가 failure.kind로 정한다.
   * wasReady: 이 화면에서 이 식별의 내용이 한 번이라도 준비됐었나(false면 진입 때 없음). 어디에 보일지는 프로젝트가 정한다.
   */
  | { readonly kind: 'missing'; readonly failure: RequestFailure; readonly wasReady: boolean }
  | { readonly kind: 'failed'; readonly failure: unknown; readonly retry: () => void }
  | { readonly kind: 'ready'; readonly data: T; readonly refresh: RecordRefresh };

/** 이 조회의 실패가 내용을 숨겨야 하는 확인된 사실인가. */
function hidesContent(error: unknown): error is RequestFailure {
  return isRequestFailure(error) && (error.kind === 'not-found' || error.kind === 'forbidden');
}

/** 취소는 실패가 아니다(화면 이탈·새 실행·세션 전환). */
function failureOf(error: unknown): unknown {
  return isRequestFailure(error) && error.kind === 'cancelled' ? undefined : (error ?? undefined);
}

/**
 * 단건 조회를 판정한다. identity는 레코드 식별이고, queryKey의 나머지(언어 등)와 구분한다.
 * 식별이 바뀌면 이전 내용을 보이지 않는다. 식별이 같고 key만 바뀌면 내용을 유지한 채 갱신 중으로 둔다.
 * 숨김 근거는 이 조회의 실패뿐이다. 다른 요청(보조 선택지·저장)의 실패는 여기에 들어오지 않는다.
 */
export function useRecord<TQueryFnData, TError = unknown, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  identity: unknown,
): RecordState<TData> {
  // 내용이 마지막으로 준비됐던 식별. 이 화면에서 이 식별의 내용이 준비된 적이 있는가를 이것 하나로 본다.
  const readyFor = useRef<{ readonly identity: unknown } | undefined>(undefined);
  const wasReady = readyFor.current !== undefined && Object.is(readyFor.current.identity, identity);
  const query = useQuery({
    ...options,
    // 마지막으로 준비된 내용이 같은 식별일 때만(언어 등 key의 나머지만 바뀜) 이전 내용을 이어 보인다.
    // 다른 식별의 내용은 다시 그려져도 보이지 않는다. 화면이 넘긴 값은 쓰지 않는다.
    placeholderData: wasReady ? keepPreviousData : undefined,
  });
  const hasData = query.data !== undefined && !query.isPlaceholderData;
  useEffect(() => {
    if (hasData) readyFor.current = { identity };
  }, [hasData, identity]);
  const retry = () => {
    void query.refetch();
  };
  if (hidesContent(query.error)) return { kind: 'missing', failure: query.error, wasReady: wasReady || hasData };
  const failure = failureOf(query.error);
  if (query.data !== undefined) return { kind: 'ready', data: query.data, refresh: { refreshing: query.isFetching, failure, retry } };
  if (failure !== undefined) return { kind: 'failed', failure, retry };
  return { kind: 'pending' };
}

export { maskText } from './masking';
