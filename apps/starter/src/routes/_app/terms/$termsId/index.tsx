// 파일 책임: 약관 상세 경로. loader는 같은 queryOptions로 미리 받기만 한다.
import { termsQuery } from '@/features/terms/api/terms';
import { TermsDetailScreen } from '@/features/terms/screens/TermsDetailScreen';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/terms/$termsId')({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(termsQuery(params.termsId));
  },
  component: TermsDetailRoute,
});

function TermsDetailRoute() {
  return <TermsDetailScreen termsId={Route.useParams().termsId} />;
}
