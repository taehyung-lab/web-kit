// 파일 책임: 상품 등록의 원본·검증·서버 요청과 완료 목적지를 선언한다.
import { useSaveForm } from '@boosterlab/web-kit/form';
import { Form } from '@/shared/ui/web-kit/form/ui';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useFormCopy } from '@/shared/lib/form-messages';
import { useCreateProduct } from '../api/products';
import {
  emptyProductForm,
  productFieldError,
  productFormSchema,
  toProductFormValues,
  toProductUpsertRequest,
  type ProductFormOutput,
} from '../model/form';
import { ProductFields } from './ProductForm';

const SOURCE = { id: 'new', values: emptyProductForm } as const;

/** 저장하면 새 상품 상세로, 취소하면 목록으로 간다. */
export function ProductCreateScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateProduct();
  const copy = useFormCopy();
  /** 제출 값을 등록 요청으로 바꾸고 새 상품의 편집 기준을 돌려준다. */
  async function saveProduct(output: ProductFormOutput) {
    const created = await create.mutateAsync(toProductUpsertRequest(output));
    return { saved: toProductFormValues(created), id: created.id };
  }
  const editor = useSaveForm({
    schema: productFormSchema,
    source: SOURCE,
    progress: 'create',
    fieldError: productFieldError,
    save: saveProduct,
    onSaved: (result) => navigate({ to: '/products/$productId', params: { productId: result.id } }),
  });
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('products.form.createTitle')}</h1>
      <Form editor={editor} {...copy}>
        <ProductFields submitLabel={t('products.form.submitCreate')} cancelTo={{ to: '/products' }} />
      </Form>
    </div>
  );
}
