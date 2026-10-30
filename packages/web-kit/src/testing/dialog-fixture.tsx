// 파일 책임: 대화창만 설치한 소비처의 브라우저 검사 화면을 만든다.
import { useState } from 'react';
import type * as DialogContract from './contracts/ui/dialog';
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

