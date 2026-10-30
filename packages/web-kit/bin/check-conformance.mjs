#!/usr/bin/env node
// 파일 책임: 설치 항목의 필수 적합성 결과·연결 파일·버전과 선택적 복사본 지문을 점검한다.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const args = process.argv.slice(2);
/** 필수 경로 인자가 빠지면 실행 방법과 함께 실패한다. */
function option(name) { const i = args.indexOf(name); if (i < 0 || !args[i + 1]) throw new Error('필수 인자: ' + name); return args[i + 1]; }
/** JSON 보고서와 설치 기록을 같은 방식으로 읽는다. */
function json(path) { return JSON.parse(readFileSync(path, 'utf8')); }
/** 파일 바이트의 지문을 계산한다. */
function hash(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
try {
  const installationPath = resolve(option('--installation'));
  const installation = json(installationPath);
  const root = dirname(installationPath);
  const packageRoot = fileURLToPath(new URL('../', import.meta.url));
  const version = json(resolve(packageRoot, 'package.json')).version;
  const requirements = json(resolve(packageRoot, 'src/testing/requirements.json'));
  const unit = json(resolve(option('--unit')));
  const browser = json(resolve(option('--browser')));
  const failures = [];
  const results = [];
  for (const file of unit.testResults ?? []) for (const test of file.assertionResults ?? []) results.push({ title: test.fullName ?? test.title, status: test.status });
  /** Playwright의 중첩 suite에서 실제 각 실행 결과를 모은다. */
  function visit(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      const last = test.results?.at(-1);
      results.push({ title: spec.title, status: test.status === 'expected' && last?.status === 'passed' ? 'passed' : last?.status ?? test.status });
    }
    for (const child of suite.suites ?? []) visit(child);
  }
  for (const suite of browser.suites ?? []) visit(suite);
  if (unit.success !== true || (browser.errors?.length ?? 0) > 0) failures.push('검사 러너가 전체 성공을 보고하지 않았습니다');
  if (installation.version !== version) failures.push('설치 기록의 package 버전이 실행한 점검 패키지와 다릅니다');
  const installed = new Map((installation.items ?? []).map((item) => [item.name, item]));
  const required = new Set();
  if (installed.size === 0) failures.push('설치 항목이 없습니다');
  for (const [name, item] of installed) {
    const contract = requirements[name];
    if (!contract) { failures.push('알 수 없는 설치 항목: ' + name); continue; }
    for (const dependency of contract.dependencies ?? []) if (!installed.has(dependency)) failures.push(name + ': 의존 항목 기록 없음 ' + dependency);
    for (const id of contract.ids) required.add(id);
    for (const connection of contract.connections) {
      const file = item.files.find((file) => file.source.endsWith('/' + connection));
      if (!file || !existsSync(resolve(root, file.installed.replace(/^apps\/starter\//, '')))) failures.push(name + ': 검사 연결 없음 ' + connection);
    }
    for (const file of item.files ?? []) {
      const path = resolve(root, file.installed.replace(/^apps\/starter\//, ''));
      if (!existsSync(path)) { failures.push('설치 파일 없음: ' + file.installed); continue; }
      if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(path) && /\b(?:it|test|describe)\s*\.\s*(?:only|skip)\b/.test(readFileSync(path, 'utf8'))) failures.push('skip/only 연결: ' + file.installed);
      if (hash(path) !== file.installedHash) {
        const message = '복사본 지문 변경: ' + file.installed;
        if (args.includes('--strict-fingerprints')) failures.push(message); else console.warn('알림: ' + message);
      }
    }
  }
  const matched = new Map();
  for (const result of results) {
    const match = /\[web-kit:([^\]]+)\]/.exec(result.title);
    if (!match) continue;
    const [id, pkg, registry, commit] = match[1].split('|').map(decodeURIComponent);
    if (!required.has(id)) continue;
    if (pkg !== version || registry !== installation.sourceRef || commit !== installation.sourceCommit) failures.push(id + ': 결과 대상 버전·commit 불일치');
    if (result.status !== 'passed') failures.push(id + ': ' + result.status);
    matched.set(id, true);
  }
  for (const id of required) if (!matched.has(id)) failures.push('필수 검사 누락: ' + id);
  console.log('한계: 실제 사용 UI와 검사 대상 복사본의 일치는 자동 판정하지 않습니다; 독립 검토가 필요합니다.');
  if (failures.length) throw new Error([...new Set(failures)].join('\n'));
  console.log('web-kit 적합성 통과: ' + installed.size + '항목, ' + required.size + '개 식별자, package ' + version + ', registry ' + installation.sourceRef + '@' + installation.sourceCommit);
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
