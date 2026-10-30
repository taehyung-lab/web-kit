// 파일 책임: 발행할 web-kit 산출물을 그대로 포장해 apps/starter에 설치한다. starter는 소스가 아니라 이 tarball로만 키트를 쓴다.
//
//   node scripts/sync-starter.mjs           키트를 바꾼 뒤 starter를 다시 맞춘다(vendor tarball과 starter lockfile의 키트 지문이 갱신된다)
//   node scripts/sync-starter.mjs --frozen  CI·검증용. 커밋된 vendor tarball의 내용이 지금 키트를 포장한 내용과 다르면 실패한다
//
// pnpm pack은 같은 내용이라도 OS마다 tar 바이트가 달라질 수 있다(항목 순서 등). 그래서 바이트가 아니라
// 풀어 낸 파일 목록·내용으로 비교하고, 커밋된 vendor tarball 하나를 lockfile·소비 검사·발행이 함께 쓴다.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
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

/** tarball을 풀어 경로 순으로 정렬한 (경로, 내용 sha256) 목록을 낸다. */
function contents(file) {
  const dir = mkdtempSync(join(tmpdir(), 'web-kit-pack-'));
  try {
    execFileSync('tar', ['xzf', file, '-C', dir]);
    const entries = [];
    const walk = (current) => {
      for (const name of readdirSync(current)) {
        const path = join(current, name);
        if (statSync(path).isDirectory()) walk(path);
        else entries.push(`${relative(dir, path)} ${createHash('sha256').update(readFileSync(path)).digest('hex')}`);
      }
    };
    walk(dir);
    return entries.sort().join('\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
run('pnpm', ['pack', '--pack-destination', dist], kit);
const archives = readdirSync(dist).filter((name) => /^boosterlab-web-kit-.*\.tgz$/.test(name));
if (archives.length !== 1) throw new Error('Expected exactly one web-kit tarball');
const packed = join(dist, archives[0]);

if (frozen) {
  const stale = () =>
    new Error('apps/starter가 지금 키트에 맞춰져 있지 않다. `pnpm starter:sync`로 맞추고 starter vendor tarball·사용 코드·lockfile을 함께 커밋한다.');
  let committed;
  try {
    committed = contents(vendored);
  } catch {
    throw stale();
  }
  if (committed !== contents(packed)) throw stale();
  if (!readFileSync(join(starter, 'pnpm-lock.yaml'), 'utf8').includes(integrity(vendored))) throw stale();
  // 발행 산출물은 lockfile이 고정한 커밋된 tarball 그대로다. 이 환경에서 다시 포장한 바이트로 바꾸지 않는다.
  copyFileSync(vendored, packed);
} else {
  mkdirSync(dirname(vendored), { recursive: true });
  copyFileSync(packed, vendored);
}
// starter는 workspace 구성원이 아니다. 외부 프로젝트처럼 자기 lockfile로만 설치한다.
if (!process.argv.includes('--verify-only'))
  run('pnpm', ['install', '--ignore-workspace', frozen ? '--frozen-lockfile' : '--no-frozen-lockfile'], starter);
