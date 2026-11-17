// @vitest-environment jsdom
// 파일 책임: registry 원본을 패키지 공통 적합성 검사에 연결한다.
import { Form, FormDefaults, defaultFormMessages, defaultFormGuardMessages } from '../../ui-registry/src/form/form';
import { FullPageProgress } from '../../ui-registry/src/full-page-progress';
import { ConfirmDialog, DialogDefaults, defaultDialogLabels } from '../../ui-registry/src/dialog';
import { checkFullPageProgressConformance } from '../src/testing/unit/blocking-progress';
checkFullPageProgressConformance({ Form, FullPageProgress, ConfirmDialog, FormDefaults, defaultFormMessages, defaultFormGuardMessages, DialogDefaults, defaultDialogLabels }, { registryVersion: 'source', registryCommit: 'source' });
