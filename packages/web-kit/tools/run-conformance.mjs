// 파일 책임: 현재 소비 파일에서 검사를 새로 실행하고 결과를 그 입력에 묶는다.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { digest, projectPath, readJson } from './files.mjs';
import { installedPath } from './registry.mjs';

/** 선언한 코드·설정과 실제 설치 파일의 현재 지문을 모은다. 비밀·의존성·결과 폴더는 포함하지 않는다. */
function snapshot(root, inputs, installation, excluded) {
  const files = new Map();
  const ignored = new Set(['node_modules', '.git', 'dist', 'coverage', 'test-results', 'playwright-report', '.web-kit-results', 'work']);
  function visit(path) {
    const name = path.split('/').at(-1);
    if (ignored.has(name) || name.startsWith('.env')) throw new Error('검사 입력으로 사용할 수 없는 경로: ' + path);
    const full = projectPath(root, path);
    if (excluded.has(full)) throw new Error('검사 입력과 출력이 겹칩니다: ' + path);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error('검사 입력의 심링크는 실제 파일 경로로 선언하세요: ' + path);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(full).sort()) {
        if (ignored.has(entry) || entry.startsWith('.env')) continue;
        const child = path + '/' + entry;
        if (!excluded.has(resolve(root, child))) visit(child);
      }
    } else if (stat.isFile()) files.set(relative(root, full).replaceAll('\\', '/'), digest(readFileSync(full)));
    else throw new Error('일반 파일이 아닌 검사 입력: ' + path);
  }
  for (const path of inputs) visit(path);
  for (const item of installation.items ?? []) for (const file of item.files ?? []) visit(installedPath(installation, file.installed));
  return Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)));
}
/** 셸을 거치지 않는 명령 배열인지 확인한다. */
function command(value, kind) {
  if (!Array.isArray(value) || value.length === 0 || value.some((part) => typeof part !== 'string' || !part)) throw new Error(kind + ': 실행 명령 배열이 필요합니다');
  return value;
}

/** 이전 결과를 없애고 두 러너의 새 결과를 현재 입력에 연결한 실행 기록을 만든다. */
export function runConformance({ root, configPath, installationPath, unitPath, browserPath, receiptPath }) {
  const config = readJson(configPath);
  if (!Array.isArray(config.inputs) || !config.inputs.length) throw new Error('검사 입력 inputs를 선언하세요');
  const unit = command(config.unit, 'unit');
  const browser = config.browser === null ? null : command(config.browser, 'browser');
  const installation = readJson(installationPath);
  const outputs = [unitPath, browserPath, receiptPath];
  if (new Set(outputs).size !== outputs.length || outputs.some((path) => path === configPath || path === installationPath)) throw new Error('검사 입력과 출력 경로가 겹칩니다');
  for (const path of outputs) {
    const checked = projectPath(root, relative(root, path));
    if (existsSync(checked) && !lstatSync(checked).isFile()) throw new Error('검사 출력은 일반 파일이어야 합니다: ' + path);
  }
  const inputs = [...config.inputs, relative(root, configPath), relative(root, installationPath)];
  const excluded = new Set(outputs);
  const before = snapshot(root, inputs, installation, excluded);
  // 실패한 실행 뒤에도 이전 receipt나 보고서가 이번 통과로 보이지 않게 먼저 지운다.
  for (const path of outputs) rmSync(path, { force: true });
  function run(args, output) {
    const result = spawnSync(args[0], args.slice(1), { cwd: root, stdio: 'inherit', shell: false });
    if (result.error || result.status !== 0) throw new Error('검사 명령 실패: ' + args[0] + ' (exit ' + result.status + ')');
    if (!existsSync(output)) throw new Error('새 검사 보고서가 없습니다: ' + relative(root, output));
  }
  run(unit, unitPath);
  if (browser) run(browser, browserPath);
  else {
    mkdirSync(dirname(browserPath), { recursive: true });
    writeFileSync(browserPath, JSON.stringify({ suites: [], errors: [] }) + '\n');
  }
  const after = snapshot(root, inputs, installation, excluded);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('검사 실행 중 입력 파일이 바뀌었습니다');
  const receipt = { schemaVersion: 1, inputs, files: before, reports: { unit: digest(readFileSync(unitPath)), browser: digest(readFileSync(browserPath)) } };
  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
}

/** 실행 뒤 파일 또는 보고서가 달라졌으면 지난 실행 기록을 거절한다. */
export function verifyConformanceRun({ root, configPath, installationPath, unitPath, browserPath, receiptPath }) {
  const receipt = readJson(receiptPath);
  const config = readJson(configPath);
  const inputs = [...config.inputs, relative(root, configPath), relative(root, installationPath)];
  if (receipt.schemaVersion !== 1 || JSON.stringify(receipt.inputs) !== JSON.stringify(inputs) ||
      JSON.stringify(receipt.files) !== JSON.stringify(snapshot(root, inputs, readJson(installationPath), new Set([unitPath, browserPath, receiptPath]))) ||
      receipt.reports.unit !== digest(readFileSync(unitPath)) || receipt.reports.browser !== digest(readFileSync(browserPath))) throw new Error('현재 파일·검사 결과와 실행 기록이 다릅니다. --run으로 다시 검사하세요');
}
