// 파일 책임: 상품 목록 화면 검사. 진입 주소 정규화(URL·요청)와 일괄 작업의 HTTP 200 업무 거절 표시를 실제 앱 조립으로 관찰한다.
import { server } from '@/mocks/server';
import { renderApp } from '@/test/app';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

describe('product list', () => {
  it('replaces a non-canonical entry URL and requests only the canonical search', async () => {
    // 역순 기간(묶음 전체 버림), 기본값과 같은 page, 모르는 key, 순서가 다른 상태 목록.
    const { router, requests } = renderApp('/products?keyword=lamp&statuses=INACTIVE,ACTIVE&from=2026-03-01&to=2026-02-01&page=1&foo=1');

    expect(await screen.findByRole('cell', { name: 'Desk Lamp' })).toBeTruthy();
    expect(router.state.location.search).toEqual({ keyword: 'lamp', statuses: 'ACTIVE,INACTIVE' });
    expect(decodeURIComponent(router.state.location.href)).toBe('/products?keyword=lamp&statuses=ACTIVE,INACTIVE');
    // 확인할 서버 선택지 값이 없으면 목록과 분류 선택지(필터 UI)를 함께 요청한다.
    expect(requests.map((request) => request.line).sort()).toEqual([
      'GET /api/categories',
      'GET /api/products?keyword=lamp&status=ACTIVE&status=INACTIVE&page=0&size=20&sort=createdAt,desc',
    ]);
  });

  it('drops a fixed-list value that does not exist and keeps the other fields', async () => {
    const { router, requests } = renderApp('/products?keyword=lamp&statuses=ACTIVE,BOGUS&sort=color');

    expect(await screen.findByRole('cell', { name: 'Desk Lamp' })).toBeTruthy();
    expect(router.state.location.search).toEqual({ keyword: 'lamp' });
    expect(requests.map((request) => request.line).sort()).toEqual(['GET /api/categories', 'GET /api/products?keyword=lamp&page=0&size=20&sort=createdAt,desc']);
  });

  it('waits for the server options, then drops a category that is not among them', async () => {
    const { router, requests } = renderApp('/products?keyword=a&categoryId=c-gone');

    await waitFor(() => expect(router.state.location.search).toEqual({ keyword: 'a' }));
    await screen.findAllByRole('cell');
    // 선택지를 받기 전에는 목록을 조회하지 않고, 없는 분류는 요청에 싣지 않는다.
    expect(requests.map((request) => request.line)).toEqual(['GET /api/categories', 'GET /api/products?keyword=a&page=0&size=20&sort=createdAt,desc']);
  });

  it('keeps a category that exists and sends it', async () => {
    const { router, requests } = renderApp('/products?categoryId=c-living');

    expect(await screen.findByRole('cell', { name: 'Desk Lamp' })).toBeTruthy();
    expect(router.state.location.search).toEqual({ categoryId: 'c-living' });
    expect(requests.map((request) => request.line)).toContain('GET /api/products?categoryId=c-living&page=0&size=20&sort=createdAt,desc');
  });

  it('holds the list when the options cannot be loaded and retries both on request', async () => {
    const user = userEvent.setup();
    let fail = true;
    server.use(http.get('*/api/categories', () => (fail ? HttpResponse.json({ header: { resultCode: 500, resultMessage: 'Error' }, data: null }, { status: 500 }) : undefined)));
    const { router, requests } = renderApp('/products?categoryId=c-living');

    expect(await screen.findByText('분류 선택지를 불러오지 못해 목록을 조회하지 않았습니다.', {}, { timeout: 5000 })).toBeTruthy();
    expect(router.state.location.search).toEqual({ categoryId: 'c-living' });
    expect(requests.some((request) => request.line.startsWith('GET /api/products'))).toBe(false);

    fail = false;
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('cell', { name: 'Desk Lamp' })).toBeTruthy();
  });

  it('shows a business rejection (HTTP 200 envelope) inside the bulk dialog and keeps the selection', async () => {
    const user = userEvent.setup();
    const { requests } = renderApp('/products?statuses=ACTIVE');
    await screen.findByRole('cell', { name: 'Notebook A5' });

    await user.click(screen.getByRole('checkbox', { name: '이 페이지 전체 선택' }));
    const bulkButton = screen.getByRole('button', { name: /선택 판매 중지/ });
    const selectedLabel = bulkButton.textContent;
    expect(selectedLabel).not.toContain('(0)');
    await user.click(bulkButton);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: '판매 중지' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe('요청을 처리할 수 없습니다.');
    expect(requests.filter((request) => request.line === 'POST /api/products/deactivate')).toHaveLength(1);

    // 실패 뒤 닫아도 선택은 그대로다(성공했을 때만 비운다).
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByRole('button', { name: /선택 판매 중지/ }).textContent).toBe(selectedLabel);
  });
});
