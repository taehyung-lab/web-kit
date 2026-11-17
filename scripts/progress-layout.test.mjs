// 파일 책임: 설치되는 진행 UI의 이름과 경로가 실제 공개 사용 방법과 일치하는지 검사한다.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const root = new URL('../', import.meta.url);
test('진행 표시는 FullPageProgress 이름으로 중복 ui 단계 없이 설치된다', () => {
  const registry = JSON.parse(readFileSync(new URL('registry.json', root), 'utf8'));
  const progress = registry.items.find(item => item.name === 'blocking-progress');
  assert(progress, '기존 registry 선택 항목을 유지한다');
  const ui = progress.files.find(file => file.path.endsWith('/full-page-progress.tsx'));
  assert.equal(ui?.target, '~/src/shared/ui/web-kit/full-page-progress.tsx');
  const source = readFileSync(new URL(ui.path, root), 'utf8');
  assert.match(source, /export function FullPageProgress\(/);
  assert.match(source, /from '@boosterlab\/web-kit\/progress'/);
  for (const item of registry.items) for (const file of item.files ?? [])
    assert(!file.target.includes('/web-kit/ui/'), file.target);
});
