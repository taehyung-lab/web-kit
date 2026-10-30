// @vitest-environment jsdom
// 파일 책임: registry 원본을 패키지 공통 적합성 검사에 연결한다.
import { List, useListField } from '../../ui-registry/src/list-ui';
import { Pending } from '../../ui-registry/src/ui';
import { checkListUiConformance } from '../src/testing/unit/list-ui';
checkListUiConformance({ List, useListField, Pending }, { registryVersion: 'source', registryCommit: 'source' });
