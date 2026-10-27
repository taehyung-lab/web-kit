// 파일 책임: 수정 원본·업무 검증·저장 요청·확인 내용을 키트에 제공한다.
import { SaveForm, type FormIntent } from '@boosterlab/web-kit/form/ui';
import { RecordView } from '@boosterlab/web-kit/detail/ui';
import { useRecord } from '@boosterlab/web-kit/record';
import { useTranslation } from 'react-i18next';
import { useFieldMessage } from '@/shared/lib/form-messages';
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { productQuery, useUpdateProduct } from '../api/products';
import { productFieldError, productFormSchema, toProductFormValues, toProductUpsertRequest } from '../model/form';
import type { Product } from '../model/product';
import { ProductForm } from './ProductForm';
/** 준비된 단건 상태만 수정 폼으로 보낸다. */
export function ProductEditScreen({
  productId,
  destination,
  onBack,
}: {
  readonly productId: string;
  readonly destination: FormIntent;
  readonly onBack: () => void;
}) {
  const { t } = useTranslation();
  const state = useRecord(productQuery(productId), productId);
  return (
    <div>
      <h1>{t('products.form.editTitle')}</h1>
      <RecordView
        messages={{ loading: t('common.loading'), retry: t('common.retry'), refreshFailed: t('common.refreshFailed') }}
        state={state}
        renderFailure={(failure) => t(failureCopyKey(failure))}
        missingAction={() => <button onClick={onBack}>{t('products.backToList')}</button>}
      >
        {(product) => <ProductEditForm product={product} destination={destination} />}
      </RecordView>
    </div>
  );
}
/** 저장 확인에는 키트가 고정한 제출 값만 표시한다. */
function ProductEditForm({ product, destination }: { readonly product: Product; readonly destination: FormIntent }) {
  const { t } = useTranslation();
  const message = useFieldMessage();
  const update = useUpdateProduct(product.id);
  return (
    <SaveForm
      schema={productFormSchema}
      source={{ id: product.id, values: toProductFormValues(product) }}
      confirm
      save={async (output) => ({ saved: toProductFormValues(await update.mutateAsync(toProductUpsertRequest(output))) })}
      fieldError={productFieldError}
      formatError={message}
      renderFailure={(failure) => t(failureCopyKey(failure))}
      completion={() => destination}
      confirmation={(submitted) => (
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
    >
      {(fields) => <ProductForm fields={fields} submitLabel={t('products.form.submitEdit')} cancel={destination} />}
    </SaveForm>
  );
}
