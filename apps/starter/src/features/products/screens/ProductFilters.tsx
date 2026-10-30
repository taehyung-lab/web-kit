// 파일 책임: 상품 목록의 검색 조건 입력 영역을 구성한다.
// 파일 책임: 상품 필터의 배치와 표시 문구를 선언한다. 검색 초안과 검증은 키트가 소유한다.
import { FilterPanel, FilterActions, TextFilter, ChoiceFilter, PeriodFilter } from '@/shared/ui/web-kit/list-ui';
import { useTranslation } from 'react-i18next';
import { PRODUCT_STATUSES } from '../model/product';
/** 상품의 검색 칸을 같은 목록 상태에 연결한다. */
export function ProductFilters() {
  const { t } = useTranslation();
  return (
    <FilterPanel>
      <TextFilter name="keyword" label={t('products.filter.keyword')} />
      <ChoiceFilter
        multiple
        appearance="horizontal"
        name="statuses"
        label={t('products.filter.statuses')}
        nodes={PRODUCT_STATUSES.map((value) => ({ value, label: t(`products.status.${value}`) }))}
      />
      <ChoiceFilter
        name="categoryId"
        label={t('products.filter.category')}
        placeholder={t('products.filter.allCategories')}
        clearLabel={t('products.filter.allCategories')}
      />
      <PeriodFilter from="from" to="to" label={t('products.filter.period')} timeZone="Asia/Seoul" now={() => new Date()} />
      <FilterActions />
    </FilterPanel>
  );
}
