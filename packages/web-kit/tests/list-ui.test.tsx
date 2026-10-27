// @vitest-environment jsdom
/** 실제 목록 module과 공통 입력의 검색·거절·선택 보존을 검사한다. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { defineSearch } from '../src/search/fields';
import { useList } from '../src/use-list';
import { ListView } from '../src/list-ui';
const definition = defineSearch({
  fields: {
    page: { schema: z.number(), default: 1 },
    size: { schema: z.number(), default: 20 },
    keywords: { schema: z.array(z.object({ field: z.string(), value: z.string() })), default: [] },
    from: { schema: z.string(), default: '' },
    to: { schema: z.string(), default: '' },
  },
});
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
/** 서버 입력과 화면 선택을 함께 관찰하는 소비 fixture다. */
function mount(run: (ids: readonly string[]) => Promise<{ completedIds: readonly string[] }> = vi.fn(async () => ({ completedIds: [] }))) {
  const fetch = vi.fn(async (_input: unknown) => ({ rows: [{ id: 'a' }, { id: 'b' }], total: 2 }));
  function App() {
    const [url, setUrl] = useState(() => definition.validateSearch({}));
    const model = useList({
      definition,
      search: url,
      navigate: (next) => setUrl(next),
      query: (full) => ({ queryKey: ['items', full], queryFn: () => fetch(full) }),
      rowId: (row) => row.id,
    });
    return (
      <ListView model={model}>
        {(ui) => (
          <>
            <ui.Filter>
              <ui.Keywords name="keywords" label="키워드" choices={[{ value: 'name', label: '이름' }]} />
              <ui.Period
                from="from"
                to="to"
                label="기간"
                timeZone="Asia/Seoul"
                now={() => new Date('2026-03-31T00:00:00Z')}
                presets={[{ label: '한 달', value: { unit: 'month', amount: -1 } }]}
              />
            </ui.Filter>
            <ui.BulkAction label="일괄 저장" run={run} />
            <ui.Table columns={[{ key: 'id', label: '이름', render: (row) => row.id }]} rowId={(row) => row.id} selectable />
          </>
        )}
      </ListView>
    );
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
  return { fetch, run };
}
it('입력 중인 키워드를 검색에 포함하고 같은 칩은 중복하지 않는다', async () => {
  const { fetch } = mount();
  await screen.findByText('a');
  fireEvent.change(screen.getByRole('textbox', { name: '키워드' }), { target: { value: '  hello  ' } });
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ keywords: [{ field: 'name', value: 'hello' }] })));
  fireEvent.change(screen.getByRole('textbox', { name: '키워드' }), { target: { value: 'hello' } });
  fireEvent.keyDown(screen.getByRole('textbox', { name: '키워드' }), { key: 'Enter' });
  expect(screen.getAllByRole('button', { name: 'hello 제거' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '초기화' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'hello 제거' })).toBeNull());
});
it('역순 기간은 요청을 막고 달 프리셋은 월말을 보정한다', async () => {
  const { fetch } = mount();
  await screen.findByText('a');
  const before = fetch.mock.calls.length;
  fireEvent.change(screen.getByLabelText('기간 시작'), { target: { value: '2026-03-31' } });
  fireEvent.change(screen.getByLabelText('기간 종료'), { target: { value: '2026-03-01' } });
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  expect(screen.getByRole('alert').textContent).toContain('순서');
  expect(fetch).toHaveBeenCalledTimes(before);
  fireEvent.click(screen.getByRole('button', { name: '한 달' }));
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-02-28', to: '2026-03-31' })));
});
it('일괄 요청 실패는 확인창과 선택을 보존하고 부분 성공은 성공한 선택만 비운다', async () => {
  const run = vi
    .fn<(ids: readonly string[]) => Promise<{ completedIds: readonly string[] }>>()
    .mockRejectedValueOnce(Error('rejected'))
    .mockResolvedValueOnce({ completedIds: ['a'] });
  mount(run);
  await screen.findByText('a');
  fireEvent.click(screen.getByRole('checkbox', { name: '이 페이지 전체 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '일괄 저장' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '확인' }));
  await waitFor(() => expect(within(screen.getByRole('alertdialog')).getByRole('alert')).toBeTruthy());
  expect(run).toHaveBeenLastCalledWith(['a', 'b']);
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '확인' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  const boxes = screen.getAllByRole('checkbox', { name: '행 선택' }) as HTMLInputElement[];
  expect(boxes.map((box) => box.checked)).toEqual([false, true]);
});

it('제한 없음은 전체 체크로 보이고 일부 해제를 다음 요청에 반영한다', async () => {
  const def = defineSearch({ fields: { tags: { schema: z.array(z.string()), default: [] } } });
  const fetch = vi.fn(async (_full: unknown) => ({ rows: [] as { id: string }[], total: 0 }));
  function App() {
    const [url, setUrl] = useState(() => def.validateSearch({}));
    const model = useList({
      definition: def,
      search: url,
      navigate: (next) => setUrl(next),
      query: (full) => ({ queryKey: ['tags', full], queryFn: () => fetch(full) }),
      rowId: (row) => row.id,
    });
    return (
      <ListView model={model}>
        {(ui) => (
          <ui.Filter>
            <ui.MultiSelect
              name="tags"
              label="태그"
              options={[
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
              ]}
            />
          </ui.Filter>
        )}
      </ListView>
    );
  }
  const client = new QueryClient();
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
  expect((screen.getByLabelText('A') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText('A'));
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['b'] })));
  fireEvent.click(screen.getByLabelText('A'));
  expect((screen.getByLabelText('A') as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText('B') as HTMLInputElement).checked).toBe(true);
});
it('키워드 대상이 늦게 도착해도 현재 선택지로 검색한다', async () => {
  const fetch = vi.fn(async (_full: unknown) => ({ rows: [] as { id: string }[], total: 0 }));
  function App({ choices }: { choices: readonly { value: string; label: string }[] }) {
    const [url, setUrl] = useState(() => definition.validateSearch({}));
    const model = useList({
      definition,
      search: url,
      navigate: (next) => setUrl(next),
      query: (full) => ({ queryKey: ['late', full], queryFn: () => fetch(full) }),
      rowId: (row) => row.id,
    });
    return (
      <ListView model={model}>
        {(ui) => (
          <ui.Filter>
            <ui.Keywords name="keywords" label="늦은 대상" choices={choices} />
          </ui.Filter>
        )}
      </ListView>
    );
  }
  const client = new QueryClient();
  clients.push(client);
  const view = render(
    <QueryClientProvider client={client}>
      <App choices={[]} />
    </QueryClientProvider>,
  );
  view.rerender(
    <QueryClientProvider client={client}>
      <App choices={[{ value: 'name', label: '이름' }]} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByRole('textbox', { name: '늦은 대상' }), { target: { value: 'hello' } });
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ keywords: [{ field: 'name', value: 'hello' }] })));
});

it('상세 기본 조건은 초기화 뒤에도 보이고 접어도 미확정 입력은 보존한다', () => {
  const def = defineSearch({ fields: { q: { schema: z.string(), default: 'default' } } });
  function App() {
    const [url, setUrl] = useState(() => def.validateSearch({}));
    const model = useList({
      definition: def,
      search: url,
      navigate: (next) => setUrl(next),
      query: (full) => ({ queryKey: ['detail', full], queryFn: async () => ({ rows: [] as { id: string }[], total: 0 }) }),
      rowId: (row) => row.id,
    });
    return (
      <ListView model={model}>
        {(ui) => (
          <ui.Filter detailKeys={['q']} detail={<ui.Text name="q" label="상세 조건" />}>
            {null}
          </ui.Filter>
        )}
      </ListView>
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
