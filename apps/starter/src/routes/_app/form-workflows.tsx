// 파일 책임: 공용 폼의 참조·두 저장 소비 예제 경로.
import { createFileRoute } from '@tanstack/react-router';
import { FormWorkflowScreen } from '@/features/form-workflows/screens/FormWorkflowScreen';
export const Route = createFileRoute('/_app/form-workflows')({ component: FormWorkflowScreen });
