// 파일 책임: import 문자열을 프로젝트 tsconfig 기준의 실제 파일로 해소하고, 재export(public.ts 등)를 따라 이름이 실제로 정의된 파일을 찾는다.
// 문자열 접두어 비교로는 별칭·상대 경로·재export·동적 import 우회를 막지 못하므로 TypeScript 해석기를 그대로 쓴다.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
let ts;
/** typescript는 선택 peer다. 구조 검사를 쓸 때만 불러온다. */
function typescript() {
  if (!ts) {
    try { ts = require('typescript'); } catch { throw new Error('구조 검사에는 typescript가 필요합니다(@boosterlab/web-kit 선택 peer). 프로젝트 devDependencies에 설치하세요.'); }
  }
  return ts;
}

const compilerOptions = new Map();
const resolutions = new Map();
const exportTables = new Map();

/** 프로젝트 tsconfig(extends·paths 포함)를 해석한다. */
function optionsFor(config) {
  const cached = compilerOptions.get(config.path);
  if (cached) return cached;
  const t = typescript();
  const parsed = t.getParsedCommandLineOfConfigFile(join(config.root, config.tsconfig), {}, {
    ...t.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => { throw new Error(t.flattenDiagnosticMessageText(diagnostic.messageText, '\n')); },
  });
  const options = { ...parsed.options, allowJs: true, noEmit: true };
  compilerOptions.set(config.path, options);
  return options;
}

/** 확장자가 없는 자산 경로(css 등)를 그대로 파일로 본다. */
function existingAsset(path) {
  return existsSync(path) && statSync(path).isFile() ? path : undefined;
}

/**
 * import 하나를 해소한다.
 * - { kind: 'file', path }: 프로젝트 파일
 * - { kind: 'package', specifier }: node_modules 패키지 또는 해소되지 않는 bare 이름
 */
export function resolveImport(config, fromFile, specifier) {
  const key = fromFile + '\0' + specifier;
  const cached = resolutions.get(key);
  if (cached) return cached;
  const t = typescript();
  const options = optionsFor(config);
  const resolved = t.resolveModuleName(specifier, fromFile, options, t.sys).resolvedModule;
  let result;
  if (resolved && !resolved.isExternalLibraryImport && !resolved.resolvedFileName.includes('/node_modules/')) result = { kind: 'file', path: resolve(resolved.resolvedFileName) };
  else if (resolved) result = { kind: 'package', specifier };
  else if (specifier.startsWith('.')) result = { kind: 'file', path: existingAsset(resolve(dirname(fromFile), specifier)) ?? resolve(dirname(fromFile), specifier) };
  else {
    // paths 별칭으로 가리킨 비코드 자산(@/styles.css 등)을 찾는다. 못 찾으면 패키지로 본다.
    let asset;
    for (const [pattern, targets] of Object.entries(options.paths ?? {})) {
      const star = pattern.indexOf('*');
      const prefix = star < 0 ? pattern : pattern.slice(0, star);
      if (star < 0 ? specifier !== pattern : !specifier.startsWith(prefix)) continue;
      for (const target of targets) {
        const candidate = resolve(options.pathsBasePath ?? options.baseUrl ?? config.root, star < 0 ? target : target.replace('*', specifier.slice(prefix.length)));
        asset = existingAsset(candidate);
        if (asset) break;
      }
      if (asset) break;
    }
    result = asset ? { kind: 'file', path: asset } : { kind: 'package', specifier };
  }
  resolutions.set(key, result);
  return result;
}

