// @vitest-environment jsdom
// 파일 책임: 공개 선택 hook의 검색/재조회/잠금 수명과 상세 의미 구조를 실제 React에서 검사한다.
import { act, renderHook, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { usePageSelection } from '../src/list';
import { DetailField } from '../src/DetailField';
afterEach(cleanup);

it('선택 순서를 유지하고 탈락 ID는 돌아와도 복원하지 않는다', () => {
  const { result, rerender } = renderHook(usePageSelection, { initialProps: { ids: ['a', 'b'], resetKey: 'one', locked: false } });
  act(() => result.current.toggleRow('b', true));
  act(() => result.current.toggleRow('a', true));
  expect(result.current.selectedIds).toEqual(['b', 'a']);
  rerender({ ids: ['b', 'a'], resetKey: 'one', locked: false });
  expect(result.current.selectedIds).toEqual(['b', 'a']);
  rerender({ ids: ['a'], resetKey: 'one', locked: false });
  rerender({ ids: ['b', 'a'], resetKey: 'one', locked: false });
  expect(result.current.selectedIds).toEqual(['a']);
  rerender({ ids: ['b', 'a'], resetKey: 'two', locked: false });
  expect(result.current.selectedIds).toEqual([]);
});
it('잠금 중 토글은 막고 명시적 clear는 허용한다', () => {
  const { result, rerender } = renderHook(usePageSelection, { initialProps: { ids: ['a', 'b'], resetKey: 'one', locked: false } });
  act(() => result.current.toggleRow('a', true));
  expect(result.current.isMixed).toBe(true);
  rerender({ ids: ['a', 'b'], resetKey: 'one', locked: true });
  act(() => result.current.togglePage(true));
  act(() => result.current.toggleRow('a', false));
  expect(result.current.selectedIds).toEqual(['a']);
  act(() => result.current.clear());
  expect(result.current.selectedIds).toEqual([]);
});
it('페이지 밖 ID는 선택하지 않고 빈 페이지는 전체 체크가 아니다', () => {
  const { result, rerender } = renderHook(usePageSelection, { initialProps: { ids: ['a', 'b'], resetKey: 'one', locked: false } });
  act(() => result.current.toggleRow('outside', true));
  expect(result.current.selectedIds).toEqual([]);
  act(() => result.current.togglePage(true));
  expect(result.current.isAllChecked).toBe(true);
  rerender({ ids: [], resetKey: 'one', locked: false });
  expect(result.current.isAllChecked).toBe(false);
  expect(result.current.isMixed).toBe(false);
});
it('상세 라벨·값은 dt/dd로 표시하고 0·빈 값 정책을 소비자에게 맡긴다', () => {
  const { container } = render(<dl><DetailField label="인원" classes={{ root: 'root', label: 'label', value: 'value' }}>{0}</DetailField></dl>);
  expect(screen.getByText('인원').tagName).toBe('DT');
  expect(container.querySelector('dd')?.textContent).toBe('0');
  expect(container.querySelector('dd')?.className).toBe('value');
});
