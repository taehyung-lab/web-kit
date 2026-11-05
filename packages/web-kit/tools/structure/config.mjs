// 파일 책임: 프로젝트의 구조 설정(web-kit.structure.json)을 읽어 검증하고, 파일 경로를 구조 역할(app·runtime·routes·feature 층 등)로 분류한다.
// 키트는 역할 규칙만 소유한다. 경로·별칭·생성 코드 위치·예외는 프로젝트가 이 파일로 넘긴다.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const CONFIG_FILE = 'web-kit.structure.json';
export const FEATURE_LAYERS = ['api', 'model', 'state', 'flows', 'screens'];
export const FEATURE_ROOT_FILES = { 'i18n.ts': 'i18n', 'public.ts': 'public' };
export const APP_ROOTS = ['app', 'runtime', 'routes', 'features', 'shared'];
/** 책임을 말하지 않는 포괄 이름. 이 이름의 파일·폴더는 무엇이든 담게 되어 자리를 잃는다. */
export const VAGUE_NAMES = ['utils', 'util', 'helpers', 'helper', 'constants', 'consts', 'common', 'misc'];
export const RULE_NAMES = ['layer-import', 'feature-public', 'package-import', 'browser-global', 'no-jsx', 'raw-element', 'file-layout', 'route-loader'];

const configs = new Map();

/** 경로 구분자를 `/`로 맞춘다. */
export function posix(path) {
  return path.split(sep).join('/');
}

/** 프로젝트 상대 경로를 검증한다. 절대 경로·루트 밖 경로는 설정 오류다. */
function projectRelative(root, value, name) {
  if (typeof value !== 'string' || value === '' || isAbsolute(value)) throw new Error(`${CONFIG_FILE}: ${name}는 프로젝트 상대 경로여야 합니다: ${value}`);
  const rel = posix(relative(root, resolve(root, value)));
  if (rel === '..' || rel.startsWith('../')) throw new Error(`${CONFIG_FILE}: ${name}가 프로젝트 밖입니다: ${value}`);
  return rel.replace(/\/$/, '');
}

