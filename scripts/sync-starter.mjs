// 파일 책임: 발행할 web-kit 산출물을 그대로 포장해 apps/starter에 설치한다. starter는 소스가 아니라 이 tarball로만 키트를 쓴다.
//
//   node scripts/sync-starter.mjs           키트를 바꾼 뒤 starter를 다시 맞춘다(starter lockfile의 키트 지문이 갱신된다)
//   node scripts/sync-starter.mjs --frozen  CI·검증용. starter lockfile이 지금 키트와 다르면 실패한다
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kit = join(root, 'packages/web-kit');
const starter = join(root, 'apps/starter');
const dist = join(root, 'dist');
const vendored = join(starter, 'vendor/boosterlab-web-kit.tgz');
const frozen = process.argv.includes('--frozen');

/** 셸 해석 없이 명령을 실행하고 출력은 그대로 보여 준다. */
function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

/** pnpm lockfile이 기록하는 형식(sha512 base64)으로 tarball 지문을 낸다. */
function integrity(file) {
  return `sha512-${createHash('sha512').update(readFileSync(file)).digest('base64')}`;
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
run('pnpm', ['pack', '--pack-destination', dist], kit);
const archives = readdirSync(dist).filter((name) => /^boosterlab-web-kit-.*\.tgz$/.test(name));
if (archives.length !== 1) throw new Error('Expected exactly one web-kit tarball');
mkdirSync(dirname(vendored), { recursive: true });
copyFileSync(join(dist, archives[0]), vendored);

if (frozen && !readFileSync(join(starter, 'pnpm-lock.yaml'), 'utf8').includes(integrity(vendored))) {
  throw new Error('apps/starter가 지금 키트에 맞춰져 있지 않다. `pnpm starter:sync`로 맞추고 starter 사용 코드와 lockfile을 함께 커밋한다.');
}
// starter는 workspace 구성원이 아니다. 외부 프로젝트처럼 자기 lockfile로만 설치한다.
run('pnpm', ['install', '--ignore-workspace', frozen ? '--frozen-lockfile' : '--no-frozen-lockfile'], starter);
