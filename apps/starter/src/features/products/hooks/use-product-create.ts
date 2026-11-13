// 파일 책임: 상품 등록 흐름. 저장은 등록 요청과 편집 기준을 돌려주고, 완료(onSaved)에서 새 상품 상세로 간다.
import { useSaveForm } from '@boosterlab/web-kit/form';
import { useNavigate } from '@tanstack/react-router';
import { useCreateProduct } from '../api/products';
import { emptyProductForm, productFieldError, productFormSchema, toProductFormValues, toProductUpsertRequest, type ProductFormOutput } from '../forms/product-form';
import { useCategoryOptions } from './use-category-options';

const SOURCE = { id: 'new', values: emptyProductForm } as const;

/** 등록 화면이 쓸 폼 상태와 분류 선택지. */
export function useProductCreate() {
  const navigate = useNavigate();
  const create = useCreateProduct();
  const categories = useCategoryOptions();
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
  return { editor, categories };
}
