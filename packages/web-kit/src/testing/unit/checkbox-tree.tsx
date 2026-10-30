// 파일 책임: 폼 없이 체크 트리 복사본의 접근성 연결·선택·초점 수신을 검사한다.
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type * as Tree from '../contracts/CheckboxTree';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';
/** 실제 체크 트리에 그룹 속성·leaf 선택·프로그램 초점을 전달한다. */
export function checkCheckboxTreeConformance({ CheckboxTree }: { CheckboxTree: typeof Tree.CheckboxTree }, target: ConformanceTarget) {
  afterEach(cleanup);
  it(conformanceTitle('tree-unit', target, '그룹 연결·선택·초점 수신'), () => {
    /** 선택 상태만 제공하고 UI는 소비 복사본이 그린다. */
    function Screen() {
      const [values, setValues] = useState<string[]>([]);
      return <><span id="label">분류</span><span id="error">필수</span><CheckboxTree id="categories" labelledBy="label" describedBy="error" invalid values={values} onValueChange={setValues} nodes={[{ value: 'paper', label: 'Paper' }]} renderCheckbox={({ label, checked, toggle }) => <input type="checkbox" aria-label={label} checked={checked} onChange={toggle} />}/></>;
    }
    render(<Screen />);
    const group = screen.getByRole('group');
    expect(group.id).toBe('categories');
    expect(group.getAttribute('aria-labelledby')).toBe('label');
    expect(group.getAttribute('aria-describedby')).toBe('error');
    expect(group.getAttribute('aria-invalid')).toBe('true');
    group.focus(); expect(document.activeElement).toBe(group);
    fireEvent.click(screen.getByRole('checkbox'));
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });
}
