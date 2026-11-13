// 파일 책임: 설치한 덮개·대화창과 선택적인 폼 복사본으로 브라우저 화면을 만든다.
import { createRoot } from 'react-dom/client';
import { createProgressFeatureConformancePage } from '@boosterlab/web-kit/testing/fixtures/progress';
import { BlockingProgress } from '../ui/blocking-progress';
import { Dialog, DialogDefaults, defaultDialogLabels } from '../ui/dialog';
import type { createFormProgressConformancePage as FormProgressPage } from '@boosterlab/web-kit/testing/fixtures/combinations';
import installation from '../../../../../registry-installation.json';
// 프로젝트 테마 CSS(components.json의 tailwind.css = src/styles.css)로 실제 화면과 같은 층·모양에서 검사한다. 위치가 다르면 이 import를 고친다.
import '@/styles.css';
let Page = createProgressFeatureConformancePage({ BlockingProgress, Dialog, DialogDefaults, defaultDialogLabels });
if (new URLSearchParams(location.search).get('mode') === 'error' && installation.items.some((item) => item.name === 'form')) {
  const forms = import.meta.glob('../form/form.tsx');
  const load = forms['../form/form.tsx'];
  if (!load) throw new Error('form 설치 기록에 맞는 소비 복사본 없음');
  type FormParts = Parameters<typeof FormProgressPage>[0];
  const { Form, FormDefaults, defaultFormMessages, defaultFormGuardMessages } = await load() as Pick<FormParts, 'Form' | 'FormDefaults' | 'defaultFormMessages' | 'defaultFormGuardMessages'>;
  const { createFormProgressConformancePage } = await import('@boosterlab/web-kit/testing/fixtures/combinations');
  Page = createFormProgressConformancePage({ Form, BlockingProgress, FormDefaults, defaultFormMessages, defaultFormGuardMessages, DialogDefaults, defaultDialogLabels });
}
createRoot(document.getElementById('root')!).render(<Page />);
