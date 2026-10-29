// 파일 책임: styles 복사본의 공통 적합성 기준과 단언을 소유한다.
import { expect, it as baseIt } from 'vitest';
import { conformanceTitle, type ConformanceTarget } from '../target.mjs';

/** 소비처가 넘긴 실제 복사본으로 styles 보장 전체를 등록한다. */
export function checkStylesConformance({ css }: { css: string }, target: ConformanceTarget) {
  const it = baseIt;
  const title = (id: string, label: string) => conformanceTitle(id, target, label);
// 파일 책임: 프로젝트가 배치하는 키트 블록(칸·구역·폼 한 줄)의 CSS가 프로젝트 간격 유틸리티를 지우지 않는지 검사한다(3.0 6단계, 5단계 교정 3).

/** 선택자 하나로 시작하는 규칙 본문들. */
function blocks(selector: string): string[] {
  const out: string[] = [];
  const pattern = new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g');
  for (const match of css.matchAll(pattern)) out.push(match[2] ?? '');
  return out;
}

it(title('G110', '칸·구역·폼 한 줄은 클래스 우선순위로 margin을 두지 않는다(초기화는 :where로 0 우선순위)'), () => {
  for (const selector of ['.wk-field', 'fieldset.wk-field', '.wk-section', '.wk-form-failure']) {
    for (const body of blocks(selector)) expect(body, selector).not.toMatch(/(^|[\s;])margin(-[a-z-]+)?\s*:/);
  }
  expect(css).toMatch(/:where\(fieldset\.wk-field, \.wk-section, \.wk-form-failure\)\s*\{\s*margin: 0;/);
});
}
