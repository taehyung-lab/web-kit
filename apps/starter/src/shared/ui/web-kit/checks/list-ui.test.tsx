// @vitest-environment jsdom
// 파일 책임: 설치한 UI 복사본을 키트의 공통 단위 검사에 연결하고, 복사본의 앱 기본값·표시 입구를 확인한다.
import { List, ListDefaults, useListField, type RenderFailure } from '../list';
import { Pending } from '../ui/pending';
import { DialogDefaults, defaultDialogLabels } from '../ui/dialog';
import { checkListUiConformance } from '@boosterlab/web-kit/testing/unit/list';
import installation from '../../../../../registry-installation.json';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useList, type ListPage } from '@boosterlab/web-kit/list';
import {
  arrayKeywordCodec,
  choices,
  connectSearch,
  dateRange,
  defineSearch,
  definePolicy,
  keywords,
  listSearch,
  paging,
  sort,
} from '@boosterlab/web-kit/search';
checkListUiConformance({ List, useListField, Pending, DialogDefaults, defaultDialogLabels }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });

// 아래는 이 복사본의 표시 입구(앱 기본 문구·실패 문구 단계, 값 고르는 일괄 작업, 머리글·버튼 모양 입구)를 실제 useList로 확인한다.

interface CheckRow {
  readonly id: string;
}
const checkSearch = defineSearch({
  fields: {
    page: { schema: z.number(), default: 1 },
    size: { schema: z.number(), default: 100 },
    sort: { schema: z.enum(['id']), default: 'id' },
    order: { schema: z.enum(['asc', 'desc']), default: 'desc' },
  },
  sortFirst: 'desc',
});
const rowsOf = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `r${index + 1}` }));
const clientsInUse: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clientsInUse.forEach((client) => client.clear());
  clientsInUse.length = 0;
});

