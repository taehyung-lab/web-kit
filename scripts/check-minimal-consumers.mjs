// 파일 책임: 같은 후보 tarball·registry를 의존이 실제로 빠진 기능별 격리 소비처에 설치해 단위·브라우저·적합성을 검사한다.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportAt = process.argv.indexOf('--report-dir');
const reports = resolve(reportAt < 0 ? join(root, 'work/form-flexibility/minimal-consumption') : process.argv[reportAt + 1]);
mkdirSync(reports, { recursive: true });
/** 저장된 검사 입력을 읽는다. */
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
/** 후보와 설치 파일의 바이트 지문을 계산한다. */
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const tarball = join(root, 'apps/starter/vendor/boosterlab-web-kit.tgz');
const registry = json(join(root, 'registry.json'));
const starter = json(join(root, 'apps/starter/package.json'));
const candidate = json(join(root, 'apps/starter/registry-installation.json'));
const versions = { ...starter.dependencies, ...starter.devDependencies };
const lockedPackages = readFileSync(join(root, 'apps/starter/pnpm-lock.yaml'), 'utf8').split('packages:\n')[1].split('\nsnapshots:')[0];
const sourceDiffBefore = createHash('sha256').update(spawnSync('git', ['diff', '--binary', 'HEAD'], { cwd: root }).stdout).digest('hex');
/** 범위 의존을 새로 해석해도 기존 lock의 버전만 사용한다. */
function lockedVersion(name) {
  const key = [...lockedPackages.matchAll(/^  '?([^\n]+?)'?:$/gm)].map((match) => match[1]).find((key) => key.startsWith(name + '@'));
  assert(key, '기존 lock에 없는 의존 ' + name);
  return key.slice(name.length + 1);
}
const overrides = Object.fromEntries(['@types/estree', 'postcss', 'tldts-core', 'seroval', 'seroval-plugins', 'rolldown', '@oxc-project/types'].map((name) => [name, lockedVersion(name)]));
const results = [];

/** 실행 출력과 종료 코드를 파일에 남기고 실패는 호출자에게 돌려준다. */
function run(cwd, name, args, { failure = false } = {}) {
  const result = spawnSync('pnpm', args, { cwd, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '', npm_config_ignore_scripts: 'true' }, maxBuffer: 20 * 1024 * 1024 });
  writeFileSync(join(reports, name + '.log'), (result.stdout ?? '') + (result.stderr ?? ''));
  if (!failure) assert.equal(result.status, 0, `${name} 실패: ${result.stderr || result.stdout}`);
  return result;
}

/** 다른 작업 트리의 검사 서버와 겹치지 않도록 OS가 고른 빈 포트를 사용한다. */
async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

/** registry가 선언한 내부 의존만 재귀로 선택한다. */
function closure(name, names = new Set()) {
  if (names.has(name)) return names;
  names.add(name);
  const item = registry.items.find((item) => item.name === name);
  assert(item, '없는 registry 항목 ' + name);
  for (const dependency of item.registryDependencies ?? []) closure(dependency.replace('@web-kit/', ''), names);
  return names;
}

