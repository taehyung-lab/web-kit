// 파일 책임: 작성 예제 화면. 칸·줄·선택 배치를 그린다. 게시·임시 저장과 게시 후 조회는 작성 flow가 맡는다.
import { Button } from '@/shared/ui/button';
import { useTranslation } from 'react-i18next';
import { Form } from '@/shared/ui/web-kit/form/form';
import { useWorkflowForm } from '../flows/use-workflow-form';
import type { WorkflowValues } from '../model/forms/workflow-form';

const F = Form.of<WorkflowValues>();

/** 관계·검증·문구만 예제가 정하고 확인·정리·잠금·변경 감지는 키트가 처리한다. */
export function FormWorkflowScreen() {
  const { t } = useTranslation();
  const { editor, notice } = useWorkflowForm();
  return (
    <div className="flex flex-col gap-5">
      <h1>{t('workflows.title')}</h1>
      <p>{t('workflows.description')}</p>
      <F
        editor={editor}
        messages={{
          referenceTitle: (count) => t('workflows.referenceTitle', { count }),
          referenceConfirm: t('workflows.clear'),
        }}
      >
        <F.Text name="title" label={t('workflows.name')} />
        <F.Checkbox name="hasNote" label={t('workflows.hasNote')} />
        <F.Text name="note" label={t('workflows.note')} />
        <F.Array name="items">
          {(rows) => (
            <div className="flex flex-col gap-3">
              {rows.items.map((item, index) => (
                <div className="flex flex-wrap items-center gap-2" key={item.id}>
                  <F.Text name={`items[${index}].name`} label={t('workflows.item', { count: index + 1 })} />
                  <Button variant="outline" onClick={() => rows.remove(index)}>
                    {t('workflows.remove', { count: index + 1 })}
                  </Button>
                </div>
              ))}
              <Button variant="outline"
                onClick={() => rows.append({ id: crypto.randomUUID(), name: t('workflows.newItem', { count: rows.items.length + 1 }) })}
              >
                {t('workflows.add')}
              </Button>
            </div>
          )}
        </F.Array>
        <F.Choice
          name="selected"
          label={t('workflows.selected')}
          nodes={editor.form.state.values.items.map((item) => ({ value: item.id, label: item.name }))}
        />
        <F.Failure />
        <div className="flex flex-wrap items-center gap-2">
          <F.Submit>{t('workflows.publish')}</F.Submit>
          <F.Submit mode="secondary">{t('workflows.draft')}</F.Submit>
          <F.Cancel to={{ to: '/products' }} />
        </div>
        <p role="status">{editor.isDirty ? t('workflows.unsaved') : notice}</p>
      </F>
    </div>
  );
}
