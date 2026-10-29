// @vitest-environment jsdom
// 복사본 두 모양의 입력 행동을 공통 적합성 검사에 연결한다.
import { describe } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { checkAuthConformance } from '../src/testing/unit';
import { AuthCodeForm } from '../../ui-registry/src/auth';
import { SixDigitAuthCodeForm } from '../../ui-registry/checks/auth-six';
const installation = { sourceRef: 'local', sourceCommit: 'local' };
const target = { registryVersion: installation.sourceRef, registryCommit: installation.sourceCommit };
describe('한 칸', () => checkAuthConformance({ Form: AuthCodeForm,
  enterCode: (code) => fireEvent.change(screen.getByRole('textbox', { name: '코드' }), { target: { value: code } }),
  readCode: () => (screen.getByRole('textbox', { name: '코드' }) as HTMLInputElement).value,
}, target));
describe('여섯 칸', () => checkAuthConformance({ Form: SixDigitAuthCodeForm,
  enterCode: (code) => Array.from(code).forEach((digit, index) => fireEvent.change(screen.getByRole('textbox', { name: `코드 ${index + 1}` }), { target: { value: digit } })),
  readCode: () => Array.from({ length: 6 }, (_, index) => (screen.getByRole('textbox', { name: `코드 ${index + 1}` }) as HTMLInputElement).value).join(''),
}, target));
