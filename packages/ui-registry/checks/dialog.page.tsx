// 파일 책임: 소비 복사본을 키트의 브라우저 검사 화면에 전달한다.
import { createRoot } from 'react-dom/client';
import { createDialogConformancePage } from '@boosterlab/web-kit/testing/fixtures/dialog';
import { Dialog } from '../ui/dialog';
// 프로젝트 테마 CSS(components.json의 tailwind.css = src/styles.css)로 실제 화면과 같은 층·모양에서 검사한다. 위치가 다르면 이 import를 고친다.
import '@/styles.css';
const Page = createDialogConformancePage({ Dialog });
createRoot(document.getElementById('root')!).render(<Page />);
