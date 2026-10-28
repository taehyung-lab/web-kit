// 파일 책임: 전송 결과와 Spring 응답 봉투를 실패 12종 하나로 해석한다. 라이브러리를 import하지 않는다.

/** 무슨 일이 일어났는가. 어디에 어떻게 보일지는 화면·프로젝트가 정한다. */
export type FailureKind =
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'unauthorized'
  | 'forbidden'
  | 'validation'
  | 'not-found'
  | 'conflict'
  | 'rate-limited'
  | 'server-error'
  | 'business'
  | 'contract';

/** 서버가 준 필드별 거절 사유. 문구가 아니라 검증 코드다. */
export interface FieldError {
  readonly field: string;
  readonly code: string;
}

/** 프로젝트가 서버 계약에서 옮겨 적는 결과 코드 한 행. 이름으로 의미를 추측해 행을 더하지 않는다. */
export interface ResultCodeRow {
  readonly status: number;
  readonly code: number | string;
  /** 없으면 status 기본 분류(200은 business)를 따른다. */
  readonly kind?: FailureKind;
  /** 화면이 번역 문구를 고를 때 쓰는 키. 서버 resultMessage는 쓰지 않는다. */
  readonly messageKey: string;
  /** 재발급으로 회복되지 않는 세션 종료. 세션 수명이 읽는다. */
  readonly endsSession?: true;
}

export interface ResultCodeTable {
  readonly lookup: (status: number, code: string | undefined) => ResultCodeRow | undefined;
}

/** 실패 해석의 입력. 각 전송 binding(axios 등)이 자기 오류를 이 모양으로 바꾼다. */
export type TransportOutcome =
  | { readonly type: 'network' | 'timeout' | 'cancelled'; readonly requestId?: string }
  | {
      readonly type: 'response';
      readonly status: number;
      readonly body: unknown;
      readonly requestId?: string;
    };

/** 판별 표시. 키트가 두 벌 로드돼도(monorepo 중복 설치, 모듈 재평가) 같은 실패로 알아보도록 전역 Symbol을 쓴다. */
const BRAND = Symbol.for('@boosterlab/web-kit/RequestFailure');

/** 화면까지 그대로 전달되는 실패. throw할 수 있도록 Error다. */
export class RequestFailure extends Error {
  readonly [BRAND] = true;
  readonly kind: FailureKind;
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly messageKey: string | undefined;
  readonly endsSession: boolean;
  readonly fieldErrors: readonly FieldError[];
  /** 쓰기가 서버에 반영됐는지 확인할 수 없음. 요청 경로를 아는 http만 정하고, kind로 추측하지 않는다. */
  readonly resultUnknown: boolean;
  readonly #fields: ConstructorParameters<typeof RequestFailure>[0];

  constructor(fields: {
    readonly kind: FailureKind;
    readonly status?: number;
    readonly code?: string;
    readonly requestId?: string;
    /** 결과 코드 표 행이 정한 문구 키. */
    readonly messageKey?: string;
    /** 결과 코드 표 행이 정한 세션 종료. */
    readonly endsSession?: boolean;
    readonly fieldErrors?: readonly FieldError[];
    readonly resultUnknown?: boolean;
  }) {
    super(fields.status === undefined ? fields.kind : `${fields.kind} (http ${fields.status})`);
    this.name = 'RequestFailure';
    this.kind = fields.kind;
    this.status = fields.status;
    this.code = fields.code;
    this.requestId = fields.requestId;
    this.messageKey = fields.messageKey;
    this.endsSession = fields.endsSession === true;
    this.fieldErrors = fields.fieldErrors ?? [];
    this.resultUnknown = fields.resultUnknown === true;
    this.#fields = fields;
  }

