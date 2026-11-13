// @vitest-environment jsdom
// 파일 책임: registry 원본을 패키지 공통 적합성 검사에 연결한다.
import { Form, FormGuard, FormDefaults, defaultFormMessages, defaultFormGuardMessages } from '../../ui-registry/src/form/form';
import { DialogDefaults, defaultDialogLabels } from '../../ui-registry/src/ui/dialog';
import { checkFormComplexConformance } from '../src/testing/unit/form-complex';
const copy = { FormDefaults, defaultFormMessages, defaultFormGuardMessages, DialogDefaults, defaultDialogLabels };
checkFormComplexConformance({ Form, FormGuard, ...copy }, { registryVersion: 'source', registryCommit: 'source' });
