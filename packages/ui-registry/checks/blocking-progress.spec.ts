// 파일 책임: 덮개 자체의 브라우저 검사와 설치한 폼 조합만 등록한다.
import { checkProgressFeatureBrowser, checkFormProgressBrowser } from '@boosterlab/web-kit/testing/browser';
import installation from '../../../registry-installation.json' with { type: 'json' };
const options = { url: '/web-kit-checks/blocking-progress.html', target: { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit } };
checkProgressFeatureBrowser(options);
if (installation.items.some((item) => item.name === 'form')) checkFormProgressBrowser(options);
