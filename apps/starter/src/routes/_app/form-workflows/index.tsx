// 파일 책임: 공용 폼의 참조·두 저장 소비 예제 경로.
import { FormWorkflowPage } from '@/features/form-workflows/pages/FormWorkflowPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/form-workflows/')({ component: FormWorkflowPage });
