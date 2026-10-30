// 파일 책임: 설치 선언과 실제 import·요구 목록의 어긋남을 검사기가 거절하는지 판정한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRegistryDependencies } from './registry-dependencies.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const registry = JSON.parse(readFileSync(new URL('../registry.json', import.meta.url), 'utf8'));
test('설치 정본: 실제 모든 항목의 import 선언이 충족된다', () => checkRegistryDependencies(root, registry));
test('설치 정본 반례: requirements와 다른 내부 의존을 거절한다', () => {
  const changed = structuredClone(registry);
  changed.items.find((item) => item.name === 'inputs').registryDependencies.push('@web-kit/form');
  assert.throws(() => checkRegistryDependencies(root, changed), /의존 불일치/);
});
test('npm 선언 반례: retry의 query 선언 누락을 거절한다', () => {
  const changed = structuredClone(registry);
  changed.items.find((item) => item.name === 'retry').dependencies = [];
  assert.throws(() => checkRegistryDependencies(root, changed), /retry: npm 의존 선언 누락 @tanstack\/react-query/);
});
test('검사 import 반례: inputs 검사에서 폼을 가져오면 선언 부재로 거절한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'web-kit-import-negative-'));
  try {
    const file = join(dir, 'check.ts');
    writeFileSync(file, "import { useForm } from '@tanstack/react-form'; console.log(useForm);\n");
    const changed = structuredClone(registry);
    changed.items.find((item) => item.name === 'inputs').files.push({ path: file });
    assert.throws(() => checkRegistryDependencies(root, changed), /inputs: npm 의존 선언 누락 @tanstack\/react-form/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
