// @vitest-environment jsdom
// 파일 책임: 권한 틀이 불러오는 중·실패·Provider 없음·판정 오류에서 닫히고, 준비되면 판정대로 진입·메뉴·버튼을 여는지 검사한다.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import {
  AccessDeniedError,
  Allowed,
  assertAllowed,
  filterAllowed,
  PermissionProvider,
  useAllowed,
  type Access,
} from '../src/permission';

afterEach(cleanup);

type Check = 'list:read' | 'list:download';
const granted = new Set<Check>(['list:read']);
const ready: Access<Check> = { status: 'ready', allows: (check) => granted.has(check) };

/** 버튼 비활성·숨김을 같은 판정으로 그린다. */
function Screen() {
  const canDownload = useAllowed<Check>('list:download');
  const canRead = useAllowed<Check>('list:read');
  return (
    <>
      <button disabled={!canRead}>읽기</button>
      <button disabled={!canDownload}>다운로드</button>
      <Allowed check={'list:read' as Check} fallback={<span>숨김</span>}>
        <span>메뉴</span>
      </Allowed>
    </>
  );
}

const disabled = (name: string) => (screen.getByRole('button', { name }) as HTMLButtonElement).disabled;

it.each([
  ['불러오는 중', { status: 'loading', allows: () => true } as Access<Check>],
  ['조회 실패', { status: 'failed', allows: () => true } as Access<Check>],
  ['판정이 던짐', { status: 'ready', allows: () => { throw new Error('x'); } } as Access<Check>],
])('%s이면 허용으로 보이지 않는다', (_, access) => {
  render(
    <PermissionProvider access={access}>
      <Screen />
    </PermissionProvider>,
  );
  expect(disabled('읽기')).toBe(true);
  expect(disabled('다운로드')).toBe(true);
  expect(screen.getByText('숨김')).toBeTruthy();
});

it('Provider가 없으면 닫힌다', () => {
  render(<Screen />);
  expect(disabled('읽기')).toBe(true);
  expect(screen.queryByText('메뉴')).toBeNull();
});

it('준비되면 판정대로 버튼을 열고 메뉴를 보인다', () => {
  render(
    <PermissionProvider access={ready}>
      <Screen />
    </PermissionProvider>,
  );
  expect(disabled('읽기')).toBe(false);
  expect(disabled('다운로드')).toBe(true);
  expect(screen.getByText('메뉴')).toBeTruthy();
});

it('경로 진입: 권한 없음은 denied, 준비 전·판정 대상 없음은 not-ready로 거부한다', () => {
  expect(() => assertAllowed(ready, 'list:read')).not.toThrow();
  const reason = (fn: () => void) => {
    try {
      fn();
    } catch (error) {
      return error instanceof AccessDeniedError ? error.reason : 'other';
    }
    return 'allowed';
  };
  expect(reason(() => assertAllowed(ready, 'list:download'))).toBe('denied');
  expect(reason(() => assertAllowed({ status: 'loading', allows: () => true }, 'list:read'))).toBe('not-ready');
  expect(reason(() => assertAllowed(ready, undefined))).toBe('not-ready');
  expect(reason(() => assertAllowed(undefined, 'list:read'))).toBe('not-ready');
});

it('메뉴 트리는 허용 항목만 남기고 자식이 모두 빠진 묶음을 지우며, 준비 전에는 checks 있는 항목을 모두 숨긴다', () => {
  const tree = [
    { id: 'home' },
    { id: 'list', checks: ['list:read' as Check] },
    { id: 'group', children: [{ id: 'dl', checks: ['list:download' as Check] }] },
    { id: 'mixed', children: [{ id: 'dl2', checks: ['list:download' as Check] }, { id: 'rd', checks: ['list:read' as Check] }] },
  ];
  expect(filterAllowed(tree, ready).map((item) => item.id)).toEqual(['home', 'list', 'mixed']);
  expect(filterAllowed(tree, ready)[2]!.children!.map((item) => item.id)).toEqual(['rd']);
  expect(filterAllowed(tree, { status: 'loading', allows: () => true }).map((item) => item.id)).toEqual(['home']);
});
