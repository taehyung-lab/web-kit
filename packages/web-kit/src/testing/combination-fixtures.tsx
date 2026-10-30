// 파일 책임: 폼과 덮개를 함께 설치한 소비처의 오류 초점 화면을 만든다.
import { useSaveForm } from '../form';
import { RequestFailure } from '../failure';
import { z } from 'zod';
import type * as ProgressContract from './contracts/ui/blocking-progress';
import type * as FormContract from './contracts/form/ui';
/** 실제 폼의 서버 오류가 실제 덮개 종료 뒤 초점을 받는지 관찰한다. */
export function createFormProgressConformancePage({ Form, BlockingProgress }: { Form: typeof FormContract.Form; BlockingProgress: typeof ProgressContract.BlockingProgress }) {
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
  /** 같은 소비 복사본을 폼과 덮개에 전달한다. */
  return function FormProgressConformancePage() { return <BlockingProgress messages={{ loading: '조회 중', create: '등록 중', edit: '수정 중', delete: '삭제 중' }}><ErrorForm /></BlockingProgress>; };
}
