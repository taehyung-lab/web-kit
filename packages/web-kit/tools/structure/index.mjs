// 파일 책임: 소비 프로젝트의 eslint.config.js가 쓰는 구조 계약 입구. 설정 파일 하나(web-kit.structure.json)로 키트 규칙 전체를 켠다.
//
//   import { webKitStructure } from '@boosterlab/web-kit/structure';
//   export default [...tsParserConfig, ...webKitStructure({ root: import.meta.dirname })];
//
// TypeScript 파서(typescript-eslint)는 프로젝트 설정이 먼저 지정한다. 규칙 내용은 키트가 소유하므로 프로젝트가 규칙을 끄지 않고,
// 남겨 둘 위반은 web-kit.structure.json의 exceptions(파일·규칙·이유)로만 둔다.
import { readFileSync } from 'node:fs';
import { CONFIG_FILE, loadStructureConfig, RULE_NAMES } from './config.mjs';
import { plugin } from './plugin.mjs';

export { plugin, CONFIG_FILE };
export const version = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;

/**
 * 구조 계약 ESLint flat config를 만든다.
 * - root: web-kit.structure.json이 있는 프로젝트 폴더(보통 import.meta.dirname)
 * - applyExceptions: false면 예외 목록을 적용하지 않는다(web-kit-check가 쓰지 않는 예외를 찾을 때 쓴다)
 */
export function webKitStructure({ root, configFile = CONFIG_FILE, applyExceptions = true } = {}) {
  if (typeof root !== 'string' || root === '') throw new Error('webKitStructure({ root })에 프로젝트 폴더를 넘기세요(예: import.meta.dirname).');
  const config = loadStructureConfig(root, configFile);
  const rules = Object.fromEntries(RULE_NAMES.map((name) => [`web-kit-structure/${name}`, 'error']));
  const ignores = [...config.generated, ...config.generatedModels].map((path) => `${path}/**`);
  const settings = { 'web-kit-structure': { root: config.root, configFile, applyExceptions } };
  return [
    {
      name: 'web-kit-structure/source',
      files: [`${config.src}/**/*.{ts,tsx,js,jsx,mts,mjs}`],
      ignores: [...ignores, '**/*.test.*', '**/*.spec.*', '**/__tests__/**'],
      plugins: { 'web-kit-structure': plugin },
      settings,
      rules,
    },
    {
      // 검사 파일은 import 방향 검사에서 빠지지만 route 폴더 안에 두었는지는 본다.
      name: 'web-kit-structure/tests',
      files: [`${config.routes}/**/*.test.*`, `${config.routes}/**/*.spec.*`],
      plugins: { 'web-kit-structure': plugin },
      settings,
      rules: { 'web-kit-structure/file-layout': 'error' },
    },
  ];
}
