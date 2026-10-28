// 파일 책임: 회원 목록 경로. URL 검색은 web-kit 검색 선언으로 검증하고, 정규형이 아닌 진입 주소는 교정한다.
import { memberListSearch } from '@/features/members/model/list-search';
import { MemberListScreen } from '@/features/members/screens/MemberListScreen';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/members/')({
  validateSearch: memberListSearch.validateSearch,
  beforeLoad: memberListSearch.beforeLoad,
  component: MemberListRoute,
});

function MemberListRoute() {
  const navigate = Route.useNavigate();
  return <MemberListScreen search={Route.useSearch()} navigate={(next, { replace }) => void navigate({ search: next, replace })} />;
}
