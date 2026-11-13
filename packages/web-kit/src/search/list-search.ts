// 파일 책임: 목록 검색을 "칸 종류"로 선언한다(검색어·선택·기간·페이지·정렬). 종류가 주소 키·허용값·기본값·묶음 복구·
// 제출 정리·화면이 읽을 선택지를 함께 정하므로 소비자는 groups·periods·view를 따로 적지 않는다.
// 이 파일은 라우터를 실행 import하지 않는 순수 선언이다. 주소 연결은 connectSearch(fields.ts)가 같은 엔진으로 한다.
// 주소 표현·키 이름·보기 수·미추가 검색어 처리 같은 제품 규칙은 소비자의 정책(definePolicy)으로 받고 키트 기본값으로 두지 않는다.
import { isCalendarDate } from '../date-range';
import { normalizeFilterSelection, type Keyword, type SortFirst } from './interactions';
import type { FieldSchema, SearchField, SearchGroup, ViewKeys } from './fields';

type Issue = { readonly issues: readonly unknown[] };
const FAIL: Issue = { issues: [{ message: 'invalid search value' }] };

/** 동기 Standard Schema 하나. 키트 종류는 zod 없이 값을 읽는다. */
function schema<T>(read: (raw: unknown) => { readonly value: T } | Issue): FieldSchema<T> {
  return { '~standard': { validate: read } };
}

type RequiredField<T> = SearchField<T> & { readonly default: T };
type OptionalField<T> = SearchField<T> & { readonly default: undefined };

// ─── 정책 ───────────────────────────────────────────────────────────────────

/** 검색어 주소 표현. parse는 읽을 수 있는 항목을 내고(대상·빈 값 거르기는 키트가 한다), 전체를 읽을 수 없으면 undefined. */
export interface KeywordCodec {
  readonly parse: (raw: unknown) => readonly { readonly field: unknown; readonly value: unknown }[] | undefined;
  readonly format: (items: readonly Keyword[]) => unknown;
}

/** 검색어를 `{ field, value }` 배열 그대로 주소에 두는 표현(Router의 JSON 직렬화). */
export const arrayKeywordCodec: KeywordCodec = {
  parse: (raw) =>
    Array.isArray(raw)
      ? raw.flatMap((item: unknown) =>
          typeof item === 'object' && item !== null ? [item as { field: unknown; value: unknown }] : [],
        )
      : undefined,
  format: (items) => items,
};

/** 한 제품의 목록 검색 규칙. 모든 목록이 같은 규칙을 쓰도록 소비자가 한 번 선언한다. */
export interface ListSearchPolicy {
  /** 페이지·보기 수·정렬·방향의 주소 키. */
  readonly keys: { readonly page: string; readonly pageSize: string; readonly sort: string; readonly order: string };
  /** paging()을 인자 없이 쓸 때의 보기 수 선택지와 기본값. */
  readonly paging: { readonly sizes: readonly number[]; readonly defaultSize: number };
  /** 처음 누른 정렬 열의 방향. */
  readonly sortFirst: SortFirst;
  /**
   * 검색어. split은 입력 한 번에 여러 검색어를 넣는 구분자(화면의 추가와 검색 제출이 같은 규칙).
   * pending이 include면 [추가]를 누르지 않은 입력도 검색할 때 포함한다.
   */
  readonly keywords: { readonly codec: KeywordCodec; readonly split?: string; readonly pending: 'include' | 'exclude' };
  /** 다중 선택 주소 표현. comma는 `a,b`, array는 배열. allToken이 오면 조건 없음이다. */
  readonly choices: { readonly format: 'comma' | 'array'; readonly allToken?: string };
  /**
   * 날짜 기간. keys는 기본 주소 키. entry는 주소로 들어올 때의 규칙이다: paired는 한쪽만 있으면 두 날짜를 함께 지우고,
   * allow-open은 한쪽만 있어도 둔다. 어느 쪽이든 형식 오류·역순은 함께 지우고, 검색할 때는 한쪽만·역순을 함께 지운다.
   */
  readonly dateRange: {
    readonly entry: 'paired' | 'allow-open';
    readonly keys: { readonly type: string; readonly from: string; readonly to: string };
  };
}

/** 정책을 선언한다. 키 이름을 리터럴 타입으로 보존해 검색 값 타입이 실제 주소 키를 갖게 한다. */
export function definePolicy<const P extends ListSearchPolicy>(policy: P): P {
  if (!policy.paging.sizes.includes(policy.paging.defaultSize))
    throw new Error(`definePolicy: paging.defaultSize ${policy.paging.defaultSize} is not one of paging.sizes`);
  return policy;
}

// ─── 칸 종류 ────────────────────────────────────────────────────────────────

