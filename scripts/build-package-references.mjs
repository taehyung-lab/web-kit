// 파일 책임: 패키지 문서가 참조하는 저장소 자료를 포장용 references에 모은다. 원본은 저장소 한 곳에서만 고친다.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const kit = join(root, 'packages/web-kit');
const output = join(kit, 'references');
const packagedEntries = JSON.parse(readFileSync(join(kit, 'package.json'), 'utf8')).files;

/** 코드는 읽기용 텍스트로 담아 검사 러너가 예제 복사본을 실행하지 않게 한다. */
function referencePath(source) {
  return join(output, relative(root, source)) + (/\.[cm]?[jt]sx?$/.test(source) ? '.txt' : '');
}

/** 실제 배포 목록에 들어가는 파일인지 확인한다. */
function isPackaged(path) {
  return inside(kit, path) && packagedEntries.some((entry) => inside(join(kit, entry), path));
}

/** 폴더 안의 문서를 찾되 생성물과 의존성은 읽지 않는다. */
function documents(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['references', 'node_modules', '.git'].includes(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? documents(path) : entry.name.endsWith('.md') ? [path] : [];
  });
}

/** Markdown 파일의 로컬 파일 참조를 꺼낸다. */
function targets(text) {
  return [...text.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]).filter((href) => !/^(?:https?:|#)/.test(href));
}

/** 상대 경로가 주어진 폴더 안에 있는지 확인한다. */
function inside(parent, path) {
  const rel = relative(parent, path);
  return rel === '' || (!rel.startsWith('..' + sep) && rel !== '..' && !rel.startsWith(sep));
}

/** 필요한 원본만 복사한다. 문서의 후속 링크는 같은 패키지 또는 생성된 자료로 이어진다. */
export function buildPackageReferences() {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  const copied = new Set();
  const queue = [];
  for (const doc of documents(kit)) {
    for (const href of targets(readFileSync(doc, 'utf8'))) {
      const path = resolve(dirname(doc), decodeURIComponent(href.split('#')[0]));
      if (inside(output, path)) queue.push(resolve(root, relative(output, path).replace(/(\.[cm]?[jt]sx?)\.txt$/, '$1')));
      else if (!inside(kit, path)) throw new Error(`패키지 밖 문서 링크: ${relative(kit, doc)} → ${href}`);
    }
  }
  while (queue.length) {
    const source = queue.shift();
    if (copied.has(source)) continue;
    const rel = relative(root, source);
    if (!inside(root, source) || /(?:^|\/)(?:node_modules|vendor|\.git|work)(?:\/|$)/.test(rel))
      throw new Error(`포장할 수 없는 자료: ${rel}`);
    if (!existsSync(source)) throw new Error(`없는 원본 자료: ${rel}`);
    copied.add(source);
    const destination = referencePath(source);
    if (statSync(source).isDirectory()) {
      // 폴더 링크는 안내 문서만 담는다. 예제는 스킬이 가리킨 파일을 개별로 담는다.
      mkdirSync(destination, { recursive: true });
      for (const entry of readdirSync(source)) if (entry.endsWith('.md')) queue.push(join(source, entry));
      continue;
    }
    mkdirSync(dirname(destination), { recursive: true });
    if (!source.endsWith('.md')) { copyFileSync(source, destination); continue; }
    const text = readFileSync(source, 'utf8').replace(/\]\(([^)]+)\)/g, (match, href) => {
      if (/^(?:https?:|#)/.test(href)) return match;
      const [path, ...anchor] = href.split('#');
      const target = resolve(dirname(source), decodeURIComponent(path));
      const packaged = isPackaged(target) ? target : referencePath(target);
      if (!isPackaged(target)) queue.push(target);
      const next = relative(dirname(destination), packaged).split(sep).join('/');
      return `](${next}${anchor.length ? '#' + anchor.join('#') : ''})`;
    });
    writeFileSync(destination, text);
  }
  return copied.size;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)))
  console.log(`배포 참고 자료 ${buildPackageReferences()}개 준비`);
