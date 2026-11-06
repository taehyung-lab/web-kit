// 파일 책임: 상품 수정 화면. 원본 상태별 표현과 수정 폼 배치·저장 확인 내용을 그린다. 원본 조회·저장·이동은 수정 flow가 맡는다.
import { Button } from '@/shared/ui/button';
import { Record } from '@/shared/ui/web-kit/detail-ui';
import { Form } from '@/shared/ui/web-kit/form/ui';
import { useTranslation } from 'react-i18next';
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { useProductEdit, useProductEditSource } from '../flows/use-product-edit';
import type { ProductFormValues } from '../model/forms/product-form';
import type { Product } from '../model/product';
import { ProductFields } from './ProductForm';

const F = Form.of<ProductFormValues>();

/** 준비된 단건 상태만 수정 폼으로 보낸다. */
export function ProductEditScreen({ productId, onBack }: { readonly productId: string; readonly onBack: () => void }) {
  const { t } = useTranslation();
  const state = useProductEditSource(productId);
  return (
    <div>
      <h1>{t('products.form.editTitle')}</h1>
      <Record
        messages={{ loading: t('common.loading'), retry: t('common.retry'), refreshFailed: t('common.refreshFailed') }}
        state={state}
        renderFailure={(failure) => t(failureCopyKey(failure))}
        missing={
          <>
            <p>{t(failureCopyKey(state.kind === 'missing' ? state.failure : undefined))}</p>
            <Button variant="outline" onClick={onBack}>
              {t('products.backToList')}
            </Button>
          </>
        }
      >
        {(product) => <ProductEditForm product={product} />}
      </Record>
    </div>
  );
}

/** 저장 확인에는 키트가 고정한 제출 값만 표시한다. 저장하면 상세로 간다. */
function ProductEditForm({ product }: { readonly product: Product }) {
  const { t } = useTranslation();
  const { editor, categories } = useProductEdit(product);
  const detail = { to: '/products/$productId' as const, params: { productId: product.id } };
  return (
    <F
      editor={editor}
      confirm={{
        title: t('products.form.confirmTitle'),
        body: (submitted) => (
          <>
            <p>{t('products.form.confirmBody')}</p>
            <dl>
              <dt>{t('products.fields.name')}</dt>
              <dd>{submitted.name}</dd>
              <dt>{t('products.fields.code')}</dt>
              <dd>{submitted.code}</dd>
              <dt>{t('products.fields.price')}</dt>
              <dd>{submitted.price}</dd>
            </dl>
          </>
        ),
      }}
    >
      <ProductFields submitLabel={t('products.form.submitEdit')} cancelTo={detail} categories={categories} />
    </F>
  );
}
