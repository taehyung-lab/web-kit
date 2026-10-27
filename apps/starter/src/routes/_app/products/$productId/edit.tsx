// 파일 책임: 상품 수정 경로. loader는 수정 원본을 미리 받기만 한다.
import { productQuery } from '@/features/products/api/products';
import { ProductEditScreen } from '@/features/products/screens/ProductEditScreen';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/products/$productId/edit')({
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(productQuery(params.productId));
  },
  component: ProductEditRoute,
});

function ProductEditRoute() {
  const { productId } = Route.useParams();
  const navigate = Route.useNavigate();
  return (
    <ProductEditScreen
      productId={productId}
      destination={{ kind: 'navigate', destination: { to: '/products/$productId', params: { productId } } }}
      onBack={() => void navigate({ to: '/products' })}
    />
  );
}
