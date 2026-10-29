// @vitest-environment jsdom
// 파일 책임: registry 원본을 패키지 공통 적합성 검사에 연결한다.
import { Form } from '../../ui-registry/src/form/ui';
import { BlockingProgress } from '../../ui-registry/src/ui/blocking-progress';
import { ConfirmDialog } from '../../ui-registry/src/ui/dialog';
import { checkBlockingProgressConformance } from '../src/testing/unit/blocking-progress';
checkBlockingProgressConformance({ Form, BlockingProgress, ConfirmDialog }, { registryVersion: 'source', registryCommit: 'source' });
