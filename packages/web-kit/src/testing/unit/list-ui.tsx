// 파일 책임: list-ui 복사본의 공통 적합성 기준과 단언을 소유한다.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it as baseIt, vi } from 'vitest';
import { z } from 'zod';
import { useListDownload, type DownloadTarget } from '../../list-download';
import type * as Contract0 from '../contracts/list-ui';
import { defineSearch, type SearchDefinition } from '../../search/fields';
import type * as Contract2 from '../contracts/ui';
import { useList, type ListPage } from '../../use-list';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';
type ListColumn<T> = Contract0.ListColumn<T>;
/** 소비처가 넘긴 실제 복사본으로 list-ui 보장 전체를 등록한다. */
export function checkListUiConformance({ List, useListField, Pending }: { List: typeof Contract0.List; useListField: typeof Contract0.useListField; Pending: typeof Contract2.Pending }, target: ConformanceTarget) {
  const it = baseIt;
  const title = (id: string, label: string) => conformanceTitle(id, target, label);
// @vitest-environment jsdom
// 파일 책임: List 묶음 부품이 실제 useList와 함께 내는 화면·요청을 검사한다(키워드·기간·다중 선택·상세·일괄 작업·정렬·배치·다운로드).

interface Row {
  readonly id: string;
}
const keyword = z.object({ field: z.string(), value: z.string() });
const definition = defineSearch({
  fields: {
    page: { schema: z.number(), default: 1 },
    size: { schema: z.number(), default: 20 },
    sort: { schema: z.enum(['name', 'createdAt']), default: 'createdAt' },
    order: { schema: z.enum(['asc', 'desc']), default: 'desc' },
    keywords: { schema: z.array(keyword), default: [] },
    from: { schema: z.string(), default: undefined },
    to: { schema: z.string(), default: undefined },
    tags: { schema: z.array(z.string()), default: [] },
  },
  sortFirst: 'desc',
});
type Fields = (typeof definition)['fields'];

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

type Model = ReturnType<typeof useList<Fields, Row>>;
let model!: Model;

/** 실제 useList와 URL 상태를 가진 소비 fixture. children이 배치를 정한다. */
function mount(
  layout: (model: Model) => ReactNode,
  options: {
    fetch?: (search: unknown) => Promise<ListPage<Row>>;
    def?: SearchDefinition<Fields>;
    initial?: Record<string, unknown>;
  } = {},
) {
  const fetch = vi.fn(options.fetch ?? (async () => ({ rows: [{ id: 'a' }, { id: 'b' }], total: 2 })));
  const def = options.def ?? definition;
  const navigations: unknown[] = [];
  function App() {
    const [url, setUrl] = useState(() => def.validateSearch(options.initial ?? {}));
    model = useList({
      definition: def,
      search: url,
      navigate: (next) => {
        navigations.push(next);
        setUrl(next);
      },
      query: (full) => ({ queryKey: ['items', full], queryFn: () => fetch(full) }),
      rowId: (row) => row.id,
      periods: [['from', 'to']],
    });
    return <List model={model}>{layout(model)}</List>;
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
  return { fetch, navigations };
}

const columns: readonly ListColumn<Row>[] = [
  { key: 'name', header: '이름', cell: (row) => row.id, sort: 'name' },
  { key: 'createdAt', header: '등록일', cell: () => '-', sort: 'createdAt' },
];

/** 위쪽 필터 배치. */
function topLayout() {
  return (
    <>
      <List.Filter>
        <List.Keywords name="keywords" label="키워드" choices={[{ value: 'name', label: '이름' }]} />
        <List.Period
          from="from"
          to="to"
          label="기간"
          timeZone="Asia/Seoul"
          now={() => new Date('2026-03-31T00:00:00Z')}
          presets={[{ label: '한 달', value: { unit: 'month', amount: -1 } }]}
        />
        <List.FilterActions />
      </List.Filter>
      <List.Total />
      <List.Result>
        <List.Table columns={columns} rowId={(row) => row.id} selectable />
      </List.Result>
    </>
  );
}

const checked = (element: HTMLElement) => element.getAttribute('aria-checked') === 'true';

it(title('G091', '입력 중인 키워드를 검색에 포함하고 같은 칩은 중복하지 않으며 초기화는 지운다'), async () => {
  const { fetch } = mount(topLayout);
  await screen.findByText('a');
  fireEvent.change(screen.getByRole('textbox', { name: '키워드' }), { target: { value: '  hello  ' } });
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ keywords: [{ field: 'name', value: 'hello' }] })));
  expect((screen.getByRole('textbox', { name: '키워드' }) as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByRole('textbox', { name: '키워드' }), { target: { value: 'hello' } });
  // 검색어 칸의 Enter는 [추가]다(1.5 search-field-input과 같다). 브라우저처럼 막히지 않은 Enter는 검색 영역 폼을 제출하므로 그것까지 흉내 낸다.
  const searches = fetch.mock.calls.length;
  const keyword = screen.getByRole('textbox', { name: '키워드' }) as HTMLInputElement;
  await act(async () => {
    if (fireEvent.keyDown(keyword, { key: 'Enter' })) keyword.form?.requestSubmit();
  });
  expect(screen.getAllByRole('button', { name: 'hello 제거' })).toHaveLength(1);
  expect(fetch.mock.calls.length).toBe(searches);
  fireEvent.click(screen.getByRole('button', { name: '초기화' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'hello 제거' })).toBeNull());
});

