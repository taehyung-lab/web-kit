// @vitest-environment jsdom
// 파일 책임: 접을 수 있는 폼 구역(Form.Section fields·FormSection)의 오류 처리를 실제 DOM으로 검사한다(0003 §3 form 행 "오류 요약·구역 펼침·첫 오류 포커스").
// 닫힌 구역 안 칸의 클라이언트 오류·서버 오류 → 그 구역이 펼쳐지고 머리글에 오류 표시(1.5 「!」), 첫 오류 칸에 포커스.
// 열림 규칙은 참조 프로젝트 use-form-sections의 사건 방식이다: 거절된 제출마다 오류 구역을 펼치고, 그 밖의 열고 닫기는 사용자 상태다.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RequestFailure } from '../src/failure';
import { FormRejection, useSaveForm } from '../src/form';
import { Form, FormGuard, FormSection } from '../src/form/ui';

afterEach(cleanup);
beforeAll(() => {
  window.scrollTo = vi.fn();
});

async function mount(node: () => ReactNode) {
  const root = createRootRoute({ component: () => <FormGuard><Outlet /></FormGuard> });
  const page = createRoute({ getParentRoute: () => root, path: '/', component: node });
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  await act(async () => {
    render(<RouterProvider router={router} />);
    await router.load();
  });
}

const schema = z.object({
  title: z.string().min(1, '제목 필요'),
  order: z.object({ grades: z.array(z.object({ key: z.string(), name: z.string().min(1, '등급 필요') })) }),
});
type Values = z.input<typeof schema>;
const F = Form.of<Values>();
const VALID: Values = { title: '공연', order: { grades: [{ key: 'a', name: 'VIP' }] } };
const rejectGrade = () =>
  new RequestFailure({ kind: 'validation', status: 400, fieldErrors: [{ field: 'grades[0].name', code: 'DUP' }] });

function Screen({ values, save }: { readonly values: Values; readonly save: () => Promise<unknown> }) {
  const editor = useSaveForm({
    schema,
    source: { id: 1, values },
    save,
    fieldError: (error) => (error.field === 'grades[0].name' ? { field: 'order.grades[0].name', message: '중복 등급' } : undefined),
  });
  return (
    <F editor={editor}>
      <F.Section title="기본" fields={['title']}>
        <F.Text name="title" label="제목" />
      </F.Section>
      <F.Section title="주문" fields={['order.grades']}>
        <F.Text name="order.grades[0].name" label="등급" />
      </F.Section>
      <F.Submit />
    </F>
  );
}

const header = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const grade = () => screen.getByLabelText('등급', { exact: false });

it('구역은 처음에 펼쳐져 있고 머리글 버튼으로 닫고 연다(닫혀도 칸은 남는다)', async () => {
  await mount(() => <Screen values={VALID} save={async () => undefined} />);
  expect(header('주문').getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(header('주문'));
  expect(header('주문').getAttribute('aria-expanded')).toBe('false');
  expect(grade().closest('[hidden]')).not.toBeNull();
  fireEvent.click(header('주문'));
  expect(grade().closest('[hidden]')).toBeNull();
});

it('닫힌 구역 안 칸의 클라이언트 오류: 제출하면 그 구역이 펼쳐지고 머리글에 오류 표시, 첫 오류 칸에 포커스한다', async () => {
  const save = vi.fn(async () => undefined);
  await mount(() => <Screen values={{ ...VALID, order: { grades: [{ key: 'a', name: '' }] } }} save={save} />);
  fireEvent.click(header('주문'));
  expect(header('주문').getAttribute('aria-expanded')).toBe('false');
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(document.activeElement).toBe(grade()));
  expect(header('주문').getAttribute('aria-expanded')).toBe('true');
  expect(header('주문').textContent).toContain('!');
  expect(header('주문').textContent).toContain('오류 1개');
  expect(header('기본').textContent).not.toContain('!');
  expect(save).not.toHaveBeenCalled();
  // 고쳐도 제출이 연 구역은 열린 채 남고, 오류 표시는 사라진다.
  fireEvent.change(grade(), { target: { value: 'R' } });
  await waitFor(() => expect(header('주문').textContent).not.toContain('!'));
  expect(header('주문').getAttribute('aria-expanded')).toBe('true');
});

