// 파일 책임: axios 요청 처리(헤더·토큰·봉투 해제·실패 12종 변환·401 재발급 뒤 한 번 재전송·반영 여부)를 소유한다.
// 세션 판정(세대·종료·재발급)은 session이 하고, 여기서는 그 결과만 따른다.
import axios, {
  AxiosHeaders,
  type AxiosRequestConfig,
  type AxiosResponse,
  type CreateAxiosDefaults,
} from 'axios';
import {
  readEnvelope,
  RequestFailure,
  toRequestFailure,
  type ResultCodeTable,
  type TransportOutcome,
} from './failure';
import type { Credentials, Session } from './session';

/**
 * E1(인증 필터가 업무 실행 전에 401로 거절하는가) 전역 전제. 확인 전에는 false다:
 * 쓰기의 401은 재전송하지 않고 반영 여부 미확정으로 돌려준다. 확인되면 이 값 하나만 바꾼다.
 */
const AUTH_REJECTS_BEFORE_EXECUTION = false;

/** 생성 endpoint가 봉투 타입을 넘겨도 호출부는 data를 받는다. */
export type Unwrapped<T> = T extends { readonly data?: infer D } ? Exclude<D, undefined> : T;

/** 전송 시도 하나의 관찰. response가 없으면 서버에 닿지 못했다(network·timeout). */
export interface TransportEvent {
  readonly url: string | undefined;
  readonly method: string;
  /** 보낸 시각(ms). 서버 시각 동기화의 기준이다. */
  readonly sentAt: number;
  readonly response: { readonly status: number; readonly header: (name: string) => string | undefined } | undefined;
}

export interface Http {
  /** 요청 하나. 성공은 봉투를 푼 data(JSON이 아니면 원본), 실패는 RequestFailure다. orval mutator로 쓴다. */
  readonly request: <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig) => Promise<Unwrapped<T>>;
}

function isRead(config: AxiosRequestConfig): boolean {
  const method = (config.method ?? 'get').toLowerCase();
  return method === 'get' || method === 'head' || method === 'options';
}

function header(response: AxiosResponse | undefined, name: string): string | undefined {
  const value: unknown = response === undefined ? undefined : AxiosHeaders.from(response.headers as never).get(name);
  return typeof value === 'string' ? value : undefined;
}

function isJson(response: AxiosResponse): boolean {
  const media = header(response, 'content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  return media === 'application/json' || media?.endsWith('+json') === true;
}

/** axios 오류를 실패 해석 입력으로 바꾼다. */
function outcomeOf(error: unknown): TransportOutcome | undefined {
  if (axios.isCancel(error)) return { type: 'cancelled' };
  if (!axios.isAxiosError(error)) return undefined;
  const requestId = header(error.response, 'x-request-id');
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return { type: 'timeout', requestId };
  if (error.response === undefined) return { type: 'network', requestId };
  return { type: 'response', status: error.response.status, body: error.response.data, requestId };
}

function cancelled(): RequestFailure {
  return new RequestFailure({ kind: 'cancelled' });
}

/** 재발급을 기다리되, 이 요청의 호출자가 취소하면 이 요청만 즉시 끝낸다. */
function awaitUnlessAborted<T>(promise: Promise<T>, signal: AxiosRequestConfig['signal']): Promise<T> {
  if (signal === undefined || signal === null) return promise;
  const abortable = signal as AbortSignal;
  if (abortable.aborted) return Promise.reject(cancelled());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(cancelled());
    abortable.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => abortable.removeEventListener('abort', onAbort));
  });
}

/**
 * 요청 처리를 만든다. isPublic은 세션에 속하지 않는 요청(로그인 전·재발급·로그아웃)을 가린다:
 * 토큰을 자동으로 싣지 않고, 그 실패는 세션을 건드리지 않고 그대로 돌려준다.
 * prepare는 프로젝트 운영 헤더(언어·메뉴 등)를 붙인다.
 */
