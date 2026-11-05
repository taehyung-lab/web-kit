// 파일 책임: 로그인 흐름. 저장(save)은 로그인 요청만 하고 응답을 돌려준다. 완료(onSaved)에서 세션을 열고 돌아갈 곳으로 이동한다.
// 저장과 완료를 나누면 이동이 실패해도 키트가 완료만 다시 시도하고 로그인 요청을 다시 보내지 않는다(web-kit-form).
import { useSaveForm } from '@boosterlab/web-kit/form';
import { useNavigate } from '@tanstack/react-router';
import { session } from '@/runtime/web-kit';
import { signIn } from '../api/auth';
import { loginSchema, loginSource } from '../model/forms/login-form';

/** 로그인 화면이 쓸 폼 상태만 돌려준다. redirect는 route가 검증한 같은 앱 안의 경로다. */
export function useLoginFlow({ redirect }: { readonly redirect: string | undefined }) {
  const navigate = useNavigate();
  const editor = useSaveForm({
    schema: loginSchema,
    source: loginSource,
    save: signIn,
    onSaved: async (response) => {
      // 완료를 다시 시도할 때 같은 토큰으로 세션 세대를 또 열지 않는다.
      if (session.current()?.credentials.accessToken !== response.accessToken) session.start({ accessToken: response.accessToken });
      // 돌아갈 곳이 없으면 앱 첫 경로로 간다. 첫 경로가 기본 화면을 정한다(routes/_app/index.tsx).
      await (redirect === undefined ? navigate({ to: '/', replace: true }) : navigate({ href: redirect, replace: true }));
    },
  });
  return { editor };
}
