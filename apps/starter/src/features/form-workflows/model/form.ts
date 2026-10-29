// 파일 책임: 작성 예제의 값·정식/임시 검증과 항목 참조 관계를 선언한다.
import { z } from 'zod';
import type { FormReference } from '@boosterlab/web-kit/form';
import { formMessages } from '@/shared/lib/form-messages';
export const draftSchema = z.object({
  title: z.string(),
  items: z.array(z.object({ id: z.string(), name: z.string() })),
  selected: z.string(),
});
export const publishSchema = draftSchema.extend({ title: z.string().trim().min(1, formMessages.encode('workflows.requiredTitle')) });
export type WorkflowValues = z.input<typeof draftSchema>;
export const initialWorkflow: WorkflowValues = { title: '', items: [], selected: '' };
export const workflowReferences: readonly FormReference<WorkflowValues>[] = [
  { source: (v) => v.items.map((item) => item.id), fields: () => ['selected'], message: formMessages.encode('workflows.invalidReference') },
];
