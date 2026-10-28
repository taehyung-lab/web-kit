// 파일 책임: 회원 목록(검색을 눌러야 조회) 재현 검사. 진입·검색·입력 중 키워드·역순 기간·정렬 선택을 실제 앱 조립의 URL·요청으로 관찰한다.
import { renderApp } from '@/test/app';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

const memberRequests = (requests: readonly { line: string }[]) => requests.filter((request) => request.line.startsWith('GET /api/members'));

describe('member list (search to load)', () => {
  it('does not request on entry and loads only after Search', async () => {
    const user = userEvent.setup();
    const { router, requests } = renderApp('/members');
    expect(await screen.findByText('검색 조건을 정하고 검색을 누르세요.')).toBeTruthy();
    expect(memberRequests(requests)).toEqual([]);

    await user.click(screen.getByRole('button', { name: '검색' }));
    expect(await screen.findByRole('cell', { name: 'member1@example.com' })).toBeTruthy();
    expect(router.state.location.search).toEqual({ searched: true });
    expect(memberRequests(requests).map((request) => request.line)).toEqual(['GET /api/members?page=0&size=100&sort=joinedAt,desc&periodType=joinedAt']);
  });

  it('includes a typed keyword that was not added and keeps the filter on page moves', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp('/members');
    await screen.findByText('검색 조건을 정하고 검색을 누르세요.');
    await user.selectOptions(screen.getByRole('combobox', { name: '검색어 검색 대상' }), 'email');
    await user.type(screen.getByRole('textbox', { name: '검색어' }), 'member2');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() =>
      expect(memberRequests(requests).at(-1)?.line).toBe('GET /api/members?page=0&size=100&sort=joinedAt,desc&periodType=joinedAt&keyword=email:member2'),
    );
    expect(await screen.findByRole('button', { name: 'member2 제거' })).toBeTruthy();
  });

  it('drops only a reversed period and searches with the other conditions', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp('/members');
    await screen.findByText('검색 조건을 정하고 검색을 누르세요.');
    await user.type(screen.getByRole('textbox', { name: '검색어' }), 'member2');
    await user.type(screen.getByLabelText('기간 시작'), '2026-03-10');
    await user.type(screen.getByLabelText('기간 종료'), '2026-03-01');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() => expect(memberRequests(requests).at(-1)?.line).toContain(':member2'));
    expect(memberRequests(requests).at(-1)?.line).not.toMatch(/from=|to=|startDate|endDate/);
    expect((screen.getByLabelText('기간 시작') as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('opens a shared searched URL directly and changes sort from the sort select', async () => {
    const user = userEvent.setup();
    const { router, requests } = renderApp('/members?searched=true&accountStatuses=%5B%22DORMANT%22%5D');
    expect(await screen.findAllByRole('cell', { name: '휴면' })).not.toHaveLength(0);
    expect(memberRequests(requests).at(-1)?.line).toContain('accountStatus=DORMANT');
    await user.selectOptions(screen.getByRole('combobox', { name: '정렬' }), 'name');
    await waitFor(() => expect(router.state.location.search).toMatchObject({ sortType: 'name', accountStatuses: ['DORMANT'] }));
    expect(memberRequests(requests).at(-1)?.line).toContain('sort=name,desc');
  });
});
