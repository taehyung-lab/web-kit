// 파일 책임: 폼 없이 덮개·대화창의 브라우저 검사 화면을 만든다.
import { useEffect, useState } from 'react';
import { useBlockingProgress } from '../progress';
import type * as ProgressContract from './contracts/ui/blocking-progress';
import type * as DialogContract from './contracts/ui/dialog';
/** inert·배경 차단·포커스 복원 각 분기를 실제 덮개로 관찰할 화면을 만든다. */
export function createProgressFeatureConformancePage({ BlockingProgress, Dialog }: { BlockingProgress: typeof ProgressContract.BlockingProgress; Dialog: typeof DialogContract.Dialog }) {
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
  /** 주소의 mode로 복원 분기만 바꾸고 같은 복사본 덮개를 사용한다. */
  return function ProgressConformancePage() {
    const mode = new URLSearchParams(location.search).get('mode') ?? 'restore';
    return <BlockingProgress messages={{ loading: '조회 중', create: '등록 중', edit: '수정 중', delete: '삭제 중' }}><Content mode={mode} /></BlockingProgress>;
  };
}

