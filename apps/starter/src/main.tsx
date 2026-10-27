import '@boosterlab/web-kit/styles.css';
// 파일 책임: 브라우저 실행 진입. mock 모드면 msw worker를 먼저 켜고 앱을 그린다.
import { App } from '@/app/App';
import { createAppRouter } from '@/app/router';
import '@/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

if (import.meta.env.MODE === 'mock') {
  const { startMockWorker } = await import('@/mocks/browser');
  await startMockWorker();
}

const root = document.getElementById('root');
if (root === null) throw new Error('#root element is missing');

createRoot(root).render(
  <StrictMode>
    <App router={createAppRouter()} />
  </StrictMode>,
);