it(title('G092', '반례: 키워드 UI를 숨겨도 이미 입력한 글자는 검색에 들어간다'), async () => {
  let show = true;
  let rerender!: () => void;
  function Toggle({ children }: { children: ReactNode }) {
    const [, setTick] = useState(0);
    rerender = () => setTick((tick) => tick + 1);
    return show ? children : null;
  }
  const { fetch } = mount(() => (
    <List.Filter>
      <Toggle>
        <List.Keywords name="keywords" label="키워드" choices={[{ value: 'name', label: '이름' }]} />
      </Toggle>
      <List.FilterActions />
    </List.Filter>
  ));
  fireEvent.change(screen.getByRole('textbox', { name: '키워드' }), { target: { value: 'kept' } });
  show = false;
  act(() => rerender());
  expect(screen.queryByRole('textbox', { name: '키워드' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ keywords: [{ field: 'name', value: 'kept' }] })));
});

it(title('G093', '반례: 기간 입력칸을 프로젝트 부품으로 바꿔도 맞지 않는 기간은 그 칸만 기본값으로 돌리고 검색한다'), async () => {
  /** 프로젝트가 만든 날짜 입력. 키트 Period를 쓰지 않는다. */
  function OwnDate({ name }: { name: string }) {
    const field = useListField<string | undefined>(name);
    return <input aria-label={`own-${name}`} value={field.value ?? ''} onChange={(event) => field.set(event.target.value)} />;
  }
  const { fetch } = mount(() => (
    <List.Filter>
      <OwnDate name="from" />
      <OwnDate name="to" />
      <List.FilterActions />
    </List.Filter>
  ));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  for (const [from, to] of [
    ['2026-03-31', '2026-03-01'],
    ['2026-03-31', ''],
  ]) {
    const before = fetch.mock.calls.length;
    fireEvent.change(screen.getByLabelText('own-from'), { target: { value: from } });
    fireEvent.change(screen.getByLabelText('own-to'), { target: { value: to } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(before + 1));
    expect(fetch.mock.lastCall?.[0]).toMatchObject({ from: undefined, to: undefined });
    expect(model.issues).toEqual([]);
    expect((screen.getByLabelText('own-from') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('own-to') as HTMLInputElement).value).toBe('');
  }
});

it(title('G094', '역순 기간은 기간만 비우고 나머지 조건으로 검색하며 달 단축은 월말을 보정한다'), async () => {
  const { fetch } = mount(topLayout);
  await screen.findByText('a');
  fireEvent.change(screen.getByRole('textbox', { name: '키워드' }), { target: { value: 'kept' } });
  fireEvent.change(screen.getByLabelText('기간 시작'), { target: { value: '2026-03-31' } });
  fireEvent.change(screen.getByLabelText('기간 종료'), { target: { value: '2026-03-01' } });
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ keywords: [{ field: 'name', value: 'kept' }] })));
  expect(fetch.mock.lastCall?.[0]).toMatchObject({ from: undefined, to: undefined });
  expect(screen.queryByRole('alert')).toBeNull();
  expect((screen.getByLabelText('기간 시작') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('기간 종료') as HTMLInputElement).value).toBe('');
  fireEvent.click(screen.getByRole('button', { name: '한 달' }));
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-02-28', to: '2026-03-31' })));
});

