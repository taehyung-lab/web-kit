// 파일 책임: 세션 연결 검사. 401 → 재발급 → 재전송 1회, 재발급 거절 → 세션 종료 → 로그인 이동, 로그인 자격증명 거절 표시를 관찰한다.
import { mockDb } from '@/mocks/db';
import { renderApp, type SentRequest } from '@/test/app';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { session } from './web-kit';

/** 목록 화면이 함께 보내는 분류 선택지 조회를 뺀 요청. 이 검사는 목록 조회와 재발급의 순서를 본다. */
const withoutOptions = (requests: readonly SentRequest[]) => requests.filter((request) => request.line !== 'GET /api/categories');

describe('session', () => {
  it('reissues once on 401 and resends the read with the new token', async () => {
    const { requests } = renderApp('/products');
    mockDb.expireAccessTokens();

    expect(await screen.findByRole('cell', { name: 'Mouse Pad' })).toBeTruthy();
    // 같은 때 401을 받은 분류 선택지 조회도 같은 재발급 한 번을 기다렸다가 다시 보낸다.
    expect(requests.filter((request) => request.line === 'POST /api/auth/reissue')).toHaveLength(1);
    const reads = withoutOptions(requests);
    expect(reads.map((request) => request.line)).toEqual([
      'GET /api/products?page=0&size=20&sort=createdAt,desc',
      'POST /api/auth/reissue',
      'GET /api/products?page=0&size=20&sort=createdAt,desc',
    ]);
    expect(reads[0]!.authorization).not.toBe(reads[2]!.authorization);
    expect(reads[1]!.authorization).toBeNull();
  });

  it('ends the session when reissue is rejected and sends the user to login with the way back', async () => {
    const { router, requests } = renderApp('/products?keyword=lamp');
    mockDb.expireAccessTokens();
    mockDb.refreshValid = false;

    expect(await screen.findByText('세션이 만료되었습니다. 다시 로그인하세요.')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ reason: 'server', redirect: '/products?keyword=lamp' });
    expect(withoutOptions(requests).map((request) => request.line)).toEqual(['GET /api/products?keyword=lamp&page=0&size=20&sort=createdAt,desc', 'POST /api/auth/reissue']);
    expect(session.current()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/아이디/)));
  });

  it('opens a session on sign-in and returns to the page the user came from', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/products?keyword=lamp', { signedIn: false });
    await user.type(await screen.findByLabelText(/아이디/), 'admin');
    await user.type(screen.getByLabelText(/비밀번호/), 'password');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByRole('cell', { name: 'Desk Lamp' })).toBeTruthy();
    expect(router.state.location.search).toEqual({ keyword: 'lamp' });
    expect(session.current()?.credentials.accessToken).toMatch(/^mock-access-/);
  });

  it('shows an inline message when the credentials are rejected and does not open a session', async () => {
    const user = userEvent.setup();
    renderApp('/login', { signedIn: false });
    await user.type(await screen.findByLabelText(/아이디/), 'admin');
    await user.type(screen.getByLabelText(/비밀번호/), 'wrong');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect((await screen.findByRole('alert')).textContent).toBe('아이디 또는 비밀번호가 올바르지 않습니다.');
    expect(session.current()).toBeNull();
  });
});
