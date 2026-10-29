// 파일 책임: 적합성 점검 명령이 정상·누락·버전·지문 위반을 구별하는지 실제 파일 입력으로 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const command = fileURLToPath(new URL('../packages/web-kit/bin/check-conformance.mjs', import.meta.url));
/** 한 항목만 설치한 소비 프로젝트의 실제 입력 파일을 만든다. */
function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'web-kit-audit-'));
  const content = '// connection\n';
  const installation = { version: '4.1.0-rc.6', sourceRef: 'v4.1.0-rc.6', sourceCommit: 'commit', items: [{ name: 'inputs', files: [{ source: 'checks/inputs.test.tsx', installed: 'inputs.test.tsx', installedHash: createHash('sha256').update(content).digest('hex') }] }] };
  const unit = { success: true, testResults: [{ assertionResults: [{ fullName: '[web-kit:inputs-unit|4.1.0-rc.6|v4.1.0-rc.6|commit] contract', status: 'passed' }] }] };
  writeFileSync(join(dir, 'inputs.test.tsx'), content);
  /** 바꾼 입력을 디스크에 기록하고 배포할 명령을 실행한다. */
  function audit(strict = true) {
    writeFileSync(join(dir, 'installation.json'), JSON.stringify(installation));
    writeFileSync(join(dir, 'unit.json'), JSON.stringify(unit));
    writeFileSync(join(dir, 'browser.json'), JSON.stringify({ suites: [] }));
    return spawnSync(process.execPath, [command, '--installation', join(dir, 'installation.json'), '--unit', join(dir, 'unit.json'), '--browser', join(dir, 'browser.json'), ...(strict ? ['--strict-fingerprints'] : [])], { encoding: 'utf8' });
  }
  try { run({ dir, installation, unit, audit }); } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('점검: 정상 입력은 통과하고 자동 판정의 한계를 알린다', () => fixture(({ audit }) => { const r = audit(); assert.equal(r.status, 0); assert.match(r.stdout, /독립 검토/); }));
test('점검: 연결 파일이 없으면 지난 성공 보고서도 거절한다', () => fixture(({ dir, audit }) => { rmSync(join(dir, 'inputs.test.tsx')); const r = audit(); assert.equal(r.status, 1); assert.match(r.stderr, /검사 연결 없음/); }));
test('점검: 빠진 검사를 거절한다', () => fixture(({ unit, audit }) => { unit.testResults = []; const r = audit(); assert.equal(r.status, 1); assert.match(r.stderr, /필수 검사 누락/); }));
for (const status of ['pending', 'failed', 'skipped']) test('점검: ' + status + ' 결과를 거절한다', () => fixture(({ unit, audit }) => { unit.testResults[0].assertionResults[0].status = status; assert.equal(audit().status, 1); }));
test('점검: 대상 registry와 commit 불일치를 거절한다', () => fixture(({ unit, audit }) => { unit.testResults[0].assertionResults[0].fullName = '[web-kit:inputs-unit|4.1.0-rc.6|v9|old] contract'; const r = audit(); assert.equal(r.status, 1); assert.match(r.stderr, /불일치/); }));
test('점검: 지문 변경은 기본 알림이고 strict에서는 실패다', () => fixture(({ dir, audit }) => { writeFileSync(join(dir, 'inputs.test.tsx'), '// modified\n'); assert.equal(audit(false).status, 0); assert.equal(audit().status, 1); }));
test('점검: only 연결은 통과 결과가 있어도 거절한다', () => fixture(({ dir, audit }) => { writeFileSync(join(dir, 'inputs.test.tsx'), 'test.only("focused", () => {});'); const r = audit(false); assert.equal(r.status, 1); assert.match(r.stderr, /skip\/only/); }));
