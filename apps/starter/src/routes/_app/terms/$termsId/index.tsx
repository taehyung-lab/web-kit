// 파일 책임: 약관 상세 경로. URL의 식별자만 화면에 넘긴다. 단건 조회 상태는 화면 flow(useRecord)가 판정한다.
import { TermsDetailPage } from '@/features/terms/pages/TermsDetailPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/terms/$termsId/')({
  component: TermsDetailRoute,
});

function TermsDetailRoute() {
  return <TermsDetailPage termsId={Route.useParams().termsId} />;
}
