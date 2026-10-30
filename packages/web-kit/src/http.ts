// 파일 책임: 필수 응답 계약으로 요청을 해석하고 토큰·전송 관찰·세션 회복을 공통 처리한다.
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
 * E1(인증 필터가 업무 실행 전에 401로 거절하는가)의 키트 기본값. 쓰기의 401은 재전송하지 않고 반영 여부 미확정으로 돌려준다.
 * 실행 전 거절 여부는 서버마다 다른 사실이라, 한 서버에서 확인돼도 이 값을 바꾸지 않는다.
 * 확인한 서버를 쓰는 프로젝트만 켤 수 있게 그때 `createHttp` 입력을 추가한다(결정 기록 「구현 결정」).
 */
const AUTH_REJECTS_BEFORE_EXECUTION = false;

/** 전송 시도 하나의 관찰. response가 없으면 서버에 닿지 못했다(network·timeout). */
export interface TransportEvent {
  readonly url: string | undefined;
  readonly method: string;
  /** 보낸 시각(ms). 서버 시각 동기화의 기준이다. */
  readonly sentAt: number;
  readonly response: { readonly status: number; readonly header: (name: string) => string | undefined } | undefined;
}

/** 성공한 최종 전송의 데이터와 시각·헤더. 재전송 전 응답과 섞이지 않는다. */
export interface HttpResponse<T> {
  readonly data: T;
  readonly sentAt: number;
  readonly response: NonNullable<TransportEvent['response']>;
}
export interface Http {
  readonly requestWithResponse: <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig) => Promise<HttpResponse<T>>;
  /** 프로젝트 해석 뒤 실제 데이터 타입을 그대로 받는다. data라는 속성도 일반 데이터로 유지한다. */
  readonly requestData: <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig) => Promise<T>;
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

/**
 * 파일로 받는 요청(responseType blob)도 서버가 JSON(봉투)으로 답하면 본문을 JSON으로 읽어 둔다.
 * 그래야 다운로드 실패도 resultCode로 해석된다. 읽지 못하면 그대로 두어 봉투 해석이 계약 위반으로 판정한다.
 */
