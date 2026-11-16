// 파일 책임: 로그인 경로. 들어온 이유(reason)와 돌아갈 곳(redirect)을 URL로 검증해 화면에 넘긴다. 로그인 요청·세션·이동은 auth의 로그인 flow가 맡는다.
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { safeAppPath } from '@boosterlab/web-kit';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

const search = z.object({
  // 같은 앱 안의 경로만 돌아갈 곳으로 받는다(외부 주소·`/\host`·로그인 화면 자신은 버린다).
  redirect: z
    .string()
    .refine((value) => safeAppPath(value, { exclude: ['/login'] }) !== undefined)
    .optional()
    .catch(undefined),
  reason: z.enum(['server', 'other-tab']).optional().catch(undefined),
});

export const Route = createFileRoute('/_public/login/')({
  validateSearch: search,
  component: LoginRoute,
});

function LoginRoute() {
  const { t } = useTranslation();
  const { redirect, reason } = Route.useSearch();
  return (
    <LoginPage
      notice={reason === undefined ? undefined : t(`auth.ended.${reason}`)}
      showMockHint={import.meta.env.MODE === 'mock'}
      redirect={redirect}
    />
  );
}
