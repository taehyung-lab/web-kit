// 파일 책임: 새 화면의 구조 골격(ui·model·api·index·route)을 web-kit-structure 자리에 만든다.
// 완료처럼 보이는 것을 만들지 않는다: 서버 endpoint·필드·화면 배치·저장 뒤 목적지는 선언되지 않은 TODO_web_kit_new_* 이름으로 남겨
// 채우기 전에는 typecheck가 실패한다. 성공을 지어낸 API, 건너뛴 검사, 통과용 검사 파일은 만들지 않는다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadStructureConfig, VAGUE_NAMES } from './config.mjs';
import { TODO_MARKER } from './markers.mjs';

const KINDS = ['list', 'form', 'detail'];
const require = createRequire(import.meta.url);

/** Preserve the existing entry verbatim, comparing exported names and origins rather than formatting. */
function extendPublicEntry(existing, additions) {
  const ts = require('typescript');
  const source = ts.createSourceFile('index.ts', existing, ts.ScriptTarget.Latest, true);
  const names = new Map();
  let star = false;
  const reserve = (name, origin = null) => names.set(name, names.has(name) ? null : origin);
  const binding = node => {
    if (ts.isIdentifier(node)) reserve(node.text);
    else for (const element of node.elements) if (ts.isBindingElement(element)) binding(element.name);
  };
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      const from = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : undefined;
      if (!statement.exportClause) star = true;
      else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements)
          reserve(element.name.text, from && !statement.isTypeOnly && !element.isTypeOnly ? { from, name: (element.propertyName ?? element.name).text } : null);
      } else reserve(statement.exportClause.name.text);
    } else if ((ts.getModifiers(statement) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) binding(declaration.name);
      else if (statement.name && ts.isIdentifier(statement.name)) reserve(statement.name.text);
    }
  }
  const lines = [];
  for (const line of additions) {
    const statement = ts.createSourceFile('addition.ts', line, ts.ScriptTarget.Latest, true).statements[0];
    const element = statement.exportClause.elements[0];
    const name = element.name.text;
    const origin = names.get(name);
    if (origin?.from === statement.moduleSpecifier.text && origin.name === name) continue;
    if (names.has(name) || star) return undefined;
    lines.push(line);
  }
  return existing + (existing && !existing.endsWith('\n') && lines.length ? '\n' : '') + (lines.length ? lines.join('\n') + '\n' : '');
}

/** kebab-case → PascalCase. */
function pascal(name) {
  return name.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('');
}
/** kebab-case → camelCase. */
function camel(name) {
  const value = pascal(name);
  return value[0].toLowerCase() + value.slice(1);
}

/** URL을 검사하고 route 파일 경로·route id·마지막 경로 변수를 정한다. */
function routeOf(kind, url, group) {
  if (typeof url !== 'string' || !url.startsWith('/') || url === '/') throw new Error('--url은 /로 시작하는 화면 경로여야 합니다(예: /orders, /orders/$orderId)');
  const segments = url.replace(/\/$/, '').slice(1).split('/');
  for (const segment of segments) if (!/^(?:[a-z0-9][a-z0-9-]*|\$[a-zA-Z][a-zA-Z0-9]*)$/.test(segment)) throw new Error(`URL 조각을 쓸 수 없습니다: ${segment} (소문자·숫자·하이픈 또는 $변수)`);
  const last = segments.at(-1);
  const params = segments.filter((segment) => segment.startsWith('$')).map((segment) => segment.slice(1));
  if (kind === 'detail' && !last.startsWith('$')) throw new Error('detail 화면의 URL은 $<id>로 끝나야 합니다(예: /orders/$orderId)');
  if (kind === 'form' && last === 'edit' && !segments.at(-2)?.startsWith('$')) throw new Error('수정 화면의 URL은 /$<id>/edit이어야 합니다');
  const fileName = kind === 'form' && (last === 'new' || last === 'edit') ? last : null;
  const dir = fileName ? segments.slice(0, -1) : segments;
  const file = [...dir, `${fileName ?? 'index'}.tsx`].join('/');
  const id = `/${group}/${segments.join('/')}${fileName ? '' : '/'}`;
  const mode = kind === 'form' ? (last === 'edit' ? 'edit' : 'create') : kind;
  // 목록 주소: 목록은 자기 주소, 상세(/$id)·등록(/new)은 마지막 조각을, 수정(/$id/edit)은 마지막 두 조각을 뺀 주소다.
  const collection = segments.slice(0, segments.length - { list: 0, detail: 1, create: 1, edit: 2 }[mode]);
  return { file, id, mode, param: params.at(-1), collectionUrl: collection.length > 0 ? '/' + collection.join('/') : null };
}

