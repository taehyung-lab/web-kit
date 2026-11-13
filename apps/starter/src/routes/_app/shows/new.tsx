// 파일 책임: 공연 예시 등록 경로.
import { ShowCreatePage } from '@/features/shows/pages/ShowCreatePage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/shows/new')({
  component: ShowCreatePage,
});