export interface KeywordsKind<T extends string = string> {
  readonly kind: 'keywords';
  readonly targets: readonly T[];
}
export interface ChoicesKind<T extends string = string, M extends boolean = boolean> {
  readonly kind: 'choices';
  readonly values: readonly T[];
  readonly multiple: M;
}
export interface DateKeys {
  readonly type: string;
  readonly from: string;
  readonly to: string;
}
export interface DateRangeKind<T extends string = string, K extends Partial<DateKeys> = Partial<DateKeys>> {
  readonly kind: 'dateRange';
  readonly types: readonly T[];
  readonly defaultType: T | undefined;
  readonly keys: K;
}
export interface PagingKind<S extends number = number> {
  readonly kind: 'paging';
  readonly sizes: readonly S[] | undefined;
  readonly defaultSize: S | undefined;
}
export interface SortKind<S extends string = string> {
  readonly kind: 'sort';
  readonly values: readonly S[];
  readonly default: S;
  readonly order: 'asc' | 'desc';
}
type Kind = KeywordsKind | ChoicesKind | DateRangeKind | PagingKind | SortKind;

/** 검색어 칩. targets는 고를 수 있는 검색 대상이고 첫 항목이 기본이다. */
export function keywords<const T extends string>(options: { readonly targets: readonly [T, ...T[]] }): KeywordsKind<T> {
  return { kind: 'keywords', targets: options.targets };
}

/** 고정 선택지. multiple이면 배열이고 빈 선택·전체 선택은 조건 없음이다. 선택지에 없는 값은 그 값만 버린다. */
export function choices<const T extends string, const M extends boolean = false>(options: {
  readonly values: readonly [T, ...T[]];
  readonly multiple?: M;
}): ChoicesKind<T, M> {
  return { kind: 'choices', values: options.values, multiple: (options.multiple ?? false) as M };
}

/** 날짜 기간. types를 주면 기간 기준(등록일·수정일 등) 칸도 만든다. keys는 정책의 기본 주소 키를 바꿀 때만 쓴다. */
export function dateRange<const T extends string = never, const K extends Partial<DateKeys> = {}>(
  options: { readonly types?: readonly [T, ...T[]]; readonly defaultType?: NoInfer<T>; readonly keys?: K } = {},
): DateRangeKind<T, K> {
  if (options.types !== undefined && (options.defaultType === undefined || !options.types.includes(options.defaultType)))
    throw new Error('dateRange: defaultType must be one of types');
  return { kind: 'dateRange', types: options.types ?? [], defaultType: options.defaultType, keys: (options.keys ?? {}) as K };
}

/** 페이지·보기 수. 인자가 없으면 정책의 보기 수를 쓴다. */
export function paging<const S extends number = never>(options?: { readonly sizes: readonly [S, ...S[]]; readonly defaultSize: NoInfer<S> }): PagingKind<S> {
  if (options !== undefined && !options.sizes.includes(options.defaultSize))
    throw new Error(`paging: defaultSize ${options.defaultSize} is not one of sizes`);
  return { kind: 'paging', sizes: options?.sizes, defaultSize: options?.defaultSize };
}

/** 정렬 기준과 방향. */
export function sort<const S extends string>(options: {
  readonly values: readonly [S, ...S[]];
  readonly default: NoInfer<S>;
  readonly order?: 'asc' | 'desc';
}): SortKind<S> {
  return { kind: 'sort', values: options.values, default: options.default, order: options.order ?? 'desc' };
}

// ─── 화면이 읽는 선언 정보 ───────────────────────────────────────────────────

/** 칸 이름별 종류 정보. 화면 부품은 이것을 읽어 주소 키·선택지를 다시 받지 않는다. */
export type SearchMetaEntry =
  | { readonly kind: 'keywords'; readonly targets: readonly string[]; readonly split?: string; readonly pending: 'include' | 'exclude' }
  | { readonly kind: 'choices'; readonly key: string; readonly values: readonly string[]; readonly multiple: boolean }
  | { readonly kind: 'dateRange'; readonly keys: DateKeys; readonly types: readonly string[] }
  | { readonly kind: 'paging'; readonly sizes: readonly number[] }
  | { readonly kind: 'sort'; readonly values: readonly string[] };
export type SearchMeta = Readonly<Record<string, SearchMetaEntry>>;

