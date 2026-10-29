// 파일 책임: 로컬 registry를 실제 고정 CLI로 설치하고 원본·설치 파일의 지문을 남긴다.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = root + 'apps/starter/components.json';
const original = readFileSync(configPath, 'utf8');
const config = JSON.parse(original);
const registry = JSON.parse(readFileSync(root + 'registry.json', 'utf8'));
/** 파일 바이트의 SHA-256으로 설치 당시 원본과 소비본을 구별한다. */
function hash(content) { return createHash('sha256').update(content).digest('hex'); }
config.registries['@web-kit'] = root + 'public/r/{name}.json';
const localConfig = JSON.stringify(config, null, 2) + '\n';
try {
  writeFileSync(configPath, localConfig);
  execFileSync('pnpm', ['exec', 'shadcn', 'add', './public/r/all.json', '--cwd', 'apps/starter', '--yes', '--overwrite'], { cwd: root, stdio: 'inherit' });
} finally { writeFileSync(configPath, original); }
const record = {
  version: '4.0.0-rc.1', sourceRef: 'v4.0.0-rc.1', shadcn: '4.19.1',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceWorkingTree: 'Source fingerprints identify the installed candidate, including uncommitted changes.',
  method: 'pnpm exec shadcn add ./public/r/all.json --cwd apps/starter --yes --overwrite; local absolute namespace during installation',
  componentsHash: hash(original), installationComponentsHash: hash(localConfig),
  items: registry.items.map((item) => ({ name: item.name, artifactHash: hash(readFileSync(root + 'public/r/' + item.name + '.json')), files: (item.files ?? []).map((file) => {
    const installed = 'apps/starter/' + file.target.replace(/^~\//, '');
    return { source: file.path, installed, sourceHash: hash(readFileSync(root + file.path)), installedHash: hash(readFileSync(root + installed)) };
  }) })),
};
writeFileSync(root + 'apps/starter/registry-installation.json', JSON.stringify(record, null, 2) + '\n');
