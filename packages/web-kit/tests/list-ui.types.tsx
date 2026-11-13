// 파일 책임: 선언과 목록 UI 연결의 이름·종류·문구 누락을 컴파일 때 거부한다.
import { List } from '../../ui-registry/src/list';
import { arrayKeywordCodec, definePolicy, listSearch, keywords, choices, dateRange, paging, sort } from '../src/search';
const declaration = listSearch({
  policy: definePolicy({ keys: { page: 'page', pageSize: 'size', sort: 'sort', order: 'order' }, paging: { sizes: [20], defaultSize: 20 }, sortFirst: 'desc', keywords: { codec: arrayKeywordCodec, pending: 'include' }, choices: { format: 'array' }, dateRange: { entry: 'paired', keys: { type: 'type', from: 'from', to: 'to' } } }),
  fields: { words: keywords({ targets: ['name', 'code'] }), states: choices({ values: ['on', 'off'], multiple: true }), one: choices({ values: ['on', 'off'] }), dates: dateRange({ types: ['created', 'updated'], defaultType: 'created' }), paging: paging(), sorting: sort({ values: ['name', 'created'], default: 'name' }) },
});
const L = List.of<typeof declaration>();
<L.Keywords name="words" label="Words" choiceLabels={{ name: 'Name', code: 'Code' }} />;
<L.MultiSelect name="states" label="State" optionLabels={{ on: 'On', off: 'Off' }} />;
<L.Period name="dates" label="Dates" typeLabels={{ created: 'Created', updated: 'Updated' }} />;
<L.SortSelect optionLabels={{ name: 'Name', created: 'Created' }} />;
// @ts-expect-error 없는 이름
<L.Keywords name="word" label="Words" choiceLabels={{ name: 'Name', code: 'Code' }} />;
// @ts-expect-error 검색어 종류가 아닌 칸
<L.Keywords name="states" label="Words" choiceLabels={{ on: 'On', off: 'Off' }} />;
// @ts-expect-error 검색 대상 code의 문구 누락
<L.Keywords name="words" label="Words" choiceLabels={{ name: 'Name' }} />;
// @ts-expect-error 단일 선택은 다중 선택 칸이 아니다
<L.MultiSelect name="one" label="State" optionLabels={{ on: 'On', off: 'Off' }} />;
// @ts-expect-error 선택지 문구 누락
<L.MultiSelect name="states" label="State" optionLabels={{ on: 'On' }} />;
// @ts-expect-error 기간 종류 문구 누락
<L.Period name="dates" label="Dates" typeLabels={{ created: 'Created' }} />;
// @ts-expect-error 정렬 문구 누락
<L.SortSelect optionLabels={{ name: 'Name' }} />;
// @ts-expect-error 없는 상세 칸
<L.Detail keys={['missing']}>Details</L.Detail>;
