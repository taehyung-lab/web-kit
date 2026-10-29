// 파일 책임: 목록 URL 검색 선언 하나에서 필드별 복구·기본값·정규 URL·route 연결(validateSearch·진입 주소 교정)을 만든다.
import type { FetchQueryOptions } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import type { CheckboxTreeNode } from '../checkbox-tree';
import type { SortFirst } from './interactions';

type StandardResult<T> =
  | { readonly value: T; readonly issues?: undefined }
  | { readonly issues: readonly unknown[] };

/** 필드 값 검증. zod 4 등 Standard Schema 구현이면 되고 동기 검증만 쓴다. `.catch`는 두지 않는다. */
export interface FieldSchema<T> {
  readonly '~standard': {
    readonly validate: (value: unknown) => StandardResult<T> | Promise<StandardResult<T>>;
    readonly types?: { readonly output: T } | undefined;
  };
}

/**
 * 서버 선택지에서 고르는 필드의 확인. 선택지에 없는 값은 버린다: 단일 값은 그 필드(와 묶음)를 기본값으로, 배열은 없는 항목만 빼고
 * 남는 항목이 없으면 기본값으로. 확인은 그 선택지 query의 observer라서 필터 UI와 같은 queryOptions를 주면 요청과 상태를 함께 쓴다.
 * 상위 필드 값이 바뀌면 그 값의 선택지로 다시 확인한다.
 */
export interface FieldCheck<TData = any> {
  readonly parents?: readonly string[];
  /** 상위 필드 값 → 선택지 조회(TanStack queryOptions() 결과 그대로). */
  readonly options: (parents: Readonly<Record<string, unknown>>) => FetchQueryOptions<TData, any, TData, any>;
  /** 선택지 응답 → 이 필드가 가질 수 있는 값. 필드 값과 같은 타입으로 낸다. */
  readonly allowed: (data: TData) => readonly unknown[];
  /** 같은 선택지 응답을 칸 표시용 트리로 바꾼다. */
  readonly tree?: (data: TData) => readonly CheckboxTreeNode[];
}

export interface SearchField<T> {
  /** URL 값 → 필드 값. URL 표현을 읽는 곳도 여기다. */
  readonly schema: FieldSchema<T>;
  /** 제품이 정한 기본값. 키트는 제한하지 않는다. */
  readonly default: T | undefined;
  /** 필드 값 → URL 값. 없으면 값 그대로 쓴다(router의 기본 직렬화). */
  readonly encode?: (value: T) => unknown;
  readonly check?: FieldCheck;
  /** 필수 조건과 빈 값 안내. 문구는 소비 프로젝트가 제공한다. */
  readonly required?: { readonly when?: (values: Readonly<Record<string, unknown>>) => boolean; readonly message: string };

}

/** 함께 맞아야 할 필드 묶음. 한 필드라도 못 읽거나 valid가 거짓이면 묶음 전체를 기본값으로 돌린다. */
export interface SearchGroup<K extends string = string> {
  readonly fields: readonly K[];
  readonly valid?: (values: Readonly<Partial<Record<K, unknown>>>) => boolean;
}

/** URL에 쓰는 값(encode 적용 뒤). route search와 navigate가 이 모양을 주고받는다. */
export type UrlSearch = Readonly<Record<string, unknown>>;

type AnyFields = Record<string, SearchField<any>>;
type Output<F> = F extends SearchField<infer T> ? (F['default'] extends undefined ? T | undefined : T) : never;

/** 화면이 쓰는 전체 검색 값. 첫 진입 미조회가 아니면 searched는 늘 true다. */
export type FullSearch<F extends AnyFields> = { readonly [K in keyof F]: Output<F[K]> } & {
  readonly searched: boolean;
};
/** URL에 남는 값. 기본값과 같은 필드는 없다. */
export type SparseSearch<F extends AnyFields> = { readonly [K in keyof F]?: Output<F[K]> } & {
  readonly searched?: true;
};

/** 보기 상태 필드 이름. URL key는 제품 계약이라 선언을 따른다. */
export interface ViewKeys {
  readonly page: string;
  readonly size: string;
  readonly sort: string;
  readonly order: string;
}

