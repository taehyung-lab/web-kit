// 파일 책임: 배포 스킬의 실제 조립 예 경로와 절별 안내, 제거된 패키지 UI 입구의 재등장을 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { checkMarkdownLinks } from './document-links.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
/**
 * 본보기로 가리키면 안 되는 starter 경로: 모든 업무 폴더(src/features/, 인증 포함)와 새 프로젝트에서 빠지는 예시 업무 층
 * (scripts/starter/examples.json). 보장은 계약 문장으로 설명하고, 링크는 앱 조립·실행 기반·설정·적합성 검사에만 둔다.
 * 단어가 아니라 링크 대상 경로로 판정한다.
 */
const exampleLayer = ['src/features', ...JSON.parse(readFileSync(resolve(root, 'scripts/starter/examples.json'), 'utf8')).remove];
/** 문서 링크 중 starter의 업무 폴더·예시 업무 층을 가리키는 것. */
function exampleLinks(text) {
  return [...text.matchAll(/\]\(([^)]+)\)/g)]
    .map(([, target]) => target.split('#')[0].match(/(?:^|\/)apps\/starter\/(.+?)(?:\.txt)?$/)?.[1])
    .filter((path) => path !== undefined && exampleLayer.some((example) => path === example || path.startsWith(example + '/')));
}
for (const document of ['README.md', ...readdirSync(resolve(root, 'packages/web-kit/docs')).filter((file) => file.endsWith('.md')).map((file) => 'docs/' + file)]) {
  test(`packages/web-kit/${document}: 업무 폴더·예시 업무 파일을 본보기로 링크하지 않는다`, () => {
    assert.deepEqual(exampleLinks(readFileSync(resolve(root, 'packages/web-kit', document), 'utf8')), []);
  });
}
test('업무 폴더 링크 판정은 경로로 하고 앱 조립·실행 기반·적합성 검사 링크는 허용한다', () => {
  assert.deepEqual(exampleLinks('[a](../../references/apps/starter/src/features/products/api/products.ts.txt) [b](../../references/apps/starter/src/runtime/web-kit.ts.txt) [c](../../references/apps/starter/src/features/auth/index.ts.txt) [d](../../references/apps/starter/src/shared/ui/web-kit/checks/form-ui.test.tsx.txt) [e](../../references/apps/starter/src/routes/_app/products/index.tsx.txt)'), ['src/features/products/api/products.ts', 'src/features/auth/index.ts', 'src/routes/_app/products/index.tsx']);
  assert.deepEqual(exampleLinks('상품 목록과 products 단어만 있는 문장'), []);
});
const skills =readdirSync(resolve(root, 'packages/web-kit/skills')).filter((name) => name.startsWith('web-kit-'));
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
  // 보장은 계약으로 설명한다. 새 프로젝트에 없는 예시 업무(scripts/starter/examples.json)의 파일을 본보기로 가리키지 않는다.
  test(name + ': 업무 폴더·예시 업무 파일을 본보기로 링크하지 않는다', () => {
    assert.deepEqual(exampleLinks(text), [], name);
  });
  // 제거된 패키지 입구를 다시 권하지 않도록 막는다.
  test(name + ': 제거된 패키지 UI 입구 안내가 없다', () => {
    assert.doesNotMatch(text, /`\/(?:list\/ui|form\/ui|detail\/ui|ui|filter)`|@boosterlab\/web-kit\/(?:list\/ui|form\/ui|detail\/ui|ui[\x27\x22`]|styles\.css)/);
  });
}

/** 풀어 낸 패키지의 모든 문서 링크가 패키지 안에서 읽히는지 확인한다. */
function checkPackedLinks(packageRoot) {
  const documents = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      if (!path.endsWith('.md')) continue;
      documents.push(path);
      for (const [, href] of readFileSync(path, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
        if (/^(?:https?:|#)/.test(href)) continue;
        const target = resolve(dirname(path), decodeURIComponent(href.split('#')[0]));
        assert.ok(target.startsWith(packageRoot + '/') || target === packageRoot, path + ': 패키지 밖 링크 ' + href);
        assert.ok(existsSync(target), path + ': 없는 링크 ' + href);
      }
    }
  };
  walk(packageRoot);
  checkMarkdownLinks(documents, { root: packageRoot });
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
