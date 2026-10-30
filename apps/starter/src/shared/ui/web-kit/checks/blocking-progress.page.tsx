// 파일 책임: 설치한 덮개·대화창과 선택적인 폼 복사본으로 브라우저 화면을 만든다.
import { createRoot } from 'react-dom/client';
import { createProgressFeatureConformancePage } from '@boosterlab/web-kit/testing/fixtures/progress';
import { BlockingProgress } from '../ui/blocking-progress';
import { Dialog } from '../ui/dialog';
import type { createFormProgressConformancePage as FormProgressPage } from '@boosterlab/web-kit/testing/fixtures/combinations';
import installation from '../../../../../registry-installation.json';
import '../ui/styles.css';
let Page = createProgressFeatureConformancePage({ BlockingProgress, Dialog });
if (new URLSearchParams(location.search).get('mode') === 'error' && installation.items.some((item) => item.name === 'form')) {
  const forms = import.meta.glob('../form/ui.tsx');
  const load = forms['../form/ui.tsx'];
  if (!load) throw new Error('form 설치 기록에 맞는 소비 복사본 없음');
  const { Form } = await load() as { Form: Parameters<typeof FormProgressPage>[0]['Form'] };
  const { createFormProgressConformancePage } = await import('@boosterlab/web-kit/testing/fixtures/combinations');
  Page = createFormProgressConformancePage({ Form, BlockingProgress });
}
createRoot(document.getElementById('root')!).render(<Page />);
