// 파일 책임: registry 설치 의존과 검사 요구 목록·실제 정적 import의 누락을 함께 점검한다.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { createRequire } from 'node:module';

/** 설치 항목별 실행·검사의 정적 import를 따라 npm 선언과 내부 의존 정본을 비교한다. */
export function checkRegistryDependencies(root, registry) {
  const read = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  const kit = read('packages/web-kit/package.json');
  const requirements = read('packages/web-kit/src/testing/requirements.json');
  const combinations = read('packages/web-kit/src/testing/combinations.json');
  const require = createRequire(resolve(root, 'packages/web-kit/package.json'));
  const ts = require('typescript');
  const items = new Map(registry.items.map((item) => [item.name, item]));
  /** 범위 선택의 내부 의존을 한 번씩만 방문한다. */
  function closure(name, selected = new Set()) {
    if (selected.has(name)) return selected;
    selected.add(name);
    for (const dep of items.get(name).registryDependencies ?? []) closure(dep.replace('@web-kit/', ''), selected);
    return selected;
  }
  /** scoped 패키지를 포함해 버전·subpath를 제거한 npm 이름을 읽는다. */
  function packageName(specifier) {
    const segments = specifier.split('/');
    return (specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]).replace(/@[^@/]+$/, '');
  }
  /** TS와 CSS의 상대 경로를 설치 원본 위치에서 해소한다. */
  function localFile(file) {
    return [file, ...['.ts', '.tsx', '.mjs', '.js', '.json', '/index.ts', '/index.tsx'].map((suffix) => file + suffix)].find((path) => existsSync(path) && extname(path));
  }
  /** 타입 제거 후 남은 정적 import만 따라간다. 조건부 조합 import는 아래 조합별로 따로 확인한다. */
  function externals(files) {
    const found = new Set();
    const visited = new Set();
    /** 한 모듈의 실행 import를 중복 없이 따라간다. */
    function visit(file) {
      if (!file || visited.has(file) || !/\.[cm]?[jt]sx?$/.test(file)) return;
      visited.add(file);
      const output = ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext } }).outputText;
      const source = ts.createSourceFile(file, output, ts.ScriptTarget.Latest, true);
      for (const statement of source.statements) {
        if ((!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) || !statement.moduleSpecifier) continue;
        const specifier = statement.moduleSpecifier.text;
        if (specifier.startsWith('.')) visit(localFile(resolve(dirname(file), specifier)));
        else if (specifier === kit.name || specifier.startsWith(kit.name + '/')) {
          const key = specifier === kit.name ? '.' : '.' + specifier.slice(kit.name.length);
          assert(kit.exports[key], '공개 입구 없음: ' + specifier);
          visit(localFile(resolve(root, 'packages/web-kit', kit.exports[key])));
        } else if (!specifier.startsWith('node:')) found.add(packageName(specifier));
      }
    }
    for (const file of files) visit(resolve(root, file));
    return found;
  }
  /** 각 선택의 실제 npm import가 그 선택의 선언 의존으로 충족되는지 확인한다. */
  function check(name, selected, extra = []) {
    const declarations = new Set(['react', 'react-dom', kit.name, ...Object.keys(kit.dependencies ?? {})]);
    const files = [...extra];
    for (const itemName of selected) {
      const item = items.get(itemName);
      for (const dep of [...(item.dependencies ?? []), ...(item.devDependencies ?? [])]) declarations.add(packageName(dep));
      files.push(...(item.files ?? []).map((file) => file.path));
    }
    for (const dep of externals(files)) assert(declarations.has(dep), name + ': npm 의존 선언 누락 ' + dep);
  }
  assert.deepEqual(Object.keys(requirements).sort(), [...items.keys()].sort(), '설치 항목과 요구 목록 이름 불일치');
  for (const [name, item] of items) {
    assert.deepEqual([...requirements[name].dependencies].sort(), (item.registryDependencies ?? []).map((dep) => dep.replace('@web-kit/', '')).sort(), name + ': registry.json/requirements.json 의존 불일치');
    check(name, closure(name));
  }
  for (const [name, combination] of Object.entries(combinations)) {
    const selected = new Set();
    for (const item of combination.items) closure(item, selected);
    check(name, selected, combination.sources ?? []);
  }
}
