// 브라우저에서 실제 입력·Enter 행동을 두 복사본에 연결한다.
import { test } from '@playwright/test';
import { checkAuthBrowser } from '@boosterlab/web-kit/testing/browser';
import installation from '../../../registry-installation.json' with { type: 'json' };
const target = { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit };
test.describe('한 칸', () => checkAuthBrowser({ url: '/web-kit-checks/auth.html', target,
  enterCode: async (page, code) => { await page.getByRole('textbox', { name: '코드', exact: true }).fill(code); },
  readCode: async (page) => page.getByRole('textbox', { name: '코드', exact: true }).inputValue(),
}));
test.describe('여섯 칸', () => checkAuthBrowser({ url: '/web-kit-checks/auth.html?six', target,
  enterCode: async (page, code) => { for (let i = 0; i < code.length; i++) await page.getByRole('textbox', { name: `코드 ${i + 1}`, exact: true }).fill(code[i]!); },
  readCode: async (page) => { const digits = []; for (let i = 0; i < 6; i++) digits.push(await page.getByRole('textbox', { name: `코드 ${i + 1}`, exact: true }).inputValue()); return digits.join(''); },
}));
