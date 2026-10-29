// 파일 책임: 소비 복사본을 키트의 브라우저 검사 화면에 전달한다.
import { createRoot } from 'react-dom/client';
import { createProgressConformancePage } from '@boosterlab/web-kit/testing/fixtures';
import { BlockingProgress } from '../ui/blocking-progress';
import { Dialog } from '../ui/dialog';
import { Form } from '../form/ui';
import '../ui/styles.css';
const Page = createProgressConformancePage({ BlockingProgress, Dialog, Form });
createRoot(document.getElementById('root')!).render(<Page />);