/** 문자열 배열 설정을 검증한다. */
function pathList(root, value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${CONFIG_FILE}: ${name}는 경로 배열이어야 합니다`);
  return value.map((entry) => projectRelative(root, entry, name));
}

/**
 * 구조 설정을 읽는다. root는 web-kit.structure.json이 있는 프로젝트 폴더다.
 * 같은 프로세스 안에서는 한 번만 읽는다(ESLint가 파일마다 규칙을 부른다).
 */
export function loadStructureConfig(root, file = CONFIG_FILE) {
  const path = resolve(root, file);
  const cached = configs.get(path);
  if (cached) return cached;
  if (!existsSync(path)) throw new Error(`구조 설정이 없습니다: ${path}`);
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const projectRoot = dirname(path);
  const known = new Set(['src', 'alias', 'tsconfig', 'routes', 'generated', 'generatedModels', 'support', 'exceptions']);
  for (const key of Object.keys(raw)) if (!known.has(key)) throw new Error(`${CONFIG_FILE}: 알 수 없는 설정 ${key}`);
  const src = projectRelative(projectRoot, raw.src ?? 'src', 'src');
  const routes = projectRelative(projectRoot, raw.routes ?? `${src}/routes`, 'routes');
  if (!routes.startsWith(src + '/')) throw new Error(`${CONFIG_FILE}: routes는 src 안이어야 합니다`);
  const tsconfig = projectRelative(projectRoot, raw.tsconfig ?? 'tsconfig.json', 'tsconfig');
  if (!existsSync(join(projectRoot, tsconfig))) throw new Error(`${CONFIG_FILE}: tsconfig가 없습니다: ${tsconfig}`);
  const alias = raw.alias ?? '@/';
  if (typeof alias !== 'string' || !alias.endsWith('/')) throw new Error(`${CONFIG_FILE}: alias는 '/'로 끝나는 import 접두어여야 합니다(예: "@/")`);
  const exceptions = (raw.exceptions ?? []).map((entry, index) => {
    const where = `${CONFIG_FILE}: exceptions[${index}]`;
    if (typeof entry !== 'object' || entry === null) throw new Error(`${where}는 객체여야 합니다`);
    const rule = String(entry.rule ?? '').replace(/^web-kit-structure\//, '');
    if (!RULE_NAMES.includes(rule)) throw new Error(`${where}.rule은 ${RULE_NAMES.join('·')} 중 하나여야 합니다`);
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 5) throw new Error(`${where}.reason에 남겨 둔 이유를 적으세요`);
    return { file: projectRelative(projectRoot, entry.file, `${where}.file`), rule, reason: entry.reason.trim() };
  });
  const config = {
    root: projectRoot,
    path,
    src,
    alias,
    tsconfig,
    routes,
    generated: pathList(projectRoot, raw.generated, 'generated'),
    generatedModels: pathList(projectRoot, raw.generatedModels, 'generatedModels'),
    support: pathList(projectRoot, raw.support, 'support'),
    exceptions,
  };
  configs.set(path, config);
  return config;
}

/** 경로가 접두 폴더 안(또는 그 파일 자체)인지 본다. */
function within(rel, prefix) {
  return rel === prefix || rel.startsWith(prefix + '/');
}

/** 검사 파일(테스트·스펙)은 소스 역할 검사에서 빠진다. 제품 코드가 import하면 지원 코드로 본다. */
export function isTestFile(rel) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(rel) || rel.split('/').includes('__tests__');
}

/**
 * 파일 하나의 구조 역할. 반환 kind:
 * external(프로젝트 src 밖·패키지) · entry(src 바로 아래 파일) · unknown(정해지지 않은 폴더) · generated · generated-model ·
 * support · test · app · runtime · routes · shared · feature(layer: api|model|state|flows|screens|i18n|public|invalid)
 */
export function classify(config, file) {
  const rel = posix(relative(config.root, file));
  if (rel.startsWith('../') || isAbsolute(rel) || rel.split('/').includes('node_modules')) return { kind: 'external', rel };
  if (config.generatedModels.some((prefix) => within(rel, prefix))) return { kind: 'generated-model', rel };
  if (config.generated.some((prefix) => within(rel, prefix))) return { kind: 'generated', rel };
  if (config.support.some((prefix) => within(rel, prefix))) return { kind: 'support', rel };
  if (!within(rel, config.src)) return { kind: 'external', rel };
  if (isTestFile(rel)) return { kind: 'test', rel };
  if (within(rel, config.routes)) return { kind: 'routes', rel };
  const parts = rel.slice(config.src.length + 1).split('/');
  if (parts.length === 1) return { kind: 'entry', rel };
  const [top, name, layer] = parts;
  if (top === 'features') {
    if (parts.length === 2) return { kind: 'feature', layer: 'invalid', feature: undefined, rel };
    if (parts.length === 3) return { kind: 'feature', layer: FEATURE_ROOT_FILES[layer] ?? 'invalid', feature: name, rel };
    return { kind: 'feature', layer: FEATURE_LAYERS.includes(layer) ? layer : 'invalid', feature: name, rel };
  }
  if (APP_ROOTS.includes(top)) return { kind: top, rel };
  // 생성 코드의 부모 폴더(예: src/api)는 생성 코드만 담는다. 그 밖 파일은 정해지지 않은 자리다.
  return { kind: 'unknown', rel };
}

/** 사람이 읽는 역할 이름. 위반 문구에 쓴다. */
export function roleName(role) {
  if (role.kind === 'feature') return role.layer === 'public' || role.layer === 'i18n' ? `features/${role.feature}/${role.layer}.ts` : `features/${role.feature ?? '?'}/${role.layer}`;
  return role.kind;
}

/** 예외 목록에 같은 파일·규칙이 있는지 본다. */
export function findException(config, rel, rule) {
  return config.exceptions.find((entry) => entry.file === rel && entry.rule === rule);
}
