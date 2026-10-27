// 파일 책임: 로그인 경로. 들어온 이유(reason)와 돌아갈 곳(redirect)을 URL로 받고, 로그인되면 세션을 열고 이동한다.
import { useAuth } from '@/app/auth';
import { session } from '@/app/web-kit';
import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

const search = z.object({
  // 같은 앱 안의 경로만 돌아갈 곳으로 받는다(외부 주소로의 이동 차단).
  redirect: z.string().regex(/^\/(?!\/)/).optional().catch(undefined),
  reason: z.enum(['server', 'other-tab']).optional().catch(undefined),
});

export const Route = createFileRoute('/login')({
  validateSearch: search,
  beforeLoad: () => {
    if (session.current() !== null) throw redirect({ to: '/products', replace: true });
  },
  component: LoginRoute,
});

function LoginRoute() {
  const { t } = useTranslation();
  const { redirect: back, reason } = Route.useSearch();
  const navigate = Route.useNavigate();
  const auth = useAuth();
  return (
    <LoginScreen
      notice={reason === undefined ? undefined : t(`auth.ended.${reason}`)}
      showMockHint={import.meta.env.MODE === 'mock'}
      onSignedIn={(accessToken) => {
        auth.signIn(accessToken);
        void (back === undefined ? navigate({ to: '/products', replace: true }) : navigate({ href: back, replace: true }));
      }}
    />
  );
}
