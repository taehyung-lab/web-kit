// 파일 책임: 상품 목록의 제목·필터·작업·결과를 배치하고 route가 준 이동을 연결한다. 목록 상태 조립은 목록 flow가 맡는다.
import { Button } from '@/shared/ui/button';
import { ListProvider, ListResult, ResultTable, Pagination } from '@/shared/ui/web-kit/list-ui';
import type { UrlSearch } from '@boosterlab/web-kit/search';
import { useTranslation } from 'react-i18next';
import { useProductList } from '../flows/use-product-list';
import { ProductFilters } from './ProductFilters';
import { ProductActions } from './ProductActions';
import { useProductColumns } from './product-columns';
/** 같은 목록 상태를 필터·표·페이지·확인 작업에 전달한다. */
export function ProductListScreen({
  search,
  navigate,
  onOpen,
  onCreate,
}: {
  readonly search: UrlSearch;
  readonly navigate: (next: UrlSearch, options: { readonly replace: boolean }) => void;
  readonly onOpen: (id: string) => void;
  readonly onCreate: () => void;
}) {
  const { t } = useTranslation();
  const { list, categoryName, deactivateSelected, deactivated } = useProductList({ search, navigate });
  const columns = useProductColumns(categoryName);
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1>{t('products.title')}</h1>
        <Button variant="outline" onClick={onCreate}>
          {t('products.create')}
        </Button>
      </header>
      {/* 공용 문구·실패 문구는 앱 ListDefaults가 준다. 여기에는 이 목록만의 문구를 둔다. */}
      <ListProvider
        model={list}
        messages={{
          search: t('products.filter.submit'),
          reset: t('products.filter.reset'),
          optionsFailed: t('products.list.optionsFailed'),
          empty: t('products.list.empty'),
          size: t('products.list.pageSize'),
        }}
      >
        <ProductFilters />
        <ProductActions total={list.total} selectedCount={list.selection.selectedIds.length} deactivateSelected={deactivateSelected} done={deactivated} />
        <ListResult>
          <ResultTable columns={columns} rowId={(row) => row.id} selectable onOpen={(row) => onOpen(row.id)} />
        </ListResult>
        <Pagination />
      </ListProvider>
    </div>
  );
}
