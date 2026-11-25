// 파일 책임: 소비 복사본을 키트의 브라우저 검사 화면에 전달한다.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createDialogConformancePage } from '@boosterlab/web-kit/testing/fixtures/dialog';
import { ConfirmDialog, Dialog, DialogDefaults, defaultDialogLabels } from '../dialog';
// 프로젝트 테마 CSS(components.json의 tailwind.css = src/styles.css)로 실제 화면과 같은 층·모양에서 검사한다. 위치가 다르면 이 import를 고친다.
import '@/styles.css';
const Page = createDialogConformancePage({ Dialog, DialogDefaults, defaultDialogLabels });
function ResultDialogExample() {
  const [phase, setPhase] = useState<'closed' | 'confirm' | 'running' | 'result'>('closed');
  return (
    <DialogDefaults labels={defaultDialogLabels}>
      <button type="button" onClick={() => setPhase('confirm')}>
        Start bulk action
      </button>
      <ConfirmDialog
        open={phase !== 'closed'}
        title={phase === 'result' ? 'Bulk action results' : 'Apply to selected rows?'}
        pending={phase === 'running'}
        acknowledge={phase === 'result'}
        onCancel={() => setPhase('closed')}
        onConfirm={() => {
          if (phase === 'result') setPhase('closed');
          else {
            setPhase('running');
            window.setTimeout(() => setPhase('result'), 60);
          }
        }}
      >
        {phase === 'result' ? <p>1 processed · 1 not processed</p> : null}
      </ConfirmDialog>
    </DialogDefaults>
  );
}

createRoot(document.getElementById('root')!).render(
  <>
    <Page />
    <ResultDialogExample />
  </>
);
