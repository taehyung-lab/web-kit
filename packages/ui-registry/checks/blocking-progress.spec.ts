// 파일 책임: 설치한 브라우저 검사 화면을 키트 Playwright 적합성 검사에 연결한다.
import { checkProgressBrowser } from '@boosterlab/web-kit/testing/browser';
import installation from '../../../registry-installation.json' with { type: 'json' };
checkProgressBrowser({ url: '/web-kit-checks/blocking-progress.html', target: { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit } });
