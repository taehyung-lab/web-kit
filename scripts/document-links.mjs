// 파일 책임: 관리 Markdown의 로컬 파일과 제목 앵커를 저장소·실제 패키지에서 같은 기준으로 검사한다.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** 코드 블록을 제외한 Markdown 제목의 GitHub식 앵커와 명시적 HTML id를 모은다. */
function anchors(text) {
  const found = new Set();
  const counts = new Map();
  let fence = null;
  for (const line of text.split('\n')) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line);
    if (marker) { if (fence === null) fence = marker[1][0]; else if (marker[1][0] === fence) fence = null; continue; }
    if (fence !== null) continue;
    for (const [, id] of line.matchAll(/\bid=["']([^"']+)["']/g)) found.add(id);
    const heading = /^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
    if (!heading) continue;
    const slug = heading[1].replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, '').replace(/ /g, '-');
    const count = counts.get(slug) ?? 0;
    found.add(slug + (count ? '-' + count : '')); counts.set(slug, count + 1);
  }
  return found;
}

/** 문서 폴더에서 생성 자료·의존성을 제외하고 Markdown을 찾는다. */
export function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.git', 'work', 'dist', 'references'].includes(entry.name) || entry.isSymbolicLink()) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : path.endsWith('.md') ? [path] : [];
  });
}

/** 파일 링크와 Markdown 제목 링크를 검사하며 배포물은 루트 밖 참조도 거절한다. */
export function checkMarkdownLinks(files, { root, resolveLink = (path) => path } = {}) {
  const cache = new Map();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const [, raw] of text.matchAll(/\]\(([^)]+)\)/g)) {
      const href = raw.replace(/^<|>$/g, '');
      if (/^(?:https?:|mailto:|data:)/.test(href)) continue;
      const [path, fragment] = href.split('#');
      const target = resolveLink(path ? resolve(dirname(file), decodeURIComponent(path)) : file);
      if (root) assert(target === root || target.startsWith(root + '/'), file + ': 패키지 밖 링크 ' + href);
      assert(existsSync(target), file + ': 없는 링크 ' + href);
      if (fragment && target.endsWith('.md') && statSync(target).isFile()) {
        if (!cache.has(target)) cache.set(target, anchors(readFileSync(target, 'utf8')));
        assert(cache.get(target).has(decodeURIComponent(fragment)), file + ': 없는 앵커 ' + href);
      }
    }
  }
}
