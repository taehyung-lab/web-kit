// 파일 책임: main CI가 소비 검사를 통과하며 남긴 산출물(web-kit-tarball)을 다시 포장하지 않고 그대로 tag·release에 올린다.
//   pnpm release:publish --run <CI run id> --notes <릴리스 본문.md> [--dry-run]
// 올리기 전에 확인한다: run이 성공한 main push이고 그 commit이 origin/main 끝이다, verification.json의 commit·버전·SHA-256이
// 내려받은 tarball과 그 commit의 패키지 버전에 맞다, 같은 번호의 tag가 아직 없다. 하나라도 어긋나면 아무것도 올리지 않는다.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 내려받은 산출물 폴더가 그 commit·버전의 검증된 tarball인지 본다. 맞으면 올릴 파일 경로를 돌려준다.
 * dir에는 CI가 남긴 tarball과 verification.json이 있다.
 */
export function verifyArtifact({ dir, commit, version }) {
  const verificationPath = join(dir, 'verification.json');
  if (!existsSync(verificationPath)) throw new Error('verification.json이 없습니다');
  const verification = JSON.parse(readFileSync(verificationPath, 'utf8'));
  if (verification.commit !== commit) throw new Error(`산출물 commit ${verification.commit}이 run의 commit ${commit}과 다릅니다`);
  if (verification.version !== version) throw new Error(`산출물 버전 ${verification.version}이 그 commit의 패키지 버전 ${version}과 다릅니다`);
  const tarball = join(dir, verification.tarball);
  if (!existsSync(tarball)) throw new Error('tarball이 없습니다: ' + verification.tarball);
  const sha256 = createHash('sha256').update(readFileSync(tarball)).digest('hex');
  if (sha256 !== verification.sha256) throw new Error(`tarball SHA-256 ${sha256}이 기록 ${verification.sha256}과 다릅니다`);
  return { tarball, verification: verificationPath, sha256 };
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** 출력을 문자열로 받는다. */
const read = (command, args) => execFileSync(command, args, { cwd: root, encoding: 'utf8' }).trim();

/** 값이 필요한 옵션을 읽는다. */
function option(name) {
  const at = process.argv.indexOf(name);
  const value = at < 0 ? undefined : process.argv[at + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`필수 인자 ${name}. 예: pnpm release:publish --run 42147308052 --notes notes.md`);
  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const runId = option('--run');
    const notes = resolve(option('--notes'));
    if (!existsSync(notes)) throw new Error('릴리스 본문 파일이 없습니다: ' + notes);
    const dryRun = process.argv.includes('--dry-run');
    const ci = JSON.parse(read('gh', ['run', 'view', runId, '--json', 'conclusion,headSha,headBranch,event']));
    if (ci.conclusion !== 'success' || ci.headBranch !== 'main' || ci.event !== 'push') throw new Error(`run ${runId}은 성공한 main push가 아닙니다: ${JSON.stringify(ci)}`);
    read('git', ['fetch', '--quiet', '--tags', 'origin']);
    const main = read('git', ['rev-parse', 'origin/main']);
    if (ci.headSha !== main) throw new Error(`run의 commit ${ci.headSha}이 origin/main 끝 ${main}이 아닙니다`);
    const version = JSON.parse(read('git', ['show', `${ci.headSha}:packages/web-kit/package.json`])).version;
    const tag = 'v' + version;
    if (read('git', ['tag', '--list', tag])) throw new Error(`tag ${tag}이 이미 있습니다. 발행한 번호로 다른 산출물을 올리지 않습니다`);
    const dir = mkdtempSync(join(tmpdir(), 'web-kit-release-'));
    read('gh', ['run', 'download', runId, '-n', 'web-kit-tarball', '-D', dir]);
    const artifact = verifyArtifact({ dir, commit: ci.headSha, version });
    const prerelease = version.includes('-');
    const args = ['release', 'create', tag, artifact.tarball, artifact.verification, '--target', ci.headSha, '--title', `web-kit ${version}${prerelease ? ' (사전 릴리스)' : ''}`, '--notes-file', notes, ...(prerelease ? ['--prerelease'] : [])];
    console.log(`확인됨: ${tag} ← run ${runId}, commit ${ci.headSha.slice(0, 7)}, SHA-256 ${artifact.sha256}`);
    if (dryRun) console.log('--dry-run: 올리지 않음. 실행할 명령: gh ' + args.join(' '));
    else console.log(read('gh', args));
  } catch (error) {
    console.error('release:publish 실패: ' + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
