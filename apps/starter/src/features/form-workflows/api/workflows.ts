// 파일 책임: 작성 예제의 두 저장 요청을 앱의 응답 해석에 연결한다. 실제 프로젝트의 저장 API 계약과는 별개다.
import { apiRequest } from '@/app/web-kit';
import type { WorkflowValues } from '../model/form';
/** 작성 예제 mock 서버가 확인한 저장 결과를 받는다. */
export function saveWorkflow(values: WorkflowValues, mode: 'draft' | 'publish'): Promise<{ saved: WorkflowValues }> {
  return apiRequest({ url: '/api/form-workflows', method: 'POST', data: { mode, values } });
}
