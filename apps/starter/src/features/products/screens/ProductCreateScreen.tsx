// 파일 책임: 상품 등록의 원본·검증·서버 요청과 완료 목적지를 선언한다.
import { SaveForm, type FormIntent } from '@boosterlab/web-kit/form/ui';
import { useTranslation } from 'react-i18next';
import { useFieldMessage } from '@/shared/lib/form-messages';
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { useCreateProduct } from '../api/products';
import { emptyProductForm, productFieldError, productFormSchema, toProductFormValues, toProductUpsertRequest } from '../model/form';
import { ProductForm } from './ProductForm';
/** 저장·입력·이탈 수명은 SaveForm 한 번으로 연결한다. */
export function ProductCreateScreen({
  createdDestination,
  cancel,
}: {
  readonly createdDestination: (id: string) => FormIntent;
  readonly cancel: FormIntent;
}) {
  const { t } = useTranslation();
  const create = useCreateProduct();
  const message = useFieldMessage();
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('products.form.createTitle')}</h1>
      <SaveForm
        schema={productFormSchema}
        source={{ id: 'new', values: emptyProductForm }}
        fieldError={productFieldError}
        formatError={message}
        renderFailure={(failure) => t(failureCopyKey(failure))}
        save={async (output) => {
          const created = await create.mutateAsync(toProductUpsertRequest(output));
          return { saved: toProductFormValues(created), id: created.id };
        }}
        completion={(result) => createdDestination(result.id)}
      >
        {(fields) => <ProductForm fields={fields} submitLabel={t('products.form.submitCreate')} cancel={cancel} />}
      </SaveForm>
    </div>
  );
}