async function readJsonBlob(response: AxiosResponse | undefined): Promise<void> {
  const data: unknown = response?.data;
  if (response === undefined || typeof Blob === 'undefined' || !(data instanceof Blob) || !isJson(response)) return;
  try {
    response.data = JSON.parse(await data.text());
  } catch {
    // 계약 위반은 아래 해석이 판정한다.
  }
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

/** 프로젝트가 JSON 응답을 공통 성공·실패 형태로 해석한다. 문구 대신 프로젝트의 문구 키를 실패에 담는다. */
export interface ResponseContract {
  readonly read: (body: unknown, status: number, requestId: string | undefined) =>
    { readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly failure: RequestFailure };
}

/** Spring 생성 endpoint의 봉투 타입에서 실제 data 타입을 고른다. 요청 자체의 타입 규칙과 분리한다. */
export type SpringEnvelopeData<T> = T extends { readonly data?: infer D } ? Exclude<D, undefined> : T;

/** Spring 봉투와 결과 코드 표를 쓰는 서버가 명시적으로 선택하는 응답 계약이다. */
export function springEnvelope(results: ResultCodeTable): ResponseContract {
  return {
    read: (body, status, requestId) => status >= 200 && status < 300
      ? readEnvelope(body, results, requestId)
      : { ok: false, failure: toRequestFailure({ type: 'response', body, status, requestId }, results) },
  };
}

/**
 * 요청 처리를 만든다. isPublic은 세션에 속하지 않는 요청(로그인 전·재발급·로그아웃)을 가린다:
 * 토큰을 자동으로 싣지 않고, 그 실패는 세션을 건드리지 않고 그대로 돌려준다.
 * prepare는 프로젝트 운영 헤더(언어·메뉴 등)를 붙인다.
 */
export function createHttp<C extends Credentials>({
  session,
  response: contract,
  isPublic,
  prepare,
  observe,
  defaults,
}: {
  readonly session: Session<C>;
  /** 서버 응답 형식·성공 코드·업무 실패를 해석할 계약을 반드시 선택한다. */
  readonly response: ResponseContract;
  readonly isPublic: (config: AxiosRequestConfig) => boolean;
  readonly prepare?: (headers: AxiosHeaders, config: AxiosRequestConfig) => void;
  /** 전송 시도마다(재전송·공개 요청 포함, 취소 제외) 한 번. 연결 상태·서버 시각 같은 프로젝트 관찰용이다. */
  readonly observe?: (event: TransportEvent) => void;
  readonly defaults?: CreateAxiosDefaults;
}): Http {
  const instance = axios.create({ withCredentials: true, ...defaults });
  const responseTimes = new WeakMap<AxiosResponse, number>();
  /** 성공 데이터에 이 전송의 메타만 묶는다. */
  function successful(response: AxiosResponse, data: unknown): HttpResponse<unknown> {
    return { data, sentAt: responseTimes.get(response)!, response: { status: response.status, header: (name) => header(response, name) } };
  }

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
      responseTimes.set(response, sentAt);
      report(response);
      await readJsonBlob(response);
      return response;
    } catch (error: unknown) {
      if (axios.isCancel(error)) throw error;
      const response = axios.isAxiosError(error) ? error.response : undefined;
      report(response);
      await readJsonBlob(response);
      throw error;
    }
  }

  /** 프로젝트는 코드 의미를 정하고 실제 HTTP 상태와 요청 식별자는 전송 관찰을 보존한다. */
  function readResponse(body: unknown, status: number, requestId: string | undefined) {
    const result = contract.read(body, status, requestId);
    if (result.ok) return result;
    const failure = result.failure;
    return { ok: false as const, failure: new RequestFailure({
      kind: failure.kind, status, requestId: requestId ?? failure.requestId,
      code: failure.code, messageKey: failure.messageKey, endsSession: failure.endsSession,
      fieldErrors: failure.fieldErrors, resultUnknown: failure.resultUnknown,
    }) };
  }

  /** axios 오류 하나를 실패 12종으로 바꾼다. */
  function failureOf(error: unknown): RequestFailure {
    const outcome = outcomeOf(error);
    if (outcome === undefined) return new RequestFailure({ kind: 'contract' });
    if (outcome.type === 'response') {
      const result = readResponse(outcome.body, outcome.status, outcome.requestId);
      // HTTP 자체가 거절한 요청을 프로젝트의 성공 코드만으로 성공 처리하지 않는다.
      return result.ok ? new RequestFailure({ kind: 'contract', status: outcome.status, requestId: outcome.requestId }) : result.failure;
    }
    return new RequestFailure({ kind: outcome.type, requestId: outcome.requestId });
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
    if (!isJson(response)) return successful(response, response.data);
    const result = readResponse(response.data, response.status, header(response, 'x-request-id'));
    if (result.ok) return successful(response, result.data);
    return recover(result.failure, config, generation, token, resent);
  }

  /** 두 타입 입구가 같은 전송·세션·응답 해석 경로를 사용한다. */
  async function requestData<T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> {
    const merged = { ...config, ...options };
    return (await requestWithResponse<T>(merged)).data;
  }
  /** 호출마다 최종 성공 응답의 메타를 돌려준다. */
  async function requestWithResponse<T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<HttpResponse<T>> {
    const merged = { ...config, ...options };
    return (!isPublic(merged) ? send(merged, session.generation(), false) : sendPublic(merged)) as Promise<HttpResponse<T>>;
  }

  return {
    requestWithResponse,
    requestData,
  };

  /** 세션 밖 요청. 실패는 해석만 하고 세션에 영향을 주지 않는다. */
  async function sendPublic(config: AxiosRequestConfig): Promise<unknown> {
    let response: AxiosResponse;
    try {
      response = await attempt(config);
    } catch (error: unknown) {
      throw failureOf(error);
    }
    if (!isJson(response)) return successful(response, response.data);
    const result = readResponse(response.data, response.status, header(response, 'x-request-id'));
    if (result.ok) return successful(response, result.data);
    throw result.failure;
  }
}
