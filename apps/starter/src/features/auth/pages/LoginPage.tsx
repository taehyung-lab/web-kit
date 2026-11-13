// 파일 책임: 로그인 화면. 자격증명 거절(401)은 입력 아래 한 줄로, 그 밖의 실패는 실패 종류 문구로 보인다. 요청·세션·이동은 로그인 flow가 맡는다.
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { Form } from '@/shared/ui/web-kit/form/form';
import { useTranslation } from 'react-i18next';
import { useLoginFlow } from '../hooks/use-login-flow';
import type { LoginInput } from '../forms/login-form';
import { loginFailureCopyKey } from '../rules/login-failure';

const F = Form.of<LoginInput>();

/** 로그인 폼. notice는 세션 종료 사유처럼 이 화면에 들어온 이유, redirect는 로그인 뒤 돌아갈 곳이다. */
export function LoginPage({
  notice,
  showMockHint,
  redirect,
}: {
  readonly notice?: string;
  readonly showMockHint: boolean;
  readonly redirect: string | undefined;
}) {
  const { t } = useTranslation();
  const { editor } = useLoginFlow({ redirect });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{t('auth.title')}</h1>
        {notice === undefined ? null : (
          <p role="status" className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {notice}
          </p>
        )}
        <Form editor={editor} protect={false} renderFailure={(failure) => t(loginFailureCopyKey(failure) ?? failureCopyKey(failure))}>
          <F.Text name="loginId" label={t('auth.loginId')} autoFocus autoComplete="username" />
          <F.Text name="password" label={t('auth.password')} type="password" autoComplete="current-password" />
          <F.Failure />
          <F.Submit>{t('auth.submit')}</F.Submit>
          {showMockHint && <p>{t('auth.mockHint')}</p>}
        </Form>
      </div>
    </main>
  );
}
