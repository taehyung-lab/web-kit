// 파일 책임: 칸 종류 선언에서 확정 검색 값 타입이 실제 주소 키와 허용값으로 추론되는지 검사한다.
import { connectSearch } from '../src/search/fields';
import { choices, dateRange, definePolicy, keywords, listSearch, paging, sort, arrayKeywordCodec, type SearchValues } from '../src/search/list-search';
import type { Keyword } from '../src/search/interactions';

const policy = definePolicy({
  keys: { page: 'page', pageSize: 'pageSize', sort: 'sort', order: 'order' },
  paging: { sizes: [20, 100], defaultSize: 100 },
  sortFirst: 'desc',
  keywords: { codec: arrayKeywordCodec, pending: 'include' },
  choices: { format: 'comma' },
  dateRange: { entry: 'paired', keys: { type: 'dateType', from: 'startDate', to: 'endDate' } },
});
const declaration = listSearch({
  policy,
  fields: {
    search: keywords({ targets: ['name'] }),
    statuses: choices({ values: ['active', 'inactive'], multiple: true }),
    kind: choices({ values: ['a', 'b'] }),
    period: dateRange({ types: ['createdAt', 'updatedAt'], defaultType: 'createdAt' }),
    paging: paging({ sizes: [20, 50], defaultSize: 20 }),
    sorting: sort({ values: ['createdAt', 'name'], default: 'createdAt' }),
  },
});
type Values = SearchValues<typeof declaration>;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const checks: [
  Equal<Values['search'], readonly Keyword[]>,
  Equal<Values['statuses'], readonly ('active' | 'inactive')[]>,
  Equal<Values['kind'], 'a' | 'b' | undefined>,
  Equal<Values['dateType'], 'createdAt' | 'updatedAt'>,
  Equal<Values['startDate'], string | undefined>,
  Equal<Values['page'], number>,
  Equal<Values['pageSize'], 20 | 50>,
  Equal<Values['sort'], 'createdAt' | 'name'>,
  Equal<Values['order'], 'asc' | 'desc'>,
] = [true, true, true, true, true, true, true, true, true];
void checks;
// @ts-expect-error 칸 이름(period)은 주소 키가 아니다.
type NoPeriodKey = Values['period'];
// 정책 보기 수: 인자 없는 paging은 정책 sizes 타입.
const common = listSearch({ policy, fields: { paging: paging() } });
const pageSize: SearchValues<typeof common>['pageSize'] = 100;
void pageSize;
// 기간 기준이 없으면 dateType 칸도 없다.
const noType = listSearch({ policy, fields: { period: dateRange() } });
// @ts-expect-error types 없는 기간에는 기간 기준 칸이 없다.
type NoType = SearchValues<typeof noType>['dateType'];
// connectSearch의 checks는 실제 칸 이름만 받는다.
connectSearch(declaration, {
  // @ts-expect-error 없는 칸
  checks: { missing: undefined },
});

// 화면 배치는 표시할 모든 검색 칸을 한 번씩 받는다. 페이지·정렬은 표의 도구다.
import { type ListFilterLayout, serverChoices } from '../src/search';
const filterSearch = listSearch({
  policy,
  fields: {
    term: keywords({ targets: ['name'] }),
    group: serverChoices({ schema: declaration.fields.statuses.schema, default: [], encode: String }, { multiple: true }),
    paging: paging(),
  },
});
type Layout = ListFilterLayout<typeof filterSearch.meta>;
const layout: Layout = {
  term: { section: 'basic', valueLabels: { name: 'Name' } },
  group: { section: 'detail', title: 'Group' },
};
void layout;
// @ts-expect-error 서버 선택지 칸의 배치 누락
const missingFilter: Layout = { term: layout.term };
// @ts-expect-error 검색 대상 이름 오타
const wrongLabel: Layout = { ...layout, term: { section: 'basic', valueLabels: { neme: 'Name' } } };
// @ts-expect-error 서버 선택지 조회 연결 누락
connectSearch(filterSearch);
void [missingFilter, wrongLabel];
