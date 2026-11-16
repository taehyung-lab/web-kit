// 파일 책임: 작성 예제 흐름. 게시(정식 검증)와 임시 저장(느슨한 검증) 두 저장을 공용 폼 수명에 연결하고, 게시 뒤 조회는 완료(onSaved)에서 한다.
import { useSaveForm } from '@boosterlab/web-kit/form';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readSavedWorkflow, saveWorkflow } from '../api/workflows';
import { draftSchema, initialWorkflow, publishSchema, workflowConditionalFields, workflowReferences, type WorkflowValues } from '../forms/workflow-form';

const SOURCE = { id: 'example', values: initialWorkflow };

/** 작성 화면이 쓸 폼 상태와 마지막 저장 안내. */
export function useWorkflowForm() {
  const { t } = useTranslation();
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
    conditionalFields: workflowConditionalFields,
    save: publish,
    onSaved: async (result) => {
      await readSavedWorkflow(result.id);
      setNotice(t('workflows.published'));
    },
    secondary: { schema: draftSchema, save: saveDraft, onSaved: () => setNotice(t('workflows.draftSaved')) },
  });
  return { editor, notice };
}
