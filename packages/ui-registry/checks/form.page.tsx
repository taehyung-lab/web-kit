// 파일 책임: 소비 복사본을 키트의 브라우저 검사 화면에 전달한다.
import { createRoot } from 'react-dom/client';
import { createFormConformancePage } from '@boosterlab/web-kit/testing/fixtures';
import { Form, FormGuard } from '../form/ui';
import { Choice } from '../ui/choice';
import '../ui/styles.css';
const Page = createFormConformancePage({ Form, FormGuard, Choice });
createRoot(document.getElementById('root')!).render(<Page />);
