// 파일 책임: 기존 전체 진행 검사 함수의 입력과 동기 등록을 보존한다.
import { checkProgressConformance } from './progress';
import { checkFormProgressConformance } from './progress-form';
import { checkListProgressConformance } from './progress-list';
import { checkRecordProgressConformance } from './progress-record';
import type * as Form from '../contracts/form/ui';
import type * as Progress from '../contracts/ui/blocking-progress';
import type * as Dialog from '../contracts/ui/dialog';
import type { ConformanceTarget } from '../target.mjs';
/** 기존 Form·덮개·확인창 입력으로 기존 검사 ID를 모두 등록한다. */
export function checkBlockingProgressConformance(parts: { Form: typeof Form.Form; BlockingProgress: typeof Progress.BlockingProgress; ConfirmDialog: typeof Dialog.ConfirmDialog }, target: ConformanceTarget) {
  checkProgressConformance(parts, target);
  checkFormProgressConformance(parts, target);
  checkListProgressConformance(parts, target);
  checkRecordProgressConformance(parts, target);
}
