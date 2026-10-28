// 파일 책임: http 요청 처리(헤더·봉투·실패 변환·401 재발급 뒤 한 번 재전송·세대·반영 여부)를 axios adapter로 검사한다.
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createResultCodeTable, RequestFailure } from '../src/failure';
import { createHttp } from '../src/http';
import { createSession, type SessionStore, type StoredSession } from '../src/session';

interface Credentials {
  readonly accessToken: string;
}

type Reply = { status: number; data?: unknown; contentType?: string } | 'timeout' | 'network';

const table = createResultCodeTable([
  { status: 401, code: 4000, messageKey: 'invalidToken', endsSession: true },
  { status: 200, code: 4999, messageKey: 'forcedOut', endsSession: true },
  { status: 200, code: 2100, messageKey: 'notExist' },
]);

let replies: Reply[];
let sent: { url?: string; method?: string; authorization?: string; locale?: string }[];

/** 순서대로 준비한 응답을 돌려주는 가짜 전송. 보낸 헤더를 기록한다. */
const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const headers = AxiosHeaders.from(config.headers);
  sent.push({
    url: config.url,
    method: config.method,
    authorization: headers.get('Authorization') as string | undefined,
    locale: headers.get('Accept-Language') as string | undefined,
  });
  if (config.signal?.aborted) throw new AxiosError('canceled', AxiosError.ERR_CANCELED, config);
  const reply = replies.shift() ?? { status: 200, data: { header: { resultCode: 200 }, data: null } };
  if (reply === 'timeout') throw new AxiosError('timeout', 'ECONNABORTED', config);
  if (reply === 'network') throw new AxiosError('Network Error', 'ERR_NETWORK', config);
  const response = {
    data: reply.data,
    status: reply.status,
    statusText: '',
    headers: { 'content-type': reply.contentType ?? 'application/json', 'x-request-id': 'rid' },
    config,
  };
  if (reply.status >= 400) throw new AxiosError('fail', 'ERR_BAD_RESPONSE', config, undefined, response);
  return response;
};

function store(): SessionStore<Credentials> {
  let value: StoredSession<Credentials> | null = null;
  return { read: () => value, write: (next) => { value = next; }, subscribe: () => () => undefined };
}

function ok(data: unknown, resultCode = 200) {
  return { status: 200, data: { header: { resultCode, resultMessage: '원문' }, data } };
}
function fail(status: number, resultCode?: number) {
  return { status, data: resultCode === undefined ? undefined : { header: { resultCode } } };
}

let reissue: ReturnType<typeof vi.fn<(credentials: Credentials) => Promise<Credentials>>>;
function setup() {
  reissue = vi.fn(async (_credentials: Credentials) => ({ accessToken: 't2' }));
  const session = createSession<Credentials>({ store: store(), reissue: (c) => reissue(c) });
  session.start({ accessToken: 't1' });
  const http = createHttp({
    session,
    results: table,
    isPublic: (config) => config.url?.startsWith('/auth/') === true,
    prepare: (headers) => headers.set('Accept-Language', 'ko'),
    defaults: { adapter },
  });
  return { session, http };
}

beforeEach(() => {
  replies = [];
  sent = [];
  vi.stubGlobal('navigator', {});
});
afterEach(() => vi.unstubAllGlobals());

it('H1 봉투를 풀고 세션 토큰과 프로젝트 헤더를 싣는다. JSON이 아니면 그대로 돌려준다', async () => {
  const { http } = setup();
  replies = [ok({ id: 1 }), { status: 200, data: 'bytes', contentType: 'application/octet-stream' }];
  await expect(http.request({ url: '/items' })).resolves.toEqual({ id: 1 });
  await expect(http.request({ url: '/file' })).resolves.toBe('bytes');
  expect(sent[0]).toMatchObject({ authorization: 'Bearer t1', locale: 'ko' });
});

it('H1b 파일로 받는 요청도 JSON 실패 응답은 resultCode로 해석한다(다운로드 실패 문구)', async () => {
  const { http } = setup();
  const json = (body: unknown) => new Blob([JSON.stringify(body)], { type: 'application/json' });
  replies = [
    { status: 500, data: json({ header: { resultCode: 2100 } }) },
    { status: 200, data: json({ header: { resultCode: 2100 } }) },
    { status: 200, data: new Blob(['xlsx']), contentType: 'application/octet-stream' },
  ];
  await expect(http.request({ url: '/file', method: 'post', responseType: 'blob' })).rejects.toMatchObject({ status: 500, code: '2100' });
  await expect(http.request({ url: '/file', method: 'post', responseType: 'blob' })).rejects.toMatchObject({ kind: 'business', messageKey: 'notExist' });
  await expect(http.request({ url: '/file', method: 'post', responseType: 'blob' })).resolves.toBeInstanceOf(Blob);
});

it('H2 HTTP 200 업무 실패는 business로 던지고, 세션 종료 행이면 세션을 끝내고 취소로 끝난다', async () => {
  const { http, session } = setup();
  replies = [ok(null, 2100), ok(null, 4999)];
  await expect(http.request({ url: '/items' })).rejects.toMatchObject({ kind: 'business', messageKey: 'notExist' });
  await expect(http.request({ url: '/items' })).rejects.toMatchObject({ kind: 'cancelled' });
  expect(session.current()).toBeNull();
});

