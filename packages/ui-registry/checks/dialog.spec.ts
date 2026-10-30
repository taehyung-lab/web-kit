// 파일 책임: 설치한 브라우저 검사 화면을 키트 Playwright 적합성 검사에 연결한다.
import { checkDialogBrowser } from '@boosterlab/web-kit/testing/browser';
import installation from '../../../registry-installation.json' with { type: 'json' };
checkDialogBrowser({ url: '/web-kit-checks/dialog.html', target: { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit } });
