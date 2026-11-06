// @vitest-environment jsdom
// 파일 책임: registry 원본을 패키지 공통 적합성 검사에 연결한다.
import { Form, FormGuard, FormDefaults, defaultFormMessages, defaultFormGuardMessages } from '../../ui-registry/src/form/ui';
import { DialogDefaults, defaultDialogLabels } from '../../ui-registry/src/ui/dialog';
import { checkFormEnterConformance } from '../src/testing/unit/form-enter';
const copy = { FormDefaults, defaultFormMessages, defaultFormGuardMessages, DialogDefaults, defaultDialogLabels };
checkFormEnterConformance({ Form, FormGuard, ...copy }, { registryVersion: 'source', registryCommit: 'source' });
