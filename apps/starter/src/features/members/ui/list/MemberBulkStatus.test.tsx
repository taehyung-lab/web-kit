// 파일 책임: 회원 일괄 상태 변경(값 하나를 골라 선택 행에 적용) 재현 검사. 값 없이 누름·확인창 문구·실제 반영·성공 뒤 값 유지·
// 이전 조건 결과 동안 잠금과 앱 기본 문구(ListDefaults)를 실제 앱 조립과 mock 서버 상태로 관찰한다.
import { mockDb } from '@/mocks/db';
import { renderApp } from '@/test/app';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

/** 휴면 회원만 보이는 결과(15명, 가상화 기준 50행 미만이라 jsdom에서도 행이 그려진다). */
const DORMANT = '/members?searched=true&accountStatuses=%5B%22DORMANT%22%5D';
const statusRequests = (requests: readonly { line: string }[]) => requests.filter((request) => request.line === 'POST /api/members/status');

describe('member bulk status change (BulkSelectAction)', () => {
  it('refuses without a chosen value using the app default message and sends nothing', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp(DORMANT);
    const rows = await screen.findAllByRole('checkbox', { name: /^(Kim|Lee|Park|Choi|Jung|Kang|Yoon|Han|Seo|Lim) / });
    await user.click(rows[0]!);
    await user.click(screen.getByRole('button', { name: '상태 변경' }));
    expect((await screen.findByRole('alert')).textContent).toBe('바꿀 값을 먼저 선택하세요.');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(statusRequests(requests)).toEqual([]);
  });

  it('confirms with the chosen value, applies it on the server and keeps the value after success', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp(DORMANT);
    const rows = await screen.findAllByRole('checkbox', { name: /^(Kim|Lee|Park|Choi|Jung|Kang|Yoon|Han|Seo|Lim) / });
    const firstName = rows[0]!.getAttribute('aria-label')!;
    const secondName = rows[1]!.getAttribute('aria-label')!;
    await user.click(rows[0]!);
    await user.click(rows[1]!);

    await user.click(screen.getByRole('combobox', { name: '바꿀 계정 상태' }));
    await user.click(await screen.findByRole('option', { name: '정지' }));
    await user.click(screen.getByRole('button', { name: '상태 변경' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('2명을 정지(으)로 바꿉니다.');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(statusRequests(requests)).toHaveLength(1);
    const changed = mockDb.members.filter((member) => member.name === firstName || member.name === secondName);
    expect(changed.map((member) => member.accountStatus)).toEqual(['BLOCKED', 'BLOCKED']);
    // 바뀐 두 명은 휴면 조건에서 빠지고(목록 재조회), 고른 값은 다음 작업을 위해 그대로 남는다.
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: firstName })).toBeNull());
    expect(screen.getByRole('combobox', { name: '바꿀 계정 상태' }).textContent).toContain('정지');
  });

  it('describes the value fixed at open even if the choice changes before the next open', async () => {
    const user = userEvent.setup();
    renderApp(DORMANT);
    const rows = await screen.findAllByRole('checkbox', { name: /^(Kim|Lee|Park|Choi|Jung|Kang|Yoon|Han|Seo|Lim) / });
    await user.click(rows[0]!);
    const select = screen.getByRole('combobox', { name: '바꿀 계정 상태' });
    await user.click(select);
    await user.click(await screen.findByRole('option', { name: '정상' }));
    await user.click(screen.getByRole('button', { name: '상태 변경' }));
    let dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('1명을 정상(으)로 바꿉니다.');
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    await user.click(select);
    await user.click(await screen.findByRole('option', { name: '정지' }));
    await user.click(screen.getByRole('button', { name: '상태 변경' }));
    dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('1명을 정지(으)로 바꿉니다.');
  });
});