it('H3 조회의 401은 재발급 뒤 새 토큰으로 한 번 재전송한다', async () => {
  const { http } = setup();
  replies = [fail(401, 4002), ok('done')];
  await expect(http.request({ url: '/items' })).resolves.toBe('done');
  expect(reissue).toHaveBeenCalledTimes(1);
  expect(sent.map((request) => request.authorization)).toEqual(['Bearer t1', 'Bearer t2']);
});

it('H4 재전송 뒤 401은 재발급하지 않고, 세션 종료는 결과 코드 표로만 판정한다', async () => {
  const { http, session } = setup();
  replies = [fail(401, 4002), fail(401, 4002)];
  await expect(http.request({ url: '/items' })).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
  expect(reissue).toHaveBeenCalledTimes(1);
  expect(session.current()).not.toBeNull();

  replies = [fail(401, 4002), fail(401, 4000)];
  await expect(http.request({ url: '/items' })).rejects.toMatchObject({ kind: 'cancelled' });
  expect(session.current()).toBeNull();
});

it('H5 세션 종료 행의 첫 401은 재발급 없이 세션을 끝내고 취소로 끝난다', async () => {
  const { http, session } = setup();
  replies = [fail(401, 4000)];
  await expect(http.request({ url: '/items' })).rejects.toMatchObject({ kind: 'cancelled' });
  expect(reissue).not.toHaveBeenCalled();
  expect(session.current()).toBeNull();
});

it('H6 쓰기의 401은 재전송하지 않고(E1 확인 전) 원 실패를 반영 여부 미확정으로 돌려준다', async () => {
  const { http } = setup();
  replies = [fail(401, 4002)];
  const error = await http.request({ url: '/items', method: 'POST' }).catch((reason: unknown) => reason);
  expect(error).toMatchObject({ kind: 'unauthorized', resultUnknown: true });
  expect(reissue).toHaveBeenCalledTimes(1);
  expect(sent).toHaveLength(1);
});

it('H7 쓰기 401 뒤 재발급이 timeout이어도 실패 종류로 반영 여부를 바꾸지 않는다', async () => {
  const { http, session } = setup();
  reissue.mockRejectedValueOnce(new RequestFailure({ kind: 'timeout' }));
  replies = [fail(401, 4002)];
  const error = await http.request({ url: '/items', method: 'PUT' }).catch((reason: unknown) => reason);
  expect(error).toMatchObject({ kind: 'unauthorized', status: 401 });
  expect(session.current()).not.toBeNull();
});

it('H8 쓰기 자체의 timeout·network만 반영 여부 미확정이고, 조회와 4xx 쓰기는 아니다', async () => {
  const { http } = setup();
  replies = ['timeout', 'network', 'timeout', fail(400)];
  await expect(http.request({ url: '/a', method: 'POST' })).rejects.toMatchObject({ kind: 'timeout', resultUnknown: true });
  await expect(http.request({ url: '/a', method: 'DELETE' })).rejects.toMatchObject({ kind: 'network', resultUnknown: true });
  await expect(http.request({ url: '/a' })).rejects.toMatchObject({ kind: 'timeout', resultUnknown: false });
  await expect(http.request({ url: '/a', method: 'POST' })).rejects.toMatchObject({ kind: 'validation', resultUnknown: false });
});

it('H9 요청 중 세션이 바뀌면 성공 응답도 취소로 끝난다', async () => {
  const { http, session } = setup();
  let release!: () => void;
  replies = [ok('old')];
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const slow = createHttp({
    session,
    results: table,
    isPublic: () => false,
    defaults: { adapter: async (config) => { await gate; return adapter(config); } },
  });
  void http;
  const pending = slow.request({ url: '/items' });
  session.start({ accessToken: 'other' });
  release();
  await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
});

it('H10 공개 요청은 토큰을 싣지 않고 401을 재발급하지 않는다', async () => {
  const { http, session } = setup();
  replies = [fail(401, 3001)];
  await expect(http.request({ url: '/auth/sign-in', method: 'POST' })).rejects.toMatchObject({ kind: 'unauthorized' });
  expect(sent[0]?.authorization).toBeUndefined();
  expect(reissue).not.toHaveBeenCalled();
  expect(session.current()).not.toBeNull();
});

it('H11 호출자가 취소하면 cancelled다. 재발급을 기다리던 요청만 끝나고 재발급은 계속된다', async () => {
  const { http } = setup();
  let finish!: (value: Credentials) => void;
  reissue.mockImplementationOnce(() => new Promise<Credentials>((resolve) => { finish = resolve; }));
  replies = [fail(401, 4002), fail(401, 4002), ok('second')];
  const controller = new AbortController();
  const first = http.request({ url: '/a', signal: controller.signal });
  const second = http.request({ url: '/b' });
  await vi.waitFor(() => expect(reissue).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(sent).toHaveLength(2));
  controller.abort();
  await expect(first).rejects.toMatchObject({ kind: 'cancelled' });
  finish({ accessToken: 't2' });
  await expect(second).resolves.toBe('second');
});