export function createHttp<C extends Credentials>({
  session,
  results,
  isPublic,
  prepare,
  observe,
  defaults,
}: {
  readonly session: Session<C>;
  readonly results: ResultCodeTable;
  readonly isPublic: (config: AxiosRequestConfig) => boolean;
  readonly prepare?: (headers: AxiosHeaders, config: AxiosRequestConfig) => void;
  /** 전송 시도마다(재전송·공개 요청 포함, 취소 제외) 한 번. 연결 상태·서버 시각 같은 프로젝트 관찰용이다. */
  readonly observe?: (event: TransportEvent) => void;
  readonly defaults?: CreateAxiosDefaults;
}): Http {
  const instance = axios.create({ withCredentials: true, ...defaults });

  /** 전송 한 번과 그 관찰. 응답이 없으면 response가 없다. */
  async function attempt(config: AxiosRequestConfig): Promise<AxiosResponse> {
    const headers = AxiosHeaders.from((config.headers ?? {}) as never);
    prepare?.(headers, config);
    const sentAt = Date.now();
    const report = (response: AxiosResponse | undefined) =>
      observe?.({
        url: config.url,
        method: (config.method ?? 'get').toLowerCase(),
        sentAt,
        response: response === undefined ? undefined : { status: response.status, header: (name) => header(response, name) },
      });
    try {
      const response = await instance.request({ ...config, headers });
      report(response);
      return response;
    } catch (error: unknown) {
      if (!axios.isCancel(error)) report(axios.isAxiosError(error) ? error.response : undefined);
      throw error;
    }
  }

  /** axios 오류 하나를 실패 12종으로 바꾼다. */
  function failureOf(error: unknown): RequestFailure {
    const outcome = outcomeOf(error);
    return outcome === undefined ? new RequestFailure({ kind: 'contract' }) : toRequestFailure(outcome, results);
  }

  /**
   * 세션 요청의 실패 하나를 처리한다. 인증 거절(401 또는 종료 행)은 이 순서로 본다:
   * 1. 요청이 쓴 토큰이 그 사이 회전됐으면 옛 토큰에 대한 응답이다 → 현재 토큰으로 다시 보낸다(새 근거가 있을 때만 반복).
   * 2. 종료 행이면 세션을 끝낸다(인증 계약). 3. 그 밖의 첫 401은 재발급 뒤 한 번 다시 보낸다.
   * 쓰기는 E1 전제 없이는 다시 보내지 않고 반영 여부 미확정으로 돌려준다.
   */
  async function recover(
    failure: RequestFailure,
    config: AxiosRequestConfig,
    generation: number,
    token: string | undefined,
    resent: boolean,
  ): Promise<unknown> {
    const stale = () => generation !== session.generation();
    if (stale()) throw cancelled();
    if (failure.kind === 'cancelled') throw failure;
    const read = isRead(config);
    const resendable = read || AUTH_REJECTS_BEFORE_EXECUTION;
    const rejected = failure.status === 401 || failure.endsSession;
    if (rejected && token !== undefined) {
      const now = session.current()?.credentials.accessToken;
      if (now !== undefined && now !== token) {
        if (resendable) return send(config, generation, resent);
        throw failure.withResultUnknown();
      }
    }
    if (failure.endsSession) {
      session.expire(failure);
      throw cancelled();
    }
    if (failure.status === 401 && !resent && token !== undefined) {
      if (resendable) {
        await awaitUnlessAborted(session.refresh(generation, token, failure), config.signal);
        return send(config, generation, true);
      }
      // 쓰기는 다시 보내지 않는다. 다음 요청을 위해 재발급만 하고, 재발급의 실패 종류로 반영 여부를 바꾸지 않는다.
      await session.refresh(generation, token, failure).catch(() => undefined);
      throw stale() ? cancelled() : failure.withResultUnknown();
    }
    const unknown = !read && failure.status === undefined && (failure.kind === 'network' || failure.kind === 'timeout');
    throw unknown ? failure.withResultUnknown() : failure;
  }

  async function send(config: AxiosRequestConfig, generation: number, resent: boolean): Promise<unknown> {
    const token = session.current()?.credentials.accessToken;
    const authorized =
      token === undefined
        ? config
        : { ...config, headers: AxiosHeaders.from((config.headers ?? {}) as never).set('Authorization', `Bearer ${token}`) };
    let response: AxiosResponse;
    try {
      response = await attempt(authorized);
    } catch (error: unknown) {
      return recover(failureOf(error), config, generation, token, resent);
    }
    if (generation !== session.generation()) throw cancelled();
    if (!isJson(response)) return response.data;
    const result = readEnvelope(response.data, results, header(response, 'x-request-id'));
    if (result.ok) return result.data;
    return recover(result.failure, config, generation, token, resent);
  }

  return {
    request: async <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig) => {
      const merged = { ...config, ...options };
      if (!isPublic(merged)) return send(merged, session.generation(), false) as Promise<Unwrapped<T>>;
      return sendPublic(merged) as Promise<Unwrapped<T>>;
    },
  };

  /** 세션 밖 요청. 실패는 해석만 하고 세션에 영향을 주지 않는다. */
  async function sendPublic(config: AxiosRequestConfig): Promise<unknown> {
    let response: AxiosResponse;
    try {
      response = await attempt(config);
    } catch (error: unknown) {
      throw failureOf(error);
    }
    if (!isJson(response)) return response.data;
    const result = readEnvelope(response.data, results, header(response, 'x-request-id'));
    if (result.ok) return result.data;
    throw result.failure;
  }
}
