// 파일 책임: 상품 등록 화면 검사. 저장 한 번 뒤 onSaved가 받은 새 id의 상세로 이동하는지, 옵션 줄(FormArrayField)의 추가·삭제·Enter를 관찰한다.
import { mockDb } from '@/mocks/db';
import { renderApp } from '@/test/app';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

describe('product create', () => {
  it('posts once and moves to the new product detail', async () => {
    const user = userEvent.setup();
    const { router, requests } = renderApp('/products/new');

    await user.type(await screen.findByLabelText(/상품명/), 'Desk Organizer');
    await user.type(screen.getByLabelText(/상품 코드/), 'SKU-9001');
    await user.selectOptions(screen.getByLabelText(/분류/), await screen.findByRole('option', { name: 'Living' }));
    await user.type(screen.getByLabelText(/옵션명 1/), 'Large');
    await user.click(screen.getByRole('button', { name: '등록' }));

    expect(await screen.findByRole('heading', { name: 'Desk Organizer' })).toBeTruthy();
    const created = mockDb.products.find((product) => product.code === 'SKU-9001');
    expect(created?.options).toEqual([{ name: 'Large', extraPrice: 0 }]);
    await waitFor(() => expect(router.state.location.pathname).toBe(`/products/${created?.productId}`));
    expect(requests.filter((request) => request.line === 'POST /api/products')).toHaveLength(1);
  });

  it('Enter in an option input adds a row like the add button, and a single row has no remove button', async () => {
    const user = userEvent.setup();
    renderApp('/products/new');

    await user.type(await screen.findByLabelText(/옵션명 1/), 'A{Enter}');
    expect(screen.getByLabelText(/옵션명 2/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^옵션 \d 삭제$/ })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: '옵션 1 삭제' }));
    expect(screen.queryByLabelText(/옵션명 2/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^옵션 \d 삭제$/ })).toBeNull();
  });

  it('stops adding at five options and blocks saving while an option name is empty', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp('/products/new');

    for (let row = 1; row < 5; row += 1) await user.click(await screen.findByRole('button', { name: '옵션 추가' }));
    expect(screen.getByLabelText(/옵션명 5/)).toBeTruthy();
    expect((screen.getByRole('button', { name: '옵션 추가' }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: '등록' }));
    expect((await screen.findAllByText('옵션명을 입력하세요.')).length).toBeGreaterThan(0);
    expect(requests.filter((request) => request.line === 'POST /api/products')).toHaveLength(0);
  });
});
