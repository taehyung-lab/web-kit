// 파일 책임: 상품 등록 경로.
import { ProductCreateScreen } from '@/features/products/screens/ProductCreateScreen';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/products/new')({
  component: ProductCreateScreen,
});
