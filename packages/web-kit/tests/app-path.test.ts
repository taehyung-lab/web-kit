// 파일 책임: 외부에서 받은 이동 주소가 같은 앱 안의 경로로만 통과하는지 공격 모양 표로 검사한다.
import { expect, it } from 'vitest';
import { safeAppPath } from '../src/app-path';
import { captureListReturn } from '../src/list-return';

const accepted = ['/', '/items', '/items?page=3#row', '/items/1/edit', '/search?q=a%20b', '/login-help', '/a//b', '/files?path=%2Fshare'];
const rejected: readonly unknown[] = [
  undefined, null, 1, '', 'items', './items', '../items', '#top', '?q=1',
  'https://evil.com', 'http:evil.com', 'javascript:alert(1)', 'data:text/html,x', 'mailto:a@b.c',
  '//evil.com', '///evil.com', '/\\evil.com', '\\\\evil.com', '/items\\..\\x',
  '/\t/evil.com', '/\n/evil.com', '/\r/evil.com', ' /items', '/items ', '/it ems', '/\u0000', '/\u007F', '/ x', '/ x',
  '/%5Cevil.com', '/%5cevil.com', '/%2F%2Fevil.com', '/%2F/evil.com', '/%09/evil.com', '/%0A', '/%E0%A4%A',
];

it.each(accepted)('같은 앱 경로 %j는 원문 그대로 통과한다', (value) => {
  expect(safeAppPath(value)).toBe(value);
});

it.each(rejected.map((value) => [value]))('앱 밖으로 나갈 수 있는 %j는 거절한다', (value) => {
  expect(safeAppPath(value)).toBeUndefined();
});

it('제외 경로는 같은 경로와 그 아래만 거절하고 이름만 이어진 경로는 통과한다', () => {
  const exclude = ['/login'];
  for (const value of ['/login', '/login?x=1', '/login#a', '/login/', '/login/otp'])
    expect(safeAppPath(value, { exclude })).toBeUndefined();
  for (const value of ['/login-help', '/logins', '/items?next=/login'])
    expect(safeAppPath(value, { exclude })).toBe(value);
  expect(safeAppPath('/sign/in', { exclude: ['/sign/', '/other'] })).toBeUndefined();
});

it('목록 복귀 문맥도 같은 판정을 쓴다', () => {
  for (const href of ['/\t/evil.com', '/%5Cevil.com', '/\\evil.com']) expect(() => captureListReturn(href)).toThrow();
  expect(captureListReturn('/items?page=2')).toEqual({ href: '/items?page=2' });
});
