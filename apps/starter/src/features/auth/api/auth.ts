// 파일 책임: 로그인·로그아웃 요청. 둘 다 세션 밖 공개 요청이다(app/web-kit의 isPublic).
import { signIn as signInRequest, signOut as signOutRequest } from '@/api/generated/auth/auth';

/** 로그인. 성공하면 access 토큰을 돌려준다(refresh 토큰은 서버가 httpOnly 쿠키로 둔다). */
export async function signIn(loginId: string, password: string): Promise<string> {
  return (await signInRequest({ loginId, password })).accessToken;
}

/** 로그아웃. 공개 요청이라 토큰이 자동으로 실리지 않으므로, 세션을 끝내기 전에 캡처한 토큰을 직접 싣는다. */
export async function signOut(accessToken: string): Promise<void> {
  await signOutRequest({ headers: { Authorization: `Bearer ${accessToken}` } });
}