const SCREENS = ['list', 'detail', 'create', 'edit'];
const TOKENS = ['feature', 'featureCamel', 'entity', 'Entity', 'entityCamel', 'ENTITY', 'id', 'alias', 'featureDir', 'group', 'routesDir', 'routeFile', 'routeId', 'url', 'collectionUrl', 'recordUrl', 'TODO'];
const DEFAULT_TEMPLATES = fileURLToPath(new URL('./screen-templates/', import.meta.url));

/**
 * {{이름}} 자리를 값으로 바꾼다. 모르는 이름은 골격 오류다(빈 값으로 넘기지 않는다).
 * 이름은 영문자로 시작하는 한 단어라서 JSX의 객체 값 `{{ a: 1 }}`은 자리로 읽지 않는다.
 */
function render(text, values, where) {
  return text.replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (_, name) => {
    if (!Object.hasOwn(values, name)) throw new Error(`${where}: 알 수 없는 골격 자리 {{${name}}} (쓸 수 있는 것: ${TOKENS.join('·')})`);
    return values[name];
  });
}

/**
 * 골격 폴더(screens.json + 템플릿 파일)를 읽는다. 프로젝트가 screenTemplates로 넘긴 폴더가 있으면 그것을, 없으면 키트 기본 골격을 쓴다.
 * screens.json: { "<list|detail|create|edit>": { files: [{ path, template, shared? }], exports?: [줄], next?: [줄] } }
 */
function loadTemplates(config) {
  const dir = config.screenTemplates === undefined ? DEFAULT_TEMPLATES : join(config.root, config.screenTemplates);
  const where = config.screenTemplates === undefined ? '키트 기본 골격' : config.screenTemplates;
  const manifest = JSON.parse(readFileSync(join(dir, 'screens.json'), 'utf8'));
  for (const key of Object.keys(manifest)) if (!SCREENS.includes(key)) throw new Error(`${where}/screens.json: 알 수 없는 화면 종류 ${key} (${SCREENS.join('·')})`);
  return { dir, where, manifest };
}