it(title('G095', '정렬: 새 머리글은 선언한 첫 방향, 같은 머리글은 반전, 필터 제출은 정렬·크기를 유지하고 페이지만 1'), async () => {
  const { fetch } = mount(topLayout, { initial: { page: 3, size: 50 } });
  await screen.findByText('a');
  fireEvent.click(screen.getByRole('button', { name: /이름/ }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'name', order: 'desc', page: 1 })));
  fireEvent.click(screen.getByRole('button', { name: /이름/ }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'name', order: 'asc' })));
  expect(screen.getByRole('columnheader', { name: /이름/ }).getAttribute('aria-sort')).toBe('ascending');
  act(() => model.goToPage(2));
  fireEvent.change(screen.getByRole('textbox', { name: '키워드' }), { target: { value: 'x' } });
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'name', order: 'asc', size: 50, page: 1 })));
});

it(title('G096', '일괄 요청 실패는 확인창과 선택을 보존하고 부분 성공은 성공한 선택만 비운다'), async () => {
  const run = vi
    .fn<(ids: readonly string[]) => Promise<{ completedIds: readonly string[] }>>()
    .mockRejectedValueOnce(Error('rejected'))
    .mockResolvedValueOnce({ completedIds: ['a'] });
  mount(() => (
    <List.Result>
      <List.Actions>
        <List.BulkAction label="일괄 저장" run={run} />
      </List.Actions>
      <List.Table columns={columns} rowId={(row) => row.id} selectable />
    </List.Result>
  ));
  await screen.findByText('a');
  fireEvent.click(screen.getByRole('checkbox', { name: '이 페이지 전체 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '일괄 저장' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '확인' }));
  await waitFor(() => expect(within(screen.getByRole('alertdialog')).getByRole('alert')).toBeTruthy());
  expect(run).toHaveBeenLastCalledWith(['a', 'b']);
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '확인' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(screen.getAllByRole('checkbox', { name: '행 선택' }).map(checked)).toEqual([false, true]);
});

it(title('G097', '이전 조건 결과를 보이는 동안 총건수는 …, 선택·액션은 잠기고, 새 결과가 오면 풀린다'), async () => {
  let release!: () => void;
  const { fetch } = mount(
    () => (
      <>
        <List.Total />
        <List.Actions>
          <button type="button">쓰기</button>
        </List.Actions>
        <List.Result>
          <List.Table columns={columns} rowId={(row) => row.id} selectable />
        </List.Result>
      </>
    ),
    {
      fetch: async (search) =>
        (search as { page: number }).page === 1
          ? { rows: [{ id: 'a' }], total: 120 }
          : new Promise((resolve) => (release = () => resolve({ rows: [{ id: 'z' }], total: 120 }))),
    },
  );
  await screen.findByText('a');
  expect(screen.getByText('120')).toBeTruthy();
  act(() => model.goToPage(2));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(screen.getByText('…')).toBeTruthy();
  expect((screen.getByRole('button', { name: '쓰기' }).closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
  expect(
    screen.getByRole('checkbox', { name: '행 선택' }).getAttribute('aria-disabled') ??
      screen.getByRole('checkbox', { name: '행 선택' }).hasAttribute('data-disabled'),
  ).toBeTruthy();
  await act(async () => release());
  await screen.findByText('z');
  expect((screen.getByRole('button', { name: '쓰기' }).closest('fieldset') as HTMLFieldSetElement).disabled).toBe(false);
});

it(title('G098', '제한 없음은 전체 체크로 보이고 일부 해제를 다음 요청에 반영한다'), async () => {
  const { fetch } = mount(() => (
    <List.Filter>
      <List.MultiSelect
        name="tags"
        label="태그"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />
      <List.FilterActions />
    </List.Filter>
  ));
  expect(checked(screen.getByRole('checkbox', { name: 'A' }))).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'A' }));
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['b'] })));
  fireEvent.click(screen.getByRole('checkbox', { name: 'A' }));
  expect(checked(screen.getByRole('checkbox', { name: 'A' }))).toBe(true);
  expect(model.draft.tags).toEqual([]);
});

it(title('G099', '키워드 대상이 늦게 도착해도 현재 선택지로 검색한다'), async () => {
  let setChoices!: (next: readonly { value: string; label: string }[]) => void;
  function LateKeywords() {
    const [choices, set] = useState<readonly { value: string; label: string }[]>([]);
    setChoices = set;
    return <List.Keywords name="keywords" label="늦은 대상" choices={choices} />;
  }
  const { fetch } = mount(() => (
    <List.Filter>
      <LateKeywords />
      <List.FilterActions />
    </List.Filter>
  ));
  act(() => setChoices([{ value: 'name', label: '이름' }]));
  fireEvent.change(screen.getByRole('textbox', { name: '늦은 대상' }), { target: { value: 'hello' } });
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ keywords: [{ field: 'name', value: 'hello' }] })));
});

