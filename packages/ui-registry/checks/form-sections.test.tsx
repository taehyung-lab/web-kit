// @vitest-environment jsdom
// 파일 책임: 설치한 UI 복사본을 키트의 공통 단위 검사에 연결하고, 구역 제목·입력 칸 모양 입구를 확인한다.
import { Form, FormGuard, FormSection, FormDefaults, defaultFormMessages, defaultFormGuardMessages } from '../form/ui';
import { DialogDefaults, defaultDialogLabels } from '../ui/dialog';
import { checkFormSectionsConformance } from '@boosterlab/web-kit/testing/unit/form';
import installation from '../../../../../registry-installation.json';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { useSaveForm } from '@boosterlab/web-kit/form';
import { afterEach, expect, it } from 'vitest';
import { z } from 'zod';
const copy = { FormDefaults, defaultFormMessages, defaultFormGuardMessages, DialogDefaults, defaultDialogLabels };
checkFormSectionsConformance({ Form, FormGuard, FormSection, ...copy }, { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit });

afterEach(cleanup);
const classSchema = z.object({ title: z.string(), kind: z.string() });
const C = Form.of<z.input<typeof classSchema>>();

/** 표시 입구는 모양만 바꾸고 라벨 연결·열고 닫기는 그대로다. */
function ClassScreen() {
  const editor = useSaveForm({ schema: classSchema, source: { id: 1, values: { title: '', kind: 'a' } }, save: async () => undefined });
  return (
    <C editor={editor}>
      <C.Section title="Fold" fields={['title']} headingClassName="bg-muted">
        <C.Text name="title" label="Title" controlClassName="h-9" />
      </C.Section>
      <C.Section title="Plain" headingClassName="text-xs">
        <C.Select name="kind" label="Kind" options={[{ value: 'a', label: 'A' }]} controlClassName="w-72" />
      </C.Section>
    </C>
  );
}

it('Form.Section headingClassName and Form.Text/Select controlClassName style only the heading and the control', async () => {
  const root = createRootRoute({ component: () => <FormGuard messages={defaultFormGuardMessages}><Outlet /></FormGuard> });
  const page = createRoute({ getParentRoute: () => root, path: '/', component: ClassScreen });
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  await act(async () => {
    render(
      <DialogDefaults labels={defaultDialogLabels}>
        <FormDefaults messages={defaultFormMessages}>
          <RouterProvider router={router} />
        </FormDefaults>
      </DialogDefaults>,
    );
    await router.load();
  });
  const fold = screen.getByRole('button', { name: 'Fold' });
  expect(fold.closest('h2')!.className).toContain('bg-muted');
  expect(fold.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByText('Plain').tagName).toBe('LEGEND');
  expect(screen.getByText('Plain').className).toContain('text-xs');
  expect(screen.getByLabelText('Title').className).toContain('h-9');
  const kind = screen.getByRole('combobox', { name: 'Kind' });
  expect(kind.className).toContain('w-72');
  expect(kind.className).not.toContain('w-full');
});
