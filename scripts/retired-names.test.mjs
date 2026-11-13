// 파일 책임: 이름을 바꾼 뒤 사용 안내(스킬·README·docs)에 옛 이름이 남아 있는지 검사한다.
// 옛 이름을 설명하는 migrating.md만 제외한다. 이름을 또 바꾸면 아래 목록에 옛 이름을 더한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
/** 바뀐 이름과 새 이름. 5.1.0-rc.5에서 상세 부품 이름과 복사본 파일 이름을 정리했다. */
const RETIRED = [
  [/\bRecordDefaults\b/, 'DetailDefaults'],
  [/\bRecordMessages\b/, 'DetailMessages'],
  [/\bRenderRecordFailure\b/, 'RenderDetailFailure'],
  [/\bRecordFailurePlace\b/, 'DetailFailurePlace'],
  [/<Record[\s>]|<\/Record>|\bRecord\.(Fields|Field|History)\b/, 'Detail'],
  [/\b(?:list-ui|detail-ui)\.tsx\b|web-kit\/(?:list-ui|detail-ui|form\/ui)\b|\bform\/ui\.tsx\b/, 'list·detail·form/form 파일 이름'],
];
const GUIDE_ROOTS = ['packages/web-kit/skills', 'packages/web-kit/docs', 'packages/web-kit/README.md', 'README.md', 'apps/starter/docs'];

function markdownFiles(path) {
  const full = join(root, path);
  if (statSync(full).isFile()) return path.endsWith('.md') ? [full] : [];
  return readdirSync(full).flatMap((name) => markdownFiles(join(path, name)));
}

test('사용 안내에 옛 이름이 남아 있지 않다', () => {
  const found = [];
  for (const file of GUIDE_ROOTS.flatMap(markdownFiles)) {
    if (file.endsWith('migrating.md')) continue;
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      for (const [pattern, current] of RETIRED) if (pattern.test(line)) found.push(`${relative(root, file)}:${index + 1} → ${current}`);
    });
  }
  assert.deepEqual(found, []);
});
