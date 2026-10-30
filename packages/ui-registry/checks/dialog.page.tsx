// 파일 책임: 소비 복사본을 키트의 브라우저 검사 화면에 전달한다.
import { createRoot } from 'react-dom/client';
import { createDialogConformancePage } from '@boosterlab/web-kit/testing/fixtures';
import { Dialog } from '../ui/dialog';
import '../ui/styles.css';
const Page = createDialogConformancePage({ Dialog });
createRoot(document.getElementById('root')!).render(<Page />);
