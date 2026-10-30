// 파일 책임: progress-list.tsx 조합이 소비 복사본에서 내는 화면 결과를 검사한다.
import { act, cleanup, render, screen, waitFor, } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, expect, it as baseIt } from 'vitest';
import type * as Contract1 from '../contracts/ui/blocking-progress';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach } from 'vitest';
import { RequestFailure } from '../../failure';
import { z } from 'zod';
import { defineSearch } from '../../search/fields';
import { useList, type ListPage } from '../../use-list';

/** 필요한 기능의 실제 복사본으로 해당 검사만 등록한다. */
export function checkListProgressConformance({ BlockingProgress }: { BlockingProgress: typeof Contract1.BlockingProgress }, target: ConformanceTarget) {
  const it = baseIt;
  const title = (id: string, label: string) => conformanceTitle(id, target, label);

afterEach(cleanup);

const MESSAGES = {
  loading: '데이터를 불러오는 중입니다.',
  create: '등록 중입니다.',
  edit: '수정 중입니다.',
  delete: '삭제 중입니다.',
  wait: '잠시만 기다려 주세요.',
};

/** 검사에서 완료·실패 시점을 직접 제어할 요청을 만든다. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** 덮개 문구 영역(늘 있음). 닫혀 있으면 비어 있다. */
function status() {
  return document.querySelector<HTMLElement>('.wk-blocking-status')!;
}
/** 실제 덮개 DOM의 열림을 읽는다. */
function overlayOpen() {
  return document.querySelector('.wk-blocking') !== null;
}
/** 덮개가 막는 본문 영역을 찾는다. */
function body() {
  return screen.getByTestId('app-body').parentElement!;
}

/** 소비처 덮개 복사본 안에 검사 본문을 배치한다. */
function Host({ children }: { readonly children: ReactNode }) {
  return (
    <BlockingProgress messages={MESSAGES}>
      <div data-testid="app-body">{children}</div>
    </BlockingProgress>
  );
}

// ─── 페이지 첫 조회 ─────────────────────────────────────────────────────────

interface Row {
  readonly id: string;
}
const definition = defineSearch({
  fields: {
    page: { schema: z.number().int().min(1), default: 1 },
    size: { schema: z.number().int(), default: 20 },
    q: { schema: z.string(), default: '' },
  },
});
const rows = (...ids: string[]): ListPage<Row> => ({ rows: ids.map((id) => ({ id })), total: ids.length });

let goToPage!: (page: number) => void;
/** 목록 조회와 검색 이동의 진행 수명을 연결한다. */
function ListScreen({ fetchRows, progress }: { readonly fetchRows: () => Promise<ListPage<Row>>; readonly progress?: 'page' }) {
  const [search, setSearch] = useState(() => definition.validateSearch({}));
  const list = useList({
    definition,
    search,
    navigate: (next) => setSearch(definition.validateSearch(next as Record<string, unknown>)),
    query: (full) => ({ queryKey: ['rows', full], queryFn: fetchRows }),
    rowId: (row) => row.id,
    progress,
  });
  goToPage = list.goToPage;
  return <p>{list.rows.map((row) => row.id).join(',') || '행 없음'}</p>;
}

let client = new QueryClient();
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
/** 같은 시험 안에서는 같은 QueryClient로 그린다(다시 그려도 캐시가 이어진다). */
function withClient(node: ReactNode) {
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

it(title('G016', 'P7 목록 첫 진입은 조회 중 덮고, 페이지 이동(새 조건)은 이전 결과를 보인 채 덮지 않는다'), async () => {
  let next = deferred<ListPage<Row>>();
  render(withClient(<Host><ListScreen progress="page" fetchRows={() => next.promise} /></Host>));
  await waitFor(() => expect(overlayOpen()).toBe(true));
  expect(status().textContent).toContain('데이터를 불러오는 중입니다.');
  await act(async () => next.resolve(rows('a', 'b')));
  await waitFor(() => expect(overlayOpen()).toBe(false));
  next = deferred<ListPage<Row>>();
  act(() => goToPage(2));
  await waitFor(() => expect(screen.getByText('a,b')).toBeTruthy());
  expect(overlayOpen()).toBe(false);
  expect(body().hasAttribute('inert')).toBe(false);
  await act(async () => next.resolve(rows('c')));
  await waitFor(() => expect(screen.getByText('c')).toBeTruthy());
  expect(overlayOpen()).toBe(false);
});

it(title('G017', 'P7 목록 첫 조회가 실패하면 덮개가 닫히고, 선언하지 않은 목록은 덮지 않는다'), async () => {
  const first = deferred<ListPage<Row>>();
  render(withClient(<Host><ListScreen progress="page" fetchRows={() => first.promise} /></Host>));
  await waitFor(() => expect(overlayOpen()).toBe(true));
  await act(async () => first.reject(new RequestFailure({ kind: 'server-error', status: 500 })));
  await waitFor(() => expect(overlayOpen()).toBe(false));
  cleanup();
  render(withClient(<Host><ListScreen fetchRows={() => new Promise(() => undefined)} /></Host>));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(overlayOpen()).toBe(false);
});


}
