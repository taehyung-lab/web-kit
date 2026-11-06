// 파일 책임: 발행 후보 커밋 뒤 starter를 그 커밋에 맞춘다(설치 기록 다시 만들기 → starter:sync). 커밋은 하지 않는다.
// 순서: 패키지·registry 변경 커밋 → pnpm release:candidate → pnpm starter:check → "chore(release)" 커밋 → PR.
// 설치 기록은 원본 커밋을 담으므로, 후보 변경이 커밋되지 않았으면 멈춘다(기록이 "modified"로 남는다).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** 설치 기록의 원본 상태(sourceWorkingTree)를 정하는 경로. tools/registry.mjs와 같다. */
const SOURCE_PATHS = ['packages/web-kit', 'packages/ui-registry', 'registry.json', 'public/r'];

/** 셸 해석 없이 명령을 실행하고 출력은 그대로 보여 준다. */
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit' });

try {
  const dirty = execFileSync('git', ['status', '--porcelain', '--', ...SOURCE_PATHS], { cwd: root, encoding: 'utf8' }).trim();
  if (dirty) throw new Error(`후보 변경이 커밋되지 않았습니다. 먼저 커밋하세요:\n${dirty}`);
  const version = JSON.parse(readFileSync(join(root, 'packages/web-kit/package.json'), 'utf8')).version;
  // 저장소의 현재 CLI를 쓴다(starter에 설치된 이전 tarball의 CLI가 아니라). 항목은 기존 기록 그대로다.
  run(process.execPath, ['packages/web-kit/bin/registry.mjs', 'record', '--source', '.', '--project', 'apps/starter', '--update']);
  const record = JSON.parse(readFileSync(join(root, 'apps/starter/registry-installation.json'), 'utf8'));
  if (record.sourceWorkingTree !== 'clean') throw new Error('설치 기록이 clean이 아닙니다: ' + record.sourceWorkingTree);
  run('pnpm', ['starter:sync']);
  console.log(`\n후보 ${version} (원본 ${record.sourceCommit.slice(0, 7)})로 starter를 맞췄습니다.`);
  console.log(`다음: pnpm starter:check → git commit -m "chore(release): ${version} 후보로 starter 설치 기록·tarball을 맞춘다" → PR.`);
} catch (error) {
  console.error('release:candidate 실패: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
