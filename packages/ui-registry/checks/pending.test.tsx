// @vitest-environment jsdom
// 파일 책임: 설치한 pending 복사본을 키트 공통 단위 검사에 연결한다.
import { Pending } from '../ui/pending';
import { checkPendingConformance } from '@boosterlab/web-kit/testing/unit/primitives';
import installation from '../../../../../registry-installation.json';
checkPendingConformance({ Pending }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
