// 파일 책임: progress-record.tsx 조합이 소비 복사본에서 내는 화면 결과를 검사한다.
import { act, cleanup, render, screen, waitFor, } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, expect, it as baseIt } from 'vitest';
import type * as Contract1 from '../contracts/ui/blocking-progress';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach } from 'vitest';
import { useRecord } from '../../record';

/** 필요한 기능의 실제 복사본으로 해당 검사만 등록한다. */
export function checkRecordProgressConformance({ BlockingProgress }: { BlockingProgress: typeof Contract1.BlockingProgress }, target: ConformanceTarget) {
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

/** 실제 덮개 DOM의 열림을 읽는다. */
function overlayOpen() {
  return document.querySelector('.wk-blocking') !== null;
}

/** 소비처 덮개 복사본 안에 검사 본문을 배치한다. */
function Host({ children }: { readonly children: ReactNode }) {
  return (
    <BlockingProgress messages={MESSAGES}>
      <div data-testid="app-body">{children}</div>
    </BlockingProgress>
  );
}

let client = new QueryClient();
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
/** 같은 시험 안에서는 같은 QueryClient로 그린다(다시 그려도 캐시가 이어진다). */
function withClient(node: ReactNode) {
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

let refetchRecord!: () => void;
/** 단건 조회와 새로고침의 진행 수명을 연결한다. */
function RecordScreen({
  id,
  lang,
  load,
  progress,
}: {
  readonly id: string;
  readonly lang: string;
  readonly load: () => Promise<{ name: string }>;
  readonly progress?: 'page';
}) {
  const state = useRecord({ queryKey: ['record', id, lang], queryFn: load }, id, progress === undefined ? undefined : { progress });
  if (state.kind === 'ready') refetchRecord = state.refresh.retry;
  return <p>{state.kind === 'ready' ? state.data.name : state.kind}</p>;
}

it(title('G018', 'P7 단건 첫 진입은 덮고, 같은 레코드의 언어 전환·재조회는 내용을 둔 채 덮지 않는다'), async () => {
  let next = deferred<{ name: string }>();
  const view = render(withClient(<Host><RecordScreen id="1" lang="ko" progress="page" load={() => next.promise} /></Host>));
  await waitFor(() => expect(overlayOpen()).toBe(true));
  await act(async () => next.resolve({ name: '공연' }));
  await waitFor(() => expect(overlayOpen()).toBe(false));
  next = deferred();
  view.rerender(withClient(<Host><RecordScreen id="1" lang="en" progress="page" load={() => next.promise} /></Host>));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(screen.getByText('공연')).toBeTruthy();
  expect(overlayOpen()).toBe(false);
  cleanup();
});

it(title('G019', 'P7 단건 재조회(캐시 있음)는 덮지 않고, 선언하지 않은 단건(대화창 안 조회)은 덮지 않는다'), async () => {
  let next = deferred<{ name: string }>();
  render(withClient(<Host><RecordScreen id="1" lang="ko" progress="page" load={() => next.promise} /></Host>));
  await act(async () => next.resolve({ name: '공연' }));
  await waitFor(() => expect(screen.getByText('공연')).toBeTruthy());
  next = deferred();
  act(() => refetchRecord());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(screen.getByText('공연')).toBeTruthy();
  expect(overlayOpen()).toBe(false);
  cleanup();
  render(withClient(<Host><RecordScreen id="2" lang="ko" load={() => new Promise(() => undefined)} /></Host>));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(overlayOpen()).toBe(false);
});

it(title('G020', 'P7 단건 첫 조회가 취소되면(세션 전환 등) 덮개가 닫힌다'), async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Host>
        <RecordScreen id="9" lang="ko" progress="page" load={() => new Promise(() => undefined)} />
      </Host>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(overlayOpen()).toBe(true));
  await act(async () => client.cancelQueries());
  await waitFor(() => expect(overlayOpen()).toBe(false));
});


}
