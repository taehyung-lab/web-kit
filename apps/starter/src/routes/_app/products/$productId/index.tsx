// 파일 책임: 상품 상세 경로. loader는 같은 queryOptions로 미리 받기만 하고, 상태 판정은 화면의 useRecord가 한다.
import { productQuery } from '@/features/products/api/products';
import { ProductDetailScreen } from '@/features/products/screens/ProductDetailScreen';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/products/$productId/')({
  // 기다리지 않는다: 실패(없음 포함)를 loader가 판정하지 않고, 화면이 같은 요청을 이어 받는다.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(productQuery(params.productId));
  },
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { productId } = Route.useParams();
  const navigate = Route.useNavigate();
  return (
    <ProductDetailScreen
      productId={productId}
      onEdit={() => void navigate({ to: '/products/$productId/edit', params: { productId } })}
      onBack={() => void navigate({ to: '/products' })}
    />
  );
}
