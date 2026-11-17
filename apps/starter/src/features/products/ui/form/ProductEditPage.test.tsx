// 파일 책임: 상품 수정 화면 검사. 확인창을 거친 저장이 서버 필드 오류(400)를 받으면 그 필드에 문구·focus가 가고 화면에 남는지 관찰한다.
import { renderApp } from '@/test/app';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

describe('product edit', () => {
  it('confirms, saves once and puts the server field error on the code field', async () => {
    const user = userEvent.setup();
    const { router, requests } = renderApp('/products/p-001/edit');

    const code = await screen.findByLabelText(/상품 코드/);
    await user.clear(code);
    await user.type(code, 'SKU-1002');
    await user.click(screen.getByRole('button', { name: '저장' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('SKU-1002');
    await user.click(within(dialog).getByRole('button', { name: '저장' }));

    expect(await screen.findByText('이미 쓰고 있는 상품 코드입니다.')).toBeTruthy();
    expect(code.getAttribute('aria-invalid')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(code));
    expect(requests.filter((request) => request.line.startsWith('PUT '))).toEqual([
      expect.objectContaining({ line: 'PUT /api/products/p-001' }),
    ]);
    expect(router.state.location.pathname).toBe('/products/p-001/edit');
  });
});
