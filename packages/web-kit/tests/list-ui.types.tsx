// 파일 책임: 선언과 목록 UI 연결의 이름·종류·문구 누락을 컴파일 때 거부한다.
import { List } from '../../ui-registry/src/list';
import { arrayKeywordCodec, definePolicy, listSearch, keywords, choices, dateRange, paging, sort } from '../src/search';
import { z } from 'zod';
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
// 상세 칸 이름은 확정 검색값의 이름이다: 기간 칸 dates의 값은 from·to·type으로 나뉘어 있다.
<L.Detail keys={['states', 'one', 'from', 'to', 'type']}>Details</L.Detail>;
// @ts-expect-error 화면 칸 이름 dates는 확정 검색값의 이름이 아니다
<L.Detail keys={['dates']}>Details</L.Detail>;
// 직접 선언한 칸(종류 선언이 아닌 칸)도 확정 검색값이라 상세 칸 이름으로 쓸 수 있다.
const custom = listSearch({
  policy: definePolicy({ keys: { page: 'page', pageSize: 'size', sort: 'sort', order: 'order' }, paging: { sizes: [20], defaultSize: 20 }, sortFirst: 'desc', keywords: { codec: arrayKeywordCodec, pending: 'include' }, choices: { format: 'array' }, dateRange: { entry: 'paired', keys: { type: 'type', from: 'from', to: 'to' } } }),
  fields: { groupIds: { schema: z.array(z.string()), default: [] as readonly string[] }, paging: paging(), sorting: sort({ values: ['name'], default: 'name' }) },
});
const C = List.of<typeof custom>();
<C.Detail keys={['groupIds']}>Details</C.Detail>;
// 표 열의 sort는 선언한 정렬 값이다. 한 열이 두 값을 맡으면 둘 다 선언한 값이어야 한다.
<L.Table columns={[{ key: 'n', header: 'N', cell: () => null, sort: 'name' }, { key: 'd', header: 'D', cell: () => null, sort: ['created', 'name'] }]} />;
// @ts-expect-error 선언하지 않은 정렬 값
<L.Table columns={[{ key: 'n', header: 'N', cell: () => null, sort: 'nam' }]} />;
// @ts-expect-error 두 번째 정렬 값의 오타
<L.Table columns={[{ key: 'd', header: 'D', cell: () => null, sort: ['created', 'nam'] }]} />;
