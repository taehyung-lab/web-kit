// 파일 책임: 프로젝트 파일 전체에 키트가 배포한 구조 규칙만 실행하고, 예외 목록과 대조한 구조 결과를 만든다.
// 프로젝트 eslint 설정·인라인 disable 주석은 쓰지 않는다(규칙을 끄거나 줄여 통과하지 못하게 한다). UI 적합성 결과와 합치지 않는다.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadStructureConfig, posix, CONFIG_FILE } from './config.mjs';
import { version, webKitStructure } from './index.mjs';

import { TODO_MARKER } from './markers.mjs';

export { TODO_MARKER };

/** 프로젝트에 설치된 패키지를 프로젝트 기준으로 불러온다. */
async function load(root, name) {
  const require = createRequire(join(root, 'package.json'));
  let path;
  try { path = require.resolve(name); } catch { throw new Error(`구조 검사에 필요한 ${name}를 프로젝트에서 찾지 못했습니다. devDependencies에 설치하세요.`); }
  return import(pathToFileURL(path).href);
}

/**
 * 구조 검사를 실행한다. root는 web-kit.structure.json이 있는 프로젝트 폴더다.
 * 반환: { ok, version, configFile, files, violations, excepted, unusedExceptions, todoMarkers, errors }.
 * violations는 예외로 덮이지 않은 위반, excepted는 예외 목록이 덮은 위반이다.
 */
export async function runStructureCheck({ root, configFile = CONFIG_FILE, resolveFrom }) {
  const config = loadStructureConfig(root, configFile);
  // eslint·typescript-eslint는 프로젝트가 설치한 것을 쓴다. resolveFrom은 키트 자체 검사가 고정 예제 폴더를 검사할 때만 넘긴다.
  const { ESLint } = await load(resolveFrom ?? config.root, 'eslint');
  const tseslint = (await load(resolveFrom ?? config.root, 'typescript-eslint')).default;
  const eslint = new ESLint({
    cwd: config.root,
    overrideConfigFile: true,
    allowInlineConfig: false,
    errorOnUnmatchedPattern: false,
    overrideConfig: [
      { files: ['**/*.{ts,tsx,mts,js,jsx,mjs}'], languageOptions: { parser: tseslint.parser, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } } },
      ...webKitStructure({ root: config.root, configFile, applyExceptions: false }),
    ],
  });
  const results = await eslint.lintFiles([`${config.src}/**/*.{ts,tsx,mts,js,jsx,mjs}`]);
  const errors = [];
  const found = [];
  let todoMarkers = 0;
  for (const result of results) {
    const rel = posix(relative(config.root, result.filePath));
    todoMarkers += readFileSync(result.filePath, 'utf8').split(TODO_MARKER).length - 1;
    for (const message of result.messages) {
      if (!message.ruleId?.startsWith('web-kit-structure/')) { errors.push(`${rel}:${message.line ?? 0} ${message.message}`); continue; }
      found.push({ file: rel, line: message.line, rule: message.ruleId.slice('web-kit-structure/'.length), message: message.message });
    }
  }
  const used = new Set();
  const violations = [];
  const excepted = [];
  for (const violation of found) {
    const index = config.exceptions.findIndex((entry) => entry.file === violation.file && entry.rule === violation.rule);
    if (index < 0) violations.push(violation);
    else { used.add(index); excepted.push({ ...violation, reason: config.exceptions[index].reason }); }
  }
  const unusedExceptions = config.exceptions.filter((_, index) => !used.has(index));
  const ok = results.length > 0 && errors.length === 0 && violations.length === 0 && unusedExceptions.length === 0;
  if (results.length === 0) errors.push(`${config.src}에서 검사할 파일을 찾지 못했습니다`);
  return { ok, version, configFile: posix(relative(config.root, config.path)), files: results.length, violations, excepted, exceptionCount: config.exceptions.length, unusedExceptions, todoMarkers, errors };
}

/** 구조 결과를 사람이 읽는 줄로 만든다. UI 적합성과 섞지 않도록 [구조] 머리를 붙인다. */
export function formatStructureResult(result) {
  const lines = [];
  const summary = `파일 ${result.files}개, 위반 ${result.violations.length}건, 예외로 남긴 위반 ${result.excepted.length}건(예외 목록 ${result.exceptionCount}개), 규칙 web-kit-structure ${result.version}, 설정 ${result.configFile}`;
  lines.push(`[구조] ${result.ok ? '통과' : '실패'}: ${summary}`);
  for (const error of result.errors) lines.push(`  오류 ${error}`);
  for (const violation of result.violations) lines.push(`  위반 ${violation.file}:${violation.line} ${violation.rule} ${violation.message}`);
  for (const entry of result.unusedExceptions) lines.push(`  쓰지 않는 예외 ${entry.file} ${entry.rule}: 위반이 없으면 목록에서 지운다`);
  if (result.todoMarkers > 0) lines.push(`  생성기 미완성 표시 ${result.todoMarkers}곳(${TODO_MARKER}…): 채우기 전에는 typecheck가 실패한다. 구조 통과는 완성을 뜻하지 않는다`);
  lines.push('  한계: 구조 결과는 import 방향·자리·파일 이름만 판정한다. 업무 의미·제품 동작 보존은 제품 검사로 따로 확인한다.');
  return lines.join('\n');
}
