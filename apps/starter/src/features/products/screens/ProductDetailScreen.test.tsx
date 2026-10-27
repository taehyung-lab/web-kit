// 파일 책임: 상품 상세 화면 검사. 서버 not-found 응답이 결과 코드 표 문구로 보이고 목록으로 돌아갈 수 있는지 관찰한다.
import { renderApp } from '@/test/app';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

describe('product detail', () => {
  it('shows the not-exist copy for a missing product and offers the way back', async () => {
    const user = userEvent.setup();
    const { router, requests } = renderApp('/products/p-unknown');

    expect((await screen.findByRole('alert')).textContent).toContain('요청한 대상이 존재하지 않습니다.');
    // loader는 기다리지 않고 미리 받기만 하므로 화면과 같은 요청을 이어 받는다: GET 정확히 1건.
    expect(requests.map((request) => request.line)).toEqual(['GET /api/products/p-unknown']);

    const back = screen.getAllByRole('button', { name: /목록으로/ });
    await user.click(back[back.length - 1]!);
    expect(router.state.location.pathname).toBe('/products');
  });
});
