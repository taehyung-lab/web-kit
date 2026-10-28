// 파일 책임: 루트(core)와 세션 adapter 검사 경로가 끌어오는 파일에 라이브러리 의존(React·axios·TanStack·zod)이 없는지 검사한다.
// 목록을 따로 두지 않고 index.ts에서 import를 따라간다. 순수 규칙인지는 README 정의와 검토가 맡는다.
// 세션 유휴 타이머(`/session/idle`)는 다른 어떤 공개 입구에서도 끌려오지 않는지 본다.
import { expect, it } from 'vitest';

/** vitest(Vite)가 제공하는 raw import. 키트에 node 타입 의존성을 더하지 않는다. */
const sources = (import.meta as unknown as { glob: (pattern: string, options: object) => Record<string, string> }).glob(
  '../src/**/*.{ts,tsx}',
  { query: '?raw', import: 'default', eager: true },
);

/** 상대 경로를 실제 소스 파일 key로 푼다. */
function resolve(from: string, specifier: string): string | undefined {
  const base = new URL(specifier, `file:///${from.slice(3)}`).pathname.slice(1);
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].map((path) => `../${path}`).find((key) => key in sources);
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

it.each(['../src/form/index.ts', '../src/form/save-form.ts', '../src/form/navigation.ts', '../src/form/confirmation.ts', '../src/use-list.ts', '../src/list.ts', '../src/session.ts', '../src/record.ts'])(
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
        if (specifier!.startsWith('.')) {
          const target = resolve(file, specifier!);
          expect(target).toBeDefined();
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
      .filter(([name, path]) => name !== './session/idle' && /\.tsx?$/.test(path))
      .map(([, path]) => `../${path.slice(2)}`),
  ),
];

it('유휴 타이머 경계 검사 대상에 동작 입구와 화면 부품 입구가 모두 들어 있다', () => {
  expect(entriesWithoutIdle).toEqual(
    expect.arrayContaining([
      '../src/form/index.ts',
      '../src/list.ts',
      '../src/record.ts',
      '../src/search/index.ts',
      '../src/list-ui.tsx',
      '../src/form/ui.tsx',
      '../src/detail-ui.tsx',
      '../src/ui/index.ts',
      '../src/filter.ts',
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
      expect(file).not.toMatch(/session-idle/);
      for (const [, specifier] of sources[file]!.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
        if (!specifier!.startsWith('.')) continue;
        const target = resolve(file, specifier!);
        expect(target).toBeDefined();
        queue.push(target!);
      }
    }
  },
);

/** 목록·폼·상세·기본 UI는 권한 판정과 결합하지 않는다(0005·0006). 권한 결과는 프로젝트가 연결한다. */
it.each([
  '../src/form/index.ts',
  '../src/form/ui.tsx',
  '../src/use-list.ts',
  '../src/list.ts',
  '../src/list-ui.tsx',
  '../src/record.ts',
  '../src/detail-ui.tsx',
  '../src/ui/index.ts',
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
        if (!specifier!.startsWith('.')) continue;
        const target = resolve(file, specifier!);
        expect(target).toBeDefined();
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
      if (!specifier!.startsWith('.')) continue;
      queue.push(resolve(file, specifier!)!);
    }
  }
  return visited;
}

it.each(['../src/form/index.ts', '../src/form/ui.tsx'])('%s는 목록(list·search)을 import하지 않는다', (entry) => {
  for (const file of reach(entry)) expect(file).not.toMatch(/use-list|list-ui|\/list\.ts|list-download|list-return|\/search\//);
});

it.each(['../src/use-list.ts', '../src/list.ts', '../src/list-ui.tsx'])('%s는 폼을 import하지 않는다', (entry) => {
  for (const file of reach(entry)) expect(file).not.toMatch(/\/form\//);
});
