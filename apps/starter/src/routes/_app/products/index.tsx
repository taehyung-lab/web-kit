// 파일 책임: 상품 목록 경로. URL 검색은 web-kit 검색 선언으로 검증하고(validateSearch), 정규형이 아닌 진입 주소는 교정한다(beforeLoad).
import { productListSearch } from '@/features/products/model/list-search';
import { ProductListScreen } from '@/features/products/screens/ProductListScreen';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/products/')({
  validateSearch: productListSearch.validateSearch,
  beforeLoad: productListSearch.beforeLoad,
  component: ProductListRoute,
});

function ProductListRoute() {
  const navigate = Route.useNavigate();
  return (
    <ProductListScreen
      search={Route.useSearch()}
      navigate={(next, { replace }) => void navigate({ search: next, replace })}
      onOpen={(productId) => void navigate({ to: '/products/$productId', params: { productId } })}
      onCreate={() => void navigate({ to: '/products/new' })}
    />
  );
}
