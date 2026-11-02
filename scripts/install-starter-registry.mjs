// 파일 책임: 로컬 registry를 실제 고정 CLI로 설치하고 원본·설치 파일의 지문을 남긴다.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { recordInstallation } from '../packages/web-kit/tools/registry.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = root + 'apps/starter/components.json';
const original = readFileSync(configPath, 'utf8');
const config = JSON.parse(original);
const { version } = JSON.parse(readFileSync(root + 'packages/web-kit/package.json', 'utf8'));
config.registries['@web-kit'] = root + 'public/r/{name}.json';
const localConfig = JSON.stringify(config, null, 2) + '\n';
try {
  writeFileSync(configPath, localConfig);
  execFileSync('pnpm', ['exec', 'shadcn', 'add', './public/r/all.json', '--cwd', 'apps/starter', '--yes', '--overwrite'], { cwd: root, stdio: 'inherit' });
} finally { writeFileSync(configPath, original); }
const record = recordInstallation({ source: root, project: root + 'apps/starter', version, selected: ['all'], installationComponents: localConfig, method: 'pnpm exec shadcn add ./public/r/all.json --cwd apps/starter --yes --overwrite; pristine test app only' });
writeFileSync(root + 'apps/starter/registry-installation.json', JSON.stringify(record, null, 2) + '\n');
