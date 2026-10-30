// @vitest-environment jsdom
// 파일 책임: 체크 트리 자체와 폼도 설치한 소비처의 오류 초점을 실제 복사본으로 검사한다.
import { CheckboxTree } from '../CheckboxTree';
import { checkCheckboxTreeConformance } from '@boosterlab/web-kit/testing/unit/checkbox-tree';
import installation from '../../../../../registry-installation.json';
const target = { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit };
checkCheckboxTreeConformance({ CheckboxTree }, target);
if (installation.items.some((item) => item.name === 'form')) {
  const { checkCheckboxTreeFocusConformance } = await import('@boosterlab/web-kit/testing/unit/combinations');
  await checkCheckboxTreeFocusConformance({ CheckboxTree }, target);
}
