// 파일 책임: 작성 예제의 저장·후속 요청·실패 재시도를 실제 화면과 요청으로 검증한다.
import { renderApp } from '@/test/app';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { mockDb } from '@/mocks/db';

it('원본 삭제 취소·정리와 다른 검증의 임시 저장을 실제 화면과 요청에 연결한다', async () => {
  const user = userEvent.setup();
  const { requests } = renderApp('/form-workflows');
  await user.click(await screen.findByRole('button', { name: '항목 추가' }));
  await user.click(screen.getByRole('button', { name: '대표 항목' }));
  await user.click(await screen.findByRole('radio', { name: '새 항목 1' }));
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: '항목 1 삭제' }));
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '취소' }));
  expect(screen.getByRole('button', { name: '대표 항목' }).textContent).toBe('새 항목 1');
  await user.click(screen.getByRole('button', { name: '항목 1 삭제' }));
  await user.click(screen.getByRole('button', { name: '함께 정리' }));
  expect(screen.queryByLabelText('항목 1 이름')).toBeNull();
  await user.click(screen.getByRole('button', { name: '게시' }));
  await screen.findByText('제목을 입력해 주세요.');
  expect(requests.filter((request) => request.line === 'POST /api/form-workflows')).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: '임시 저장' }));
  expect((await screen.findByText('임시 저장했습니다.')).getAttribute('role')).toBe('status');
  expect(requests.filter((request) => request.line === 'POST /api/form-workflows')).toHaveLength(1);
});

it('게시 후 조회가 끝나야 완료를 알리고, 후속 실패 재시도는 저장을 다시 보내지 않는다', async () => {
  const user = userEvent.setup();
  let finish!: () => void;
  let fail = true;
  server.use(http.get('*/api/form-workflows/:id', async () => {
    await new Promise<void>((resolve) => { finish = resolve; });
    return fail ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json({ header: { resultCode: 200, resultMessage: 'OK' }, data: mockDb.workflows[0] });
  }));
  const { requests } = renderApp('/form-workflows');
  await user.type(await screen.findByLabelText(/제목/), '후속 조회 예제');
  await user.click(screen.getByRole('button', { name: '게시' }));
  await waitFor(() => expect(requests.filter((r) => r.line.startsWith('GET /api/form-workflows/'))).toHaveLength(1));
  expect(screen.queryByText('게시했습니다.')).toBeNull();
  expect(screen.getByRole('button', { name: '게시' }).getAttribute('aria-disabled')).toBe('true');
  finish();
  await screen.findByRole('button', { name: '다시 시도' });
  expect(screen.getByRole('alert').textContent).toContain('저장은 완료');
  await user.click(screen.getByRole('button', { name: '게시' }));
  expect(requests.filter((r) => r.line === 'POST /api/form-workflows')).toHaveLength(1);
  fail = false;
  await user.dblClick(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(requests.filter((r) => r.line.startsWith('GET /api/form-workflows/'))).toHaveLength(2));
  expect(screen.queryByText('게시했습니다.')).toBeNull();
  finish();
  await screen.findByText('게시했습니다.');
  expect(screen.queryByRole('alert')).toBeNull();
  expect(requests.filter((r) => r.line === 'POST /api/form-workflows')).toHaveLength(1);
  expect(mockDb.workflows).toHaveLength(1);
});

it('저장이 실패하면 입력을 유지하고 후속 조회를 시작하지 않는다', async () => {
  server.use(http.post('*/api/form-workflows', () => HttpResponse.json({}, { status: 503 })));
  const user = userEvent.setup();
  const { requests } = renderApp('/form-workflows');
  const title = await screen.findByLabelText(/제목/);
  await user.type(title, '유지할 초안');
  await user.click(screen.getByRole('button', { name: '게시' }));
  await screen.findByRole('alert');
  expect((title as HTMLInputElement).value).toBe('유지할 초안');
  expect(requests.filter((r) => r.line.startsWith('GET /api/form-workflows/'))).toHaveLength(0);
  expect(screen.queryByText('게시했습니다.')).toBeNull();
  expect(mockDb.workflows).toHaveLength(0);
});
