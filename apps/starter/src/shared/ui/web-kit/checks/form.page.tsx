// 파일 책임: 소비 복사본을 키트의 브라우저 검사 화면에 전달한다.
import { createRoot } from 'react-dom/client';
import { createFormConformancePage } from '@boosterlab/web-kit/testing/fixtures';
import { Form, FormGuard, FormDefaults, defaultFormMessages, defaultFormGuardMessages } from '../form/ui';
import { DialogDefaults, defaultDialogLabels } from '../ui/dialog';
import { Choice } from '../ui/choice';
// 프로젝트 테마 CSS(components.json의 tailwind.css = src/styles.css)로 실제 화면과 같은 층·모양에서 검사한다. 위치가 다르면 이 import를 고친다.
import '@/styles.css';
const Page = createFormConformancePage({ Form, FormGuard, Choice, FormDefaults, defaultFormMessages, defaultFormGuardMessages, DialogDefaults, defaultDialogLabels });
createRoot(document.getElementById('root')!).render(<Page />);
