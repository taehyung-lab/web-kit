// 파일 책임: 약관 등록 경로.
import { TermsCreateScreen } from '@/features/terms/screens/TermsCreateScreen';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/terms/new')({
  component: TermsCreateScreen,
});