/** 화면 종류별 파일 목록을 골격 폴더에서 만든다. shared는 같은 feature의 다른 화면과 함께 쓰는 파일이라 이미 있으면 그대로 둔다. */
function plan({ config, feature, entity, kind, url, group }) {
  const route = routeOf(kind, url, group);
  const { dir, where, manifest } = loadTemplates(config);
  const screen = manifest[route.mode];
  if (screen === undefined) throw new Error(`${where}/screens.json에 ${route.mode} 화면 골격이 없습니다`);
  const featureDir = `${config.src}/features/${feature}`;
  const routesDir = `${config.routes}/${group}`;
  // 주소 변수 이름: 상세·수정은 주소의 마지막 $변수, 목록·등록은 상세로 이동할 때 쓸 <entity>Id다.
  const id = route.mode === 'detail' || route.mode === 'edit' ? route.param : `${camel(entity)}Id`;
  const values = {
    feature, featureCamel: camel(feature), entity, Entity: pascal(entity), entityCamel: camel(entity), ENTITY: entity.toUpperCase().replaceAll('-', '_'), id, alias: config.alias,
    featureDir, group, routesDir, routeFile: route.file, routeId: route.id, url,
    collectionUrl: route.collectionUrl ?? '', recordUrl: `${route.collectionUrl ?? ''}/$${id}`, TODO: TODO_MARKER,
  };
  const routePath = `${routesDir}/${route.file}`;
  // 요청한 URL이 쓰는 route 파일은 둘뿐이다: 이 화면의 route 파일과, 목록 주소 묶음의 route.tsx(같은 목록의 화면들이 함께 쓰는 진입 판정).
  const collectionRoute = route.collectionUrl === null ? null : `${routesDir}${route.collectionUrl}/route.tsx`;
  const files = (screen.files ?? []).map((entry, index) => {
    const at = `${where}/screens.json ${route.mode}.files[${index}]`;
    if (typeof entry?.path !== 'string' || typeof entry?.template !== 'string') throw new Error(`${at}: path와 template을 적으세요`);
    const path = render(entry.path, values, at);
    // 골격은 요청한 업무 폴더와 요청한 URL의 route 파일에만 쓴다. 다른 업무·다른 주소의 route는 건드리지 않는다.
    // 목록 묶음 route.tsx는 같은 목록의 여러 화면이 함께 쓰므로 shared(이미 있으면 그대로 둔다)로만 받는다.
    const allowedRoute = path === routePath || (path === collectionRoute && entry.shared === true);
    if (!allowedRoute && !path.startsWith(featureDir + '/'))
      throw new Error(`${at}: ${path}는 ${featureDir}/ 안이거나 ${routePath}${collectionRoute ? `·${collectionRoute}(shared)` : ''}여야 합니다`);
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) throw new Error(`${at}: 검사 파일은 골격으로 만들지 않습니다: ${path}`);
    if (path === `${featureDir}/index.ts`) throw new Error(`${at}: 공개 입구(index.ts)는 exports로 적습니다`);
    const content = render(readFileSync(join(dir, entry.template), 'utf8'), values, `${where}/${entry.template}`);
    if (path === routePath && !content.includes(`'${route.id}'`)) throw new Error(`${where}/${entry.template}: route 파일에 이 화면의 route id {{routeId}}가 없습니다`);
    if (path === collectionRoute && !content.includes(`'/${group}${route.collectionUrl}'`))
      throw new Error(`${where}/${entry.template}: 목록 묶음 route 파일에 route id '/{{group}}{{collectionUrl}}'가 없습니다`);
    return { path, content, ...(entry.shared === true ? { shared: true } : {}) };
  });
  if (!files.some((file) => file.path === routePath)) throw new Error(`${where}/screens.json ${route.mode}: route 파일({{routesDir}}/{{routeFile}})이 없습니다`);
  // 골격 자체에 채울 자리가 있어야 한다. 화면 전용 파일이 공유 파일(폼 schema 등)만 채우면 되는 화면도 있어 공유 파일까지 본다.
  if (!files.some((file) => file.content.includes(TODO_MARKER)))
    throw new Error(`${where}/screens.json ${route.mode}: 채울 자리({{TODO}}…)가 없는 골격은 완료처럼 보이므로 만들지 않습니다`);
  const exports = (screen.exports ?? []).map((line) => render(line, values, `${where}/screens.json ${route.mode}.exports`));
  files.push({ path: `${featureDir}/index.ts`, exports });
  return { files, next: (screen.next ?? []).map((line) => render(line, values, `${where}/screens.json ${route.mode}.next`)) };
}

/**
 * 골격을 만든다. 같은 내용의 파일은 그대로 두고(다시 실행해도 같다), 다른 내용의 화면 파일이 있으면 아무것도 쓰지 않고 실패한다.
 * 반환: { created, updated, reused, unchanged, conflicts, markers, dryRun, next(골격이 적은 직접 연결할 것) }
 */
