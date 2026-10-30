// 파일 책임: 루트(core)와 세션 adapter 검사 경로가 끌어오는 파일에 라이브러리 의존(React·axios·TanStack·zod)이 없는지 검사한다.
// 목록을 따로 두지 않고 index.ts에서 import를 따라간다. 순수 규칙인지는 README 정의와 검토가 맡는다.
// 세션 유휴 타이머(`/session/idle`)는 다른 어떤 공개 입구에서도 끌려오지 않는지 본다.
import { expect, it } from 'vitest';
import ts from 'typescript';

/** vitest(Vite)가 제공하는 raw import. 키트에 node 타입 의존성을 더하지 않는다. */
const packageSources = (import.meta as unknown as { glob: (pattern: string, options: object) => Record<string, string> }).glob(
  '../src/**/*.{ts,tsx,mjs}',
  { query: '?raw', import: 'default', eager: true },
);

const registrySources = (import.meta as unknown as { glob: (pattern: string, options: object) => Record<string, string> }).glob(
  '../../ui-registry/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true },
);
const sources = { ...packageSources, ...registrySources };

/** 상대 경로를 실제 소스 파일 key로 푼다. */
function resolve(from: string, specifier: string): string | undefined {
  if (specifier.startsWith('@boosterlab/web-kit')) {
    const entry = specifier.slice('@boosterlab/web-kit'.length);
    const path = exportsMap[entry === '' ? '.' : '.' + entry];
    return path === undefined ? undefined : '../' + path.slice(2);
  }
  const base = new URL(specifier, new URL(from, 'file:///packages/web-kit/tests/')).pathname;
  return [base, base + '.ts', base + '.tsx', base + '.d.ts', base + '/index.ts', base + '/index.d.ts'].map((path) =>
    Object.keys(sources).find((key) => new URL(key, 'file:///packages/web-kit/tests/').pathname === path),
  ).find((key) => key !== undefined);
}

it.each(['../src/index.ts', '../src/session-testing.ts'])('%s는 상대 경로의 소스 파일만 따라가며 import한다', (entry) => {
  const visited = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = sources[file];
    expect(source, file).toBeDefined();
    for (const [, specifier] of source!.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
      expect(specifier, `${file} → ${specifier}`).toMatch(/^\.\.?\//);
      const target = resolve(file, specifier!);
      expect(target, `${file} → ${specifier}`).toBeDefined();
      queue.push(target!);
    }
  }
  expect(visited.size).toBeGreaterThan(1);
});

it.each(['../src/form/index.ts', '../src/form/save-form.ts', '../src/form/navigation.ts', '../src/confirmation.ts', '../src/use-list.ts', '../src/list.ts', '../src/session.ts', '../src/record.ts'])(
  '%s의 동작 경로는 기본 UI를 import하지 않는다',
  (entry) => {
    const queue = [entry];
    const visited = new Set<string>();
    while (queue.length) {
      const file = queue.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      expect(file).not.toMatch(/\/ui\/|\/list-ui\.|\/detail-ui\.|\/form\/ui\./);
      for (const [, specifier] of sources[file]!.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
        if (specifier!.startsWith('.') || specifier!.startsWith('@boosterlab/web-kit')) {
          const target = resolve(file, specifier!);
          expect(target, file + ' → ' + specifier).toBeDefined();
          queue.push(target!);
        }
      }
    }
  },
);

/**
 * 공개 입구(package.json exports) 중 유휴 타이머 자신을 뺀 전부. 유휴 타이머는 그 입구를 직접 import한 앱에만 들어간다(0004 §1):
 * 동작 입구(목록·폼·record)뿐 아니라 화면 부품 입구(list/ui·form/ui·detail/ui·ui·filter)도 끌어오면 쓰지 않는 앱(starter) 결과물에 들어간다.
 * 목록을 손으로 두지 않아 새 입구도 자동으로 검사된다.
 */
