#!/usr/bin/env node
// 파일 책임: 새 화면의 구조 골격을 만든다. 프로젝트 폴더(web-kit.structure.json이 있는 곳)에서 실행한다.
//   web-kit-new --feature orders --kind list --url /orders [--entity order] [--group <_묶음>] [--dry-run]
//   --group이 없으면 web-kit.structure.json의 screenGroup 묶음에 만든다. 묶음 이름은 프로젝트가 정한다.
// 기존 파일을 덮어쓰지 않고, 같은 입력으로 다시 실행하면 바뀌는 것이 없다. 완료를 만들지 않는다(skills/web-kit-structure).
import { resolve } from 'node:path';
import { formatScaffold, scaffoldScreen } from '../tools/structure/scaffold.mjs';

const args = process.argv.slice(2);
/** 값이 있는 선택 인자를 읽는다. */
function option(name) {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  const value = args[at + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(name + '에 값을 넘기세요');
  return value;
}
try {
  const input = { feature: option('--feature'), kind: option('--kind'), url: option('--url') };
  for (const [name, value] of Object.entries(input)) if (value === undefined) throw new Error(`필수 인자 --${name}. 예: web-kit-new --feature orders --kind list --url /orders`);
  const result = scaffoldScreen({ root: resolve('.'), configFile: option('--config'), entity: option('--entity'), group: option('--group'), dryRun: args.includes('--dry-run'), ...input });
  const text = formatScaffold(result, input);
  if (result.conflicts.length > 0) { console.error(text); process.exitCode = 1; } else console.log(text);
} catch (error) {
  console.error('web-kit-new 실패: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