export function scaffoldScreen({ root, configFile, feature, kind, url, entity, group: groupOption, dryRun = false }) {
  const config = loadStructureConfig(root, configFile);
  // 묶음 이름은 키트가 정하지 않는다. --group이 없으면 프로젝트 설정(screenGroup)을 쓰고, 둘 다 없으면 만들지 않는다.
  const group = groupOption ?? config.screenGroup;
  if (group === undefined) throw new Error('새 화면을 넣을 route 묶음을 정하세요: --group <_묶음> 또는 web-kit.structure.json의 "screenGroup"');
  if (!KINDS.includes(kind)) throw new Error(`--kind는 ${KINDS.join('|')} 중 하나여야 합니다`);
  if (typeof feature !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(feature)) throw new Error('--feature는 kebab-case 도메인 이름이어야 합니다(예: orders)');
  const name = entity ?? (feature.length > 3 && feature.endsWith('s') && !feature.endsWith('ss') ? feature.slice(0, -1) : feature);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) throw new Error('--entity는 kebab-case 이름이어야 합니다(예: order)');
  if ([feature, name].some((value) => VAGUE_NAMES.includes(value))) throw new Error('포괄 이름(utils·helpers·constants 등)으로 만들 수 없습니다');
  if (!/^_[a-z][a-z0-9-]*$/.test(group)) throw new Error('--group은 _로 시작하는 route 묶음 이름이어야 합니다(예: _authenticated)');
  // 묶음의 진입 판정·골격은 그 묶음의 route.tsx에 있다. 없는 묶음에 화면을 만들면 진입 판정 없는 화면이 생기므로 거절한다.
  if (!existsSync(join(config.root, config.routes, group, 'route.tsx')))
    throw new Error(`route 묶음 ${group}이 없습니다: 진입 판정·골격을 둔 ${config.routes}/${group}/route.tsx가 있는 묶음에만 화면을 만듭니다`);
  const { files, next } = plan({ config, feature, entity: name, kind, url, group });
  const result = { created: [], updated: [], reused: [], unchanged: [], conflicts: [], markers: 0, dryRun, next };
  for (const file of files) {
    const full = join(config.root, file.path);
    if (file.exports) {
      const existing = existsSync(full) ? readFileSync(full, 'utf8') : '';
      file.content = extendPublicEntry(existing, file.exports);
      if (file.content === undefined) { result.conflicts.push(file); continue; }
    }
    if (!existsSync(full)) { result.created.push(file); result.markers += file.content.split(TODO_MARKER).length - 1; continue; }
    if (readFileSync(full, 'utf8') === file.content) { result.unchanged.push(file); result.markers += file.content.split(TODO_MARKER).length - 1; }
    else if (file.exports) result.updated.push(file);
    else if (file.shared) result.reused.push(file);
    else result.conflicts.push(file);
  }
  if (result.conflicts.length > 0 || dryRun) return result;
  for (const file of result.created) {
    mkdirSync(dirname(join(config.root, file.path)), { recursive: true });
    writeFileSync(join(config.root, file.path), file.content, { flag: 'wx' });
  }
  for (const file of result.updated) writeFileSync(join(config.root, file.path), file.content);
  return result;
}

/** 생성 결과를 읽는 줄로 만든다. 생성 수를 완료 수로 읽지 않도록 함께 적는다. */
export function formatScaffold(result, { feature, kind, url }) {
  const lines = [`web-kit-new ${feature} ${kind} ${url}${result.dryRun ? ' (--dry-run: 파일을 쓰지 않음)' : ''}`];
  for (const file of result.created) lines.push(`  ${result.dryRun ? '만들 파일' : '만듦'} ${file.path}`);
  for (const file of result.updated) lines.push(`  ${result.dryRun ? '공개 연결 추가 예정' : '공개 연결 추가'} ${file.path}`);
  for (const file of result.reused) lines.push(`  기존 파일 사용 ${file.path} (같은 feature의 공유 파일이라 덮어쓰지 않음)`);
  for (const file of result.unchanged) lines.push(`  변경 없음 ${file.path}`);
  for (const file of result.conflicts) lines.push(`  충돌 ${file.path}: 내용이 다른 파일이 이미 있어 아무 파일도 쓰지 않았다`);
  if (result.conflicts.length > 0) return lines.join('\n');
  lines.push(`이 화면 골격에 남은 미완성 표시 ${result.markers}곳(${TODO_MARKER}…, 공유 파일 중 이미 고친 것은 세지 않음): 선언되지 않은 이름이라 채우기 전에는 typecheck가 실패한다.`);
  lines.push('생성한 파일 수는 완료한 화면 수가 아니다. 검사 파일은 만들지 않았다: 화면 행동·서버 요청을 확인하는 제품 검사를 직접 작성하고 따로 집계한다.');
  if (result.next.length > 0) lines.push('직접 연결할 것:', ...result.next.map((line) => `  - ${line}`));
  return lines.join('\n');
}