const exportsMap = JSON.parse(
  Object.values(
    (import.meta as unknown as { glob: (pattern: string, options: object) => Record<string, string> }).glob('../package.json', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  )[0]!,
).exports as Record<string, string>;
const entriesWithoutIdle = [
  ...new Set(
    Object.entries(exportsMap)
      .filter(([name, path]) => !['./session/idle', './session/activity'].includes(name) && /\.(?:tsx?|mjs)$/.test(path))
      .map(([, path]) => `../${path.slice(2)}`),
  ),
];

it('유휴 타이머 경계 검사 대상에 남은 패키지 입구가 모두 들어 있다', () => {
  expect(entriesWithoutIdle).toEqual(
    expect.arrayContaining([
      '../src/form/index.ts',
      '../src/list.ts',
      '../src/record.ts',
      '../src/search/index.ts',
      '../src/session.ts',
    ]),
  );
  expect(entriesWithoutIdle).not.toContain('../src/session-idle.ts');
});

it.each([...entriesWithoutIdle, '../src/use-list.ts'])(
  '%s는 세션 유휴 타이머를 import하지 않는다',
  (entry) => {
    const queue = [entry];
    const visited = new Set<string>();
    while (queue.length) {
      const file = queue.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      expect(file).not.toMatch(/session-idle|session-activity/);
      for (const [, specifier] of sources[file]!.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
        if (!specifier!.startsWith('.') && !specifier!.startsWith('@boosterlab/web-kit')) continue;
        const target = resolve(file, specifier!);
        expect(target, file + ' → ' + specifier).toBeDefined();
        queue.push(target!);
      }
    }
  },
);

/** 목록·폼·상세·기본 UI는 권한 판정과 결합하지 않는다(0005·0006). 권한 결과는 프로젝트가 연결한다. */
it.each([
  '../src/form/index.ts',
  '../../ui-registry/src/form/ui.tsx',
  '../src/use-list.ts',
  '../src/list.ts',
  '../../ui-registry/src/list-ui.tsx',
  '../src/record.ts',
  '../../ui-registry/src/detail-ui.tsx',
  '../../ui-registry/src/ui/index.ts',
  '../src/search/index.ts',
])(
  '%s는 권한을 import하지 않는다',
  (entry) => {
    const queue = [entry];
    const visited = new Set<string>();
    while (queue.length) {
      const file = queue.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      expect(file).not.toMatch(/permission/);
      for (const [, specifier] of sources[file]!.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
        if (!specifier!.startsWith('.') && !specifier!.startsWith('@boosterlab/web-kit')) continue;
        const target = resolve(file, specifier!);
        expect(target, file + ' → ' + specifier).toBeDefined();
        queue.push(target!);
      }
    }
  },
);

/** 진입 파일에서 상대 import를 따라 닿는 소스 파일 전부. */
function reach(entry: string): Set<string> {
  const queue = [entry];
  const visited = new Set<string>();
  while (queue.length) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    for (const [, specifier] of sources[file]!.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
      if (!specifier!.startsWith('.') && !specifier!.startsWith('@boosterlab/web-kit')) continue;
      queue.push(resolve(file, specifier!)!);
    }
  }
  return visited;
}

