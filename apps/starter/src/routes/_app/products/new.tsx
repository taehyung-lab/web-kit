// 파일 책임: 상품 등록 경로.
import { ProductCreateScreen } from '@/features/products/screens/ProductCreateScreen';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/products/new')({
  component: ProductCreateRoute,
});

function ProductCreateRoute() {
  return (
    <ProductCreateScreen
      createdDestination={(productId) => ({ kind: 'navigate', destination: { to: '/products/$productId', params: { productId } } })}
      cancel={{ kind: 'navigate', destination: { to: '/products' } }}
    />
  );
}
