// 파일 책임: 로그인 요청. 세션 밖 공개 요청이다(runtime/web-kit의 isPublic). 서버 로그아웃은 세션 계약이라 runtime이 보낸다.
import { signIn as signInRequest } from '@/api/generated/auth/auth';
import type { LoginValues } from '../forms/login-form';

/** 로그인 응답. 성공하면 access 토큰이 있다(refresh 토큰은 서버가 httpOnly 쿠키로 둔다). */
export interface SignInResponse {
  readonly accessToken: string;
}

/** 로그인 요청만 보낸다. 세션 시작·이동은 하지 않는다(로그인 flow의 완료 단계가 맡는다). */
export async function signIn(values: LoginValues): Promise<SignInResponse> {
  return { accessToken: (await signInRequest({ loginId: values.loginId, password: values.password })).accessToken };
}
