// 파일 책임: {{url}} 등록 경로. web-kit-new가 만든 골격이다.
import { createFileRoute } from '@tanstack/react-router';
import { {{Entity}}CreatePage } from '{{alias}}features/{{feature}}';

export const Route = createFileRoute('{{routeId}}')({
  component: {{Entity}}CreatePage,
});
