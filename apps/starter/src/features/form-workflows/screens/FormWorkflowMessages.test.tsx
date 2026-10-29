// 파일 책임: 설치된 키트의 폼 전체 오류를 프로젝트 번역으로 표시하는 연결을 검사한다.
import { i18n } from '@/app/i18n';
import { useSaveForm } from '@boosterlab/web-kit/form';
import { Form } from '@boosterlab/web-kit/form/ui';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { formMessages, useFormCopy } from '@/shared/lib/form-messages';

it('두 번째 저장의 전체 오류는 프로젝트 문구로 표시하고 언어 변경도 반영한다', async () => {
  const save = vi.fn(async () => undefined);
  const schema = z.object({ title: z.string() });
  const F = Form.of<z.input<typeof schema>>();
  /** 공용 폼에 프로젝트 오류 번역 연결만 제공한다. */
  function Example() {
    const copy = useFormCopy();
    const editor = useSaveForm({
      schema,
      source: { id: 1, values: { title: '' } },
      save,
      secondary: {
        schema: schema.refine(() => false, formMessages.encode('workflows.invalidReference')),
        save,
      },
    });
    return (
      <F editor={editor} {...copy} protect={false}>
        <F.Failure />
        <F.Submit mode="secondary">임시 저장</F.Submit>
      </F>
    );
  }
  render(<Example />);
  await act(async () => fireEvent.click(screen.getByText('임시 저장')));
  expect(screen.getByRole('alert').textContent).toBe('선택한 항목을 다시 확인해 주세요.');
  expect(save).not.toHaveBeenCalled();
  await act(async () => {
    await i18n.changeLanguage('en');
  });
  expect(screen.getByRole('alert').textContent).toBe('Check the selected item.');
});
