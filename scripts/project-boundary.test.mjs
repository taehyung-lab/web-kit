// 파일 책임: 키트 문서와 패키지·starter 소스 주석에 알려진 소비 프로젝트 표기가 다시 들어오는지 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(resolve(root, 'packages/web-kit/package.json'));
const ts = require('typescript');
// ASCII 식별자 경계로 한글 조사는 허용하고 DTO 같은 다른 식별자는 구별한다.
const projectReference = /(?<![A-Za-z0-9_])(?:DT|REF)(?![A-Za-z0-9_])|디지털\s?티켓|zerosolution|레퍼런스|참조\s+프로젝트/u;

/** 알려진 이름과 우회 표현이 있는 문장을 찾는다. */
function violations(text) {
  return text.split('\n').flatMap((line, index) => projectReference.test(line) ? [{ line: index + 1, text: line.trim() }] : []);
}

/** 문서와 소스 경로를 읽되 생성 references와 의존성은 원본에서 검사한다. */
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'references' ? [] : files(path);
    return [path];
  });
}

/** 문자열·정규식·JSX 본문을 제외하고 구문 트리 토큰에 붙은 실제 주석을 모은다. */
function comments(text, path) {
  if (path.endsWith('.css')) return [...text.matchAll(/\/\*[\s\S]*?\*\//g)].map((match) => match[0]).join('\n');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const ranges = new Map();
  // 각 토큰 앞뒤 주석을 중복 없이 수집하며 빈 블록 안 주석도 포함한다.
  function visit(node) {
    for (const range of [...(ts.getLeadingCommentRanges(text, node.pos) ?? []), ...(ts.getTrailingCommentRanges(text, node.end) ?? [])]) {
      ranges.set(range.pos, text.slice(range.pos, range.end));
    }
    for (const child of node.getChildren(source)) visit(child);
  }
  visit(source);
  return [...ranges.values()].join('\n');
}

test('프로젝트 표기는 한글 조사와 우회 표현을 검출하고 일반 식별자·버전은 허용한다', () => {
  for (const text of ['DT의 정책', 'REF는 수동 연장', '디지털 티켓 화면', 'zerosolution 정책', '레퍼런스 화면', '참조 프로젝트 방식']) {
    assert.equal(violations(text).length, 1, text);
  }
  for (const text of ['DTO 변환', 'REFERENCE 상수', 'myDT_value', '1.5 버전', '프로젝트 입력', '참조 필드', 'ref는 실제 요소 참조']) {
    assert.deepEqual(violations(text), [], text);
  }
});

test('주석 검사는 실행 문자열·정규식·JSX와 실제 주석을 구별한다', () => {
  const source = 'const name = "DT의"; const regex = /REF는/; const ui = <p>참조 프로젝트</p>;';
  assert.deepEqual(violations(comments(source, 'example.tsx')), []);
  for (const suffix of ['\n// DT의 정책', '\n/* REF는 정책 */', '\nfunction example() { /* 참조 프로젝트 */ }']) {
    assert.equal(violations(comments(source + suffix, 'example.tsx')).length, 1);
  }
  assert.equal(violations(comments('/* DT의 정책 */ .example {}', 'example.css')).length, 1);
});

test('관리하는 키트 문서와 패키지·registry·starter 소스 주석에는 프로젝트 고유 표기가 없다', () => {
  const documents = ['README.md', 'docs/maintaining.md', 'packages/web-kit/README.md', 'apps/starter/README.md'];
  for (const directory of ['docs/decisions', 'packages/web-kit/docs', 'packages/web-kit/skills']) {
    documents.push(...files(resolve(root, directory)).filter((path) => path.endsWith('.md')));
  }
  const findings = [];
  for (const path of documents) {
    const text = readFileSync(resolve(root, path), 'utf8');
    findings.push(...violations(text).map((finding) => ({ path: relative(root, resolve(root, path)), ...finding })));
  }
  // 중앙 키트 규칙은 설치본 소유이며 프로젝트가 관리하는 절만 이 검사에서 판정한다.
  const agents = readFileSync(resolve(root, 'AGENTS.md'), 'utf8').split('<!-- agent-workflow-kit:end -->')[1];
  assert.ok(agents, 'AGENTS 프로젝트 절 경계를 찾을 수 있어야 한다');
  findings.push(...violations(agents).map((finding) => ({ path: 'AGENTS.md (프로젝트 절)', ...finding })));
  const sourceRoots = readdirSync(resolve(root, 'packages')).map((directory) => resolve(root, 'packages', directory, 'src'));
  sourceRoots.push(resolve(root, 'apps/starter/src'), resolve(root, 'apps/starter/tests'));
  for (const sourceRoot of sourceRoots) {
    for (const path of files(sourceRoot).filter((path) => /\.(?:[cm]?[jt]sx?|css)$/.test(path))) {
      findings.push(...violations(comments(readFileSync(path, 'utf8'), path)).map((finding) => ({ path: relative(root, path), ...finding })));
    }
  }
  assert.deepEqual(findings, [], JSON.stringify(findings, null, 2));
});
