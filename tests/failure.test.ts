// 파일 책임: 실패 12종 분류·결과 코드 표·Spring 봉투 해석의 관찰 결과를 검사한다.
import { describe, expect, it } from 'vitest';
import {
  createResultCodeTable,
  isRequestFailure,
  RequestFailure,
  readEnvelope,
  toRequestFailure,
  type FailureKind,
} from '../src/failure';

const table = createResultCodeTable([
  { status: 403, code: 3012, kind: 'business', messageKey: 'accountPending' },
  { status: 401, code: 4000, messageKey: 'invalidToken', endsSession: true },
  { status: 401, code: 4002, messageKey: 'tokenExpired' },
  { status: 200, code: 2100, messageKey: 'notExist' },
]);

function envelope(resultCode: number, data?: unknown) {
  return { header: { resultCode, resultMessage: '서버 원문' }, data };
}

describe('응답 없는 실패', () => {
  it.each([
    ['network', 'network'],
    ['timeout', 'timeout'],
    ['cancelled', 'cancelled'],
  ] as const)('%s는 status 없이 %s', (type, kind) => {
    const failure = toRequestFailure({ type }, table);
    expect(failure.kind).toBe(kind);
    expect(failure.status).toBeUndefined();
    expect(failure.fieldErrors).toEqual([]);
  });
});

describe('HTTP status 기본 분류', () => {
  it.each<[number, FailureKind]>([
    [400, 'validation'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [409, 'conflict'],
    [429, 'rate-limited'],
    [500, 'server-error'],
    [503, 'server-error'],
    [418, 'contract'],
    [302, 'contract'],
  ])('%i → %s', (status, kind) => {
    expect(toRequestFailure({ type: 'response', status, body: undefined }, table).kind).toBe(kind);
  });
});

describe('결과 코드 표', () => {
  it('(status, code) 행이 kind와 문구 키를 정한다', () => {
    const failure = toRequestFailure(
      { type: 'response', status: 403, body: envelope(3012), requestId: 'r-1' },
      table,
    );
    expect(failure).toMatchObject({ kind: 'business', status: 403, code: '3012', messageKey: 'accountPending', requestId: 'r-1' });
    expect(failure.endsSession).toBe(false);
  });
  it('같은 코드라도 status가 다르면 그 행을 쓰지 않는다', () => {
    const failure = toRequestFailure({ type: 'response', status: 400, body: envelope(3012) }, table);
    expect(failure).toMatchObject({ kind: 'validation', code: '3012' });
    expect(failure.messageKey).toBeUndefined();
  });
  it('행에 kind가 없으면 status 분류를 유지하고 세션 종료 표시만 싣는다', () => {
    const ended = toRequestFailure({ type: 'response', status: 401, body: envelope(4000) }, table);
    expect(ended).toMatchObject({ kind: 'unauthorized', endsSession: true, messageKey: 'invalidToken' });
    const reissue = toRequestFailure({ type: 'response', status: 401, body: envelope(4002) }, table);
    expect(reissue.endsSession).toBe(false);
  });
  it('같은 (status, code) 행을 두 번 선언하면 거절한다', () => {
    expect(() =>
      createResultCodeTable([
        { status: 200, code: 1, messageKey: 'a' },
        { status: 200, code: '1', messageKey: 'b' },
      ]),
    ).toThrow(Error);
  });
  it('서버 원문 resultMessage는 실패에 담지 않는다', () => {
    const failure = toRequestFailure({ type: 'response', status: 500, body: envelope(9999) }, table);
    expect(JSON.stringify(failure)).not.toContain('서버 원문');
    expect(failure.message).not.toContain('서버 원문');
  });
  it('실패 응답 본문의 필드 오류를 읽는다', () => {
    const failure = toRequestFailure(
      {
        type: 'response',
        status: 400,
        body: envelope(2000, [{ field: 'name', validCode: 'NotBlank' }, { field: 1 }, { field: 'email', validCode: 'Email' }]),
      },
      table,
    );
    expect(failure.fieldErrors).toEqual([
      { field: 'name', code: 'NotBlank' },
      { field: 'email', code: 'Email' },
    ]);
  });
});

describe('성공 응답 봉투', () => {
  it('resultCode 200이면 data를 돌려준다', () => {
    expect(readEnvelope(envelope(200, { id: 1 }), table)).toEqual({ ok: true, data: { id: 1 } });
  });
  it('HTTP 200 안의 다른 resultCode는 business 실패다', () => {
    const result = readEnvelope(envelope(2100, [{ field: 'id', validCode: 'Exists' }]), table, 'r-2');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure).toMatchObject({ kind: 'business', status: 200, code: '2100', messageKey: 'notExist', requestId: 'r-2' });
    expect(result.failure.fieldErrors).toEqual([{ field: 'id', code: 'Exists' }]);
  });
  it('표에 없는 HTTP 200 코드도 business로 남긴다', () => {
    const result = readEnvelope(envelope(7777), table);
    expect(!result.ok && result.failure.kind).toBe('business');
  });
  it('봉투 모양이 아니면 contract 실패다', () => {
    const result = readEnvelope({ id: 1 }, table);
    expect(!result.ok && result.failure).toMatchObject({ kind: 'contract', status: 200 });
  });
  it('실패는 throw 가능한 Error이고 판별 함수로 구별한다', () => {
    const result = readEnvelope(envelope(2100), table);
    if (result.ok) throw new Error('unreachable');
    expect(result.failure).toBeInstanceOf(Error);
    expect(isRequestFailure(result.failure)).toBe(true);
    expect(isRequestFailure(new Error('x'))).toBe(false);
  });
});

describe('1.0 시험 적용 교정', () => {
  it('422는 validation이다', () => {
    expect(toRequestFailure({ type: 'response', status: 422, body: undefined }, table).kind).toBe('validation');
  });
  it('필드 오류는 data 배열과 data.invalidMessages 두 모양을 읽는다', () => {
    const nested = toRequestFailure(
      { type: 'response', status: 400, body: envelope(400, { invalidMessages: [{ field: 'phone', validCode: 'Pattern', message: '원문' }] }) },
      table,
    );
    expect(nested.fieldErrors).toEqual([{ field: 'phone', code: 'Pattern' }]);
    expect(JSON.stringify(nested)).not.toContain('원문');
  });
  it('messageKey와 endsSession을 직접 실을 수 있고 복사본도 유지한다', () => {
    const failure = new RequestFailure({ kind: 'business', status: 200, code: '2100', messageKey: 'notExist', endsSession: true });
    expect(failure).toMatchObject({ messageKey: 'notExist', endsSession: true });
    expect(failure.withResultUnknown()).toMatchObject({ messageKey: 'notExist', endsSession: true, resultUnknown: true });
  });
});

it('키트가 두 벌 로드돼도 다른 사본이 만든 실패를 알아본다', async () => {
  const { vi: vitest } = await import('vitest');
  vitest.resetModules();
  // 같은 파일을 다른 모듈 id로 다시 평가해 두 번째 사본을 만든다.
  const second = (await import(/* @vite-ignore */ '../src/failure?copy' as string)) as typeof import('../src/failure');
  const other = new second.RequestFailure({ kind: 'not-found', status: 404 });
  expect(other).not.toBeInstanceOf(RequestFailure);
  expect(isRequestFailure(other)).toBe(true);
  expect(isRequestFailure({ kind: 'not-found' })).toBe(false);
});
