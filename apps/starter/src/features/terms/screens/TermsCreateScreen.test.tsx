// 파일 책임: 약관 등록(레퍼런스 재현) 검사. 필수 검증 → 저장 확인 → 저장 한 번 → 저장 완료 확인 → 상세, 서버 필드 오류 위치를 관찰한다.
import { mockDb } from '@/mocks/db';
import { renderApp } from '@/test/app';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

async function fill(user: ReturnType<typeof userEvent.setup>, version: string) {
  await user.type(await screen.findByLabelText(/버전/), version);
  await user.type(screen.getByLabelText(/시행일/), '2026-11-01');
  await user.type(screen.getByLabelText(/게시일/), '2026-10-28');
  await user.type(screen.getByLabelText(/본문/), 'E2E-본문');
}

describe('terms create (reference reproduction)', () => {
  it('blocks an empty submit with the first error focused and sends nothing', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp('/terms/new');
    await user.click(await screen.findByRole('button', { name: '저장' }));
    const version = screen.getByLabelText(/버전/);
    await waitFor(() => expect(document.activeElement).toBe(version));
    expect(screen.getByText('버전을 입력하세요.')).toBeTruthy();
    expect(screen.getByText('본문을 입력하세요.')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(requests.filter((request) => request.line.startsWith('POST'))).toHaveLength(0);
  });

  it('confirms, saves once, acknowledges once and opens the new terms detail', async () => {
    const user = userEvent.setup();
    const { router, requests } = renderApp('/terms/new');
    await fill(user, '1.0');
    await user.click(screen.getByRole('button', { name: '저장' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: '저장' }));
    const saved = await screen.findByRole('alertdialog', { name: '저장되었습니다.' });
    expect(saved.textContent).toContain('약관을 등록했습니다.');
    expect(router.state.location.pathname).toBe('/terms/new');
    expect(requests.filter((request) => request.line === 'GET /api/terms/t-001')).toHaveLength(0);
    expect(requests.filter((request) => request.line === 'POST /api/terms')).toHaveLength(1);
    await user.click(within(saved).getByRole('button', { name: '확인' }));
    expect(await screen.findByRole('heading', { name: '약관 상세' })).toBeTruthy();
    await waitFor(() => expect(router.state.location.pathname).toBe('/terms/t-001'));
    expect(await screen.findByText('E2E-본문')).toBeTruthy();
    expect(requests.filter((request) => request.line === 'POST /api/terms')).toHaveLength(1);
    expect(mockDb.terms).toHaveLength(1);
  });

  it('puts a duplicate version rejection on the version field and stays', async () => {
    mockDb.terms.push({ termsId: 't-000', version: '2.0', effectiveAt: '2026-01-01', status: 'PUBLISHED', publishedAt: '2026-01-01', body: 'x' });
    const user = userEvent.setup();
    const { router } = renderApp('/terms/new');
    await fill(user, '2.0');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '저장' }));
    expect(await screen.findByText('이미 등록된 버전입니다.')).toBeTruthy();
    const version = screen.getByLabelText(/버전/);
    await waitFor(() => expect(document.activeElement).toBe(version));
    expect(router.state.location.pathname).toBe('/terms/new');
  });
});
