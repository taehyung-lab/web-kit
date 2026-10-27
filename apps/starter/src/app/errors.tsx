// 파일 책임: 경로 오류·없는 경로 화면과, router 밖 렌더 오류를 받는 마지막 경계.
import { failureCopyKey } from '@/shared/lib/failure-copy';
import { Button } from '@boosterlab/web-kit/form/ui';
import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** route 렌더·loader 실패. 문구는 실패 종류로 고르고, 다시 시도는 route를 다시 읽는다. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <section role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <p className="text-base font-medium text-slate-800">{t(failureCopyKey(error))}</p>
      <Button
        variant="secondary"
        onClick={() => {
          reset();
          void router.invalidate();
        }}
      >
        {t('common.retry')}
      </Button>
    </section>
  );
}

/** 없는 경로. */
export function RouteNotFound() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <p className="text-base font-medium text-slate-800">{t('app.routeNotFound')}</p>
      <Link to="/" className="text-sm font-medium text-slate-900 underline underline-offset-4">
        {t('app.goHome')}
      </Link>
    </section>
  );
}

/** router 밖(provider 등)의 렌더 오류. 번역이 깨졌을 수 있어 고정 문구 대신 fallback을 받는다. */
export class AppErrorBoundary extends Component<
  { readonly fallback: ReactNode; readonly children: ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