const featureAt = process.argv.indexOf('--features');
const features = featureAt < 0 ? registry.items.filter((item) => item.name !== 'all').map((item) => item.name) : process.argv[featureAt + 1].split(',');
for (const feature of features) {
  const cwd = mkdtempSync(join(tmpdir(), `web-kit-${feature}-consumer-`));
  console.log(`${feature}: ${cwd}`);
  /** 이 실행이 만든 소비 폴더 안 파일만 기록한다. */
  const write = (file, content) => { mkdirSync(dirname(join(cwd, file)), { recursive: true }); writeFileSync(join(cwd, file), content); };
  /** 소비 설정을 JSON으로 기록한다. */
  const writeJson = (file, value) => write(file, JSON.stringify(value, null, 2) + '\n');
  const tools = ['vite', 'vitest', 'jsdom', '@vitejs/plugin-react', '@testing-library/react', '@testing-library/dom', '@playwright/test', 'typescript', '@types/node', '@types/react', '@types/react-dom'];
  writeJson('package.json', { name: `web-kit-${feature}-consumer`, private: true, type: 'module', pnpm: { overrides }, packageManager: 'pnpm@10.33.0', dependencies: { react: versions.react, 'react-dom': versions['react-dom'], '@boosterlab/web-kit': 'file:vendor/web-kit.tgz' }, devDependencies: Object.fromEntries(tools.map((name) => [name, versions[name]])) });
  write('.npmrc', 'auto-install-peers=false\nstrict-peer-dependencies=false\nnode-linker=isolated\n');
  write('pnpm-workspace.yaml', 'packages: []\n');
  writeJson('tsconfig.json', { compilerOptions: { jsx: 'react-jsx', module: 'ESNext', moduleResolution: 'Bundler', target: 'ES2022', baseUrl: '.', paths: { '@/*': ['./src/*'] } } });
  write('src/styles.css', '');
  write('src/setup.ts', "import { afterEach } from 'vitest';\nimport { cleanup } from '@testing-library/react';\nwindow.scrollTo = () => undefined;\nafterEach(cleanup);\n");
  const components = json(join(root, 'apps/starter/components.json'));
  components.registries['@web-kit'] = join(root, 'public/r/{name}.json');
  writeJson('components.json', components);
  mkdirSync(join(cwd, 'vendor'), { recursive: true });
  copyFileSync(tarball, join(cwd, 'vendor/web-kit.tgz'));
  // 최초 해석 뒤 고정된 lockfile로 재설치한다. 실행 스크립트와 자동 peer 설치는 양쪽에서 끈다.
  run(cwd, feature + '-install-tools', ['install', '--ignore-scripts', '--no-frozen-lockfile', '--prefer-offline']);
  run(root, feature + '-registry', ['exec', 'shadcn', 'add', join(root, `public/r/${feature}.json`), '--cwd', cwd, '--yes']);
  run(cwd, feature + '-install-frozen', ['install', '--frozen-lockfile', '--ignore-scripts']);

  const names = closure(feature);
  writeJson('registry-installation.json', { version: candidate.version, sourceRef: candidate.sourceRef, sourceCommit: candidate.sourceCommit, items: [...names].map((name) => {
    const item = registry.items.find((item) => item.name === name);
    return { name, artifactHash: hash(join(root, `public/r/${name}.json`)), files: item.files.map((file) => {
      const installed = file.target.replace(/^~\//, '');
      return { source: file.path, installed, sourceHash: hash(join(root, file.path)), installedHash: hash(join(cwd, installed)) };
    }) };
  }) });
  const declared = [...names].flatMap((name) => { const item = registry.items.find((item) => item.name === name); return [...(item.dependencies ?? []), ...(item.devDependencies ?? [])]; });
  const forbidden = ['@tanstack/react-form', '@tanstack/react-router', '@tanstack/react-query', '@tanstack/react-virtual', 'zod', 'axios'].filter((name) => !declared.some((dependency) => dependency.startsWith(name + '@')));
  const require = createRequire(join(cwd, 'package.json'));
  const kitRequire = createRequire(realpathSync(require.resolve('@boosterlab/web-kit')));
  for (const name of forbidden) {
    for (const from of [require, kitRequire]) assert.throws(() => from.resolve(name), { code: 'MODULE_NOT_FOUND' }, `${feature} 소비처에서 ${name}가 실제 해석됨`);
    assert(!existsSync(join(cwd, 'node_modules', name)), `${name} 직접 설치 누출`);
  }
  const listing = run(cwd, feature + '-resolution', ['list', '--depth', 'Infinity', '--json']);
  for (const name of forbidden) assert(!listing.stdout.includes(`"${name}"`), `${name} 전이 설치 누출`);
  copyFileSync(join(cwd, 'pnpm-lock.yaml'), join(reports, feature + '-pnpm-lock.yaml'));
  const selectedPackages = readFileSync(join(cwd, 'pnpm-lock.yaml'), 'utf8').split('packages:\n')[1].split('\nsnapshots:')[0];
  for (const [, key] of selectedPackages.matchAll(/^  '?([^\n]+?)'?:$/gm)) {
    if (key.startsWith('@boosterlab/web-kit@file:')) continue;
    assert([...lockedPackages.matchAll(/^  '?([^\n]+?)'?:$/gm)].some((match) => match[1] === key), '기존 lock 밖 버전: ' + key);
  }
  const alias = "{ '@': fileURLToPath(new URL('./src', import.meta.url)) }";
  write('vitest.config.ts', `import react from '@vitejs/plugin-react';\nimport { fileURLToPath } from 'node:url';\nimport { defineConfig } from 'vitest/config';\nexport default defineConfig({ plugins: [react()], resolve: { alias: ${alias} }, test: { include: ['src/**/*.test.tsx'], environment: 'jsdom', allowOnly: false, setupFiles: ['./src/setup.ts'], execArgv: ['--no-experimental-webstorage'], reporters: ['default', 'json'], outputFile: { json: 'unit.json' } } });\n`);
  write('vite.config.ts', `import react from '@vitejs/plugin-react';\nimport { fileURLToPath } from 'node:url';\nimport { defineConfig } from 'vite';\nexport default defineConfig({ plugins: [react()], optimizeDeps: { extensions: ['.tsx'] }, resolve: { alias: ${alias} } });\n`);
  const browserPort = await availablePort();
  const browserEntry = [...names].flatMap((name) => registry.items.find((item) => item.name === name).files).find((file) => file.path.endsWith('.html'))?.target.replace(/^~\//, '/') ?? '/';
  write('playwright.config.ts', `import { defineConfig } from '@playwright/test';\nexport default defineConfig({ testDir: './tests/e2e', workers: 1, forbidOnly: true, reporter: [['list'], ['json', { outputFile: 'browser.json' }]], use: { baseURL: 'http://127.0.0.1:${browserPort}', locale: 'ko-KR' }, webServer: { command: 'pnpm exec vite --host 127.0.0.1 --port ${browserPort} --strictPort', url: 'http://127.0.0.1:${browserPort}${browserEntry}', reuseExistingServer: false } });\n`);
  // 선언되지 않은 선택 peer를 실제 검사에 넣으면 해석 실패로 거절해야 한다.
  const connection = 'src/undeclared-peer.test.tsx';
  const missing = forbidden.includes('@tanstack/react-form') ? '@tanstack/react-form' : forbidden[0];
  assert(missing, '반례용 미설치 peer 없음');
  write(connection, `import * as peer from '${missing}';\nimport { it, expect } from 'vitest';\nit('선언되지 않은 peer 반례', () => expect(peer).toBeDefined());\n`);
  const negative = run(cwd, feature + '-undeclared-peer', ['exec', 'vitest', 'run', connection], { failure: true });
  assert.notEqual(negative.status, 0, '미설치 peer import가 의존 부재를 잡지 못함');
  assert.match(negative.stdout + negative.stderr, /Cannot find|Failed to resolve|ERR_MODULE_NOT_FOUND|Could not resolve/);
  const { unlinkSync } = await import('node:fs');
  unlinkSync(join(cwd, connection));
  if (feature === 'auth') {
    write('src/old-fixture.test.tsx', "import { expect, it } from 'vitest';\nimport { createAuthConformancePage } from '@boosterlab/web-kit/testing/fixtures';\nit('이전 fixture 입구', () => expect(createAuthConformancePage).toBeTypeOf('function'));\n");
    const oldFixture = run(cwd, 'auth-old-fixture', ['exec', 'vitest', 'run', 'src/old-fixture.test.tsx'], { failure: true });
    assert.notEqual(oldFixture.status, 0, '이전 fixture가 의존 부재를 잡지 못함');
    assert.match(oldFixture.stdout + oldFixture.stderr, /Cannot find|Failed to resolve|ERR_MODULE_NOT_FOUND|Could not resolve/);
    // 이 실행이 만든 반례 파일만 지운다. 정상 소비 검사에는 설치된 연결 파일만 남긴다.
    const { unlinkSync } = await import('node:fs');
    unlinkSync(join(cwd, 'src/old-fixture.test.tsx'));
  }
  run(cwd, feature + '-unit', ['exec', 'vitest', 'run']);
  const hasBrowser = [...names].some((name) => registry.items.find((item) => item.name === name).files.some((file) => /\.spec\.ts$/.test(file.path)));
  if (hasBrowser) run(cwd, feature + '-browser', ['exec', 'playwright', 'test']);
  else writeJson('browser.json', { suites: [], errors: [] });
  run(cwd, feature + '-conformance', ['exec', 'web-kit-check', '--installation', 'registry-installation.json', '--unit', 'unit.json', '--browser', 'browser.json', '--strict-fingerprints']);
  for (const file of ['unit.json', 'browser.json', 'registry-installation.json']) copyFileSync(join(cwd, file), join(reports, feature + '-' + file));
  results.push({ feature, cwd, candidateVersion: candidate.version, tarballSha256: hash(tarball), registryItems: [...names], absent: forbidden, undeclaredPeerRejected: missing, unitTests: json(join(cwd, 'unit.json')).numPassedTests, browser: hasBrowser ? 'passed' : 'no required browser checks', conformance: 'passed' });
  writeFileSync(join(reports, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
const sourceDiffAfter = createHash('sha256').update(spawnSync('git', ['diff', '--binary', 'HEAD'], { cwd: root }).stdout).digest('hex');
assert.equal(sourceDiffAfter, sourceDiffBefore, '최소 소비 실행이 원본 저장소를 변경했습니다');
writeFileSync(join(reports, 'source-unchanged.json'), JSON.stringify({ before: sourceDiffBefore, after: sourceDiffAfter, equal: true }, null, 2) + '\n');
console.log('최소 소비 통과: ' + reports);
