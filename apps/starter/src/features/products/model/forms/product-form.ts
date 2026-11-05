// 파일 책임: 상품 등록·수정 폼의 값 모양·검증 schema와, 원본 → 폼 값 / 폼 결과 → 저장 요청 변환, 서버 필드 오류 대응.
import type { ProductUpsertRequest } from '@/api/generated/models';
import { formMessages } from '@/shared/lib/form-messages';
import type { FieldError } from '@boosterlab/web-kit/failure';
import { z } from 'zod';
import { PRODUCT_STATUSES, type Product, type ProductStatus } from './product';

const m = (key: string) => formMessages.encode(`products.form.errors.${key}`);
const amount = z.string().trim().regex(/^\d{1,9}$/, m('amount')).transform(Number);

/** 옵션은 1~5줄이다. 서버 명세의 minItems·maxItems를 옮긴 것이다. */
export const OPTION_LIMITS = { min: 1, max: 5 } as const;

const option = z.object({
  name: z.string().trim().min(1, m('optionNameRequired')).max(30, m('optionNameTooLong')),
  extraPrice: amount,
});

/** 입력 값(문자열) → 저장 값(숫자 변환 포함). 서버 명세의 제약을 옮긴 것이다. */
export const productFormSchema = z.object({
  name: z.string().trim().min(1, m('nameRequired')).max(100, m('nameTooLong')),
  code: z.string().trim().regex(/^[A-Z0-9-]{3,20}$/, m('codeFormat')),
  status: z.enum(PRODUCT_STATUSES),
  categoryId: z.string().min(1, m('categoryRequired')),
  price: amount,
  stock: amount,
  options: z.array(option).min(OPTION_LIMITS.min, m('optionsCount')).max(OPTION_LIMITS.max, m('optionsCount')),
  description: z.string().max(500, m('descriptionTooLong')),
});

export type ProductFormValues = z.input<typeof productFormSchema>;
export type ProductFormOutput = z.output<typeof productFormSchema>;

export const emptyProductForm: ProductFormValues = {
  name: '',
  code: '',
  status: 'DRAFT' satisfies ProductStatus,
  categoryId: '',
  price: '0',
  stock: '0',
  options: [{ name: '', extraPrice: '0' }],
  description: '',
};

/** 원본(또는 저장 결과) → 폼 값. */
export function toProductFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    code: product.code,
    status: product.status,
    categoryId: product.categoryId,
    price: String(product.price),
    stock: String(product.stock),
    options: product.options.map((option) => ({ name: option.name, extraPrice: String(option.extraPrice) })),
    description: product.description,
  };
}

/** 검증된 폼 결과 → 서버 요청. 빈 설명은 null로 보낸다. */
export function toProductUpsertRequest(output: ProductFormOutput): ProductUpsertRequest {
  return { ...output, description: output.description === '' ? null : output.description };
}

const FORM_FIELDS = new Set<string>(Object.keys(emptyProductForm));

/** 서버 필드 오류 → 폼 경로와 문구. 폼에 없는 필드면 붙이지 않는다(unattachedFieldErrors로 남는다). */
export function productFieldError(error: FieldError): { readonly field: keyof ProductFormValues; readonly message: string } | undefined {
  if (!FORM_FIELDS.has(error.field)) return undefined;
  const key = error.field === 'code' && error.code === 'DUPLICATE' ? 'codeDuplicate' : 'invalid';
  return { field: error.field as keyof ProductFormValues, message: m(key) };
}
