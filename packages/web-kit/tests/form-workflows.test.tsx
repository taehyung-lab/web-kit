// @vitest-environment jsdom
// 파일 책임: registry 원본을 패키지 공통 적합성 검사에 연결한다.
import { Form } from '../../ui-registry/src/form/ui';
import { checkFormWorkflowsConformance } from '../src/testing/unit/form-workflows';
checkFormWorkflowsConformance({ Form }, { registryVersion: 'source', registryCommit: 'source' });
