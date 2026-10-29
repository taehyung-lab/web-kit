// 파일 책임: record-ui 복사본의 공통 적합성 기준과 단언을 소유한다.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it as baseIt, vi } from 'vitest';
import type * as Contract0 from '../contracts/detail-ui';
import { RequestFailure } from '../../failure';
import type { RecordState } from '../../record';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';

/** 소비처가 넘긴 실제 복사본으로 record-ui 보장 전체를 등록한다. */
export function checkRecordUiConformance({ Record }: { Record: typeof Contract0.Record }, target: ConformanceTarget) {
  const it = baseIt;
  const title = (id: string, label: string) => conformanceTitle(id, target, label);
// @vitest-environment jsdom
// 파일 책임: Record 묶음 부품이 useRecord 상태(대기·없음·실패·준비됨·갱신 실패)와 항목·이력을 화면에 그리는 결과를 검사한다.

afterEach(cleanup);

const forbidden = new RequestFailure({ kind: 'forbidden', status: 403 });
const notFound = new RequestFailure({ kind: 'not-found', status: 404 });
/** 앱 경계(403)는 그리지 않는 프로젝트 문구 규칙. */
const renderFailure = (failure: unknown) => (failure instanceof RequestFailure && failure.kind === 'forbidden' ? null : undefined);

function view(state: RecordState<{ name: string; phone?: string; count: number }>) {
  return render(
    <Record state={state} renderFailure={renderFailure} missing={<a href="/list">목록으로</a>}>
      {(data) => (
        <Record.Fields>
          <Record.Field label="이름">{data.name}</Record.Field>
          <Record.Field label="전화">{data.phone}</Record.Field>
          <Record.Field label="수">{data.count}</Record.Field>
        </Record.Fields>
      )}
    </Record>,
  );
}

it(title('G106', 'F9 대기는 불러오는 중, 준비됨은 항목을 그리고 빈 값은 -, 0은 그대로다'), () => {
  const pending = view({ kind: 'pending' });
  expect(screen.getByRole('status').textContent).toBe('불러오는 중입니다.');
  pending.unmount();
  view({ kind: 'ready', data: { name: 'A', count: 0 }, refresh: { refreshing: false, failure: undefined, retry: () => undefined } });
  const values = Array.from(document.querySelectorAll('dd')).map((node) => node.textContent);
  expect(values).toEqual(['A', '-', '0']);
});

it(title('G107', 'F9 없음은 돌아갈 길을 보이고, 이 조회의 거부(앱 경계)는 아무것도 그리지 않는다'), () => {
  const missing = view({ kind: 'missing', failure: notFound, wasReady: false });
  expect(screen.getByRole('link', { name: '목록으로' })).toBeTruthy();
  missing.unmount();
  const { container } = view({ kind: 'missing', failure: forbidden, wasReady: false });
  expect(container.textContent).toBe('');
});

it(title('G108', 'F9 내용 없는 실패는 다시 시도를, 재조회 실패는 내용을 유지한 채 알리고 다시 시도한다'), () => {
  const retry = vi.fn();
  const failed = view({ kind: 'failed', failure: new RequestFailure({ kind: 'server-error', status: 500 }), retry });
  expect(screen.getByRole('alert').textContent).toContain('항목을 불러오지 못했습니다.');
  fireEvent.click(screen.getByText('다시 시도'));
  expect(retry).toHaveBeenCalledTimes(1);
  failed.unmount();
  const refresh = vi.fn();
  view({ kind: 'ready', data: { name: 'A', count: 1 }, refresh: { refreshing: false, failure: new RequestFailure({ kind: 'network' }), retry: refresh } });
  expect(screen.getByText('A')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('최신 내용을 불러오지 못했습니다.');
  fireEvent.click(screen.getByText('다시 시도'));
  expect(refresh).toHaveBeenCalledTimes(1);
});

it(title('G109', '이력은 일시·변경·담당자 표이고 0건이면 빈 문구다'), () => {
  const { rerender } = render(
    <Record.History entries={[]} labels={{ at: '일시', changes: '변경', actor: '담당' }} empty="이력 없음" />,
  );
  expect(screen.getByText('이력 없음')).toBeTruthy();
  rerender(
    <Record.History
      entries={[{ id: '1', at: '2026-10-28 10:00', actor: '', changes: ['등록', '이름: A'] }]}
      labels={{ at: '일시', changes: '변경', actor: '담당' }}
    />,
  );
  expect(Array.from(document.querySelectorAll('td')).map((cell) => cell.textContent)).toEqual(['2026-10-28 10:00', '등록이름: A', '-']);
});
}
