// 파일 책임: 로그인 화면. 자격증명 거절(401)은 입력 아래 한 줄로, 그 밖의 실패는 실패 종류 문구로 보인다. 세션 시작은 onSignedIn이 맡는다.
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { formMessages, useFieldMessage } from '@/shared/lib/form-messages';
import { isRequestFailure } from '@boosterlab/web-kit/failure';
import { useSaveForm } from '@boosterlab/web-kit/form';
import { Form } from '@/shared/ui/web-kit/form/ui';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { signIn } from '../api/auth';

const SOURCE = { id: 'login', values: { loginId: '', password: '' } } as const;
const schema = z.object({
  loginId: z.string().trim().min(1, formMessages.encode('auth.required.loginId')),
  password: z.string().min(1, formMessages.encode('auth.required.password')),
});

const F = Form.of<z.input<typeof schema>>();

/** 로그인 폼. notice는 세션 종료 사유처럼 이 화면에 들어온 이유를 보인다. */
export function LoginScreen({
  notice,
  showMockHint,
  onSignedIn,
}: {
  readonly notice?: string;
  readonly showMockHint: boolean;
  readonly onSignedIn: (accessToken: string) => void;
}) {
  const { t } = useTranslation();
  const message = useFieldMessage();
  /** 입력한 자격증명으로 로그인하고 세션 시작에 쓸 토큰을 돌려준다. */
  async function submitLogin(values: z.output<typeof schema>) {
    return { accessToken: await signIn(values.loginId, values.password) };
  }
  const editor = useSaveForm({
    schema,
    source: SOURCE,
    save: submitLogin,
    onSaved: (result) => onSignedIn(result.accessToken),
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{t('auth.title')}</h1>
        {notice === undefined ? null : (
          <p role="status" className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {notice}
          </p>
        )}
        <Form
          editor={editor}
          protect={false}
          formatError={message}
          renderFailure={(failure) =>
            isRequestFailure(failure) && failure.kind === 'unauthorized' ? t('auth.credentialRejected') : t(failureCopyKey(failure))
          }
        >
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