/** 실제 useList 하나를 바깥 감싸개(앱 기본값 등) 안에 그린다. */
function mountList(
  body: ReactNode,
  { fetch = async () => ({ rows: rowsOf(2), total: 2 }), outer = (node: ReactNode) => node, listProps = {} }: {
    readonly fetch?: () => Promise<ListPage<CheckRow>>;
    readonly outer?: (node: ReactNode) => ReactNode;
    readonly listProps?: Omit<Parameters<typeof List>[0], 'model' | 'children'>;
  } = {},
) {
  const request = vi.fn(fetch);
  function App() {
    const [url, setUrl] = useState(() => checkSearch.validateSearch({}));
    const model = useList({
      definition: checkSearch,
      search: url,
      navigate: (next) => setUrl(next),
      query: (full) => ({ queryKey: ['check-rows', full], queryFn: () => request() }),
      rowId: (row) => row.id,
    });
    return <List model={model} {...listProps}>{body}</List>;
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clientsInUse.push(client);
  render(<QueryClientProvider client={client}>{outer(<App />)}</QueryClientProvider>);
  return request;
}

const failing = async (): Promise<ListPage<CheckRow>> => {
  throw new Error('down');
};
const appFailure: RenderFailure = () => 'APP FAILURE';

describe('ListDefaults (앱 기본 문구 → 목록 문구, 실패 문구 단계)', () => {
  it('uses app messages and app renderFailure when the list gives none, and ignores undefined local values', async () => {
    mountList(<List.Result>{null}</List.Result>, {
      fetch: failing,
      outer: (node) => <ListDefaults messages={{ retry: 'Retry' }} renderFailure={appFailure}>{node}</ListDefaults>,
      listProps: { messages: { retry: undefined } },
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('APP FAILURE' + 'Retry');
  });

  it('falls through a local undefined to the app layer, hides on null and keeps an empty string without falling back', async () => {
    const outer = (node: ReactNode) => <ListDefaults renderFailure={appFailure}>{node}</ListDefaults>;
    mountList(<List.Result>{null}</List.Result>, { fetch: failing, outer, listProps: { renderFailure: () => undefined } });
    expect((await screen.findByRole('alert')).textContent).toContain('APP FAILURE');
    cleanup();
    mountList(<List.Result>{null}</List.Result>, { fetch: failing, outer, listProps: { renderFailure: () => null } });
    await waitFor(() => expect(document.querySelector('section[aria-busy]')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
    cleanup();
    mountList(<List.Result>{null}</List.Result>, { fetch: failing, outer, listProps: { renderFailure: () => '' } });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('APP FAILURE');
    expect(alert.textContent).not.toContain('목록을 불러오지 못했습니다.');
  });

  it('merges nested defaults over outer ones and lets the list override both', async () => {
    mountList(<List.Result>{null}</List.Result>, {
      fetch: async () => ({ rows: [], total: 0 }),
      outer: (node) => (
        <ListDefaults messages={{ empty: 'outer empty', retry: 'outer retry' }}>
          <ListDefaults messages={{ empty: 'inner empty' }}>{node}</ListDefaults>
        </ListDefaults>
      ),
    });
    expect((await screen.findByText('inner empty')).getAttribute('role')).toBe('status');
    cleanup();
    mountList(<List.Result>{null}</List.Result>, {
      fetch: async () => ({ rows: [], total: 0 }),
      outer: (node) => <ListDefaults messages={{ empty: 'app empty' }}>{node}</ListDefaults>,
      listProps: { messages: { empty: 'list empty' } },
    });
    expect((await screen.findByText('list empty')).getAttribute('role')).toBe('status');
  });
});

describe('List.Table headerClassName', () => {
  it('puts sticky opaque surface on the header itself when virtualized and the same headerClassName in both modes', async () => {
    mountList(<List.Result><List.Table columns={[{ key: 'id', header: 'ID', cell: (row: CheckRow) => row.id }]} rowId={(row: CheckRow) => row.id} headerClassName="bg-muted" /></List.Result>, {
      fetch: async () => ({ rows: rowsOf(60), total: 60 }),
    });
    await waitFor(() => expect(document.querySelector('[data-virtual] thead')).not.toBeNull());
    const header = document.querySelector('thead')!;
    expect(header.className).toContain('sticky');
    expect(header.className).toContain('bg-muted');
    // 앱 색이 키트 기본 배경을 이긴다(합칠 때 같은 종류 클래스는 뒤의 것만 남는다).
    expect(header.className).not.toContain('bg-background');
    cleanup();
    mountList(<List.Result><List.Table columns={[{ key: 'id', header: 'ID', cell: (row: CheckRow) => row.id }]} rowId={(row: CheckRow) => row.id} headerClassName="bg-muted" /></List.Result>);
    await screen.findByRole('cell', { name: 'r1' });
    expect(document.querySelector('[data-virtual]')).toBeNull();
    expect(document.querySelector('thead')!.className).toContain('bg-muted');
    expect(document.querySelector('thead')!.className).not.toContain('sticky');
  });

  it('keeps an opaque default background on the sticky header without headerClassName', async () => {
    mountList(<List.Result><List.Table columns={[{ key: 'id', header: 'ID', cell: (row: CheckRow) => row.id }]} rowId={(row: CheckRow) => row.id} /></List.Result>, {
      fetch: async () => ({ rows: rowsOf(60), total: 60 }),
    });
    await waitFor(() => expect(document.querySelector('[data-virtual] thead')).not.toBeNull());
    expect(document.querySelector('thead')!.className).toContain('bg-background');
  });
});

it('List.Detail triggerClassName styles only the toggle button and keeps its aria wiring', async () => {
  mountList(<List.Filter><List.Detail keys={[]} triggerClassName="h-7 text-xs"><span>more</span></List.Detail></List.Filter>);
  const toggle = await screen.findByRole('button', { name: '상세 검색' });
  expect(toggle.className).toContain('h-7');
  expect(toggle.className).toContain('justify-self-start');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
});

/** 선택 칸(shadcn Select)을 열고 이름이 같은 선택지를 실제 포인터 순서로 고른다. */
async function pick(trigger: HTMLElement, name: string) {
  await act(async () => fireEvent.click(trigger));
  const option = await screen.findByRole('option', { name });
  await act(async () => {
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.mouseDown(option);
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.mouseUp(option);
    fireEvent.click(option);
  });
  await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
}

/** 확인창 버튼 문구는 앱 DialogDefaults가 준다. */
const withDialog = (node: ReactNode) => <DialogDefaults labels={defaultDialogLabels}>{node}</DialogDefaults>;

describe('List.BulkSelectAction', () => {
  const options = [
    { value: 'on', label: 'On' },
    { value: 'off', label: 'Off' },
  ] as const;
  function bulk(run: (ids: readonly string[], value: 'on' | 'off') => Promise<{ completedIds: readonly string[] }>, extra: { readonly requiredMessage?: string; readonly check?: (ids: readonly string[], value: 'on' | 'off') => string | undefined } = {}) {
    return (
      <>
        <List.BulkSelectAction label="Apply" selectLabel="New state" placeholder="Choose" options={options} run={run} describe={(ids, value) => `${ids.join(',')} -> ${value}`} {...extra} />
        <List.Result><List.Table columns={[{ key: 'id', header: 'ID', cell: (row: CheckRow) => row.id }]} rowId={(row: CheckRow) => row.id} selectable /></List.Result>
      </>
    );
  }

  it('refuses without a value using requiredMessage, then runs ids and the value fixed at open and keeps the value after success', async () => {
    const run = vi.fn(async (ids: readonly string[]) => ({ completedIds: ids }));
    mountList(bulk(run, { requiredMessage: 'Pick a state' }), { outer: withDialog });
    await screen.findByRole('cell', { name: 'r1' });
    fireEvent.click(screen.getAllByRole('checkbox', { name: '행 선택' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Pick a state');
    expect(screen.queryByRole('alertdialog')).toBeNull();

    const select = screen.getByRole('combobox', { name: 'New state' });
    await pick(select, 'Off');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('r1 -> off');
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: '확인' })));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(run).toHaveBeenCalledWith(['r1'], 'off');
    expect(select.textContent).toContain('Off');
  });

  it('asks the business check with the current value at open and the fixed value at confirm', async () => {
    const run = vi.fn(async (ids: readonly string[]) => ({ completedIds: ids }));
    const check = vi.fn(() => undefined);
    mountList(bulk(run, { check }), { outer: withDialog });
    await screen.findByRole('cell', { name: 'r1' });
    fireEvent.click(screen.getAllByRole('checkbox', { name: '행 선택' })[1]!);
    await pick(screen.getByRole('combobox', { name: 'New state' }), 'On');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    const dialog = await screen.findByRole('alertdialog');
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: '확인' })));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(check.mock.calls).toEqual([[['r2'], 'on'], [['r2'], 'on']]);
  });
});