/** 선언의 이름·종류·허용값을 UI 타입까지 보존한다. 실행 시 meta와 같은 모양이다. */
export type ListSearchMeta<F, P extends ListSearchPolicy> = {
  readonly [N in keyof F & string as F[N] extends Kind ? N : never]:
    F[N] extends KeywordsKind<infer T> ? Extract<SearchMetaEntry, { kind: 'keywords' }> & { readonly targets: readonly T[] }
    : F[N] extends ChoicesKind<infer T, infer M> ? { readonly kind: 'choices'; readonly key: N; readonly values: readonly T[]; readonly multiple: M }
    : F[N] extends DateRangeKind<infer T, infer K> ? { readonly kind: 'dateRange'; readonly keys: KeysOf<K, P>; readonly types: readonly T[] }
    : F[N] extends PagingKind<infer S> ? { readonly kind: 'paging'; readonly sizes: readonly ([S] extends [never] ? P['paging']['sizes'][number] : S)[] }
    : F[N] extends SortKind<infer S> ? { readonly kind: 'sort'; readonly values: readonly S[] }
    : never;
};

// ─── 검색 값 타입 ───────────────────────────────────────────────────────────

type KeysOf<K extends Partial<DateKeys>, P extends ListSearchPolicy> = {
  readonly [N in keyof DateKeys]: K[N] extends string ? K[N] : P['dateRange']['keys'][N];
};
type DateFields<T extends string, D extends DateKeys> = { readonly [_ in D['from'] | D['to']]: OptionalField<string> } & ([
  T,
] extends [never]
  ? unknown
  : { readonly [_ in D['type']]: RequiredField<T> });
type FieldsOfKind<N extends string, K, P extends ListSearchPolicy> =
  K extends KeywordsKind
    ? { readonly [_ in N]: RequiredField<readonly Keyword[]> }
    : K extends ChoicesKind<infer T, infer M>
      ? [M] extends [true]
        ? { readonly [_ in N]: RequiredField<readonly T[]> }
        : { readonly [_ in N]: OptionalField<T> }
      : K extends DateRangeKind<infer T, infer DK>
        ? DateFields<T, KeysOf<DK, P>>
        : K extends PagingKind<infer S>
          ? { readonly [_ in P['keys']['page']]: RequiredField<number> } & {
              readonly [_ in P['keys']['pageSize']]: RequiredField<[S] extends [never] ? P['paging']['sizes'][number] : S>;
            }
          : K extends SortKind<infer S>
            ? { readonly [_ in P['keys']['sort']]: RequiredField<S> } & { readonly [_ in P['keys']['order']]: RequiredField<'asc' | 'desc'> }
            : K extends SearchField<unknown>
              ? { readonly [_ in N]: K }
              : never;
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;
type Flatten<T> = { readonly [K in keyof T]: T[K] };
/** 칸 선언 → 주소 키별 필드. */
export type ListSearchFields<F, P extends ListSearchPolicy> = Flatten<
  UnionToIntersection<{ [N in keyof F & string]: FieldsOfKind<N, F[N], P> }[keyof F & string]>
>;

type AsFields<T> = T extends Record<string, SearchField<any>> ? T : never;

/** listSearch 결과. defineSearch에 그대로 넘길 수 있는 선언과 화면용 meta를 함께 갖는다. */
export interface ListSearch<F extends Record<string, SearchField<any>>, M extends SearchMeta = SearchMeta> {
  readonly fields: F;
  readonly groups: readonly SearchGroup<keyof F & string>[];
  readonly periods: readonly (readonly [keyof F & string, keyof F & string])[];
  readonly view: Partial<Record<keyof ViewKeys, keyof F & string>>;
  readonly sortFirst: SortFirst;
  readonly meta: M;
}

/** 확정 검색 값(주소 키별, 기본값을 채운 값). api가 서버 요청으로 바꿀 때 받는다. */
export type SearchValues<S> = S extends ListSearch<infer F>
  ? { readonly [K in keyof F]: F[K] extends SearchField<infer T> ? (F[K]['default'] extends undefined ? T | undefined : T) : never }
  : never;

// ─── 선언 ───────────────────────────────────────────────────────────────────

function isKind(value: unknown): value is Kind {
  return typeof value === 'object' && value !== null && 'kind' in value && !('schema' in value);
}

/**
 * 목록 검색을 칸 종류로 선언한다. fields의 이름은 화면이 칸을 가리키는 이름이고, 실제 주소 키는 종류가 정한다
 * (검색어·선택은 이름 그대로, 기간·페이지·정렬은 정책 키). 기존 SearchField도 그대로 넣을 수 있다.
 * 같은 주소 키가 두 번 나오면 오류다.
 */