it(title('G100', '상세 기본 조건은 초기화 뒤에도 보이고 접어도 미확정 입력은 보존한다'), () => {
  const def = defineSearch({ fields: { q: { schema: z.string(), default: 'default' } } });
  function App() {
    const [url, setUrl] = useState(() => def.validateSearch({}));
    const list = useList({
      definition: def,
      search: url,
      navigate: (next) => setUrl(next),
      query: (full) => ({ queryKey: ['detail', full], queryFn: async () => ({ rows: [] as Row[], total: 0 }) }),
      rowId: (row) => row.id,
    });
    return (
      <List model={list}>
        <List.Filter>
          <List.Detail keys={['q']}>
            <List.Text name="q" label="상세 조건" />
          </List.Detail>
          <List.FilterActions />
        </List.Filter>
      </List>
    );
  }
  const client = new QueryClient();
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
  const toggle = screen.getByRole('button', { name: '상세 검색' });
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  fireEvent.change(screen.getByRole('textbox', { name: '상세 조건' }), { target: { value: 'draft' } });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect((screen.getByRole('textbox', { name: '상세 조건' }) as HTMLInputElement).value).toBe('draft');
  fireEvent.click(screen.getByRole('button', { name: '초기화' }));
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect((screen.getByRole('textbox', { name: '상세 조건' }) as HTMLInputElement).value).toBe('default');
});

it(title('G101', '반례: 필터를 왼쪽으로 옮기는 배치만 바꿔도 조회·정렬·선택 연결 코드는 같다'), async () => {
  /** 같은 부품을 다른 순서·감싸기로 둔다. 상태 조립(useList)은 mount가 그대로 쓴다. */
  function leftLayout() {
    return (
      <div style={{ display: 'flex' }}>
        <aside>
          <List.Filter>
            <List.Keywords name="keywords" label="키워드" choices={[{ value: 'name', label: '이름' }]} />
            <List.FilterActions />
          </List.Filter>
        </aside>
        <main>
          <List.Result>
            <List.Table columns={columns} rowId={(row) => row.id} selectable />
          </List.Result>
          <List.Total />
        </main>
      </div>
    );
  }
  for (const layout of [topLayout, leftLayout]) {
    const { fetch } = mount(layout);
    await screen.findByText('a');
    fireEvent.change(screen.getByRole('textbox', { name: '키워드' }), { target: { value: 'k' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ keywords: [{ field: 'name', value: 'k' }] })));
    await screen.findByText('a');
    fireEvent.click(screen.getByRole('button', { name: /이름/ }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'name' })));
    await screen.findByText('a');
    fireEvent.click(screen.getAllByRole('checkbox', { name: '행 선택' })[0]!);
    expect(model.selection.selectedIds).toEqual(['a']);
    cleanup();
  }
});

it(title('G102', '행이 많으면 보이는 행만 그린다'), async () => {
  const rows = Array.from({ length: 300 }, (_, index) => ({ id: `r${index}` }));
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  mount(
    () => (
      <List.Result>
        <List.Table columns={columns} rowId={(row) => row.id} />
      </List.Result>
    ),
    { fetch: async () => ({ rows, total: 300 }) },
  );
  await screen.findByText('r0');
  expect(screen.getAllByRole('row').length).toBeLessThan(100);
  vi.restoreAllMocks();
});

