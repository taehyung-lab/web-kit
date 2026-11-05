// 파일 책임: web-kit 구조 계약을 ESLint 규칙으로 판정한다. 어느 역할이 어느 역할·패키지·전역을 쓸 수 있는지만 본다.
// 판정 근거는 실제로 해소한 import 대상(별칭·상대 경로·재export·동적 import 포함)이다. 업무 의미가 맞는지는 판정하지 않는다.
import { posix, classify, findException, isTestFile, loadStructureConfig, roleName, VAGUE_NAMES } from './config.mjs';
import { importOrigins, resolveImport } from './resolve.mjs';
import { basename, dirname } from 'node:path';

const PLUGIN = 'web-kit-structure';

/** 역할별 금지 대상. all: 타입 import까지 금지(구조를 알면 안 됨), value: 실행 import만 금지(타입은 허용). */
const LAYER_BANS = {
  shared: { all: ['app', 'runtime', 'routes', 'generated', 'generated-model', 'feature'] },
  runtime: { all: ['app', 'routes', 'feature'] },
  routes: { value: ['runtime', 'generated', 'feature:api', 'feature:flows'] },
  feature: { all: ['app', 'routes'] },
  'feature:api': { all: ['feature:state', 'feature:flows', 'feature:screens'] },
  'feature:model': { all: ['feature:flows', 'feature:screens'], value: ['runtime', 'generated', 'feature:api', 'feature:state'] },
  'feature:state': { all: ['feature:flows', 'feature:screens'] },
  'feature:flows': { all: ['feature:screens'] },
  'feature:screens': { value: ['runtime', 'generated', 'generated-model', 'feature:api', 'feature:state'] },
};

/** 금지 이유. 위반 문구에 붙여 고칠 자리를 알려 준다. */
const LAYER_REASONS = {
  shared: 'shared는 도메인·앱 연결을 모르는 공용 코드다',
  runtime: 'runtime(설정된 http·세션·QueryClient)은 feature·화면·앱 조립을 모른다. 필요하면 app이 연결한다',
  routes: 'route는 URL·진입 조건·문맥만 넘긴다. 요청·업무 흐름은 feature의 flows가 실행한다',
  feature: 'feature는 앱 조립(app)·route를 모른다. 실행 기반은 runtime에서 가져온다',
  'feature:api': 'api는 요청·DTO·query 정의만 둔다. 상태·흐름·화면을 모른다',
  'feature:model': 'model(forms·rules)은 순수하다. 요청·실행 기반·상태 저장·흐름·화면에 의존하지 않는다',
  'feature:state': 'state는 화면과 흐름을 모른다',
  'feature:flows': 'flows는 화면이 쓸 상태·동작만 돌려주고 화면 부품을 모른다',
  'feature:screens': '화면은 flow를 호출하고 그린다. 요청·생성 코드·실행 기반·상태 쓰기는 flows로 옮긴다',
  support: '제품 코드는 mock·검사 도우미(support)를 import하지 않는다',
};

const RUNTIME_KIT = ['@boosterlab/web-kit/http', '@boosterlab/web-kit/session', '@boosterlab/web-kit/session/browser', '@boosterlab/web-kit/session/idle', '@boosterlab/web-kit/session/activity', '@boosterlab/web-kit/query'];
const REACT_FAMILY = ['react', 'react-dom', 'react-i18next', '@tanstack/react-query', '@tanstack/react-router', '@tanstack/react-form', 'axios'];

/** 역할별 패키지 금지. all: 타입 포함, value: 실행 import, names: 특정 실행 이름. */
const PACKAGE_BANS = {
  'feature:model': { value: [...REACT_FAMILY, ...RUNTIME_KIT], reason: 'model은 React·라우터·요청·세션 실행에 의존하지 않는 순수 코드다' },
  'feature:api': { value: ['@tanstack/react-router'], reason: 'api는 화면 이동을 하지 않는다. 이동은 flows가 정한다' },
  'feature:screens': {
    all: ['zod'],
    value: ['axios', '@tanstack/react-query', ...RUNTIME_KIT, '@boosterlab/web-kit/api'],
    names: {
      '@boosterlab/web-kit/form': ['useSaveForm'],
      '@boosterlab/web-kit/list': ['useList'],
      '@boosterlab/web-kit/record': ['useRecord'],
      '@boosterlab/web-kit/auth': ['useAuthChallenge'],
      '@tanstack/react-router': ['useNavigate', 'useRouter', 'redirect'],
    },
    reason: '화면은 UI binding만 쓴다. 저장·목록·단건·인증 수명 조립, 요청, 업무 결과에 따른 이동은 flows에 두고 schema는 model에 둔다',
  },
};

