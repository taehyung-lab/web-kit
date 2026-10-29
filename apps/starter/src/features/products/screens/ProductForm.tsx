// 파일 책임: 상품 필드·배치·옵션의 업무 값을 선언한다. 입력·검증·오류 연결은 키트 Form 부품이 맡는다.
import { Form } from '@/shared/ui/web-kit/form/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFieldMessage } from '@/shared/lib/form-messages';
import { categoryOptionsQuery } from '../api/categories';
import { OPTION_LIMITS, type ProductFormValues } from '../model/form';
import { PRODUCT_STATUSES } from '../model/product';

const F = Form.of<ProductFormValues>();
/** 취소 버튼이 가는 곳(키트 Form.Cancel의 to). */
type CancelTo = Parameters<typeof Form.Cancel>[0]['to'];

/** 등록·수정의 업무 필드는 같은 선언을 사용한다. `<Form editor>` 안에 둔다. */
export function ProductFields({ submitLabel, cancelTo }: { readonly submitLabel: string; readonly cancelTo: CancelTo }) {
  const { t } = useTranslation();
  const message = useFieldMessage();
  const categories = useQuery(categoryOptionsQuery());
  return (
    <>
      <F.Failure />
      <div className="grid gap-5 md:grid-cols-2">
        <F.Text name="name" label={t('products.fields.name')} />
        <F.Text name="code" label={t('products.fields.code')} description={t('products.form.codeDescription')} />
        <F.Select
          name="status"
          label={t('products.fields.status')}
          options={PRODUCT_STATUSES.map((value) => ({ value, label: t(`products.status.${value}`) }))}
        />
        <F.Select
          name="categoryId"
          label={t('products.fields.category')}
          placeholder={t('products.form.chooseCategory')}
          status={categories.isError ? { failure: categories.error } : categories.data === undefined ? 'loading' : 'ready'}
          onRetry={() => void categories.refetch()}
          options={(categories.data ?? []).map((category) => ({ value: category.id, label: category.name }))}
        />
        <F.Text name="price" label={t('products.fields.price')} inputMode="numeric" />
        <F.Text name="stock" label={t('products.fields.stock')} inputMode="numeric" />
      </div>
      <F.Array name="options" minItems={OPTION_LIMITS.min} maxItems={OPTION_LIMITS.max}>
        {(rows) => {
          const add = () => rows.append({ name: '', extraPrice: '0' });
          return (
            <F.Section title={t('products.fields.options')}>
              {rows.items.map((_, index) => (
                <div className="grid gap-3 md:grid-cols-3" key={index}>
                  <F.Text
                    name={`options[${index}].name`}
                    label={`${t('products.fields.optionName')} ${index + 1}`}
                    onKeyDown={rows.enterAdds(add)}
                  />
                  <F.Text
                    name={`options[${index}].extraPrice`}
                    label={`${t('products.fields.optionExtraPrice')} ${index + 1}`}
                    inputMode="numeric"
                    onKeyDown={rows.enterAdds(add)}
                  />
                  {rows.canRemove && (
                    <button type="button" className="wk-button wk-button-secondary" onClick={() => rows.remove(index)}>
                      {t('products.form.removeOption', { index: index + 1 })}
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="wk-button wk-button-secondary" disabled={!rows.canAdd} onClick={add}>
                {t('products.form.addOption')}
              </button>
              {message(rows.errors) && <p role="alert">{message(rows.errors)}</p>}
            </F.Section>
          );
        }}
      </F.Array>
      <F.TextArea name="description" label={t('products.fields.description')} maxLength={500} />
      <div className="wk-actions">
        <F.Submit>{submitLabel}</F.Submit>
        <F.Cancel to={cancelTo} />
      </div>
    </>
  );
}
