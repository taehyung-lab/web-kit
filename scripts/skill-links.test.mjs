// 파일 책임: 배포 스킬의 실제 조립 예 경로와 절별 안내, 제거된 패키지 UI 입구의 재등장을 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
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

/** 풀어 낸 패키지의 모든 문서 링크가 패키지 안에서 읽히는지 확인한다. */
function checkPackedLinks(packageRoot) {
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      if (!path.endsWith('.md')) continue;
      for (const [, href] of readFileSync(path, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
        if (/^(?:https?:|#)/.test(href)) continue;
        const target = resolve(dirname(path), decodeURIComponent(href.split('#')[0]));
        assert.ok(target.startsWith(packageRoot + '/') || target === packageRoot, path + ': 패키지 밖 링크 ' + href);
        assert.ok(existsSync(target), path + ': 없는 링크 ' + href);
      }
    }
  };
  walk(packageRoot);
}

test('실제 tarball의 문서·스킬 예제를 독립 폴더에서 읽고, 누락된 예제는 거절한다', () => {
  const temporary = mkdtempSync(resolve(tmpdir(), 'web-kit-links-'));
  try {
    execFileSync('pnpm', ['pack', '--pack-destination', temporary], { cwd: resolve(root, 'packages/web-kit'), stdio: 'pipe' });
    const archive = readdirSync(temporary).find((name) => name.endsWith('.tgz'));
    execFileSync('tar', ['xzf', resolve(temporary, archive), '-C', temporary]);
    const packed = resolve(temporary, 'package');
    checkPackedLinks(packed);
    // 읽기용 예제는 실제 검사 앱 원본과 같은 바이트여야 한다.
    const examples = resolve(packed, 'references/apps/starter');
    const compare = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = resolve(dir, entry.name);
        if (entry.isDirectory()) compare(path);
        else if (!path.endsWith('.md')) assert.deepEqual(readFileSync(path), readFileSync(resolve(root, 'apps/starter', path.slice(examples.length + 1).replace(/(\.[cm]?[jt]sx?)\.txt$/, '$1'))));
      }
    };
    compare(examples);
    rmSync(resolve(examples, 'src/shared/ui/web-kit/checks/auth.page.tsx.txt'));
    assert.throws(() => checkPackedLinks(packed), /없는 링크/);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
