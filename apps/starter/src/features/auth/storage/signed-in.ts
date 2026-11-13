// 파일 책임: 로그인 여부 읽기. 토큰이 유효한지는 서버만 안다. 여기서는 저장된 자격증명이 있는지만 본다.
import { session } from '@/runtime/web-kit';

/** 현재 탭에 열린 세션이 있는지. route 진입 판정이 쓴다. */
export function isSignedIn(): boolean {
  return session.current() !== null;
}
