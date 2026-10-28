// 파일 책임: 공연 예시 등록 경로.
import { ShowCreateScreen } from '@/features/shows/screens/ShowCreateScreen';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/shows/new')({
  component: ShowCreateScreen,
});
