// @vitest-environment jsdom
// 파일 책임: 설치한 UI 복사본을 키트의 공통 단위 검사에 연결한다.
import { Form, FormGuard } from '../form/ui';
import { checkFormComplexConformance } from '@boosterlab/web-kit/testing/unit/form';
import installation from '../../../../../registry-installation.json';
checkFormComplexConformance({ Form, FormGuard }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