  /** 같은 실패에 "쓰기 반영 여부를 확인할 수 없음" 사실만 더한 복사본. */
  withResultUnknown(): RequestFailure {
    return new RequestFailure({ ...this.#fields, resultUnknown: true });
  }
}

/** 실패 12종으로 해석된 값인지 판별한다. */
export function isRequestFailure(value: unknown): value is RequestFailure {
  return typeof value === 'object' && value !== null && (value as { [BRAND]?: unknown })[BRAND] === true;
}

/** (status, code) 조회 표를 만든다. 같은 조합의 중복 선언은 서버 계약 옮겨 적기 실수라 거절한다. */
export function createResultCodeTable(rows: readonly ResultCodeRow[]): ResultCodeTable {
  const byKey = new Map<string, ResultCodeRow>();
  for (const row of rows) {
    const key = `${row.status}:${String(row.code)}`;
    if (byKey.has(key)) throw new Error(`duplicate result code row ${key}`);
    byKey.set(key, row);
  }
  return {
    lookup: (status, code) => (code === undefined ? undefined : byKey.get(`${status}:${code}`)),
  };
}

/** 서버가 코드로 달리 선언하지 않은 실패의 기준 분류. */
function kindOfStatus(status: number): FailureKind {
  if (status === 200) return 'business';
  if (status === 400 || status === 422) return 'validation';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate-limited';
  if (status >= 500 && status <= 599) return 'server-error';
  return 'contract';
}

interface Envelope {
  readonly header: { readonly resultCode: number };
  readonly data?: unknown;
}

function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null || !('header' in value)) return false;
  const header: unknown = value.header;
  return (
    typeof header === 'object' &&
    header !== null &&
    'resultCode' in header &&
    typeof header.resultCode === 'number'
  );
}

/** 필드 오류 목록은 `data` 자체 또는 `data.invalidMessages`다(두 백엔드의 실제 모양). 항목은 `{ field, validCode }`. */
function readFieldErrors(data: unknown): readonly FieldError[] {
  const items: unknown =
    typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as { invalidMessages?: unknown }).invalidMessages : data;
  if (!Array.isArray(items)) return [];
  const result: FieldError[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const { field, validCode } = item as Record<string, unknown>;
    if (typeof field === 'string' && typeof validCode === 'string') result.push({ field, code: validCode });
  }
  return result;
}

/** 응답 status·봉투에서 실패 하나를 만든다. 표 행이 status 기본 분류보다 앞선다. */
function failureOfResponse(
  status: number,
  body: unknown,
  table: ResultCodeTable,
  requestId: string | undefined,
): RequestFailure {
  const code = isEnvelope(body) ? String(body.header.resultCode) : undefined;
  const row = table.lookup(status, code);
  return new RequestFailure({
    kind: row?.kind ?? kindOfStatus(status),
    status,
    code,
    requestId,
    messageKey: row?.messageKey,
    endsSession: row?.endsSession === true,
    fieldErrors: isEnvelope(body) ? readFieldErrors(body.data) : [],
  });
}

/** 전송 실패 하나를 실패 12종 하나로 바꾼다. 없는 status를 채우지 않는다. */
export function toRequestFailure(outcome: TransportOutcome, table: ResultCodeTable): RequestFailure {
  if (outcome.type !== 'response')
    return new RequestFailure({ kind: outcome.type, requestId: outcome.requestId });
  return failureOfResponse(outcome.status, outcome.body, table, outcome.requestId);
}

/** HTTP 2xx 본문의 봉투를 푼다. resultCode 200만 성공이고, 봉투가 아니면 contract 실패다. */
export function readEnvelope(
  body: unknown,
  table: ResultCodeTable,
  requestId?: string,
): { readonly ok: true; readonly data: unknown } | { readonly ok: false; readonly failure: RequestFailure } {
  if (!isEnvelope(body))
    return { ok: false, failure: new RequestFailure({ kind: 'contract', status: 200, requestId }) };
  if (body.header.resultCode === 200) return { ok: true, data: body.data };
  return { ok: false, failure: failureOfResponse(200, body, table, requestId) };
}
