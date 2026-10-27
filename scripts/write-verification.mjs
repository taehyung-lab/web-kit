// 파일 책임: starter 소비 검사가 끝난 뒤 실제 commit과 검사한 tarball의 식별값을 같은 artifact에 기록한다. 키트와 starter는 같은 저장소라 commit은 하나다.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** 셸 해석 없이 지정 checkout의 실제 commit을 읽는다. */
function commit(directory) {
  return execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

const [kitPath, artifactPath] = process.argv.slice(2);
if (!kitPath || !artifactPath) throw new Error('Usage: write-verification.mjs KIT_PACKAGE ARTIFACT_DIRECTORY');
const kit = resolve(kitPath);
const directory = resolve(artifactPath);
const archives = readdirSync(directory).filter((name) => /^boosterlab-web-kit-.*\.tgz$/.test(name));
if (archives.length !== 1) throw new Error('Expected exactly one web-kit tarball');
const tarball = archives[0];
const { version } = JSON.parse(readFileSync(join(kit, 'package.json'), 'utf8'));
if (tarball !== `boosterlab-web-kit-${version}.tgz`) throw new Error('Package version and tarball name differ');
const metadata = {
  commit: commit(kit),
  consumer: 'apps/starter',
  version,
  tarball,
  sha256: createHash('sha256').update(readFileSync(join(directory, tarball))).digest('hex'),
  runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
};
writeFileSync(join(directory, 'verification.json'), `${JSON.stringify(metadata, null, 2)}\n`);