const BROWSER_GLOBALS = new Set(['localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'navigator', 'location', 'history', 'window', 'document', 'globalThis']);
const NO_JSX = new Set(['api', 'model', 'state', 'flows']);
const RAW_ELEMENTS = { button: 'Button', input: 'Input', select: 'Select', textarea: 'Textarea' };
const ROUTE_FILES = new Set(['__root', 'route', 'index', 'new', 'edit', '$']);

/** ESLint 설정(settings)에서 프로젝트 구조 설정을 꺼낸다. */
function settingsOf(context) {
  const settings = context.settings?.[PLUGIN];
  if (!settings?.root) throw new Error(`${PLUGIN}: settings.${PLUGIN}.root가 없습니다. webKitStructure({ root })로 설정하세요.`);
  return { config: loadStructureConfig(settings.root, settings.configFile), applyExceptions: settings.applyExceptions !== false };
}

/** 이 파일의 역할과 보고 함수. 예외 목록에 있는 파일·규칙이면 보고하지 않는다. */
function setup(context, rule) {
  const { config, applyExceptions } = settingsOf(context);
  const file = context.physicalFilename ?? context.filename;
  const role = classify(config, file);
  const excepted = applyExceptions && findException(config, role.rel, rule) !== undefined;
  const report = (descriptor) => { if (!excepted) context.report(descriptor); };
  return { config, file, role, report };
}

/** 역할 키 목록: feature는 공통 키와 층 키를 함께 쓴다. */
function roleKeys(role) {
  return role.kind === 'feature' ? ['feature', `feature:${role.layer}`] : [role.kind];
}

/** 대상 역할이 금지 목록과 맞는지 본다. 'feature'는 모든 feature 층과 맞는다. */
function matches(list, target) {
  if (!list) return false;
  if (target.kind === 'feature') return list.includes('feature') || list.includes(`feature:${target.layer}`);
  return list.includes(target.kind);
}

/** 이 파일이 제품 코드로 검사받는 역할인지. */
function checked(role) {
  return ['app', 'runtime', 'routes', 'shared', 'feature'].includes(role.kind) && !(role.kind === 'feature' && role.layer === 'invalid');
}

/** import·export from·동적 import·require 하나의 정보: 문자열, 타입 전용 여부, 가져온 이름. */
function importsOf(node) {
  if (node.type === 'ImportDeclaration') {
    const all = new Set();
    const values = new Set();
    for (const specifier of node.specifiers) {
      const name = specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.type === 'ImportNamespaceSpecifier' ? '*' : specifier.imported.name ?? specifier.imported.value;
      all.add(name);
      if (node.importKind !== 'type' && specifier.importKind !== 'type') values.add(name);
    }
    // 부수효과 import(`import './x'`)는 모듈 전체를 실행한다.
    if (node.specifiers.length === 0) { all.add('*'); values.add('*'); }
    return { source: node.source.value, all, values };
  }
  if (node.type === 'ExportNamedDeclaration' && node.source) {
    const all = new Set(node.specifiers.map((s) => s.local.name ?? s.local.value));
    const values = node.exportKind === 'type' ? new Set() : new Set(node.specifiers.filter((s) => s.exportKind !== 'type').map((s) => s.local.name ?? s.local.value));
    return { source: node.source.value, all, values };
  }
  if (node.type === 'ExportAllDeclaration') return { source: node.source.value, all: new Set(['*']), values: node.exportKind === 'type' ? new Set() : new Set(['*']) };
  if (node.type === 'ImportExpression' && node.source.type === 'Literal' && typeof node.source.value === 'string') return { source: node.source.value, all: new Set(['*']), values: new Set(['*']) };
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require' && node.arguments[0]?.type === 'Literal' && typeof node.arguments[0].value === 'string')
    return { source: node.arguments[0].value, all: new Set(['*']), values: new Set(['*']) };
  return undefined;
}

/** 이름 집합을 출처 계산용으로 바꾼다('*'가 있으면 모듈 전체). */
function nameSet(names) {
  return names.has('*') ? '*' : names;
}

/** 모든 import 형태에 같은 처리를 붙인다. */
function onImports(handler) {
  const visit = (node) => { const info = importsOf(node); if (info) handler(node, info); };
  return { ImportDeclaration: visit, ExportNamedDeclaration: visit, ExportAllDeclaration: visit, ImportExpression: visit, CallExpression: visit };
}

const layerImport = {
  meta: { type: 'problem', schema: [], docs: { description: '구조 역할 사이 import 방향(실제 해소한 대상과 재export의 출처 기준)' } },
  create(context) {
    const { config, file, role, report } = setup(context, 'layer-import');
    if (!checked(role)) return {};
    const keys = roleKeys(role);
    return onImports((node, info) => {
      const target = resolveImport(config, file, info.source);
      if (target.kind !== 'file') return;
      const seen = new Set();
      /** 금지 대상이 하나라도 출처에 있으면 보고한다. */
      const inspect = (names, kind) => {
        if (names.size === 0) return;
        for (const origin of importOrigins(config, target.path, nameSet(names))) {
          const targetRole = classify(config, origin);
          if (seen.has(origin)) continue;
          if (targetRole.kind === 'support') {
            if (kind === 'value') { seen.add(origin); report({ node, message: `${roleName(role)} → ${posix(targetRole.rel)}: ${LAYER_REASONS.support}.` }); }
            continue;
          }
          const key = keys.find((k) => matches(LAYER_BANS[k]?.all, targetRole) || (kind === 'value' && matches(LAYER_BANS[k]?.value, targetRole)));
          if (!key) continue;
          seen.add(origin);
          const via = origin === target.path ? '' : ` (${posix(classify(config, target.path).rel)}를 거쳐)`;
          report({ node, message: `${roleName(role)} → ${roleName(targetRole)}${via}: ${LAYER_REASONS[key]}. 대상 ${targetRole.rel}` });
        }
      };
      inspect(info.values, 'value');
      inspect(new Set([...info.all].filter((name) => !info.values.has(name))), 'type');
    });
  },
};

const featurePublic = {
  meta: { type: 'problem', schema: [], docs: { description: '다른 feature는 public.ts로만 쓴다' } },
  create(context) {
    const { config, file, role, report } = setup(context, 'feature-public');
    if (role.kind !== 'feature' || role.layer === 'invalid') return {};
    return onImports((node, info) => {
      const target = resolveImport(config, file, info.source);
      if (target.kind !== 'file') return;
      const targetRole = classify(config, target.path);
      if (targetRole.kind !== 'feature' || targetRole.feature === role.feature || targetRole.layer === 'public') return;
      report({ node, message: `features/${role.feature} → ${targetRole.rel}: 다른 feature의 내부 파일을 쓰지 않는다. features/${targetRole.feature}/public.ts에 공개할 연결만 내고 그것을 import한다.` });
    });
  },
};

const packageImport = {
  meta: { type: 'problem', schema: [], docs: { description: '역할별 패키지·키트 실행 입구 금지' } },
  create(context) {
    const { config, file, role, report } = setup(context, 'package-import');
    if (!checked(role)) return {};
    const bans = roleKeys(role).map((key) => PACKAGE_BANS[key]).filter(Boolean);
    if (bans.length === 0) return {};
    const hit = (list, specifier) => list?.some((name) => specifier === name || specifier.startsWith(name + '/'));
    return onImports((node, info) => {
      if (resolveImport(config, file, info.source).kind !== 'package') return;
      for (const ban of bans) {
        const named = ban.names?.[info.source]?.filter((name) => info.values.has(name)) ?? [];
        if (hit(ban.all, info.source) || (info.values.size > 0 && hit(ban.value, info.source)) || named.length > 0)
          report({ node, message: `${roleName(role)}에서 ${info.source}${named.length ? `의 ${named.join('·')}` : ''}를 쓰지 않는다: ${ban.reason}.` });
      }
    });
  },
};

const browserGlobal = {
  meta: { type: 'problem', schema: [], docs: { description: 'model의 브라우저 저장소·네트워크·이동 전역 사용 금지' } },
  create(context) {
    const { role, report } = setup(context, 'browser-global');
    if (role.kind !== 'feature' || role.layer !== 'model') return {};
    return {
      'Program:exit'(node) {
        const scope = context.sourceCode.getScope(node);
        for (const reference of scope.through) {
          const name = reference.identifier.name;
          if (BROWSER_GLOBALS.has(name)) report({ node: reference.identifier, message: `model에서 ${name}을(를) 쓰지 않는다: 저장은 state, 요청은 api, 이동은 flows가 맡는다.` });
        }
      },
    };
  },
};

const noJsx = {
  meta: { type: 'problem', schema: [], docs: { description: 'api·model·state·flows는 JSX를 만들지 않는다' } },
  create(context) {
    const { role, report } = setup(context, 'no-jsx');
    if (role.kind !== 'feature' || !NO_JSX.has(role.layer)) return {};
    const visit = (node) => report({ node, message: `${roleName(role)}는 JSX를 만들지 않는다. 그리는 일은 screens가 맡는다.` });
    return { JSXElement: (node) => { if (node.parent?.type !== 'JSXElement' && node.parent?.type !== 'JSXFragment') visit(node); }, JSXFragment: (node) => { if (node.parent?.type !== 'JSXElement' && node.parent?.type !== 'JSXFragment') visit(node); } };
  },
};

const rawElement = {
  meta: { type: 'problem', schema: [], docs: { description: '화면 코드의 맨 HTML 입력·버튼 금지' } },
  create(context) {
    const { role, report } = setup(context, 'raw-element');
    if (!['app', 'routes', 'feature'].includes(role.kind)) return {};
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || !(node.name.name in RAW_ELEMENTS)) return;
        report({ node, message: `<${node.name.name}> 대신 설치한 UI 부품 ${RAW_ELEMENTS[node.name.name]}(shared/ui)를 쓴다(폼 안이면 Form 칸, 목록 필터면 List 칸). 맨 요소는 테마·포커스·키트 잠금 규칙을 건너뛴다.` });
      },
    };
  },
};

