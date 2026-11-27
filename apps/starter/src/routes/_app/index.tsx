// 파일 책임: 로그인 뒤 첫 경로. 앱이 정한 첫 화면(app/screens.ts의 firstScreen)으로 보내고, 없으면 시작 화면을 보인다.
import { firstScreen } from '@/app/screens';
import { AppHome } from '@/app/shell/AppHome';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/')({
  beforeLoad: () => {
    if (firstScreen !== null) throw redirect({ to: firstScreen, replace: true });
  },
  component: AppHome,
});
