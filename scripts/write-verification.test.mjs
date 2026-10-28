// 파일 책임: 발행 메타데이터가 실제 checkout과 tarball을 식별하고 모호한 산출물은 거절하는지 임시 저장소에서 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./write-verification.mjs', import.meta.url));

/** 사용자 저장소를 건드리지 않는 임시 checkout과 가짜 산출물을 만들고 시험 뒤 정리한다. */
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'web-kit-verification-'));
  try {
    const kit = join(root, 'kit');
    const artifacts = join(root, 'artifacts');
    for (const path of [kit, artifacts]) mkdirSync(path);
    execFileSync('git', ['init', '-q', kit]);
    writeFileSync(join(kit, 'package.json'), JSON.stringify({ version: '1.1.0' }));
    execFileSync('git', ['-C', kit, 'add', 'package.json']);
    execFileSync('git', ['-C', kit, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture']);
    const bytes = Buffer.from('synthetic packed bytes');
    writeFileSync(join(artifacts, 'boosterlab-web-kit-1.1.0.tgz'), bytes);
    run({ kit, artifacts, bytes });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('기록은 실제 commit과 검사 대상 파일의 hash를 담는다', () => fixture(({ kit, artifacts, bytes }) => {
  execFileSync(process.execPath, [script, kit, artifacts]);
  const metadata = JSON.parse(readFileSync(join(artifacts, 'verification.json'), 'utf8'));
  assert.equal(metadata.commit, execFileSync('git', ['-C', kit, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
  assert.equal(metadata.version, '1.1.0');
  assert.equal(metadata.sha256, createHash('sha256').update(bytes).digest('hex'));
}));

test('여러 tarball 중 임의로 하나를 고르지 않는다', () => fixture(({ kit, artifacts }) => {
  writeFileSync(join(artifacts, 'boosterlab-web-kit-0.0.0.tgz'), 'old');
  const result = spawnSync(process.execPath, [script, kit, artifacts], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /exactly one/);
  assert.equal(existsSync(join(artifacts, 'verification.json')), false);
}));

test('package 버전과 다른 tarball은 기록하지 않는다', () => fixture(({ kit, artifacts }) => {
  writeFileSync(join(kit, 'package.json'), JSON.stringify({ version: '2.0.0' }));
  const result = spawnSync(process.execPath, [script, kit, artifacts], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /version and tarball name differ/);
  assert.equal(existsSync(join(artifacts, 'verification.json')), false);
}));
