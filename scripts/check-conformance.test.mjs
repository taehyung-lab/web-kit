// 파일 책임: 적합성 점검 명령이 정상·누락·버전·지문 위반을 구별하는지 실제 파일 입력으로 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
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
  const installation = { version: '4.2.0-rc.1', sourceRef: 'v4.2.0-rc.1', sourceCommit: 'commit', items: [{ name: 'inputs', files: [{ source: 'checks/inputs.test.tsx', installed: 'inputs.test.tsx', installedHash: createHash('sha256').update(content).digest('hex') }] }] };
  const unit = { success: true, testResults: [{ assertionResults: [{ fullName: '[web-kit:inputs-unit|4.2.0-rc.1|v4.2.0-rc.1|commit] contract', status: 'passed' }] }] };
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
for (const status of ['pending', 'failed', 'skipped']) test('점검: ' + status + ' 결과를 두 소비 모드 모두 거절한다', () => fixture(({ unit, audit }) => { unit.testResults[0].assertionResults[0].status = status; assert.equal(audit().status, 1); assert.equal(audit(false).status, 1); }));
test('점검: 대상 registry와 commit 불일치를 거절한다', () => fixture(({ unit, audit }) => { unit.testResults[0].assertionResults[0].fullName = '[web-kit:inputs-unit|4.2.0-rc.1|v9|old] contract'; const r = audit(); assert.equal(r.status, 1); assert.match(r.stderr, /불일치/); }));
test('점검: 지문 변경은 기본 알림이고 strict에서는 실패다', () => fixture(({ dir, audit }) => { writeFileSync(join(dir, 'inputs.test.tsx'), '// modified\n'); assert.equal(audit(false).status, 0); assert.equal(audit().status, 1); }));
test('점검: only 연결은 통과 결과가 있어도 거절한다', () => fixture(({ dir, audit }) => { writeFileSync(join(dir, 'inputs.test.tsx'), 'test.only("focused", () => {});'); const r = audit(false); assert.equal(r.status, 1); assert.match(r.stderr, /skip\/only/); }));

// 서로 다른 선택 조합에 전체 registry나 쓰지 않는 기능의 검사를 강제하지 않는다.
for (const names of [['inputs'], ['auth'], ['record', 'retry']]) {
  test('부분 채택: ' + names.join('+') + '만 연결해 검사하고 필수 의존 누락은 거절한다', () => fixture(({ installation, unit, audit, dir }) => {
    const contracts = JSON.parse(readFileSync(fileURLToPath(new URL('../packages/web-kit/src/testing/requirements.json', import.meta.url)), 'utf8'));
    const content = '// connection\n';
    installation.items = names.map((name) => ({ name, files: contracts[name].connections.map((connection) => {
      writeFileSync(join(dir, connection), content);
      return { source: 'checks/' + connection, installed: connection, installedHash: createHash('sha256').update(content).digest('hex') };
    }) }));
    unit.testResults[0].assertionResults = names.flatMap((name) => contracts[name].ids.map((id) => ({ fullName: `[web-kit:${id}|${installation.version}|${installation.sourceRef}|${installation.sourceCommit}] contract`, status: 'passed' })));
    assert.equal(audit(false).status, 0);
    unit.testResults[0].assertionResults.pop();
    assert.equal(audit(false).status, 1, '선택한 기능의 필수 결과 누락은 실패');
    if (names.includes('record')) {
      installation.items = installation.items.filter((item) => item.name !== 'retry');
      assert.match(audit(false).stderr, /의존 항목 기록 없음/);
    }
  }));
}

// 조합의 양쪽을 설치했을 때만 기존 조합 ID를 필수로 요구한다.
for (const pair of [['form', 'blocking-progress'], ['list', 'blocking-progress'], ['record', 'blocking-progress'], ['form', 'checkbox-tree']]) {
  test('조합: ' + pair.join('+') + '는 조합 검사 누락을 거절한다', () => fixture(({ installation, unit, audit, dir }) => {
    const contracts = JSON.parse(readFileSync(fileURLToPath(new URL('../packages/web-kit/src/testing/requirements.json', import.meta.url)), 'utf8'));
    const combinations = Object.values(JSON.parse(readFileSync(fileURLToPath(new URL('../packages/web-kit/src/testing/combinations.json', import.meta.url)), 'utf8')));
    const names = new Set();
    /** 설치하는 두 기능의 실제 내부 의존도 기록한다. */
    function select(name) { if (names.has(name)) return; names.add(name); for (const dep of contracts[name].dependencies) select(dep); }
    pair.forEach(select);
    const content = '// connection\n';
    installation.items = [...names].map((name) => ({ name, files: contracts[name].connections.map((connection) => {
      writeFileSync(join(dir, connection), content);
      return { source: 'checks/' + connection, installed: connection, installedHash: createHash('sha256').update(content).digest('hex') };
    }) }));
    const baseIds = [...names].flatMap((name) => contracts[name].ids);
    const comboIds = combinations.filter((combo) => combo.items.every((name) => names.has(name))).flatMap((combo) => combo.ids);
    /** 실제 러너와 같은 보고서 형식으로 선택한 결과를 기록한다. */
    function results(ids) { unit.testResults[0].assertionResults = ids.map((id) => ({ fullName: `[web-kit:${id}|${installation.version}|${installation.sourceRef}|${installation.sourceCommit}] contract`, status: 'passed' })); }
    results(baseIds);
    assert.equal(audit(false).status, 1);
    assert.match(audit(false).stderr, /필수 검사 누락/);
    results([...baseIds, ...comboIds]);
    assert.equal(audit(false).status, 0);
  }));
}
