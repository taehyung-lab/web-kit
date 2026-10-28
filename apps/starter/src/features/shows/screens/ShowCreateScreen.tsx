// 파일 책임: 공연 예시 등록 화면 — DT 공연 폼의 복잡한 부분(회차 줄 오류 위치, 대화창 하위 폼 제출 격리, 좌석도 파일 보존)을 키트 값만으로 재현한다.
// 회차 줄은 Form.Array(추가·삭제·위/아래 이동), 좌석도는 Form.File, 판매처 키는 Form.Dialog 안의 자기 useSaveForm이다.
// 회차·판매처 키는 접을 수 있는 구역(Form.Section fields)이라 닫힌 구역의 오류는 제출 뒤 펼쳐지고 그 칸에 포커스한다.
// 저장: 좌석도 업로드 → 등록. 저장 완료 확인 뒤 상품 목록으로 간다. 공연 폼 전체를 옮긴 것은 아니다.
import { useSaveForm, type FormFileValue } from '@boosterlab/web-kit/form';
import { Form } from '@boosterlab/web-kit/form/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormCopy } from '@/shared/lib/form-messages';
import { createShow, uploadFile } from '../api/shows';
import {
  EMPTY_SHOW_FORM,
  newRound,
  showFieldError,
  showFormSchema,
  toShowRequest,
  vendorKeysSchema,
  type ShowFormInput,
  type VendorKeysInput,
} from '../model/show';

const F = Form.of<ShowFormInput>();
const K = Form.of<VendorKeysInput>();
const SOURCE = { id: 'new', values: EMPTY_SHOW_FORM } as const;

/** 고른 좌석도 파일. 저장 함수가 업로드한다(schema가 고른 파일·기존 파일만 받는다). */
function selectedFile(seat: FormFileValue): File {
  if (seat.kind !== 'selected') throw new Error('seat file is not selected');
  return seat.file;
}

/** 공연 예시 등록. */
export function ShowCreateScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const copy = useFormCopy();
  const [keysOpen, setKeysOpen] = useState(false);
  /** 좌석도를 올린 뒤 파일 식별자를 공연 등록 요청에 연결한다. */
  async function saveShow(_values: ShowFormInput, submitted: ShowFormInput) {
    const { fileId } = await uploadFile(selectedFile(submitted.seat));
    return createShow(toShowRequest(submitted, fileId));
  }
  const editor = useSaveForm({
    schema: showFormSchema,
    source: SOURCE,
    acknowledge: true,
    progress: 'create',
    fieldError: showFieldError,
    save: saveShow,
    onSaved: () => navigate({ to: '/products' }),
  });
  const vendorKeys = editor.form.state.values.vendorKeys;
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('shows.createTitle')}</h1>
      <F editor={editor} {...copy}>
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
                  <div className="wk-actions">
                    <button
                      type="button"
                      className="wk-button wk-button-secondary"
                      disabled={index === 0}
                      onClick={() => rows.move(index, index - 1)}
                    >
                      {t('shows.moveUp', { index: index + 1 })}
                    </button>
                    <button
                      type="button"
                      className="wk-button wk-button-secondary"
                      disabled={index === rows.items.length - 1}
                      onClick={() => rows.move(index, index + 1)}
                    >
                      {t('shows.moveDown', { index: index + 1 })}
                    </button>
                    {rows.canRemove ? (
                      <button type="button" className="wk-button wk-button-secondary" onClick={() => rows.remove(index)}>
                        {t('shows.removeRound', { index: index + 1 })}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              <div className="wk-actions">
                <button type="button" className="wk-button wk-button-secondary" onClick={() => rows.append(newRound())}>
                  {t('shows.addRound')}
                </button>
              </div>
            </F.Section>
          )}
        </F.Array>
        <F.File name="seat" label={t('shows.fields.seat')} accept="image/*,.pdf" />
        <F.Section title={t('shows.fields.vendorKeys')} fields={['vendorKeys']}>
          <p>{vendorKeys.length === 0 ? t('shows.noVendorKeys') : vendorKeys.map((item) => item.value).join(', ')}</p>
          <div className="wk-actions">
            <button type="button" className="wk-button wk-button-secondary" onClick={() => setKeysOpen(true)}>
              {t('shows.editVendorKeys')}
            </button>
          </div>
        </F.Section>
        <div className="wk-actions">
          <F.Submit />
          <F.Cancel to={{ to: '/products' }} />
        </div>
        <F.Saved>{t('shows.savedBody')}</F.Saved>
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
  const copy = useFormCopy();
  const [source] = useState(() => ({
    id: 'vendor-keys',
    values: { keys: initial.length === 0 ? [{ key: crypto.randomUUID(), value: '' }] : [...initial] },
  }));
  const editor = useSaveForm({
    schema: vendorKeysSchema,
    source,
    save: async (_values, submitted) => onConfirm(submitted.keys),
  });
  return (
    <K editor={editor} {...copy} messages={{ ...copy.messages, submit: t('common.confirm') }}>
      <K.Array name="keys" minItems={1}>
        {(rows) => (
          <>
            {rows.items.map((item, index) => (
              <div key={item.key} className="wk-actions">
                <K.Text name={`keys[${index}].value`} label={t('shows.fields.vendorKey', { index: index + 1 })} />
                {rows.canRemove ? (
                  <button type="button" className="wk-button wk-button-secondary" onClick={() => rows.remove(index)}>
                    {t('shows.removeVendorKey', { index: index + 1 })}
                  </button>
                ) : null}
              </div>
            ))}
            <div className="wk-actions">
              <button
                type="button"
                className="wk-button wk-button-secondary"
                onClick={() => rows.append({ key: crypto.randomUUID(), value: '' })}
              >
                {t('shows.addVendorKey')}
              </button>
            </div>
          </>
        )}
      </K.Array>
      <div className="wk-actions">
        <K.Submit />
        <K.Cancel />
      </div>
    </K>
  );
}
