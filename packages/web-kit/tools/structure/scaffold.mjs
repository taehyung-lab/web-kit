// 파일 책임: 새 화면의 구조 골격(api·model·state·flows·screens·route)을 web-kit-structure 자리에 만든다.
// 완료처럼 보이는 것을 만들지 않는다: 서버 endpoint·필드·화면 배치·저장 뒤 목적지는 선언되지 않은 TODO_web_kit_new_* 이름으로 남겨
// 채우기 전에는 typecheck가 실패한다. 성공을 지어낸 API, 건너뛴 검사, 통과용 검사 파일은 만들지 않는다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadStructureConfig, VAGUE_NAMES } from './config.mjs';
import { TODO_MARKER } from './markers.mjs';

const KINDS = ['list', 'form', 'detail'];

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
  return { file, id, mode: kind === 'form' ? (last === 'edit' ? 'edit' : 'create') : kind, param: params.at(-1) };
}

/** 화면 종류별 파일 목록. shared는 같은 feature의 다른 화면과 함께 쓰는 파일이라 이미 있으면 그대로 둔다. */
function plan({ config, feature, entity, kind, url, group }) {
  const A = config.alias;
  const F = `${config.src}/features/${feature}`;
  const E = pascal(entity);
  const e = camel(entity);
  const route = routeOf(kind, url, group);
  const id = route.param ?? 'id';
  const head = (text) => `// 파일 책임: ${text} web-kit-new가 만든 골격이다.\n`;
  const model = {
    path: `${F}/model/${entity}.ts`, shared: true, content: `${head(`${E} 화면이 쓰는 앱 모델(서버 DTO와 분리).`)}
/** TODO(web-kit-new): 서버 명세에서 화면이 쓰는 값만 옮긴다. 채우기 전에는 typecheck가 실패한다. */
export interface ${E} {
  readonly id: string;
  readonly fields: ${TODO_MARKER}model_fields;
}
` };
  const detailQuery = {
    path: `${F}/api/${entity}-detail-query.ts`, shared: true, content: `${head(`${E} 단건 조회 query 정의.`)}import { queryOptions } from '@tanstack/react-query';
import type { ${E} } from '../model/${entity}';

/** 상세·수정 원본이 같은 query(같은 캐시)를 쓴다. */
export function ${e}DetailQuery(id: string) {
  return queryOptions({
    queryKey: ['${feature}', 'detail', id] as const,
    // TODO(web-kit-new): 생성 endpoint를 호출하고 DTO를 앱 모델로 바꾼다. 응답을 지어내지 않는다. 채우기 전에는 typecheck가 실패한다.
    queryFn: ({ signal }): Promise<${E}> => ${TODO_MARKER}detail_endpoint(id, signal),
  });
}
` };
  const form = {
    path: `${F}/model/forms/${entity}-form.ts`, shared: true, content: `${head(`${E} 폼의 값 모양·검증(순수).`)}import { z } from 'zod';

// TODO(web-kit-new): 서버 명세의 필드·제약을 옮긴다(필수 표시도 이 schema가 정한다). 채우기 전에는 typecheck가 실패한다.
export const ${e}FormSchema = z.object(${TODO_MARKER}form_fields);
export type ${E}FormInput = z.input<typeof ${e}FormSchema>;
export type ${E}FormOutput = z.output<typeof ${e}FormSchema>;
` };
  const files = [];
  const routeHead = (text) => `${head(text)}import { createFileRoute } from '@tanstack/react-router';\n`;
  if (route.mode === 'list') {
    files.push(model, {
      path: `${F}/api/${entity}-list-query.ts`, content: `${head(`${E} 목록 조회 query 정의(요청·응답 변환).`)}import type { ListPage } from '@boosterlab/web-kit/list';
import { queryOptions } from '@tanstack/react-query';
import type { ${E} } from '../model/${entity}';

/** 목록 요청(서버 계약). TODO(web-kit-new): 서버 명세의 요청 이름·형식으로 바꾼다. */
export interface ${E}ListParams {
  readonly page: number;
}

export function ${e}ListQuery(params: ${E}ListParams) {
  return queryOptions({
    queryKey: ['${feature}', 'list', params] as const,
    // TODO(web-kit-new): 생성 endpoint를 호출하고 응답을 { rows, total }로 바꾼다. 응답을 지어내지 않는다. 채우기 전에는 typecheck가 실패한다.
    queryFn: ({ signal }): Promise<ListPage<${E}>> => ${TODO_MARKER}list_endpoint(params, signal),
  });
}
` }, {
      path: `${F}/state/${entity}-list-search.ts`, content: `${head(`${E} 목록 URL 검색 선언과 확정 검색 → 요청 변환.`)}import { defineSearch, type FullSearch } from '@boosterlab/web-kit/search';
import { z } from 'zod';
import type { ${E}ListParams } from '../api/${entity}-list-query';

// TODO(web-kit-new): 제품이 정한 검색 필드·기본값·검색을 눌러야 조회(gated) 여부를 더한다(web-kit-list 스킬).
export const ${e}ListSearch = defineSearch({
  fields: {
    page: { schema: z.number().int().min(1), default: 1 },
  },
});

export type ${E}ListSearch = FullSearch<typeof ${e}ListSearch.fields>;

/** 확정 검색 → 서버 요청. */
export function to${E}ListParams(search: ${E}ListSearch): ${E}ListParams {
  return { page: search.page - 1 };
}
` }, {
      path: `${F}/flows/use-${entity}-list.ts`, content: `${head(`${E} 목록 흐름. URL 검색·조회를 조립하고 화면이 쓸 목록 상태를 돌려준다.`)}import { useList } from '@boosterlab/web-kit/list';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { ${e}ListQuery } from '../api/${entity}-list-query';
import { ${e}ListSearch, to${E}ListParams } from '../state/${entity}-list-search';

/** search·navigate는 route가 URL에서 읽어 넘긴다. */
export function use${E}List({
  search,
  navigate,
}: {
  readonly search: UrlSearch;
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
}) {
  const list = useList({
    definition: ${e}ListSearch,
    search,
    navigate,
    progress: 'page',
    query: (full) => ${e}ListQuery(to${E}ListParams(full)),
    rowId: (row) => row.id,
  });
  return { list };
}
` }, {
      path: `${F}/screens/${E}ListScreen.tsx`, content: `${head(`${E} 목록 화면. 목록 상태는 목록 flow가 조립한다.`)}import type { UrlSearch } from '@boosterlab/web-kit/search';
import { use${E}List } from '../flows/use-${entity}-list';

export function ${E}ListScreen({
  search,
  navigate,
}: {
  readonly search: UrlSearch;
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
}) {
  const { list } = use${E}List({ search, navigate });
  // TODO(web-kit-new): 제목·필터·결과 표·페이지 이동을 registry list로 배치한다(web-kit-list 「registry 표시」). 채우기 전에는 typecheck가 실패한다.
  return <${TODO_MARKER}list_layout list={list} />;
}
` }, {
      path: `${config.routes}/${group}/${route.file}`, content: `${routeHead(`${url} 목록 경로. URL 검색을 검증하고 화면에 넘긴다.`)}import { ${E}ListScreen } from '${A}features/${feature}/screens/${E}ListScreen';
import { ${e}ListSearch } from '${A}features/${feature}/state/${entity}-list-search';

export const Route = createFileRoute('${route.id}')({
  validateSearch: ${e}ListSearch.validateSearch,
  beforeLoad: ${e}ListSearch.beforeLoad,
  component: ${E}ListRoute,
});

function ${E}ListRoute() {
  const navigate = Route.useNavigate();
  return <${E}ListScreen search={Route.useSearch()} navigate={(next, { replace }) => void navigate({ search: next, replace })} />;
}
` });
  } else if (route.mode === 'detail') {
    files.push(model, detailQuery, {
      path: `${F}/flows/use-${entity}-detail.ts`, content: `${head(`${E} 상세 흐름. 단건 상태 판정(useRecord)을 이 한 곳에서 한다.`)}import { useRecord } from '@boosterlab/web-kit/record';
import { ${e}DetailQuery } from '../api/${entity}-detail-query';

export function use${E}Detail(${id}: string) {
  return useRecord(${e}DetailQuery(${id}), ${id}, { progress: 'page' });
}
` }, {
      path: `${F}/screens/${E}DetailScreen.tsx`, content: `${head(`${E} 상세 화면. 단건 상태는 상세 flow가 판정한다.`)}import { use${E}Detail } from '../flows/use-${entity}-detail';

export function ${E}DetailScreen({ ${id} }: { readonly ${id}: string }) {
  const state = use${E}Detail(${id});
  // TODO(web-kit-new): registry record의 Detail로 대기·없음·실패·내용을 그린다(web-kit-record). 채우기 전에는 typecheck가 실패한다.
  return <${TODO_MARKER}detail_layout state={state} />;
}
` }, {
      path: `${config.routes}/${group}/${route.file}`, content: `${routeHead(`${url} 상세 경로. URL의 식별자만 화면에 넘긴다.`)}import { ${E}DetailScreen } from '${A}features/${feature}/screens/${E}DetailScreen';

export const Route = createFileRoute('${route.id}')({
  component: ${E}DetailRoute,
});

function ${E}DetailRoute() {
  const { ${id} } = Route.useParams();
  return <${E}DetailScreen ${id}={${id}} />;
}
` });
  } else if (route.mode === 'create') {
    files.push(form, {
      path: `${F}/api/${entity}-create.ts`, content: `${head(`${E} 등록 요청.`)}import { useMutation } from '@tanstack/react-query';
import type { ${E}FormOutput } from '../model/forms/${entity}-form';

export function useCreate${E}() {
  return useMutation({
    // TODO(web-kit-new): 폼 결과를 서버 요청으로 바꿔 생성 endpoint를 호출하고 새 대상의 id를 돌려준다. 무효화할 목록 key는 meta.invalidates로 선언한다(web-kit-http). 채우기 전에는 typecheck가 실패한다.
    mutationFn: (output: ${E}FormOutput): Promise<{ readonly id: string }> => ${TODO_MARKER}create_endpoint(output),
  });
}
` }, {
      path: `${F}/flows/use-${entity}-create.ts`, content: `${head(`${E} 등록 흐름. 저장은 요청 결과를 돌려주고, 완료(onSaved)에서 다음 화면으로 간다.`)}import { useSaveForm } from '@boosterlab/web-kit/form';
import { useCreate${E} } from '../api/${entity}-create';
import { ${e}FormSchema, type ${E}FormInput, type ${E}FormOutput } from '../model/forms/${entity}-form';

// TODO(web-kit-new): 등록 화면의 첫 값을 제품 결정대로 정해 model/forms에 둔다. 채우기 전에는 typecheck가 실패한다.
const SOURCE: { readonly id: string; readonly values: ${E}FormInput } = { id: 'new', values: ${TODO_MARKER}form_empty_values };

export function use${E}Create() {
  const create = useCreate${E}();
  const editor = useSaveForm({
    schema: ${e}FormSchema,
    source: SOURCE,
    progress: 'create',
    save: (output: ${E}FormOutput) => create.mutateAsync(output),
    // TODO(web-kit-new): 저장 뒤 갈 곳(제품 결정)으로 이동한다(useNavigate). 저장(save)과 완료(onSaved)를 섞지 않는다. 채우기 전에는 typecheck가 실패한다.
    onSaved: ${TODO_MARKER}after_save,
  });
  return { editor };
}
` }, {
      path: `${F}/screens/${E}CreateScreen.tsx`, content: `${head(`${E} 등록 화면. 저장 흐름은 등록 flow가 맡는다.`)}import { use${E}Create } from '../flows/use-${entity}-create';

export function ${E}CreateScreen() {
  const { editor } = use${E}Create();
  // TODO(web-kit-new): registry form/form의 Form·칸으로 필드를 배치한다(web-kit-form). 채우기 전에는 typecheck가 실패한다.
  return <${TODO_MARKER}form_layout editor={editor} />;
}
` }, {
      path: `${config.routes}/${group}/${route.file}`, content: `${routeHead(`${url} 등록 경로.`)}import { ${E}CreateScreen } from '${A}features/${feature}/screens/${E}CreateScreen';

export const Route = createFileRoute('${route.id}')({
  component: ${E}CreateScreen,
});
` });
  } else {
    files.push(model, detailQuery, form, {
      path: `${F}/api/${entity}-update.ts`, content: `${head(`${E} 수정 요청.`)}import { useMutation } from '@tanstack/react-query';
import type { ${E}FormOutput } from '../model/forms/${entity}-form';

export function useUpdate${E}(id: string) {
  return useMutation({
    // TODO(web-kit-new): 폼 결과를 서버 요청으로 바꿔 수정 endpoint를 호출한다. 무효화할 key는 meta.invalidates로 선언한다(web-kit-http). 채우기 전에는 typecheck가 실패한다.
    mutationFn: (output: ${E}FormOutput): Promise<void> => ${TODO_MARKER}update_endpoint(id, output),
  });
}
` }, {
      path: `${F}/flows/use-${entity}-edit.ts`, content: `${head(`${E} 수정 흐름. 원본 단건 상태와, 준비된 원본으로 만든 저장 폼을 나눠 돌려준다.`)}import { useSaveForm } from '@boosterlab/web-kit/form';
import { useRecord } from '@boosterlab/web-kit/record';
import { ${e}DetailQuery } from '../api/${entity}-detail-query';
import { useUpdate${E} } from '../api/${entity}-update';
import { ${e}FormSchema, type ${E}FormOutput } from '../model/forms/${entity}-form';
import type { ${E} } from '../model/${entity}';

/** 수정 원본의 단건 상태. */
export function use${E}EditSource(${id}: string) {
  return useRecord(${e}DetailQuery(${id}), ${id}, { progress: 'page' });
}

/** 준비된 원본의 수정 폼. */
export function use${E}Edit(record: ${E}) {
  const update = useUpdate${E}(record.id);
  const editor = useSaveForm({
    schema: ${e}FormSchema,
    // TODO(web-kit-new): 원본 → 폼 값 변환을 model/forms에 두고 여기서 쓴다. 채우기 전에는 typecheck가 실패한다.
    source: { id: record.id, values: ${TODO_MARKER}form_values(record) },
    progress: 'edit',
    save: async (output: ${E}FormOutput) => {
      await update.mutateAsync(output);
    },
    // TODO(web-kit-new): 저장 뒤 갈 곳(제품 결정)으로 이동한다. 채우기 전에는 typecheck가 실패한다.
    onSaved: ${TODO_MARKER}after_save,
  });
  return { editor };
}
` }, {
      path: `${F}/screens/${E}EditScreen.tsx`, content: `${head(`${E} 수정 화면. 원본 조회·저장은 수정 flow가 맡는다.`)}import { use${E}Edit, use${E}EditSource } from '../flows/use-${entity}-edit';
import type { ${E} } from '../model/${entity}';

export function ${E}EditScreen({ ${id} }: { readonly ${id}: string }) {
  const state = use${E}EditSource(${id});
  // TODO(web-kit-new): registry record의 Detail로 원본 상태를 그리고 준비되면 수정 폼을 그린다(web-kit-record·web-kit-form). 채우기 전에는 typecheck가 실패한다.
  return <${TODO_MARKER}edit_layout state={state} renderForm={(record: ${E}) => <${E}EditForm record={record} />} />;
}

function ${E}EditForm({ record }: { readonly record: ${E} }) {
  const { editor } = use${E}Edit(record);
  // TODO(web-kit-new): registry form/form의 Form·칸으로 필드를 배치한다(web-kit-form). 채우기 전에는 typecheck가 실패한다.
  return <${TODO_MARKER}form_layout editor={editor} />;
}
` }, {
      path: `${config.routes}/${group}/${route.file}`, content: `${routeHead(`${url} 수정 경로. URL의 식별자만 화면에 넘긴다.`)}import { ${E}EditScreen } from '${A}features/${feature}/screens/${E}EditScreen';

export const Route = createFileRoute('${route.id}')({
  component: ${E}EditRoute,
});

function ${E}EditRoute() {
  const { ${id} } = Route.useParams();
  return <${E}EditScreen ${id}={${id}} />;
}
` });
  }
  return files;
}

/**
 * 골격을 만든다. 같은 내용의 파일은 그대로 두고(다시 실행해도 같다), 다른 내용의 화면 파일이 있으면 아무것도 쓰지 않고 실패한다.
 * 반환: { created, reused, unchanged, conflicts, markers, dryRun }
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
  const files = plan({ config, feature, entity: name, kind, url, group });
  const result = { created: [], reused: [], unchanged: [], conflicts: [], markers: 0, dryRun };
  for (const file of files) {
    const full = join(config.root, file.path);
    if (!existsSync(full)) { result.created.push(file); result.markers += file.content.split(TODO_MARKER).length - 1; continue; }
    if (readFileSync(full, 'utf8') === file.content) { result.unchanged.push(file); result.markers += file.content.split(TODO_MARKER).length - 1; }
    else if (file.shared) result.reused.push(file);
    else result.conflicts.push(file);
  }
  if (result.conflicts.length > 0 || dryRun) return result;
  for (const file of result.created) {
    mkdirSync(dirname(join(config.root, file.path)), { recursive: true });
    writeFileSync(join(config.root, file.path), file.content, { flag: 'wx' });
  }
  return result;
}

/** 생성 결과를 읽는 줄로 만든다. 생성 수를 완료 수로 읽지 않도록 함께 적는다. */
export function formatScaffold(result, { feature, kind, url }) {
  const lines = [`web-kit-new ${feature} ${kind} ${url}${result.dryRun ? ' (--dry-run: 파일을 쓰지 않음)' : ''}`];
  for (const file of result.created) lines.push(`  ${result.dryRun ? '만들 파일' : '만듦'} ${file.path}`);
  for (const file of result.reused) lines.push(`  기존 파일 사용 ${file.path} (같은 feature의 공유 파일이라 덮어쓰지 않음)`);
  for (const file of result.unchanged) lines.push(`  변경 없음 ${file.path}`);
  for (const file of result.conflicts) lines.push(`  충돌 ${file.path}: 내용이 다른 파일이 이미 있어 아무 파일도 쓰지 않았다`);
  if (result.conflicts.length > 0) return lines.join('\n');
  lines.push(`이 화면 골격에 남은 미완성 표시 ${result.markers}곳(${TODO_MARKER}…, 공유 파일 중 이미 고친 것은 세지 않음): 선언되지 않은 이름이라 채우기 전에는 typecheck가 실패한다.`);
  lines.push('생성한 파일 수는 완료한 화면 수가 아니다. 검사 파일은 만들지 않았다: 화면 행동·서버 요청을 확인하는 제품 검사를 직접 작성하고 따로 집계한다.');
  lines.push(`직접 연결할 것: 문구(features/${feature}/i18n.ts와 app의 문구 등록), 메뉴, route 트리 재생성(vite dev·build).`);
  return lines.join('\n');
}
