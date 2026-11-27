// 파일 책임: 브라우저 mock 상태의 저장·복원 검사. 지금 모양과, 인증·업무 상태를 나누기 전에 저장한 모양을 모두 그대로 읽는다.
import { mockDb } from '@/mocks/db';
import { exampleDb } from '@/mocks/examples/example-db';
import { mockServerState } from '@/mocks/server-state';
import { expect, it } from 'vitest';

it('저장한 인증·업무 상태를 그대로 되살린다', () => {
  mockDb.issueToken();
  mockDb.refreshValid = false;
  exampleDb.products = exampleDb.products.map((product, index) => (index === 0 ? { ...product, name: 'Edited' } : product));
  const saved = JSON.parse(JSON.stringify(mockServerState.snapshot()));
  mockServerState.reset();
  mockServerState.restore(saved);
  expect(exampleDb.products[0]!.name).toBe('Edited');
  expect(mockDb.refreshValid).toBe(false);
  expect(mockDb.snapshot().issued).toBe(1);
});

it('나누기 전 모양(인증·업무 값이 한 객체)으로 저장된 상태도 초기화하지 않고 읽는다', () => {
  const token = mockDb.issueToken();
  const legacy = JSON.parse(
    JSON.stringify({
      products: exampleDb.products.map((product, index) => (index === 0 ? { ...product, name: 'Legacy edit' } : product)),
      members: exampleDb.members,
      terms: [],
      workflows: [],
      tokens: [[token, Date.now()]],
      refreshValid: false,
      issued: 3,
    })
  );
  mockServerState.reset();
  mockServerState.restore(legacy);
  expect(exampleDb.products[0]!.name).toBe('Legacy edit');
  expect(mockDb.refreshValid).toBe(false);
  expect(mockDb.snapshot().issued).toBe(3);
  expect(mockDb.isValidToken(token)).toBe(true);
  expect(Object.keys(exampleDb.snapshot()).sort()).toEqual(['members', 'products', 'terms', 'workflows']);
});