/** 파일의 export 표: 직접 선언한 이름, import한 이름을 다시 낸 것, `export … from` 재export. */
function exportTable(file) {
  let mtime = 0;
  try { mtime = statSync(file).mtimeMs; } catch { return { local: new Set(), forwarded: new Map(), reexports: [], star: [] }; }
  const cached = exportTables.get(file);
  if (cached && cached.mtime === mtime) return cached.table;
  const t = typescript();
  const source = t.createSourceFile(file, readFileSync(file, 'utf8'), t.ScriptTarget.Latest, true);
  const imported = new Map();
  const table = { local: new Set(), forwarded: new Map(), reexports: [], star: [] };
  const exported = (node) => t.canHaveModifiers(node) && (t.getModifiers(node) ?? []).some((m) => m.kind === t.SyntaxKind.ExportKeyword);
  const isDefault = (node) => (t.getModifiers(node) ?? []).some((m) => m.kind === t.SyntaxKind.DefaultKeyword);
  for (const statement of source.statements) {
    if (t.isImportDeclaration(statement) && t.isStringLiteral(statement.moduleSpecifier) && statement.importClause) {
      const from = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (clause.name) imported.set(clause.name.text, { from, name: 'default' });
      const bindings = clause.namedBindings;
      if (bindings && t.isNamespaceImport(bindings)) imported.set(bindings.name.text, { from, name: '*' });
      if (bindings && t.isNamedImports(bindings)) for (const element of bindings.elements) imported.set(element.name.text, { from, name: (element.propertyName ?? element.name).text });
    } else if (t.isExportDeclaration(statement)) {
      const from = statement.moduleSpecifier && t.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : undefined;
      const clause = statement.exportClause;
      if (!clause && from) table.star.push(from);
      else if (clause && t.isNamespaceExport(clause) && from) table.reexports.push({ from, exported: clause.name.text, name: '*' });
      else if (clause && t.isNamedExports(clause)) {
        for (const element of clause.elements) {
          const name = (element.propertyName ?? element.name).text;
          if (from) table.reexports.push({ from, exported: element.name.text, name });
          else table.forwarded.set(element.name.text, name);
        }
      }
    } else if (t.isExportAssignment(statement)) table.local.add('default');
    else if (exported(statement)) {
      if (isDefault(statement)) table.local.add('default');
      else if (t.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
        if (t.isIdentifier(declaration.name)) table.local.add(declaration.name.text);
      }
      else if (statement.name && t.isIdentifier(statement.name)) table.local.add(statement.name.text);
    }
  }
  // `import { x } from 'm'; export { x }`는 m의 x를 그대로 낸 것이다.
  for (const [exportedName, localName] of [...table.forwarded]) {
    const origin = imported.get(localName);
    if (origin) { table.reexports.push({ from: origin.from, exported: exportedName, name: origin.name }); table.forwarded.delete(exportedName); }
    else table.local.add(exportedName);
  }
  exportTables.set(file, { mtime, table });
  return table;
}

/**
 * import한 이름(names: Set 또는 '*')이 실제로 정의된 프로젝트 파일 목록. 재export 사슬을 끝까지 따라간다.
 * 패키지로 나가는 재export는 따라가지 않는다(프로젝트 구조 밖이다).
 */
export function importOrigins(config, file, names, seen = new Set(), fallback = true) {
  const key = file + '\0' + (names === '*' ? '*' : [...names].sort().join(',')) + (fallback ? '' : '\0strict');
  if (seen.has(key)) return [];
  seen.add(key);
  const table = exportTable(file);
  const origins = new Set();
  const follow = (from, next, strict = false) => {
    const target = resolveImport(config, file, from);
    if (target.kind === 'file' && /\.[cm]?[jt]sx?$/.test(target.path)) for (const origin of importOrigins(config, target.path, next, seen, !strict)) origins.add(origin);
  };
  if (names === '*') {
    origins.add(file);
    for (const entry of table.reexports) follow(entry.from, entry.name === '*' ? '*' : new Set([entry.name]));
    for (const from of table.star) follow(from, '*');
    return [...origins];
  }
  const remaining = new Set(names);
  for (const name of names) if (table.local.has(name)) { origins.add(file); remaining.delete(name); }
  for (const entry of table.reexports) {
    if (!remaining.has(entry.exported)) continue;
    remaining.delete(entry.exported);
    follow(entry.from, entry.name === '*' ? '*' : new Set([entry.name]));
  }
  const starNames = new Set([...remaining].filter((name) => name !== 'default'));
  // `export *`는 그 이름을 실제로 낸 모듈만 출처로 센다.
  if (starNames.size > 0) for (const from of table.star) follow(from, starNames, true);
  // 찾지 못한 이름(타입 선언 등)은 이 파일이 낸 것으로 본다.
  if (origins.size === 0 && fallback) origins.add(file);
  return [...origins];
}
