// @vitest-environment jsdom
// 파일 책임: registry 원본을 패키지 공통 적합성 검사에 연결한다.
import { Detail, RecordView } from '../../ui-registry/src/detail';
import { checkRecordUiConformance } from '../src/testing/unit/record-ui';
checkRecordUiConformance({ Detail, RecordView }, { registryVersion: 'source', registryCommit: 'source' });
