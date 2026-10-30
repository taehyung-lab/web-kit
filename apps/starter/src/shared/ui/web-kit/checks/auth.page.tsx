// 설치된 두 인증 복사본을 실제 브라우저 검사 화면에 연결한다.
import { createRoot } from 'react-dom/client';
import { createAuthConformancePage } from '@boosterlab/web-kit/testing/fixtures/auth';
import { AuthCodeForm } from '../auth';
import { SixDigitAuthCodeForm } from './auth-six';
const Page = createAuthConformancePage(new URLSearchParams(location.search).has('six') ? SixDigitAuthCodeForm : AuthCodeForm);
createRoot(document.getElementById('root')!).render(<Page />);
