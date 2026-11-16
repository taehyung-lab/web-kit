// 파일 책임: 상품 수정 흐름. 수정 원본의 단건 상태(useRecord)와, 준비된 원본으로 만든 저장 폼을 나눠 돌려준다. 저장 뒤 상세로 간다.
import { useSaveForm } from '@boosterlab/web-kit/form';
import { useRecord } from '@boosterlab/web-kit/record';
import { useNavigate } from '@tanstack/react-router';
import { productQuery, useUpdateProduct } from '../api/products';
import { productFieldError, productFormSchema, toProductFormValues, toProductUpsertRequest, type ProductFormOutput } from '../forms/product-form';
import type { Product } from '../product';
import { useCategoryOptions } from './use-category-options';

/** 수정 원본의 단건 상태. 판정은 이 한 곳에서 한다. */
export function useProductEditSource(productId: string) {
  return useRecord(productQuery(productId), productId, { progress: 'page' });
}

/** 준비된 원본의 수정 폼과 분류 선택지. */
export function useProductEdit(product: Product) {
  const navigate = useNavigate();
  const update = useUpdateProduct(product.id);
  const categories = useCategoryOptions();
  /** 제출 값을 서버 요청으로 바꾸고 저장된 값을 편집 기준으로 돌려준다. */
  async function saveProduct(output: ProductFormOutput) {
    const saved = await update.mutateAsync(toProductUpsertRequest(output));
    return { saved: toProductFormValues(saved) };
  }
  const editor = useSaveForm({
    schema: productFormSchema,
    source: { id: product.id, values: toProductFormValues(product) },
    confirm: true,
    progress: 'edit',
    fieldError: productFieldError,
    save: saveProduct,
    onSaved: () => navigate({ to: '/products/$productId', params: { productId: product.id } }),
  });
  return { editor, categories };
}
