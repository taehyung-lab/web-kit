// 파일 책임: 발행 스크립트가 올리기 전에 산출물(tarball·verification.json)이 그 commit·버전·지문과 맞는지 확인하는지 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyArtifact } from './release-publish.mjs';

const commit = 'a'.repeat(40);
const version = '5.0.0-rc.99';

/** CI가 남기는 모양의 산출물 폴더를 만든다. change로 한 값을 어긋나게 한다. */
function artifact(change = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'web-kit-artifact-'));
  const body = Buffer.from('tarball bytes');
  writeFileSync(join(dir, 'boosterlab-web-kit.tgz'), body);
  const verification = { commit, version, tarball: 'boosterlab-web-kit.tgz', sha256: createHash('sha256').update(body).digest('hex'), ...change };
  writeFileSync(join(dir, 'verification.json'), JSON.stringify(verification));
  return dir;
}

test('commit·버전·SHA-256이 맞으면 올릴 파일을 돌려준다', () => {
  const dir = artifact();
  try {
    const result = verifyArtifact({ dir, commit, version });
    assert.equal(result.tarball, join(dir, 'boosterlab-web-kit.tgz'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

for (const [name, change, message] of [
  ['다른 commit', { commit: 'b'.repeat(40) }, /commit/],
  ['다른 버전', { version: '5.0.0-rc.98' }, /버전/],
  ['바뀐 tarball', { sha256: '0'.repeat(64) }, /SHA-256/],
  ['없는 tarball', { tarball: 'missing.tgz' }, /tarball이 없습니다/],
]) test('어긋난 산출물은 거절한다: ' + name, () => {
  const dir = artifact(change);
  try { assert.throws(() => verifyArtifact({ dir, commit, version }), message); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});
