// @vitest-environment jsdom
// 파일 책임: 설치한 UI 복사본을 키트의 공통 단위 검사에 연결한다.
import { Form, FormDefaults, defaultFormMessages, defaultFormGuardMessages } from '../form/ui';
import { DialogDefaults, defaultDialogLabels } from '../ui/dialog';
import { checkFormWorkflowsConformance } from '@boosterlab/web-kit/testing/unit/form';
import installation from '../../../../../registry-installation.json';
const copy = { FormDefaults, defaultFormMessages, defaultFormGuardMessages, DialogDefaults, defaultDialogLabels };
checkFormWorkflowsConformance({ Form, ...copy }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
