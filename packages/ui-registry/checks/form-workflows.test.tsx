// @vitest-environment jsdom
// 파일 책임: 설치한 UI 복사본을 키트의 공통 단위 검사에 연결한다.
import { Form } from '../form/ui';
import { checkFormWorkflowsConformance } from '@boosterlab/web-kit/testing/unit';
import installation from '../../../../../registry-installation.json';
checkFormWorkflowsConformance({ Form }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
