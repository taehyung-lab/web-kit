// 파일 책임: 선언과 목록 UI 연결의 이름·종류·문구 누락을 컴파일 때 거부한다.
import { List } from '../../ui-registry/src/list';
import { arrayKeywordCodec, definePolicy, listSearch, keywords, choices, dateRange, paging, sort } from '../src/search';
import { z } from 'zod';
const declaration = listSearch({
  policy: definePolicy({ keys: { page: 'page', pageSize: 'size', sort: 'sort', order: 'order' }, paging: { sizes: [20], defaultSize: 20 }, sortFirst: 'desc', keywords: { codec: arrayKeywordCodec, pending: 'include' }, choices: { format: 'array' }, dateRange: { entry: 'paired', keys: { type: 'type', from: 'from', to: 'to' } } }),
  fields: { words: keywords({ targets: ['name', 'code'] }), states: choices({ values: ['on', 'off'], multiple: true }), one: choices({ values: ['on', 'off'] }), dates: dateRange({ types: ['created', 'updated'], defaultType: 'created' }), paging: paging(), sorting: sort({ values: ['name', 'created'], default: 'name' }) },
});
const L = List.of<typeof declaration>();
<L.Keywords name="words" label="Words" valueLabels={{ name: 'Name', code: 'Code' }} />;
<L.MultiSelect name="states" label="State" valueLabels={{ on: 'On', off: 'Off' }} />;
<L.Period name="dates" label="Dates" valueLabels={{ created: 'Created', updated: 'Updated' }} />;
<L.SortSelect valueLabels={{ name: 'Name', created: 'Created' }} />;
// @ts-expect-error 없는 이름
<L.Keywords name="word" label="Words" valueLabels={{ name: 'Name', code: 'Code' }} />;
// @ts-expect-error 검색어 종류가 아닌 칸
<L.Keywords name="states" label="Words" valueLabels={{ on: 'On', off: 'Off' }} />;
// @ts-expect-error 검색 대상 code의 문구 누락
<L.Keywords name="words" label="Words" valueLabels={{ name: 'Name' }} />;
// @ts-expect-error 단일 선택은 다중 선택 칸이 아니다
<L.MultiSelect name="one" label="State" valueLabels={{ on: 'On', off: 'Off' }} />;
// @ts-expect-error 선택지 문구 누락
<L.MultiSelect name="states" label="State" valueLabels={{ on: 'On' }} />;
// @ts-expect-error 기간 종류 문구 누락
<L.Period name="dates" label="Dates" valueLabels={{ created: 'Created' }} />;
// @ts-expect-error 정렬 문구 누락
<L.SortSelect valueLabels={{ name: 'Name' }} />;
// @ts-expect-error 없는 상세 칸
<L.FilterDetails names={['missing']}>Details</L.FilterDetails>;
// 상세 칸은 다른 부품과 같은 칸 이름으로 고른다: 기간 칸은 dates 하나이고 from·to·type 주소 키는 선언에서 푼다.
<L.FilterDetails names={['words', 'states', 'one', 'dates']}>Details</L.FilterDetails>;
// @ts-expect-error 기간의 주소 키 from은 칸 이름이 아니다
<L.FilterDetails names={['from']}>Details</L.FilterDetails>;
// 직접 선언한 칸(종류 선언이 아닌 칸)은 이름이 곧 주소 키라 그 이름으로 쓴다.
const custom = listSearch({
  policy: definePolicy({ keys: { page: 'page', pageSize: 'size', sort: 'sort', order: 'order' }, paging: { sizes: [20], defaultSize: 20 }, sortFirst: 'desc', keywords: { codec: arrayKeywordCodec, pending: 'include' }, choices: { format: 'array' }, dateRange: { entry: 'paired', keys: { type: 'type', from: 'from', to: 'to' } } }),
  fields: { groupIds: { schema: z.array(z.string()), default: [] as readonly string[] }, paging: paging(), sorting: sort({ values: ['name'], default: 'name' }) },
});
const C = List.of<typeof custom>();
<C.FilterDetails names={['groupIds']}>Details</C.FilterDetails>;
// 표 열의 sort는 선언한 정렬 값이다. 한 열이 두 값을 맡으면 둘 다 선언한 값이어야 한다.
<L.Table columns={[{ key: 'n', header: 'N', cell: () => null, sort: 'name' }, { key: 'd', header: 'D', cell: () => null, sort: ['created', 'name'] }]} />;
// @ts-expect-error 선언하지 않은 정렬 값
<L.Table columns={[{ key: 'n', header: 'N', cell: () => null, sort: 'nam' }]} />;
// @ts-expect-error 두 번째 정렬 값의 오타
<L.Table columns={[{ key: 'd', header: 'D', cell: () => null, sort: ['created', 'nam'] }]} />;
