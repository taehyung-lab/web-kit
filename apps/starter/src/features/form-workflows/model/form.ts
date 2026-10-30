// 파일 책임: 작성 예제의 값·정식/임시 검증과 항목 참조 관계를 선언한다.
import { z } from 'zod';
import type { ConditionalField, FormReference } from '@boosterlab/web-kit/form';
import { formMessages } from '@/shared/lib/form-messages';
export const draftSchema = z.object({
  title: z.string(),
  hasNote: z.boolean(),
  note: z.string(),
  items: z.array(z.object({ id: z.string(), name: z.string() })),
  selected: z.string(),
});
/** 표시와 필수 검증이 같은 조건을 참조한다. */
export const showWorkflowNote = (values: { hasNote: boolean }) => values.hasNote;
export const publishSchema = draftSchema.extend({ title: z.string().trim().min(1, formMessages.encode('workflows.requiredTitle')) }).superRefine((values, context) => {
  if (showWorkflowNote(values) && values.note.trim() === '') context.addIssue({ code: 'custom', path: ['note'], message: formMessages.encode('workflows.requiredNote') });
});
export type WorkflowValues = z.input<typeof draftSchema>;
export const initialWorkflow: WorkflowValues = { title: '', hasNote: false, note: '', items: [], selected: '' };
export const workflowReferences: readonly FormReference<WorkflowValues>[] = [
  { source: (v) => v.items.map((item) => item.id), fields: () => ['selected'], message: formMessages.encode('workflows.invalidReference') },
];

/** 조건과 서버 빈 값을 폼 정의에서 선언하고 화면에 중복하지 않는다. */
export const workflowConditionalFields = (values: WorkflowValues): readonly ConditionalField<WorkflowValues>[] => [
  { field: 'note', visible: showWorkflowNote(values), emptyValue: '' },
];
