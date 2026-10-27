// 파일 책임: 상품 필드·배치·옵션의 업무 값을 선언한다. 기본 입력 연결은 키트가 맡는다.
import type { FormFields, FormIntent } from '@boosterlab/web-kit/form/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFieldMessage } from '@/shared/lib/form-messages';
import { categoryOptionsQuery } from '../api/categories';
import { OPTION_LIMITS, type ProductFormValues } from '../model/form';
import { PRODUCT_STATUSES } from '../model/product';

/** 등록·수정의 업무 필드는 같은 선언을 사용한다. */
export function ProductForm({
  fields: f,
  submitLabel,
  cancel,
}: {
  readonly fields: FormFields<ProductFormValues>;
  readonly submitLabel: string;
  readonly cancel: FormIntent;
}) {
  const { t } = useTranslation();
  const message = useFieldMessage();
  const categories = useQuery(categoryOptionsQuery());
  return (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        <f.Text name="name" label={t('products.fields.name')} required />
        <f.Text name="code" label={t('products.fields.code')} required description={t('products.form.codeDescription')} />
        <f.Select
          name="status"
          label={t('products.fields.status')}
          required
          options={PRODUCT_STATUSES.map((value) => ({ value, label: t(`products.status.${value}`) }))}
        />
        <f.Select
          name="categoryId"
          label={t('products.fields.category')}
          required
          disabled={categories.data === undefined}
          options={[
            { value: '', label: t('products.form.chooseCategory') },
            ...(categories.data ?? []).map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
        <f.Text name="price" label={t('products.fields.price')} required inputMode="numeric" />
        <f.Text name="stock" label={t('products.fields.stock')} required inputMode="numeric" />
      </div>
      {categories.isError && (
        <button type="button" onClick={() => void categories.refetch()}>
          {t('common.retry')}
        </button>
      )}
      <f.Array name="options" minItems={OPTION_LIMITS.min} maxItems={OPTION_LIMITS.max}>
        {(rows) => {
          const add = () => rows.append({ name: '', extraPrice: '0' });
          return (
            <fieldset>
              <legend>{t('products.fields.options')}</legend>
              {rows.items.map((_, index) => (
                <div className="grid gap-3 md:grid-cols-3" key={index}>
                  <f.Text
                    name={`options[${index}].name`}
                    label={`${t('products.fields.optionName')} ${index + 1}`}
                    required
                    onKeyDown={rows.enterAdds(add)}
                  />
                  <f.Text
                    name={`options[${index}].extraPrice`}
                    label={`${t('products.fields.optionExtraPrice')} ${index + 1}`}
                    required
                    inputMode="numeric"
                    onKeyDown={rows.enterAdds(add)}
                  />
                  {rows.canRemove && (
                    <button type="button" onClick={() => rows.remove(index)}>
                      {t('products.form.removeOption', { index: index + 1 })}
                    </button>
                  )}
                </div>
              ))}
              <button type="button" disabled={!rows.canAdd} onClick={add}>
                {t('products.form.addOption')}
              </button>
              {message(rows.errors) && <p role="alert">{message(rows.errors)}</p>}
            </fieldset>
          );
        }}
      </f.Array>
      <f.TextArea name="description" label={t('products.fields.description')} />
      <f.Actions submitLabel={submitLabel} cancelLabel={t('common.cancel')} cancel={cancel} />
    </>
  );
}
