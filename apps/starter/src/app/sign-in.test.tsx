// 파일 책임: 업무 화면 없이도 지켜야 하는 로그인 검사. 앱 밖·로그인으로 도는 돌아갈 주소는 버리고 앱 첫 화면으로 가며, 자격증명 거절은 세션을 열지 않는다.
import { firstScreen } from '@/app/screens';
import { session } from '@/runtime/web-kit';
import { renderApp } from '@/test/app';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

describe('sign-in', () => {
  it.each(['/\\evil.example', '//evil.example', 'https://evil.example', '/login?redirect=/login'])(
    'drops the way back %j that could leave the app or loop to login, and goes to the first screen',
    async (back) => {
      const user = userEvent.setup();
      const { router } = renderApp(`/login?redirect=${encodeURIComponent(back)}`, { signedIn: false });
      expect(router.state.location.search).toEqual({});
      await user.type(await screen.findByLabelText(/아이디/), 'admin');
      await user.type(screen.getByLabelText(/비밀번호/), 'password');
      await user.click(screen.getByRole('button', { name: '로그인' }));

      await waitFor(() => expect(router.state.location.pathname).toBe(firstScreen ?? '/'));
      expect(session.current()?.credentials.accessToken).toMatch(/^mock-access-/);
    },
  );

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
