// @vitest-environment jsdom
// 파일 책임: 설치한 UI 복사본을 키트의 공통 단위 검사에 연결한다.
import { Choice } from '../ui/choice';
import { checkChoiceConformance } from '@boosterlab/web-kit/testing/unit/choice';
import installation from '../../../../../registry-installation.json';
checkChoiceConformance({ Choice }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
