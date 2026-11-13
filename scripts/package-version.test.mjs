// 파일 책임: 적합성 결과가 실제 패키지 후보 버전으로 식별되는지 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conformanceTitle } from '../packages/web-kit/src/testing/target.mjs';

test('conformance report titles identify the actual package version', () => {
  const { version } = JSON.parse(readFileSync(new URL('../packages/web-kit/package.json', import.meta.url), 'utf8'));
  assert.equal(conformanceTitle('B-version', { registryVersion: 'local', registryCommit: 'candidate' }, 'version'), `[web-kit:B-version|${encodeURIComponent(version)}|local|candidate] version`);
});
