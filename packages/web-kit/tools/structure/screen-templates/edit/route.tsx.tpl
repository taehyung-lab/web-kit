// 파일 책임: {{url}} 수정 경로. URL의 식별자만 화면에 넘긴다. web-kit-new가 만든 골격이다.
import { createFileRoute } from '@tanstack/react-router';
import { {{Entity}}EditPage } from '{{alias}}features/{{feature}}';

export const Route = createFileRoute('{{routeId}}')({
  component: {{Entity}}EditRoute,
});

function {{Entity}}EditRoute() {
  const { {{id}} } = Route.useParams();
  return <{{Entity}}EditPage {{id}}={{{id}}} />;
}
