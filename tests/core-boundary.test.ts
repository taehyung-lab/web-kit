// 파일 책임: 루트(core)로 공개하는 코드와 그것이 끌어오는 파일에 라이브러리 의존(React·axios·TanStack·zod)이 없는지 검사한다.
// 목록을 따로 두지 않고 index.ts에서 import를 따라간다. 순수 규칙인지는 README 정의와 검토가 맡는다.
import { expect, it } from 'vitest';

/** vitest(Vite)가 제공하는 raw import. 키트에 node 타입 의존성을 더하지 않는다. */
const sources = (
  import.meta as unknown as { glob: (pattern: string, options: object) => Record<string, string> }
).glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });

/** 상대 경로를 실제 소스 파일 key로 푼다. */
function resolve(from: string, specifier: string): string | undefined {
  const base = new URL(specifier, `file:///${from.slice(3)}`).pathname.slice(1);
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].map((path) => `../${path}`).find((key) => key in sources);
}

it('루트 공개 코드는 상대 경로의 소스 파일만 따라가며 import한다', () => {
  const visited = new Set<string>();
  const queue = ['../src/index.ts'];
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
