// @vitest-environment jsdom
// 파일 책임: 덮개 자체와 실제 함께 설치된 기능의 조합만 소비 복사본으로 검사한다.
import { BlockingProgress } from '../ui/blocking-progress';
import { ConfirmDialog } from '../ui/dialog';
import { checkProgressConformance } from '@boosterlab/web-kit/testing/unit/blocking-progress';
import type { checkFormProgressConformance as FormProgressCheck } from '@boosterlab/web-kit/testing/unit/combinations';
import installation from '../../../../../registry-installation.json';
const target = { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit };
checkProgressConformance({ BlockingProgress, ConfirmDialog }, target);
const names = new Set(installation.items.map((item) => item.name));
if (names.has('form')) {
  const forms = import.meta.glob('../form/ui.tsx');
  const load = forms['../form/ui.tsx'];
  if (!load) throw new Error('form 설치 기록에 맞는 소비 복사본 없음');
  const module = await load() as { Form: Parameters<typeof FormProgressCheck>[0]['Form'] };
  const { Form } = module;
  const { checkFormProgressConformance } = await import('@boosterlab/web-kit/testing/unit/combinations');
  await checkFormProgressConformance({ Form, BlockingProgress }, target);
}
if (names.has('list')) {
  const { checkListProgressConformance } = await import('@boosterlab/web-kit/testing/unit/combinations');
  await checkListProgressConformance({ BlockingProgress }, target);
}
if (names.has('record')) {
  const { checkRecordProgressConformance } = await import('@boosterlab/web-kit/testing/unit/combinations');
  await checkRecordProgressConformance({ BlockingProgress }, target);
}
