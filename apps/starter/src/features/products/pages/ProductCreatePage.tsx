// 파일 책임: 상품 등록 화면. 제목과 폼 배치를 그린다. 원본·검증·요청·완료 목적지는 등록 flow가 맡는다.
import { Form } from '@/shared/ui/web-kit/form/form';
import { useTranslation } from 'react-i18next';
import { useProductCreate } from '../hooks/use-product-create';
import { ProductFields } from './ProductForm';

/** 저장하면 새 상품 상세로, 취소하면 목록으로 간다. */
export function ProductCreatePage() {
  const { t } = useTranslation();
  const { editor, categories } = useProductCreate();
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('products.form.createTitle')}</h1>
      <Form editor={editor}>
        <ProductFields submitLabel={t('products.form.submitCreate')} cancelTo={{ to: '/products' }} categories={categories} />
      </Form>
    </div>
  );
}
