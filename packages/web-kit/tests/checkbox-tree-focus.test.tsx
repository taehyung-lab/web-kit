// @vitest-environment jsdom
// 파일 책임: registry 원본을 패키지 공통 적합성 검사에 연결한다.
import { CheckboxTree } from '../../ui-registry/src/CheckboxTree';
import { checkCheckboxTreeFocusConformance } from '../src/testing/unit/checkbox-tree-focus';
checkCheckboxTreeFocusConformance({ CheckboxTree }, { registryVersion: 'source', registryCommit: 'source' });
