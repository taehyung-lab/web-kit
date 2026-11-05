#!/usr/bin/env node
// 파일 책임: 구조 계약 검사만 실행한다. `web-kit-structure [--config web-kit.structure.json]`를 프로젝트 폴더에서 실행한다.
// 결과는 [구조] 한 가지다. UI 적합성은 web-kit-check가 따로 판정한다.
import { resolve } from 'node:path';
import { formatStructureResult, runStructureCheck } from '../tools/structure/check.mjs';

const args = process.argv.slice(2);
const at = args.indexOf('--config');
const configFile = at < 0 ? 'web-kit.structure.json' : args[at + 1];
try {
  if (!configFile) throw new Error('--config에 구조 설정 파일을 넘기세요');
  const result = await runStructureCheck({ root: resolve('.'), configFile });
  const text = formatStructureResult(result);
  if (result.ok) console.log(text);
  else { console.error(text); process.exitCode = 1; }
} catch (error) {
  console.error('[구조] 실패: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
