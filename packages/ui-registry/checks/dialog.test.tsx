// @vitest-environment jsdom
// 파일 책임: 설치한 dialog 복사본을 키트 공통 단위 검사에 연결한다.
import { ConfirmDialog } from '../ui/dialog';
import { checkDialogConformance } from '@boosterlab/web-kit/testing/unit';
import installation from '../../../../../registry-installation.json';
checkDialogConformance({ ConfirmDialog }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
