// 파일 책임: 고정 CLI로 registry를 재빌드하여 같은 checkout의 커밋된 산출물과 정확히 비교한다.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { checkRegistryDependencies } from './registry-dependencies.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'web-kit-registry-'));
try {
  execFileSync('pnpm', ['exec', 'shadcn', 'build', 'registry.json', '--output', temporary], { cwd: root, stdio: 'pipe' });
  const expected = readdirSync(temporary).sort();
  const committed = resolve(root, 'public/r');
  assert.deepEqual(readdirSync(committed).sort(), expected, 'registry 산출물 목록이 원본과 다릅니다');
  for (const file of expected)
    assert.deepEqual(JSON.parse(readFileSync(join(committed, file), 'utf8')), JSON.parse(readFileSync(join(temporary, file), 'utf8')), file + ': registry 산출물이 원본과 다릅니다');
  const registry = JSON.parse(readFileSync(resolve(root, 'registry.json'), 'utf8'));
  checkRegistryDependencies(root, registry);
  const names = new Set(registry.items.map((item) => '@web-kit/' + item.name));
  // `@web-kit/` 의존은 같은 registry에서 해소되어야 하고, 이름만 있는 의존은 소비 프로젝트 style의 shadcn 공식 기본 부품이다.
  for (const item of registry.items)
    for (const dependency of item.registryDependencies ?? [])
      if (dependency.startsWith('@web-kit/')) assert(names.has(dependency), item.name + ': 같은 registry에서 해소되지 않는 의존 ' + dependency);
      else assert(/^[a-z0-9-]+$/.test(dependency), item.name + ': shadcn 기본 부품 이름이 아닌 외부 의존 ' + dependency);
  console.log('registry 원본/산출물 ' + expected.length + '개 일치, 내부 의존 해소·shadcn 기본 부품 선언 확인');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
