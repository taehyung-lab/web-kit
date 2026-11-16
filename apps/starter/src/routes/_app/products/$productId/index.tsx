// 파일 책임: 상품 상세 경로. URL의 식별자와 이동 수단만 화면에 넘긴다. 단건 상태 판정은 화면 flow의 useRecord가 한다.
import { ProductDetailPage } from '@/features/products/pages/ProductDetailPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/products/$productId/')({
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { productId } = Route.useParams();
  const navigate = Route.useNavigate();
  return (
    <ProductDetailPage
      productId={productId}
      onEdit={() => void navigate({ to: '/products/$productId/edit', params: { productId } })}
      onBack={() => void navigate({ to: '/products' })}
    />
  );
}
