// 파일 책임: 포장한 키트의 참조 정리와 임시 저장을 실제 앱 요청으로 검증한다.
import { renderApp } from '@/test/app';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';

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
