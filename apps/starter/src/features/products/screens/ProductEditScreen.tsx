// 파일 책임: 수정 원본·업무 검증·저장 요청·확인 내용을 키트에 제공한다.
import { Record } from '@boosterlab/web-kit/detail/ui';
import { useSaveForm } from '@boosterlab/web-kit/form';
import { Form } from '@boosterlab/web-kit/form/ui';
import { useRecord } from '@boosterlab/web-kit/record';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { useFormCopy } from '@/shared/lib/form-messages';
import { productQuery, useUpdateProduct } from '../api/products';
import { productFieldError, productFormSchema, toProductFormValues, toProductUpsertRequest, type ProductFormValues } from '../model/form';
import type { Product } from '../model/product';
import { ProductFields } from './ProductForm';

const F = Form.of<ProductFormValues>();

/** 준비된 단건 상태만 수정 폼으로 보낸다. */
export function ProductEditScreen({ productId, onBack }: { readonly productId: string; readonly onBack: () => void }) {
  const { t } = useTranslation();
  const state = useRecord(productQuery(productId), productId);
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
            <button type="button" className="wk-button wk-button-secondary" onClick={onBack}>
              {t('products.backToList')}
            </button>
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
  const navigate = useNavigate();
  const copy = useFormCopy();
  const update = useUpdateProduct(product.id);
  const editor = useSaveForm({
    schema: productFormSchema,
    source: { id: product.id, values: toProductFormValues(product) },
    confirm: true,
    fieldError: productFieldError,
    save: async (output) => ({ saved: toProductFormValues(await update.mutateAsync(toProductUpsertRequest(output))) }),
    onSaved: () => navigate({ to: '/products/$productId', params: { productId: product.id } }),
  });
  const detail = { to: '/products/$productId' as const, params: { productId: product.id } };
  return (
    <F editor={editor} {...copy}>
      <ProductFields submitLabel={t('products.form.submitEdit')} cancelTo={detail} />
      <F.Confirm title={t('products.form.confirmTitle')}>
        {(submitted) => (
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
        )}
      </F.Confirm>
    </F>
  );
}