it('does not execute a value removed from the available options after confirmation opens', async () => {
  const run = vi.fn(async (ids: readonly string[]) => ({ completedIds: ids }));
  let removeOption!: () => void;
  function DynamicBulk() {
    const [available, setAvailable] = useState(true);
    removeOption = () => setAvailable(false);
    return <List.BulkSelectAction label="Apply" defaultValue="off" options={available ? [{ value: 'off', label: 'Off' }] : []} requiredMessage="Choose again" run={run} />;
  }
  mountList(<><DynamicBulk /><List.Result><List.Table columns={[{ key: 'id', header: 'ID', cell: (row: CheckRow) => row.id }]} rowId={(row: CheckRow) => row.id} selectable /></List.Result></>, { outer: withDialog });
  await screen.findByRole('cell', { name: 'r1' });
  fireEvent.click(screen.getAllByRole('checkbox', { name: '행 선택' })[0]!);
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  const dialog = await screen.findByRole('alertdialog');
  act(removeOption);
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: '확인' })));
  expect(run).not.toHaveBeenCalled();
  expect((await screen.findByRole('alert')).textContent).toBe('Choose again');
});

describe('listSearch 선언을 이름으로 읽는 칸', () => {
  const policy = definePolicy({
    keys: { page: 'page', pageSize: 'pageSize', sort: 'sort', order: 'order' },
    paging: { sizes: [10, 30], defaultSize: 10 },
    sortFirst: 'desc',
    keywords: { codec: arrayKeywordCodec, split: ',', pending: 'include' },
    choices: { format: 'array' },
    dateRange: { entry: 'paired', keys: { type: 'dateType', from: 'startDate', to: 'endDate' } },
  });
  const declared = connectSearch(
    listSearch({
      policy,
      fields: {
        search: keywords({ targets: ['name', 'code'] }),
        statuses: choices({ values: ['on', 'off'], multiple: true }),
        period: dateRange({ types: ['created', 'updated'], defaultType: 'created' }),
        paging: paging(),
        sorting: sort({ values: ['created', 'name'], default: 'created' }),
      },
    }),
  );
  function Declared({ body }: { readonly body: ReactNode }) {
    const [url, setUrl] = useState(() => declared.validateSearch({}));
    const model = useList({
      definition: declared,
      search: url,
      navigate: (next) => setUrl(next),
      query: (full) => ({ queryKey: ['declared-rows', full], queryFn: async () => ({ rows: rowsOf(1), total: 1 }) }),
      rowId: (row: CheckRow) => row.id,
    });
    return <List model={model}>{body}</List>;
  }
  function mount(body: ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clientsInUse.push(client);
    return render(
      <QueryClientProvider client={client}>
        <Declared body={body} />
      </QueryClientProvider>,
    );
  }

  it('takes keys, targets, choices, sizes and sort values from the declaration and only labels from the screen', async () => {
    mount(
      <>
        <List.Period name="period" label="Period" typeLabels={{ created: 'T-created', updated: 'T-updated' }} />
        <List.Keywords name="search" label="Words" choiceLabels={{ name: 'K-name', code: 'K-code' }} />
        <List.MultiSelect name="statuses" label="Status" optionLabels={{ on: 'S-on', off: 'S-off' }} />
        <List.PageSize />
        <List.SortSelect optionLabels={{ created: 'O-created', name: 'O-name' }} />
      </>,
    );
    expect(await screen.findByRole('checkbox', { name: 'S-on' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'S-off' })).toBeDefined();
    expect(screen.getByLabelText('Period 시작')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Period 시작'), { target: { value: '2026-01-01' } });
    expect((screen.getByLabelText('Period 시작') as HTMLInputElement).value).toBe('2026-01-01');
    // 선언의 구분자(,)로 나눠 칩을 추가하고 대상 문구는 화면이 준다.
    fireEvent.change(screen.getByRole('textbox', { name: 'Words' }), { target: { value: 'a,b' } });
    fireEvent.click(screen.getByRole('button', { name: /add|추가/i }));
    expect(await screen.findByText('K-name: a')).toBeDefined();
    expect(screen.getByText('K-name: b')).toBeDefined();
  });

  it('refuses a name that is not that kind of field and a missing label instead of showing raw values', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => mount(<List.Period name="statuses" label="Wrong" />)).toThrow(/"statuses" is not a dateRange field/);
    expect(() => mount(<List.MultiSelect name="statuses" label="Status" optionLabels={{ on: 'S-on' }} />)).toThrow(/no label for "off"/);
  });

  it('lets the table read rowId and selectable rows from the list model', async () => {
    mount(<List.Table columns={[{ key: 'id', header: 'Id', cell: (row: CheckRow) => row.id }]} />);
    expect(await screen.findByText('r1')).toBeDefined();
    // useList에 selectable을 선언하지 않았으므로 선택 칸이 없다.
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