export interface SearchDefinition<F extends AnyFields> {
  readonly fields: F;
  readonly view: ViewKeys;
  /** 처음 누른 머리글의 정렬 방향(화면 값). */
  readonly sortFirst: SortFirst;
  readonly groups: readonly SearchGroup[];
  readonly gated: boolean;
  readonly defaults: FullSearch<F>;
  /**
   * route validateSearch: 정규 URL 표현을 낸다(틀린 필드·묶음은 기본값, 기본값과 같은 값은 생략, encode 적용).
   * Router는 이 값을 그대로 URL로 쓰므로 정규형이 아닌 URL은 이동 때 정규형으로 바뀌고, 다시 넣어도 같다.
   */
  readonly validateSearch: (raw: Record<string, unknown>) => UrlSearch;
  /**
   * route beforeLoad: 진입 주소가 정규형이 아니면 정규형으로 replace한다. Router는 validateSearch 결과를 이동 때만 URL로
   * 쓰고 처음 진입한 주소는 고치지 않으므로 이 단계가 필요하다. 정규형은 다시 넣어도 같아서 반복되지 않는다.
   */
  readonly beforeLoad: (args: { readonly location: { readonly pathname: string; readonly search: unknown } }) => void;
  /** URL 값 → 필드 값. 필드별로 읽고 틀린 필드(와 그 묶음)는 버린다. useList가 쓴다. */
  readonly read: (url: UrlSearch) => SparseSearch<F>;
  /** 빠진 필드를 기본값으로 채운다. */
  readonly resolve: (sparse: SparseSearch<F>) => FullSearch<F>;
  /** 전체 값 → URL 값. 기본값과 같은 필드를 생략하고 encode를 적용한다. 검색 전이면 빈 URL이다. */
  readonly canonical: (full: FullSearch<F>) => UrlSearch;
}

/** JSON으로 오가는 값의 깊은 비교. */
export function sameSearchValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((value, index) => sameSearchValue(value, right[index]));
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a).filter((key) => a[key] !== undefined);
  return (
    keys.length === Object.keys(b).filter((key) => b[key] !== undefined).length &&
    keys.every((key) => sameSearchValue(a[key], b[key]))
  );
}

/** 필드 하나를 동기 검증한다. 실패·비동기 schema는 읽지 못한 값이다. */
function readField(schema: FieldSchema<unknown>, value: unknown): { ok: true; value: unknown } | { ok: false } {
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise) throw new Error('search field schema must be synchronous');
  return result.issues === undefined ? { ok: true, value: result.value } : { ok: false };
}

/** 목록 URL 검색을 선언한다. 필드마다 schema·기본값, 함께 맞아야 할 필드 묶음, 첫 진입 미조회 여부. */
export function defineSearch<const F extends AnyFields>(spec: {
  readonly fields: F;
  readonly groups?: readonly SearchGroup<keyof F & string>[];
  readonly gated?: boolean;
  /** 페이지·크기·정렬 필드 이름. 생략하면 page·size·sort·order. */
  readonly view?: Partial<Record<keyof ViewKeys, keyof F & string>>;
  /** 처음 누른 머리글의 정렬 방향. 생략하면 지금 방향을 유지한다. */
  readonly sortFirst?: SortFirst;
}): SearchDefinition<F> {
  const keys = Object.keys(spec.fields);
  const groups = spec.groups ?? [];
  const gated = spec.gated === true;
  const defaults = {
    ...Object.fromEntries(keys.map((key) => [key, spec.fields[key]!.default])),
    searched: !gated,
  } as FullSearch<F>;

  function read(raw: UrlSearch): SparseSearch<F> {
    const read: Record<string, unknown> = {};
    const failed = new Set<string>();
    for (const key of keys) {
      if (raw[key] === undefined) continue;
      const result = readField(spec.fields[key]!.schema, raw[key]);
      if (result.ok) read[key] = result.value;
      else failed.add(key);
    }
    for (const group of groups) {
      const values = Object.fromEntries(group.fields.map((key) => [key, read[key]])) as Partial<Record<keyof F & string, unknown>>;
      if (group.fields.some((key) => failed.has(key)) || group.valid?.(values) === false)
        for (const key of group.fields) delete read[key];
    }
    if (gated && (raw['searched'] === true || Object.keys(read).length > 0)) read['searched'] = true;
    return read as SparseSearch<F>;
  }

  function resolve(sparse: SparseSearch<F>): FullSearch<F> {
    const values = sparse as Record<string, unknown>;
    return {
      ...Object.fromEntries(keys.map((key) => [key, values[key] ?? spec.fields[key]!.default])),
      searched: !gated || values['searched'] === true,
    } as FullSearch<F>;
  }

  /** 정규 URL 표현. 다시 넣어도 같다. */
  function validateSearch(raw: UrlSearch): UrlSearch {
    return canonical(resolve(read(raw)));
  }

  function canonical(full: FullSearch<F>): UrlSearch {
    if (gated && !full.searched) return {};
    const values = full as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      const value = values[key];
      const field = spec.fields[key]!;
      if (value === undefined || sameSearchValue(value, field.default)) continue;
      result[key] = field.encode === undefined ? value : field.encode(value);
    }
    if (gated) result['searched'] = true;
    return result;
  }

  return {
    fields: spec.fields,
    view: { page: 'page', size: 'size', sort: 'sort', order: 'order', ...spec.view },
    sortFirst: spec.sortFirst ?? 'current',
    groups,
    gated,
    defaults,
    validateSearch,
    beforeLoad: ({ location }) => {
      const raw = (typeof location.search === 'object' && location.search !== null ? location.search : {}) as UrlSearch;
      const next = validateSearch(raw);
      if (sameSearchValue(raw, next)) return;
      throw redirect({ to: location.pathname, search: next as never, replace: true });
    },
    read,
    resolve,
    canonical,
  };
}