const fileLayout = {
  meta: { type: 'problem', schema: [], docs: { description: '정해진 자리·파일 이름' } },
  create(context) {
    const { config, role, report } = setup(context, 'file-layout');
    return {
      Program(node) {
        const rel = role.rel;
        if (role.kind === 'external' || role.kind === 'generated' || role.kind === 'generated-model') return;
        const segments = rel.split('/');
        const vague = segments.find((segment, index) => VAGUE_NAMES.includes(index === segments.length - 1 ? segment.replace(/(?:\.(?:test|spec))?\.[^.]+$/, '') : segment));
        if (vague) report({ node, message: `${rel}: '${vague}' 같은 포괄 이름은 쓰지 않는다. 의미·소유자로 이름을 짓는다(예: rules/<업무>-policy.ts, forms/<폼>-form.ts).` });
        if (role.kind === 'unknown') report({ node, message: `${rel}: src 아래 정해진 자리(app·runtime·routes·features·shared, 생성 코드·지원 폴더)가 아니다.` });
        if (role.kind === 'feature' && role.layer === 'invalid') report({ node, message: `${rel}: feature 안에는 api·model·state·flows·screens 폴더와 i18n.ts·public.ts만 둔다.` });
        if (role.kind === 'routes' || (role.kind === 'test' && (rel === config.routes || rel.startsWith(config.routes + '/')))) {
          const name = basename(rel).replace(/\.[^.]+$/, '');
          if (isTestFile(rel)) report({ node, message: `${rel}: route 폴더에 검사 파일을 두지 않는다. 검사는 feature 옆이나 tests/에 둔다.` });
          else if (!ROUTE_FILES.has(name)) report({ node, message: `${rel}: route 파일 이름은 index(목록·상세·단일 화면)·new(등록)·edit(수정)·route(묶음 골격)·$(골격 안 없는 경로)·__root만 쓴다. URL마다 폴더를 만든다(예: terms/$termsId/index.tsx).` });
          else if (name === 'edit' && !basename(dirname(rel)).startsWith('$')) report({ node, message: `${rel}: 수정 화면은 $<id>/edit.tsx에 둔다.` });
        }
      },
    };
  },
};

const routeLoader = {
  meta: { type: 'problem', schema: [], docs: { description: 'route에 기본 loader를 두지 않는다' } },
  create(context) {
    const { role, report } = setup(context, 'route-loader');
    if (role.kind !== 'routes') return {};
    return {
      Property(node) {
        if (node.computed || node.key.type !== 'Identifier' || node.key.name !== 'loader') return;
        if (node.parent?.type === 'ObjectExpression' && node.parent.parent?.type === 'CallExpression')
          report({ node, message: 'route에 기본 loader를 두지 않는다. 조회 상태 판정은 화면 flow(useRecord·useList)가 한 곳에서 한다. 꼭 필요하면 이유와 함께 예외로 남긴다.' });
      },
    };
  },
};

export const rules = {
  'layer-import': layerImport,
  'feature-public': featurePublic,
  'package-import': packageImport,
  'browser-global': browserGlobal,
  'no-jsx': noJsx,
  'raw-element': rawElement,
  'file-layout': fileLayout,
  'route-loader': routeLoader,
};

export const plugin = { meta: { name: PLUGIN }, rules };
