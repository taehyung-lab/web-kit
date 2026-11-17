// 파일 책임: 상품 상태 배지(상태별 색은 이 도메인의 표현이다).
import { useTranslation } from 'react-i18next';
import type { ProductStatus } from '../model/product';

const TONE: Record<ProductStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  INACTIVE: 'bg-rose-50 text-rose-700',
};

/** 상태 하나를 번역된 이름과 색으로 보인다. */
export function StatusBadge({ status }: { readonly status: ProductStatus }) {
  const { t } = useTranslation();
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONE[status]}`}>{t(`products.status.${status}`)}</span>;
}