export function listSearch<const P extends ListSearchPolicy, const F extends Record<string, Kind | SearchField<any>>>(spec: {
  readonly policy: P;
  readonly fields: F;
}): ListSearch<AsFields<ListSearchFields<F, P>>, ListSearchMeta<F, P>> {
  const { policy } = spec;
  const fields: Record<string, SearchField<any>> = {};
  const groups: SearchGroup[] = [];
  const periods: (readonly [string, string])[] = [];
  const meta: Record<string, SearchMetaEntry> = {};
  let view: Partial<Record<keyof ViewKeys, string>> = {};
  const put = (key: string, field: SearchField<any>) => {
    if (key in fields) throw new Error(`listSearch: duplicate search key "${key}"`);
    fields[key] = field;
  };

  for (const [name, entry] of Object.entries(spec.fields)) {
    if (!isKind(entry)) {
      put(name, entry as SearchField<any>);
      continue;
    }
    switch (entry.kind) {
      case 'keywords': {
        const targets: readonly string[] = entry.targets;
        const { codec } = policy.keywords;
        put(name, {
          schema: schema((raw) => {
            const items = codec.parse(raw);
            if (items === undefined) return FAIL;
            return {
              value: items.flatMap((item) =>
                typeof item.field === 'string' && targets.includes(item.field) && typeof item.value === 'string' && item.value.trim() !== ''
                  ? [{ field: item.field, value: item.value.trim() }]
                  : [],
              ),
            };
          }),
          default: [] as readonly Keyword[],
          encode: (items: readonly Keyword[]) => codec.format(items),
        });
        meta[name] = { kind: 'keywords', targets, split: policy.keywords.split, pending: policy.keywords.pending };
        break;
      }
      case 'choices': {
        const values: readonly string[] = entry.values;
        const { format, allToken } = policy.choices;
        if (entry.multiple) {
          put(name, {
            schema: schema((raw) => {
              const items = format === 'comma' ? (typeof raw === 'string' ? raw.split(',') : undefined) : Array.isArray(raw) ? raw : undefined;
              if (items === undefined) return FAIL;
              if (allToken !== undefined && items.includes(allToken)) return { value: [] };
              return { value: normalizeFilterSelection(items.filter((item): item is string => values.includes(item as string)), values) };
            }),
            default: [] as readonly string[],
            encode: (items: readonly string[]) => (format === 'comma' ? items.join(',') : items),
          });
        } else {
          put(name, {
            schema: schema((raw) => (typeof raw === 'string' && values.includes(raw) ? { value: raw } : FAIL)),
            default: undefined,
          });
        }
        meta[name] = { kind: 'choices', key: name, values, multiple: entry.multiple };
        break;
      }
      case 'dateRange': {
        const keys: DateKeys = { ...policy.dateRange.keys, ...entry.keys };
        const date = { schema: schema((raw) => (typeof raw === 'string' && isCalendarDate(raw) ? { value: raw } : FAIL)), default: undefined };
        const types: readonly string[] = entry.types;
        if (types.length > 0)
          put(keys.type, { schema: schema((raw) => (typeof raw === 'string' && types.includes(raw) ? { value: raw } : FAIL)), default: entry.defaultType });
        put(keys.from, date);
        put(keys.to, date);
        const paired = policy.dateRange.entry === 'paired';
        groups.push({
          fields: [keys.from, keys.to],
          valid: (pair) => {
            const start = pair[keys.from];
            const end = pair[keys.to];
            if (start === undefined || end === undefined) return !paired || start === end;
            return String(start) <= String(end);
          },
        });
        periods.push([keys.from, keys.to]);
        meta[name] = { kind: 'dateRange', keys, types };
        break;
      }
      case 'paging': {
        const sizes: readonly number[] = entry.sizes ?? policy.paging.sizes;
        const defaultSize = entry.defaultSize ?? policy.paging.defaultSize;
        put(policy.keys.page, {
          schema: schema((raw) => (typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 1 ? { value: raw } : FAIL)),
          default: 1,
        });
        put(policy.keys.pageSize, { schema: schema((raw) => (typeof raw === 'number' && sizes.includes(raw) ? { value: raw } : FAIL)), default: defaultSize });
        view = { ...view, page: policy.keys.page, size: policy.keys.pageSize };
        meta[name] = { kind: 'paging', sizes };
        break;
      }
      case 'sort': {
        const values: readonly string[] = entry.values;
        put(policy.keys.sort, { schema: schema((raw) => (typeof raw === 'string' && values.includes(raw) ? { value: raw } : FAIL)), default: entry.default });
        put(policy.keys.order, { schema: schema((raw) => (raw === 'asc' || raw === 'desc' ? { value: raw } : FAIL)), default: entry.order });
        view = { ...view, sort: policy.keys.sort, order: policy.keys.order };
        meta[name] = { kind: 'sort', values };
        break;
      }
    }
  }
  return { fields, groups, periods, view, sortFirst: policy.sortFirst, meta } as unknown as ListSearch<AsFields<ListSearchFields<F, P>>, ListSearchMeta<F, P>>;
}
