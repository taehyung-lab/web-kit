// 파일 책임: 작성 예제의 저장과 저장 후 조회 요청을 프로젝트 계약으로 연결한다.
import { apiRequest } from '@/app/web-kit';
import type { WorkflowValues } from '../model/form';
/** 작성 예제 mock 서버가 확인한 저장 결과를 받는다. */
export function saveWorkflow(values: WorkflowValues, mode: 'draft' | 'publish'): Promise<{ saved: WorkflowValues; id: string }> {
  return apiRequest({ url: '/api/form-workflows', method: 'POST', data: { mode, values } });
}

/** 저장 후 추가 행동으로 저장된 문서를 조회한다. 실패는 호출한 onSaved의 완료 실패가 된다. */
export function readSavedWorkflow(id: string): Promise<{ saved: WorkflowValues; id: string }> {
  return apiRequest({ url: `/api/form-workflows/${encodeURIComponent(id)}`, method: 'GET' });
}