it('닫힌 구역 안 칸의 서버 필드 오류: 그 구역이 펼쳐지고 오류 표시, 그 칸에 포커스한다', async () => {
  await mount(() => <Screen values={VALID} save={() => Promise.reject(rejectGrade())} />);
  fireEvent.click(header('주문'));
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(document.activeElement).toBe(grade()));
  expect(header('주문').getAttribute('aria-expanded')).toBe('true');
  expect(grade().getAttribute('aria-invalid')).toBe('true');
  expect(header('주문').textContent).toContain('오류 1개');
});

it('저장 중에 사용자가 닫은 구역도 그 저장의 서버 필드 오류가 늦게 오면 펼치고 그 칸에 포커스한다', async () => {
  let reject: (error: unknown) => void = () => undefined;
  const save = () =>
    new Promise<never>((_, fail) => {
      reject = fail;
    });
  await mount(() => <Screen values={VALID} save={save} />);
  await act(async () => fireEvent.click(screen.getByText('저장')));
  fireEvent.click(header('주문'));
  expect(header('주문').getAttribute('aria-expanded')).toBe('false');
  await act(async () => reject(rejectGrade()));
  await waitFor(() => expect(document.activeElement).toBe(grade()));
  expect(header('주문').getAttribute('aria-expanded')).toBe('true');
  expect(header('주문').textContent).toContain('오류 1개');
  // 고쳐도 서버 오류가 연 구역은 열린 채 남고, 그 뒤 닫으면 닫힌다.
  fireEvent.change(grade(), { target: { value: 'R' } });
  await act(async () => undefined);
  expect(header('주문').getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(header('주문'));
  expect(header('주문').getAttribute('aria-expanded')).toBe('false');
});

it('제출 뒤 사용자가 다시 닫으면 다음 거절된 제출까지 닫힌 채 둔다', async () => {
  await mount(() => <Screen values={{ ...VALID, order: { grades: [{ key: 'a', name: '' }] } }} save={async () => undefined} />);
  fireEvent.click(header('주문'));
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(header('주문').getAttribute('aria-expanded')).toBe('true'));
  fireEvent.click(header('주문'));
  expect(header('주문').getAttribute('aria-expanded')).toBe('false');
  fireEvent.change(grade(), { target: { value: 'x' } });
  fireEvent.change(grade(), { target: { value: '' } });
  await act(async () => undefined);
  expect(header('주문').getAttribute('aria-expanded')).toBe('false');
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(header('주문').getAttribute('aria-expanded')).toBe('true'));
});

it('키트 Form 밖의 폼도 FormSection으로 같은 규칙을 쓴다(useSaveForm의 form만 있는 화면)', async () => {
  function Plain() {
    const editor = useSaveForm({ schema, source: { id: 1, values: { ...VALID, title: '' } }, save: async () => undefined });
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void editor.submit();
        }}
      >
        <FormSection form={editor.form} fields={['title']} title="기본" errorLabel={(count) => `errors ${count}`}>
          <editor.form.Field name="title">
            {(field) => (
              <input
                id={editor.fieldId('title')}
                aria-label="제목"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            )}
          </editor.form.Field>
        </FormSection>
        <button type="submit">저장</button>
      </form>
    );
  }
  await mount(() => <Plain />);
  fireEvent.click(header('기본'));
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('제목')));
  expect(header('기본').getAttribute('aria-expanded')).toBe('true');
  expect(header('기본').textContent).toContain('errors 1');
});

