// 파일 책임: 상품 상세 화면. 단건 상태 판정은 web-kit useRecord 한 곳이 하고, 여기서는 상태별 표현과 dt/dd 목록을 그린다.
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { Record } from '@boosterlab/web-kit/detail/ui';
import { Button } from '@boosterlab/web-kit/ui';
import { useRecord } from '@boosterlab/web-kit/record';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { categoryOptionsQuery } from '../api/categories';
import { productQuery } from '../api/products';
import type { Product } from '../model/product';
import { formatDate, formatPrice } from './format';
import { StatusBadge } from './StatusBadge';

/** 상품 하나의 상세. 없음(missing)이면 목록으로 돌아가는 수단을 준다. */
export function ProductDetailScreen({
  productId,
  onEdit,
  onBack,
}: {
  readonly productId: string;
  readonly onEdit: () => void;
  readonly onBack: () => void;
}) {
  const { t } = useTranslation();
  const state = useRecord(productQuery(productId), productId);
  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" className="self-start" onClick={onBack}>
        ‹ {t('products.backToList')}
      </Button>
      <Record
        messages={{ loading: t('common.loading'), retry: t('common.retry'), refreshFailed: t('common.refreshFailed'), empty: t('common.empty') }}
        state={state}
        renderFailure={(failure) => t(failureCopyKey(failure))}
        missing={
          <>
            <p>{t(failureCopyKey(state.kind === 'missing' ? state.failure : undefined))}</p>
            <Button variant="secondary" onClick={onBack}>
              {t('products.backToList')}
            </Button>
          </>
        }
      >
        {(product) => <ProductDetail product={product} onEdit={onEdit} />}
      </Record>
    </div>
  );
}

/** 준비된 상품 내용. */
function ProductDetail({ product, onEdit }: { readonly product: Product; readonly onEdit: () => void }) {
  const { t, i18n } = useTranslation();
  const categories = useQuery(categoryOptionsQuery());
  const categoryName = categories.data?.find((category) => category.id === product.categoryId)?.name ?? t('common.empty');
  const item = (label: string, value: ReactNode) => <Record.Field label={label}>{value}</Record.Field>;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{product.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            <code>{product.code}</code>
          </p>
        </div>
        <Button variant="primary" onClick={onEdit}>
          {t('products.edit')}
        </Button>
      </header>
      <Record.Fields>
        {item(t('products.fields.status'), <StatusBadge status={product.status} />)}
        {item(t('products.fields.category'), categoryName)}
        {item(t('products.fields.price'), formatPrice(product.price, i18n.language))}
        {item(t('products.fields.stock'), product.stock.toLocaleString(i18n.language))}
        {item(
          t('products.fields.options'),
          <ul>
            {product.options.map((option, index) => (
              <li key={index}>
                {option.name} (+{formatPrice(option.extraPrice, i18n.language)})
              </li>
            ))}
          </ul>,
        )}
        {item(
          t('products.fields.description'),
          product.description === '' ? null : <span className="whitespace-pre-wrap">{product.description}</span>,
        )}
        {item(t('products.fields.createdAt'), formatDate(product.createdAt, i18n.language))}
        {item(t('products.fields.updatedAt'), formatDate(product.updatedAt, i18n.language))}
      </Record.Fields>
    </article>
  );
}
