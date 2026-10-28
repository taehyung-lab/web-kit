// 파일 책임: 프로젝트가 배치하는 키트 블록(칸·구역·폼 한 줄)의 CSS가 프로젝트 간격 유틸리티를 지우지 않는지 검사한다(3.0 6단계, 5단계 교정 3).
import { expect, it } from 'vitest';

/** Vite는 테스트에서 CSS 내용을 비우므로 파일을 직접 읽는다. 키트에 node 타입 의존성을 더하지 않는다. */
const { readFileSync } = (
  globalThis as unknown as { process: { getBuiltinModule: (id: 'node:fs') => { readFileSync: (path: URL, encoding: 'utf8') => string } } }
).process.getBuiltinModule('node:fs');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

/** 선택자 하나로 시작하는 규칙 본문들. */
function blocks(selector: string): string[] {
  const out: string[] = [];
  const pattern = new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g');
  for (const match of css.matchAll(pattern)) out.push(match[2] ?? '');
  return out;
}

it('칸·구역·폼 한 줄은 클래스 우선순위로 margin을 두지 않는다(초기화는 :where로 0 우선순위)', () => {
  for (const selector of ['.wk-field', 'fieldset.wk-field', '.wk-section', '.wk-form-failure']) {
    for (const body of blocks(selector)) expect(body, selector).not.toMatch(/(^|[\s;])margin(-[a-z-]+)?\s*:/);
  }
  expect(css).toMatch(/:where\(fieldset\.wk-field, \.wk-section, \.wk-form-failure\)\s*\{\s*margin: 0;/);
});
