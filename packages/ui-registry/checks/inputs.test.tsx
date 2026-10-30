// @vitest-environment jsdom
// 파일 책임: 설치한 inputs 복사본을 키트 공통 단위 검사에 연결한다.
import { Button, Input, Checkbox } from '../ui/inputs';
import { checkInputsConformance } from '@boosterlab/web-kit/testing/unit/primitives';
import installation from '../../../../../registry-installation.json';
checkInputsConformance({ Button, Input, Checkbox }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });
