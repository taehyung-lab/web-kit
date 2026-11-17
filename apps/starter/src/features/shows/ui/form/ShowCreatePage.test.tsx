// 파일 책임: 공연 예시 화면 검사 — 회차 서버 오류 위치와 이동 뒤 위치, 대화창 하위 폼 제출 격리, 좌석도 파일 보존.
import { renderApp } from '@/test/app';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

const posts = (requests: readonly { line: string }[], path: string) => requests.filter((request) => request.line === `POST ${path}`);
const invalid = (label: RegExp) => screen.getByLabelText(label).getAttribute('aria-invalid') === 'true';

/** 공연명·두 회차(같은 일시)·좌석도를 채운다. */
async function fill(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.type(await screen.findByLabelText(/공연명/), title);
  await user.type(screen.getByLabelText(/^1회차 날짜/), '2026-11-01');
  await user.type(screen.getByLabelText(/^1회차 시각/), '19:00');
  await user.click(screen.getByRole('button', { name: '회차 추가' }));
  await user.type(screen.getByLabelText(/^2회차 날짜/), '2026-11-01');
  await user.type(screen.getByLabelText(/^2회차 시각/), '19:00');
  await user.upload(screen.getByLabelText(/좌석배치도/), new File(['map'], 'seat-map.png', { type: 'image/png' }));
}

describe('show example (performance form fit)', () => {
  it('puts the server duplicate-round error on the second round and keeps it on that round after moving it up', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp('/shows/new');
    await fill(user, 'E2E-회차 중복');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(invalid(/^2회차 시각/)).toBe(true));
    expect(invalid(/^1회차 시각/)).toBe(false);
    expect(screen.getByText('같은 시작 일시의 회차가 이미 있습니다.')).toBeTruthy();
    // 오류 난 줄의 날짜를 바꿔 구별한 뒤 위로 옮긴다. 오류는 그 줄(이제 1회차)을 따라간다.
    await user.clear(screen.getByLabelText(/^2회차 날짜/));
    await user.type(screen.getByLabelText(/^2회차 날짜/), '2026-11-02');
    await user.click(screen.getByRole('button', { name: '2회차 위로' }));
    expect((screen.getByLabelText(/^1회차 날짜/) as HTMLInputElement).value).toBe('2026-11-02');
    expect(invalid(/^1회차 시각/)).toBe(true);
    expect(invalid(/^2회차 시각/)).toBe(false);
    expect(posts(requests, '/api/shows')).toHaveLength(1);
  });

  it('confirms the vendor-key dialog with Enter without submitting or validating the outer form', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp('/shows/new');
    await user.click(await screen.findByRole('button', { name: '판매처 키 입력' }));
    const dialog = await screen.findByRole('dialog', { name: '판매처 키 입력' });
    await user.type(within(dialog).getByLabelText(/판매처 키 1/), 'YES24-K1{Enter}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '판매처 키 입력' })).toBeNull());
    expect(screen.getByText('YES24-K1')).toBeTruthy();
    // 바깥 폼(공연명 비어 있음)은 검증되지 않았고 요청도 없다.
    expect(invalid(/공연명/)).toBe(false);
    expect(requests.filter((request) => request.line.startsWith('POST'))).toHaveLength(0);
  });

  it('keeps the chosen seat map through a failed save and a dialog round trip, and uploads it again on retry', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp('/shows/new');
    await fill(user, 'E2E-실패 공연');
    await user.clear(screen.getByLabelText(/^2회차 시각/));
    await user.type(screen.getByLabelText(/^2회차 시각/), '21:00');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('서버에서 오류가 발생했습니다. 잠시 뒤 다시 시도하세요.');
    expect(screen.getByText('seat-map.png')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '판매처 키 입력' }));
    await user.click(within(await screen.findByRole('dialog', { name: '판매처 키 입력' })).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '판매처 키 입력' })).toBeNull());
    expect(screen.getByText('seat-map.png')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(posts(requests, '/api/files')).toHaveLength(2));
  });
});
