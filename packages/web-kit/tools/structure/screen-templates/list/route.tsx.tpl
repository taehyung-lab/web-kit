// 파일 책임: {{url}} 목록 경로. URL 검색을 검증하고 화면에 넘긴다. web-kit-new가 만든 골격이다.
import { createFileRoute } from '@tanstack/react-router';
import { {{Entity}}ListPage } from '{{alias}}features/{{feature}}';
import { {{entityCamel}}ListSearch } from '{{alias}}features/{{feature}}';

export const Route = createFileRoute('{{routeId}}')({
  validateSearch: {{entityCamel}}ListSearch.validateSearch,
  beforeLoad: {{entityCamel}}ListSearch.beforeLoad,
  component: {{Entity}}ListRoute,
});

function {{Entity}}ListRoute() {
  const navigate = Route.useNavigate();
  return <{{Entity}}ListPage urlSearch={Route.useSearch()} navigate={(next, { replace }) => void navigate({ search: next, replace })} />;
}
