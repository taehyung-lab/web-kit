// @vitest-environment jsdom
// 파일 책임: 설치한 UI 복사본을 키트의 공통 단위 검사에 연결한다.
import { Form } from '../form/ui';
import { BlockingProgress } from '../ui/blocking-progress';
import { ConfirmDialog } from '../ui/dialog';
import { checkBlockingProgressConformance } from '@boosterlab/web-kit/testing/unit';
import installation from '../../../../../registry-installation.json';
checkBlockingProgressConformance({ Form, BlockingProgress, ConfirmDialog }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
