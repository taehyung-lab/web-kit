// 파일 책임: {{url}} 수정 경로. URL의 식별자만 화면에 넘긴다. web-kit-new가 만든 골격이다.
import { createFileRoute } from '@tanstack/react-router';
import { {{Entity}}EditPage } from '{{alias}}features/{{feature}}';

export const Route = createFileRoute('{{routeId}}')({
  component: {{Entity}}EditRoute,
});

function {{Entity}}EditRoute() {
  // 주소 변수 이름(프로젝트가 정한다)은 속성 이름으로만 쓴다. 화면에는 id로 넘긴다.
  const params = Route.useParams();
  return <{{Entity}}EditPage id={params.{{id}}} />;
}
