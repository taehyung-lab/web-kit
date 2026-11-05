// 파일 책임: 로그인 폼의 빈 값과 입력 schema. 화면(screens/LoginScreen)은 이것을 import해 모양과 연결만 맡는다.
import { formMessages } from '@/shared/lib/form-messages';
import { z } from 'zod';

export const loginSource = { id: 'login', values: { loginId: '', password: '' } } as const;

export const loginSchema = z.object({
  loginId: z.string().trim().min(1, formMessages.encode('auth.required.loginId')),
  password: z.string().min(1, formMessages.encode('auth.required.password')),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
