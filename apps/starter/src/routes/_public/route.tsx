// 파일 책임: 로그인 전 화면 묶음. "이미 로그인했으면 앱 첫 경로로" 판정을 이 한 곳에 둔다. 묶음 골격은 없어 하위 화면을 그대로 그린다.
import { isSignedIn } from '@/features/auth/public';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_public')({
  beforeLoad: () => {
    if (isSignedIn()) throw redirect({ to: '/', replace: true });
  },
});