it('거절 때 실패 칸이 없는 닫힌 구역은 닫힌 채 둔다(클라이언트 검증 실패·서버 필드 오류 모두)', async () => {
  const save = vi.fn(() => Promise.reject(rejectGrade()));
  await mount(() => <Screen values={{ ...VALID, order: { grades: [{ key: 'a', name: '' }] } }} save={save} />);
  fireEvent.click(header('기본'));
  fireEvent.click(header('주문'));
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(document.activeElement).toBe(grade()));
  expect(header('주문').getAttribute('aria-expanded')).toBe('true');
  expect(header('기본').getAttribute('aria-expanded')).toBe('false');
  expect(save).not.toHaveBeenCalled();

  // 서버 거절도 같다: 고쳐서 저장하면 서버가 등급만 거절하고, 닫아 둔 기본 구역은 그대로 닫혀 있다.
  fireEvent.change(grade(), { target: { value: 'VIP' } });
  fireEvent.click(header('주문'));
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(header('주문').getAttribute('aria-expanded')).toBe('true'));
  await waitFor(() => expect(document.activeElement).toBe(grade()));
  expect(save).toHaveBeenCalledTimes(1);
  expect(header('기본').getAttribute('aria-expanded')).toBe('false');
});

it('save가 던진 화면 절차 거절(FormRejection): 닫힌 오류 구역을 펼치고 문구를 붙여 그 칸에 포커스, 저장 중 닫은 구역도 다시 펼친다', async () => {
  let reject: (error: unknown) => void = () => undefined;
  const save = () =>
    new Promise<never>((_, fail) => {
      reject = fail;
    });
  await mount(() => <Screen values={VALID} save={save} />);
  fireEvent.click(header('기본'));
  await act(async () => fireEvent.click(screen.getByText('저장')));
  fireEvent.click(header('주문'));
  expect(header('주문').getAttribute('aria-expanded')).toBe('false');
  await act(async () => reject(new FormRejection([{ field: 'order.grades[0].name', message: '판매처 등급이 아닙니다' }])));
  await waitFor(() => expect(document.activeElement).toBe(grade()));
  expect(header('주문').getAttribute('aria-expanded')).toBe('true');
  expect(header('기본').getAttribute('aria-expanded')).toBe('false');
  expect(grade().getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByText('판매처 등급이 아닙니다')).toBeTruthy();
  expect(header('주문').textContent).toContain('오류 1개');
});

it('머리글 오류 표시는 프로젝트가 바꿀 수 있다: 기본은 「!」 + 낭독 "<제목> 오류 N개", errorMarker를 주면 그 표시(보이는 "오류 N개" 배지)', async () => {
  const twoErrors: Values = { title: '', order: { grades: [{ key: 'a', name: '' }] } };
  const marker = (count: number) => <span className="badge">{`오류 ${count}개`}</span>;
  function Marked() {
    const editor = useSaveForm({ schema, source: { id: 1, values: twoErrors }, save: async () => undefined });
    return (
      <F editor={editor}>
        <F.Section title="기본" fields={['title']}>
          <F.Text name="title" label="제목" />
        </F.Section>
        <F.Section title="주문" fields={['order.grades', 'title']} errorMarker={marker}>
          <F.Text name="order.grades[0].name" label="등급" />
        </F.Section>
        <FormSection form={editor.form} fields={['title', 'order.grades']} title="전체" errorLabel={(count) => `errors ${count}`} errorMarker={marker}>
          <span />
        </FormSection>
        <F.Submit />
      </F>
    );
  }
  await mount(() => <Marked />);
  await act(async () => fireEvent.click(screen.getByText('저장')));
  await waitFor(() => expect(header('기본').textContent).toContain('!'));
  // 기본 표시: 보이는 「!」(낭독 제외) + 화면 낭독기 문구.
  const visible = header('기본').querySelector('[aria-hidden="true"]');
  expect(visible?.textContent).toBe('!');
  expect(header('기본').querySelector('.wk-visually-hidden')?.textContent).toBe('오류 1개');
  // 바꾼 표시: 「!」 없이 보이는 배지가 오류 수를 받는다(Form.Section·FormSection 모두).
  expect(header('주문').textContent).toBe('주문 오류 2개');
  expect(header('주문').querySelector('.badge')?.getAttribute('aria-hidden')).toBeNull();
  expect(header('주문').textContent).not.toContain('!');
  expect(header('전체').textContent).toBe('전체 오류 2개');
  expect(header('전체').textContent).not.toContain('errors');
});
