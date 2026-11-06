// @vitest-environment jsdom
// 파일 책임: registry 원본을 패키지 공통 적합성 검사에 연결한다.
import { Form, FormGuard, FormSection, FormDefaults, defaultFormMessages, defaultFormGuardMessages } from '../../ui-registry/src/form/ui';
import { DialogDefaults, defaultDialogLabels } from '../../ui-registry/src/ui/dialog';
import { checkFormSectionsConformance } from '../src/testing/unit/form-sections';
const copy = { FormDefaults, defaultFormMessages, defaultFormGuardMessages, DialogDefaults, defaultDialogLabels };
checkFormSectionsConformance({ Form, FormGuard, FormSection, ...copy }, { registryVersion: 'source', registryCommit: 'source' });
