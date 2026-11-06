// 파일 책임: 공연 예시 등록 화면 — 배열·하위 폼·파일 동작(회차 줄 오류 위치, 대화창 하위 폼 제출 격리, 좌석도 파일 보존)을 키트 값만으로 재현한다.
// 회차 줄은 Form.Array(추가·삭제·위/아래 이동), 좌석도는 Form.File, 판매처 키는 Form.Dialog 안의 자기 저장 폼(use-vendor-keys-form)이다.
// 회차·판매처 키는 접을 수 있는 구역(Form.Section fields)이라 닫힌 구역의 오류는 제출 뒤 펼쳐지고 그 칸에 포커스한다.
// 저장(좌석도 업로드 → 등록)과 완료 뒤 이동은 등록 flow가 맡는다. 공연 폼 전체를 옮긴 것은 아니다.
import { Button } from '@/shared/ui/button';
import { Form } from '@/shared/ui/web-kit/form/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShowCreate } from '../flows/use-show-create';
import { useVendorKeysForm } from '../flows/use-vendor-keys-form';
import { newRound, type ShowFormInput, type VendorKeysInput } from '../model/forms/show-form';

const F = Form.of<ShowFormInput>();
const K = Form.of<VendorKeysInput>();

/** 공연 예시 등록. */
export function ShowCreateScreen() {
  const { t } = useTranslation();
  const [keysOpen, setKeysOpen] = useState(false);
  const { editor } = useShowCreate();
  const vendorKeys = editor.form.state.values.vendorKeys;
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('shows.createTitle')}</h1>
      <F editor={editor} saved={{ body: t('shows.savedBody') }}>
        <F.Failure />
        <F.Text name="title" label={t('shows.fields.title')} />
        <F.Array name="rounds" minItems={1}>
          {(rows) => (
            <F.Section title={t('shows.fields.rounds')} fields={['rounds']}>
              {rows.items.map((item, index) => (
                <div
                  key={item.key}
                  role="group"
                  aria-label={t('shows.round', { index: index + 1 })}
                  className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <F.Text name={`rounds[${index}].date`} type="date" label={t('shows.fields.date', { index: index + 1 })} />
                  <F.Text name={`rounds[${index}].time`} type="time" label={t('shows.fields.time', { index: index + 1 })} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline"
                      disabled={index === 0}
                      onClick={() => rows.move(index, index - 1)}
                    >
                      {t('shows.moveUp', { index: index + 1 })}
                    </Button>
                    <Button variant="outline"
                      disabled={index === rows.items.length - 1}
                      onClick={() => rows.move(index, index + 1)}
                    >
                      {t('shows.moveDown', { index: index + 1 })}
                    </Button>
                    {rows.canRemove ? (
                      <Button variant="outline" onClick={() => rows.remove(index)}>
                        {t('shows.removeRound', { index: index + 1 })}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => rows.append(newRound())}>
                  {t('shows.addRound')}
                </Button>
              </div>
            </F.Section>
          )}
        </F.Array>
        <F.File name="seat" label={t('shows.fields.seat')} accept="image/*,.pdf" />
        <F.Section title={t('shows.fields.vendorKeys')} fields={['vendorKeys']}>
          <p>{vendorKeys.length === 0 ? t('shows.noVendorKeys') : vendorKeys.map((item) => item.value).join(', ')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setKeysOpen(true)}>
              {t('shows.editVendorKeys')}
            </Button>
          </div>
        </F.Section>
        <div className="flex flex-wrap items-center gap-2">
          <F.Submit />
          <F.Cancel to={{ to: '/products' }} />
        </div>
        {keysOpen ? (
          <F.Dialog title={t('shows.vendorKeysTitle')} onClose={() => setKeysOpen(false)}>
            <VendorKeysForm
              initial={vendorKeys}
              onConfirm={(keys) => {
                editor.form.setFieldValue('vendorKeys', keys);
                setKeysOpen(false);
              }}
            />
          </F.Dialog>
        ) : null}
      </F>
    </div>
  );
}

/** 판매처 키 하위 폼. 열릴 때마다 새로 시작하고, 확인은 이 폼만 검증한 뒤 바깥 값에 넣는다(바깥 폼을 제출하지 않는다). */
function VendorKeysForm({
  initial,
  onConfirm,
}: {
  readonly initial: VendorKeysInput['keys'];
  readonly onConfirm: (keys: VendorKeysInput['keys']) => void;
}) {
  const { t } = useTranslation();
  const { editor } = useVendorKeysForm(initial, onConfirm);
  return (
    <K editor={editor} messages={{ submit: t('common.confirm') }}>
      <K.Array name="keys" minItems={1}>
        {(rows) => (
          <>
            {rows.items.map((item, index) => (
              <div key={item.key} className="flex flex-wrap items-center gap-2">
                <K.Text name={`keys[${index}].value`} label={t('shows.fields.vendorKey', { index: index + 1 })} />
                {rows.canRemove ? (
                  <Button variant="outline" onClick={() => rows.remove(index)}>
                    {t('shows.removeVendorKey', { index: index + 1 })}
                  </Button>
                ) : null}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline"
                onClick={() => rows.append({ key: crypto.randomUUID(), value: '' })}
              >
                {t('shows.addVendorKey')}
              </Button>
            </div>
          </>
        )}
      </K.Array>
      <div className="flex flex-wrap items-center gap-2">
        <K.Submit />
        <K.Cancel />
      </div>
    </K>
  );
}
