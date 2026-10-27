// @vitest-environment jsdom
// 파일 책임: 상세 라벨/값 표현의 의미 구조를 실제 React에서 검사한다.
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { DetailField } from '../src/DetailField';
afterEach(cleanup);

it('상세 라벨·값은 dt/dd로 표시하고 0·빈 값 정책을 소비자에게 맡긴다', () => {
  const { container } = render(<dl><DetailField label="인원" classes={{ root: 'root', label: 'label', value: 'value' }}>{0}</DetailField></dl>);
  expect(screen.getByText('인원').tagName).toBe('DT');
  expect(container.querySelector('dd')?.textContent).toBe('0');
  expect(container.querySelector('dd')?.className).toBe('value');
});
