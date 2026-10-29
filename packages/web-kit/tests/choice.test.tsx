// @vitest-environment jsdom
// 파일 책임: registry 원본을 패키지 공통 적합성 검사에 연결한다.
import { Choice } from '../../ui-registry/src/ui/choice';
import { checkChoiceConformance } from '../src/testing/unit/choice';
checkChoiceConformance({ Choice }, { registryVersion: 'source', registryCommit: 'source' });
