// 파일 책임: 배포 스킬의 실제 조립 예 경로와 절별 안내, 제거된 패키지 UI 입구의 재등장을 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const skills = readdirSync(resolve(root, 'packages/web-kit/skills')).filter((name) => name.startsWith('web-kit-'));
for (const name of skills) {
  const path = resolve(root, 'packages/web-kit/skills', name, 'SKILL.md');
  const text = readFileSync(path, 'utf8');
  // 스킬이 가리키는 파일의 존재를 확인한다.
  test(name + ': 문서의 로컬 링크가 실제 파일을 가리킨다', () => {
    for (const [, target] of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:/.test(target)) continue;
      assert.ok(existsSync(resolve(dirname(path), decodeURIComponent(target.split('#')[0]))), name + ' → ' + target);
    }
  });
  // 절별 조립 예와 예시 값의 적용 한계를 확인한다.
  test(name + ': 각 절에 실제 조립 예 또는 승인된 미확인 표시가 있다', () => {
    const sections = text.split(/^## /m).slice(1);
    assert.ok(sections.length > 0);
    for (const section of sections) {
      assert.match(section, /\]\([^)]*apps\/starter\//, section.split('\n')[0]);
      assert.match(section, /조립 방식만 참고한다\. 필드·기본값·문구·권한은 예시 값이며 프로젝트의 원문·결정으로 정한다\./);
      if (name === 'web-kit-permission') assert.match(section, /starter 실제 예 없음\(검사하지 않음\)/);
    }
  });
  // 제거된 패키지 입구를 다시 권하지 않도록 막는다.
  test(name + ': 제거된 패키지 UI 입구 안내가 없다', () => {
    assert.doesNotMatch(text, /`\/(?:list\/ui|form\/ui|detail\/ui|ui|filter)`|@boosterlab\/web-kit\/(?:list\/ui|form\/ui|detail\/ui|ui[\x27\x22`]|styles\.css)/);
  });
}
