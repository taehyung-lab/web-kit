// 파일 책임: 로그인 뒤 화면 묶음의 진입 판정과 골격 연결. 저장된 세션이 없으면 로그인으로 보낸다. 골격 모양은 app/shell이 맡는다.
import { AppShell } from '@/app/shell/AppShell';
import { isSignedIn } from '@/features/auth/public';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_app')({
  // 토큰이 유효한지는 서버만 안다. 여기서는 자격증명이 있는지만 본다.
  beforeLoad: ({ location }) => {
    if (!isSignedIn()) throw redirect({ to: '/login', search: { redirect: location.href }, replace: true });
  },
  component: AppShell,
});
