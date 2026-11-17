// 파일 책임: 상품 등록 경로.
import { ProductCreatePage } from '@/features/products';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/products/new')({
  component: ProductCreatePage,
});
