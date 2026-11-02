// 파일 책임: 옮긴 문서·옛 경로·한글 제목·실제 배포 링크가 끊기면 검사에서 거절되는지 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMarkdownLinks, markdownFiles } from './document-links.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
test('관리 문서와 starter 템플릿의 파일·제목 링크가 해소된다', () => {
  const files = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'apps/starter/README.md'].map((file) => resolve(root, file));
  for (const dir of ['docs', 'packages/web-kit', 'apps/starter/docs', 'scripts/starter', '.agents/skills']) files.push(...markdownFiles(resolve(root, dir)));
  checkMarkdownLinks(files, { resolveLink: (path) => {
    const template = resolve(root, 'scripts/starter/node_modules/@boosterlab/web-kit');
    return path.startsWith(template + '/') ? resolve(root, 'packages/web-kit', path.slice(template.length + 1)) : path;
  } });
});
test('한글·중복 제목·코드 블록을 구별하고 없는 파일과 앵커를 거절한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'web-kit-docs-'));
  try {
    writeFileSync(join(dir, 'target.md'), '# 제목: A · B\n## 같은 제목\n## 같은 제목\n```md\n## 코드 속 제목\n```\n');
    const file = join(dir, 'README.md');
    writeFileSync(file, '[첫 제목](target.md#제목-a--b) [중복](target.md#같은-제목-1)');
    checkMarkdownLinks([file], { root: dir });
    writeFileSync(file, '[옛 제목](target.md#코드-속-제목)');
    assert.throws(() => checkMarkdownLinks([file]), /없는 앵커/);
    writeFileSync(file, '[옛 경로](removed.md)');
    assert.throws(() => checkMarkdownLinks([file]), /없는 링크/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
