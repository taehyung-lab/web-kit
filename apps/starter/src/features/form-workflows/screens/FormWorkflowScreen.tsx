// 파일 책임: 항목 참조와 두 저장 방식의 소비 예제를 공용 폼에 연결한다.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSaveForm } from '@boosterlab/web-kit/form';
import { Form } from '@boosterlab/web-kit/form/ui';
import { useFormCopy } from '@/shared/lib/form-messages';
import { saveWorkflow } from '../api/workflows';
import { draftSchema, publishSchema, initialWorkflow, workflowReferences, type WorkflowValues } from '../model/form';
const F = Form.of<WorkflowValues>();
const SOURCE = { id: 'example', values: initialWorkflow };
/** 관계·검증·문구만 예제가 정하고 확인·정리·잠금·변경 감지는 키트가 처리한다. */
export function FormWorkflowScreen() {
  const { t } = useTranslation();
  const copy = useFormCopy();
  const [notice, setNotice] = useState('');
  /** 필수 제목을 검증한 게시 요청을 보낸다. */
  function publish(values: WorkflowValues) {
    return saveWorkflow(values, 'publish');
  }
  /** 제목을 아직 입력하지 않아도 임시 저장 요청을 보낸다. */
  function saveDraft(values: WorkflowValues) {
    return saveWorkflow(values, 'draft');
  }
  const editor = useSaveForm({
    schema: publishSchema,
    source: SOURCE,
    references: workflowReferences,
    save: publish,
    onSaved: () => setNotice(t('workflows.published')),
    secondary: { schema: draftSchema, save: saveDraft, onSaved: () => setNotice(t('workflows.draftSaved')) },
  });
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('workflows.title')}</h1>
      <p>{t('workflows.description')}</p>
      <F
        editor={editor}
        {...copy}
        messages={{
          ...copy.messages,
          referenceTitle: (count) => t('workflows.referenceTitle', { count }),
          referenceConfirm: t('workflows.clear'),
        }}
      >
        <F.Text name="title" label={t('workflows.name')} />
        <F.Array name="items">
          {(rows) => (
            <div className="flex flex-col gap-3">
              {rows.items.map((item, index) => (
                <div className="wk-actions" key={item.id}>
                  <F.Text name={`items[${index}].name`} label={t('workflows.item', { count: index + 1 })} />
                  <button type="button" className="wk-button wk-button-secondary" onClick={() => rows.remove(index)}>
                    {t('workflows.remove', { count: index + 1 })}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="wk-button wk-button-secondary"
                onClick={() => rows.append({ id: crypto.randomUUID(), name: t('workflows.newItem', { count: rows.items.length + 1 }) })}
              >
                {t('workflows.add')}
              </button>
            </div>
          )}
        </F.Array>
        <F.Choice
          name="selected"
          label={t('workflows.selected')}
          nodes={editor.form.state.values.items.map((item) => ({ value: item.id, label: item.name }))}
        />
        <F.Failure />
        <div className="wk-actions">
          <F.Submit>{t('workflows.publish')}</F.Submit>
          <F.Submit mode="secondary">{t('workflows.draft')}</F.Submit>
          <F.Cancel to={{ to: '/products' }} />
        </div>
        <p role="status">{editor.isDirty ? t('workflows.unsaved') : notice}</p>
      </F>
    </div>
  );
}