it(title('G103', '다운로드: 누른 순간의 확정 조건·선택을 고정하고, 입력만 한 필터는 쓰지 않으며, 진행 중 재실행·이전 결과 중 시작을 막는다'), async () => {
  const targets: DownloadTarget<unknown>[] = [];
  let finish!: () => void;
  function DownloadPart() {
    const control = useListDownload(model, {
      run: (target) => {
        targets.push(target);
        return new Promise<void>((resolve) => (finish = resolve));
      },
    });
    return <List.Download control={control} />;
  }
  mount(() => (
    <>
      <List.Filter>
        <List.Keywords name="keywords" label="키워드" choices={[{ value: 'name', label: '이름' }]} />
        <List.FilterActions />
      </List.Filter>
      <List.Actions>
        <DownloadPart />
      </List.Actions>
      <List.Result>
        <List.Table columns={columns} rowId={(row) => row.id} selectable />
      </List.Result>
    </>
  ));
  await screen.findByText('a');
  fireEvent.change(screen.getByRole('textbox', { name: '키워드' }), { target: { value: 'typed-only' } });
  const kind = screen.getByRole('combobox', { name: '다운로드 종류' });
  const button = screen.getByRole('button', { name: '다운로드' }) as HTMLButtonElement;
  fireEvent.change(kind, { target: { value: 'selected' } });
  expect(button.disabled).toBe(true);
  fireEvent.change(kind, { target: { value: 'all' } });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(targets).toHaveLength(1));
  expect(targets[0]).toEqual({ kind: 'all', search: expect.objectContaining({ keywords: [] }) });
  expect(button.disabled).toBe(true);
  // 진행 중: 종류·버튼 잠금, 옆에는 로딩 표시만(문구는 화면 낭독기용).
  expect((kind as HTMLSelectElement).disabled).toBe(true);
  const progress = screen.getByRole('status');
  expect(progress.className).toContain('wk-spinner');
  expect(progress.textContent).toBe('다운로드 중입니다.');
  expect(progress.querySelector('.wk-visually-hidden')?.textContent).toBe('다운로드 중입니다.');
  // 공개 부품 /ui Pending과 같은 표시다(프로젝트가 버튼 옆 진행 표시를 그릴 때 쓰는 그 부품).
  expect(progress.outerHTML).toBe(renderToStaticMarkup(<Pending label="다운로드 중입니다." />));
  await act(async () => finish());
  expect(screen.queryByRole('status')).toBeNull();
  expect((kind as HTMLSelectElement).disabled).toBe(false);
  fireEvent.click(screen.getAllByRole('checkbox', { name: '행 선택' })[1]!);
  fireEvent.change(kind, { target: { value: 'selected' } });
  fireEvent.click(button);
  fireEvent.click(screen.getAllByRole('checkbox', { name: '행 선택' })[0]!);
  await waitFor(() => expect(targets).toHaveLength(2));
  expect(targets[1]).toEqual({ kind: 'selected', ids: ['b'], search: expect.objectContaining({ keywords: [] }) });
  await act(async () => finish());
});

it(title('G104', '다운로드 실패는 원인을 남기고 종류를 바꾸면 지운다'), async () => {
  function DownloadPart() {
    const control = useListDownload(model, { run: async () => Promise.reject(new Error('boom')) });
    return <List.Download control={control} />;
  }
  mount(() => (
    <>
      <DownloadPart />
      <List.Result>
        <List.Table columns={columns} rowId={(row) => row.id} />
      </List.Result>
    </>
  ));
  await screen.findByText('a');
  fireEvent.change(screen.getByRole('combobox', { name: '다운로드 종류' }), { target: { value: 'all' } });
  fireEvent.click(screen.getByRole('button', { name: '다운로드' }));
  expect((await screen.findByRole('alert')).textContent).toContain('다운로드하지 못했습니다');
  fireEvent.change(screen.getByRole('combobox', { name: '다운로드 종류' }), { target: { value: 'selected' } });
  expect(screen.queryByRole('alert')).toBeNull();
});

it(title('G105', '필수 필터는 별표·aria와 안내를 연결하며 검색 버튼은 초점을 받을 수 있고 요청은 차단한다'), async () => {
  const def = defineSearch({
    fields: { ...definition.fields, from: { ...definition.fields.from, required: { message: '시작 날짜가 필요합니다.' } } },
  });
  const { fetch } = mount(
    () => (
      <List.Filter>
        <List.Text name="to" label="다른 조건" />
        <List.Detail keys={['from']}>
          <List.Text name="from" label="시작" />
        </List.Detail>
        <List.FilterActions />
      </List.Filter>
    ),
    { def },
  );
  const search = screen.getByRole('button', { name: '검색' });
  expect(search.getAttribute('aria-disabled')).toBe('true');
  expect((search as HTMLButtonElement).disabled).toBe(false);
  search.focus();
  expect(document.activeElement).toBe(search);
  fireEvent.click(search);
  expect(screen.getByRole('button', { name: '상세 검색' }).getAttribute('aria-expanded')).toBe('true');
  const input = screen.getByLabelText('시작 *');
  expect(input.getAttribute('aria-required')).toBe('true');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '상세 검색' }));
  expect(screen.getByRole('button', { name: '상세 검색' }).getAttribute('aria-expanded')).toBe('false');
  fireEvent.change(screen.getByLabelText('다른 조건'), { target: { value: 'a' } });
  expect(screen.getByRole('button', { name: '상세 검색' }).getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(search);
  expect(screen.getByRole('button', { name: '상세 검색' }).getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '초기화' }));
  expect(screen.getByRole('button', { name: '상세 검색' }).getAttribute('aria-expanded')).toBe('false');
  expect(fetch).not.toHaveBeenCalled();
});
}
