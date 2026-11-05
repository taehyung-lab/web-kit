// 파일 책임: 상품 수정 경로. URL의 식별자와 돌아갈 곳만 화면에 넘긴다. 수정 원본 조회·저장은 화면 flow가 맡는다.
import { ProductEditScreen } from '@/features/products/screens/ProductEditScreen';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/products/$productId/edit')({
  component: ProductEditRoute,
});

function ProductEditRoute() {
  const { productId } = Route.useParams();
  const navigate = Route.useNavigate();
  return <ProductEditScreen productId={productId} onBack={() => void navigate({ to: '/products' })} />;
}
