// 파일 책임: 로그인 폼의 빈 값과 입력 schema(순수). 로그인 flow가 저장 수명에 연결하고 화면은 그 결과만 그린다.
import { formMessages } from '@/shared/lib/form-messages';
import { z } from 'zod';

export const loginSource = { id: 'login', values: { loginId: '', password: '' } } as const;

export const loginSchema = z.object({
  loginId: z.string().trim().min(1, formMessages.encode('auth.required.loginId')),
  password: z.string().min(1, formMessages.encode('auth.required.password')),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginValues = z.output<typeof loginSchema>;