it.each(['../src/form/index.ts', '../../ui-registry/src/form/ui.tsx'])('%s는 목록(list·search)을 import하지 않는다', (entry) => {
  for (const file of reach(entry)) expect(file).not.toMatch(/use-list|list-ui|\/list\.ts|list-download|list-return|\/search\//);
});

it.each(['../src/use-list.ts', '../src/list.ts', '../../ui-registry/src/list-ui.tsx'])('%s는 폼을 import하지 않는다', (entry) => {
  for (const file of reach(entry)) expect(file).not.toMatch(/\/form\//);
});

it('진행 표시 마크업(.wk-spinner)은 /ui의 pending 한 곳에만 있고, 목록 다운로드·폼 저장·확인창은 Pending을, 화면 전체 덮개는 Spinner를 쓴다', () => {
  const owners = Object.entries(sources)
    .filter(([file, source]) => !file.startsWith('../src/testing/') && source.includes('wk-spinner'))
    .map(([file]) => file);
  expect(owners).toEqual(['../../ui-registry/src/ui/pending.tsx']);
  for (const file of ['../../ui-registry/src/list-ui.tsx', '../../ui-registry/src/form/ui.tsx', '../../ui-registry/src/ui/dialog.tsx']) expect(sources[file], file).toMatch(/<Pending label=/);
  expect(sources['../../ui-registry/src/ui/blocking-progress.tsx']).toMatch(/<Spinner large \/>/);
  expect(sources['../../ui-registry/src/ui/index.ts']).toMatch(/export \{ Pending \} from '\.\/pending'/);
});


/** 제품 실행 파일은 배치 JSX·스타일·registry 역참조를 소유하지 않는다. */
it('패키지 제품 실행 코드에는 화면 요소·스타일·registry import가 없다', () => {
  for (const [path, source] of Object.entries(packageSources)) {
    expect(source, path).not.toMatch(/from\s+['"][^'"]*(?:ui-registry|registry\/|\.css)['"]/);
    if (path === '../src/testing.tsx' || path.startsWith('../src/testing/')) continue;
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    /** JSX의 소문자 태그와 문자열 createElement는 시각 배치이므로 거절한다. */
    function visit(node: ts.Node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName))
        expect(node.tagName.getText(file), path).not.toMatch(/^[a-z]/);
      if (ts.isCallExpression(node) && node.expression.getText(file).endsWith('createElement') && node.arguments[0])
        expect(ts.isStringLiteral(node.arguments[0]), path).toBe(false);
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
});

it('/choice는 목록·폼을 import하지 않는다', () => {
  for (const file of reach('../src/choice-binding.ts')) expect(file).not.toMatch(/use-list|list-binding|\/list\.ts|\/form\//);
});

/** registry는 공개 패키지 입구와 자기 원본 파일만 연결한다. */
it('registry 원본의 패키지 내부 import는 0개다', () => {
  for (const [file, source] of Object.entries(registrySources)) {
    for (const [, specifier] of source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
      if (specifier!.startsWith('@boosterlab/web-kit')) expect(resolve(file, specifier!), file + ' → ' + specifier).toBeDefined();
      else if (specifier!.startsWith('.')) {
        const target = resolve(file, specifier!);
        expect(target, file + ' → ' + specifier).toBeDefined();
        expect(target, file + ' → ' + specifier).toMatch(/^\.\.\/\.\.\/ui-registry\/src\//);
      }
    }
  }
});

/** 검사 전용 입구를 채택하지 않은 제품 코드에는 검사 러너가 들어오지 않는다. */
it.each(Object.entries(exportsMap).filter(([name]) => !name.startsWith('./testing')).map(([, path]) => '../' + path.slice(2)))('%s 제품 경로는 검사 러너를 import하지 않는다', (entry) => {
  for (const file of reach(entry)) {
    expect(file).not.toMatch(/\/testing(?:\/|\.)/);
    expect(sources[file]).not.toMatch(/from\s+['"](?:vitest|@playwright\/test|@testing-library\/react)/);
  }
});

/** 선택한 검사 입구는 다른 기능의 실행 의존을 끌어오지 않는다. 실제 설치 부재는 최소 소비 검사로 확인한다. */
it.each(['../src/testing/form-unit.ts', '../src/testing/unit/auth.tsx', '../src/testing/auth-fixture.tsx'])('%s는 선택하지 않은 목록 검사를 불러오지 않는다', (entry) => {
  for (const file of reach(entry)) {
    expect(file).not.toMatch(/use-list|list-ui|list-download|list-return/);
    expect(sources[file]).not.toMatch(/from ['"]@tanstack\/react-query['"]/);
    if (entry !== '../src/testing/form-unit.ts') expect(file).not.toMatch(/\/form\//);
  }
});
