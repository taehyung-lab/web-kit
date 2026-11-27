// 파일 책임: {{url}} 상세 경로. URL의 식별자만 화면에 넘긴다. web-kit-new가 만든 골격이다.
import { createFileRoute } from '@tanstack/react-router';
import { {{Entity}}DetailPage } from '{{alias}}features/{{feature}}';

export const Route = createFileRoute('{{routeId}}')({
  component: {{Entity}}DetailRoute,
});

function {{Entity}}DetailRoute() {
  const { {{id}} } = Route.useParams();
  return <{{Entity}}DetailPage {{id}}={{{id}}} />;
}