/** 다른 탭의 회전을 흉내 낼 수 있는 세션과 http. rotateAt[i]번째 전송 직후 저장 토큰을 바꾼다. */
function rotatingSetup(rotateAt: Record<number, string>) {
  let value: StoredSession<Credentials> | null = null;
  const listeners = new Set<(next: StoredSession<Credentials> | null) => void>();
  const rotating: SessionStore<Credentials> = {
    read: () => value,
    write: (next) => { value = next; },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  };
  reissue = vi.fn(async () => ({ accessToken: 't2' }));
  const session = createSession<Credentials>({ store: rotating, reissue: (c) => reissue(c) });
  session.start({ accessToken: 't1' });
  const http = createHttp({
    session,
    results: table,
    isPublic: () => false,
    defaults: {
      adapter: async (config) => {
        const index = sent.length;
        const response = adapter(config);
        const token = rotateAt[index];
        if (token !== undefined) {
          const rotated = { sessionId: value!.sessionId, credentials: { accessToken: token } };
          value = rotated;
          for (const listener of listeners) listener(rotated);
        }
        return response;
      },
    },
  });
  return { session, http };
}

it('H12 회전된 옛 토큰에 온 401은 종료 행이어도 세션을 끝내지 않고 현재 토큰으로 다시 보낸다', async () => {
  const { http, session } = rotatingSetup({ 0: 't-other' });
  replies = [fail(401, 4000), ok('done')];
  await expect(http.request({ url: '/items' })).resolves.toBe('done');
  expect(reissue).not.toHaveBeenCalled();
  expect(session.current()).not.toBeNull();
  expect(sent.map((request) => request.authorization)).toEqual(['Bearer t1', 'Bearer t-other']);
});

it('H12b 재전송의 401도 그 사이 토큰이 다시 회전됐으면 재발급 없이 현재 토큰으로 보낸다. 회전이 없으면 멈춘다', async () => {
  const { http } = rotatingSetup({ 1: 't3' });
  replies = [fail(401, 4002), fail(401, 4002), ok('done')];
  await expect(http.request({ url: '/items' })).resolves.toBe('done');
  expect(reissue).toHaveBeenCalledTimes(1);
  expect(sent.map((request) => request.authorization)).toEqual(['Bearer t1', 'Bearer t2', 'Bearer t3']);

  // 회전이 없으면 재전송 뒤 401에서 멈춘다(무한 반복 없음).
  const still = rotatingSetup({});
  replies = [fail(401, 4002), fail(401, 4002)];
  sent = [];
  await expect(still.http.request({ url: '/items' })).rejects.toMatchObject({ kind: 'unauthorized' });
  expect(sent).toHaveLength(2);
});

it('H13 모든 전송 시도(재전송 포함)를 응답 헤더·status·보낸 시각과 함께 관찰한다. 응답 없음은 response가 없다', async () => {
  const events: { url?: string; status?: number; expires?: string; sentAt: number }[] = [];
  reissue = vi.fn(async () => ({ accessToken: 't2' }));
  const session = createSession<Credentials>({ store: store(), reissue: (c) => reissue(c) });
  session.start({ accessToken: 't1' });
  const http = createHttp({
    session,
    results: table,
    isPublic: () => false,
    observe: (event) => events.push({ url: event.url, status: event.response?.status, expires: event.response?.header('x-request-id'), sentAt: event.sentAt }),
    defaults: { adapter },
  });
  replies = [fail(401, 4002), ok('done'), 'network'];
  await http.request({ url: '/a' });
  await http.request({ url: '/b' }).catch(() => undefined);
  expect(events.map(({ url, status, expires }) => ({ url, status, expires }))).toEqual([
    { url: '/a', status: 401, expires: 'rid' },
    { url: '/a', status: 200, expires: 'rid' },
    { url: '/b', status: undefined, expires: undefined },
  ]);
  expect(events.every((event) => typeof event.sentAt === 'number')).toBe(true);
});

it('H14 결과 코드 표의 종료 행으로 끝난 세션은 서버가 끝낸 것으로 알린다', async () => {
  const { http, session } = setup();
  const changes: unknown[] = [];
  session.subscribe((change) => changes.push(change));
  replies = [fail(401, 4000)];
  await http.request({ url: '/items' }).catch(() => undefined);
  expect(changes).toMatchObject([{ kind: 'ended', by: 'server' }]);
});

it('H15 쓰기의 인증 거절은 토큰이 회전돼 있어도 다시 보내지 않고 반영 여부 미확정으로 돌려준다(E1 전제)', async () => {
  const { http, session } = rotatingSetup({ 0: 't-other' });
  replies = [fail(401, 4002), ok('must-not-send')];
  const error = await http.request({ url: '/items', method: 'POST' }).catch((reason: unknown) => reason);
  expect(error).toMatchObject({ kind: 'unauthorized', resultUnknown: true });
  expect(sent).toHaveLength(1);
  expect(reissue).not.toHaveBeenCalled();
  expect(session.current()).not.toBeNull();
});
