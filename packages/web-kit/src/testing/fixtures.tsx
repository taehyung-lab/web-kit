// 파일 책임: 소비처 UI를 주입받아 실제 브라우저에서 공통 보장을 관찰하는 검사 전용 화면을 만든다.
import { useEffect, useState } from 'react';
import { useSaveForm } from '../form';
import { RequestFailure } from '../failure';
import { createBrowserHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { useBlockingProgress } from '../progress';
import type * as DialogContract from './contracts/ui/dialog';
import type * as ProgressContract from './contracts/ui/blocking-progress';
import type * as FormContract from './contracts/form/ui';
import type * as ChoiceContract from './contracts/ui/choice';
import { z } from 'zod';

/** 팝업 진입·동일 이벤트 Tab 순환·중첩 포털·복원을 관찰할 화면을 만든다. */
export function createDialogConformancePage({ Dialog }: { Dialog: typeof DialogContract.Dialog }) {
  /** 바깥 대화창과 안쪽 포털의 독립 닫기 상태를 제공한다. */
  return function DialogConformancePage() {
    const [open, setOpen] = useState(false);
    const [nested, setNested] = useState(false);
    const [clicks, setClicks] = useState(0);
    return <><button onClick={() => setOpen(true)}>열기</button><button onClick={() => setClicks(clicks + 1)}>배경</button><output aria-label="배경 횟수">{clicks}</output>
      <Dialog open={open} title="외부 창" onClose={() => setOpen(false)} footer={<><button onClick={() => setNested(true)}>안쪽 열기</button><button onClick={() => setOpen(false)}>닫기</button></>}>
        <input aria-label="첫 입력" />
        <Dialog open={nested} title="내부 창" onClose={() => setNested(false)} footer={<button onClick={() => setNested(false)}>안쪽 닫기</button>}><input aria-label="안쪽 입력" /></Dialog>
      </Dialog></>;
  };
}

/** inert·배경 차단·포커스 복원 각 분기를 실제 덮개로 관찰할 화면을 만든다. */
export function createProgressConformancePage({ BlockingProgress, Dialog, Form }: { Form: typeof FormContract.Form; BlockingProgress: typeof ProgressContract.BlockingProgress; Dialog: typeof DialogContract.Dialog }) {
  /** 조회 종료를 외부 이벤트로 전달해 완료 순간의 포커스를 인위적으로 바꾸지 않는다. */
  function Content({ mode }: { mode: string }) {
    const [active, setActive] = useState(mode === 'initial');
    const [portal, setPortal] = useState(false);
    const [portalClicks, setPortalClicks] = useState(0);
    const [clicks, setClicks] = useState(0);
    useBlockingProgress('edit', active);
    useEffect(() => {
      const finish = () => { setActive(false); if (mode === 'saved') setPortal(true); };
      window.addEventListener('web-kit:finish', finish);
      return () => window.removeEventListener('web-kit:finish', finish);
    }, [mode]);
    return <>{mode !== 'root' && <h1 tabIndex={-1}>제목</h1>}
      {!(active && (mode === 'removed' || mode === 'root')) && <button onClick={() => { if (mode !== 'from-dialog') setActive(true); if (mode === 'portal' || mode === 'from-dialog') setPortal(true); }}>시작</button>}
      <button onClick={() => setClicks(clicks + 1)}>본문 작업</button><output aria-label="작업 횟수">{clicks}</output><input id="error-field" aria-label="오류 칸" />
      <Dialog open={portal} title="별도 창" onClose={() => setPortal(false)}><button onClick={() => { if (mode === 'from-dialog') { setPortal(false); setActive(true); } else setPortalClicks((n) => n + 1); }}>별도 확인</button><output aria-label="별도 횟수">{portalClicks}</output></Dialog></>;
  }
  /** 서버 오류가 덮개 정리 뒤 실제 첫 오류 칸으로 이동하는지 관찰한다. */
  function ErrorForm() {
    const schema = z.object({ name: z.string() });
    const editor = useSaveForm({ schema, source: { id: 1, values: { name: 'name' } }, progress: 'edit',
      fieldError: (error) => ({ field: error.field as 'name', message: '중복' }),
      save: () => new Promise<void>((_resolve, reject) => window.addEventListener('web-kit:finish', () => reject(new RequestFailure({ kind: 'validation', status: 400, fieldErrors: [{ field: 'name', code: 'duplicate' }] })), { once: true })),
    });
    const F = Form.of<z.input<typeof schema>>();
    return <F editor={editor} protect={false}><F.Text name="name" label="오류 칸" /><F.Submit>시작</F.Submit><button type="button">본문 작업</button><output aria-label="작업 횟수">0</output></F>;
  }
  /** 주소의 mode로 복원 분기만 바꾸고 같은 복사본 덮개를 사용한다. */
  return function ProgressConformancePage() {
    const mode = new URLSearchParams(location.search).get('mode') ?? 'restore';
    return <BlockingProgress messages={{ loading: '조회 중', create: '등록 중', edit: '수정 중', delete: '삭제 중' }}>{mode === 'error' ? <ErrorForm /> : <Content mode={mode} />}</BlockingProgress>;
  };
}

/** 실제 Enter 암묵 제출과 중첩 선택 포털을 관찰할 폼 화면을 만든다. */
export function createFormConformancePage({ Form, FormGuard, Choice }: { FormGuard: typeof FormContract.FormGuard; Form: typeof FormContract.Form; Choice: typeof ChoiceContract.Choice }) {
  const schema = z.object({ title: z.string().min(1), tags: z.array(z.object({ value: z.string() })) });
  const F = Form.of<z.input<typeof schema>>();
  const inner = z.object({ code: z.string().min(1) });
  const I = Form.of<z.input<typeof inner>>();
  /** 하위 폼 제출 횟수를 바깥 폼과 분리해 표시한다. */
  function Inner({ saved }: { saved: () => void }) {
    const editor = useSaveForm({ schema: inner, source: { id: 1, values: { code: 'inner' } }, save: async () => saved() });
    const [choice, setChoice] = useState<string>();
    return <I editor={editor} protect={false}><I.Text name="code" label="안쪽 코드" /><Choice label="중첩 선택" appearance="search" nodes={[{ value: 'a', label: 'Alpha' }]} value={choice} onValueChange={(value) => setChoice(typeof value === 'string' ? value : undefined)} /><I.Submit /></I>;
  }
  /** 일반 입력·추가 입력·하위 대화창을 각각 실제 소비 부품으로 연결한다. */
  function FormConformancePage() {
    const [count, setCount] = useState(0);
    const [innerCount, setInnerCount] = useState(0);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('tag');
    const editor = useSaveForm({ schema, source: { id: 1, values: { title: 'outer', tags: [] } }, save: async () => setCount((n) => n + 1) });
    return <><output aria-label="바깥 저장">{count}</output><output aria-label="안쪽 저장">{innerCount}</output><F editor={editor} protect={new URLSearchParams(location.search).get('protect') === 'true'}><F.Text name="title" label="제목" />
      <F.Array name="tags">{(rows) => {
        const add = () => { rows.append({ value: draft }); setDraft(''); };
        return <><input aria-label="추가 입력" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={rows.enterAdds(add)} /><button type="button" onClick={add}>추가</button><output aria-label="줄 수">{rows.items.length}</output></>;
      }}</F.Array><button type="button" onClick={() => setOpen(true)}>안쪽 열기</button><F.Submit />
      {open && <F.Dialog title="하위 폼" onClose={() => setOpen(false)}><Inner saved={() => setInnerCount((n) => n + 1)} /></F.Dialog>}
    </F></>;
  }
  const route = createRootRoute({ component: () => <FormGuard><Outlet /></FormGuard> });
  const page = createRoute({ getParentRoute: () => route, path: '$', component: FormConformancePage });
  const router = createRouter({ routeTree: route.addChildren([page]), history: createBrowserHistory() });
  /** 검사 전용 Router 안에서 실제 보호 범위를 제공한다. */
  return function GuardedFormConformancePage() { return <RouterProvider router={router} />; };
}

export { createAuthConformancePage, type AuthConformanceFormProps } from './auth-fixture';
