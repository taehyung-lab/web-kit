// 파일 책임: 로그인 뒤 화면들의 골격(머리글·탐색·언어·로그아웃, 저장·페이지 첫 조회 중 화면 전체 진행 덮개).
// 진입 판정은 route(routes/_app/route.tsx)가, 로그아웃 뒤 이동은 세션 구독(app/session/SessionNavigation)이 맡는다.
import { changeLanguage, LANGUAGES } from '@/app/i18n';
import { session } from '@/runtime/web-kit';
import { Button } from '@/shared/ui/button';
import { BlockingProgress } from '@/shared/ui/web-kit/ui';
import { Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/** 골격 안에 각 화면(Outlet)을 그린다. */
export function AppShell() {
  const { t, i18n } = useTranslation();
  return (
    <BlockingProgress
      messages={{
        loading: t('app.progress.loading'),
        create: t('app.progress.create'),
        edit: t('app.progress.edit'),
        delete: t('app.progress.delete'),
        wait: t('app.progress.wait'),
      }}
    >
      <div className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-6">
            <span className="text-sm font-semibold tracking-tight text-slate-900">{t('app.title')}</span>
            <nav className="flex gap-1 text-sm">
              <Link
                to="/products"
                className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 data-[status=active]:bg-slate-100 data-[status=active]:font-medium data-[status=active]:text-slate-900"
              >
                {t('app.nav.products')}
              </Link>
              <Link
                to="/members"
                className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 data-[status=active]:bg-slate-100 data-[status=active]:font-medium data-[status=active]:text-slate-900"
              >
                {t('app.nav.members')}
              </Link>
              <Link
                to="/terms/new"
                className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 data-[status=active]:bg-slate-100 data-[status=active]:font-medium data-[status=active]:text-slate-900"
              >
                {t('app.nav.terms')}
              </Link>
              <Link
                to="/shows/new"
                className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 data-[status=active]:bg-slate-100 data-[status=active]:font-medium data-[status=active]:text-slate-900"
              >
                {t('app.nav.shows')}
              </Link>
              <Link to="/form-workflows" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">{t('workflows.title')}</Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <div role="group" aria-label={t('app.language')} className="flex rounded-md border border-slate-200 p-0.5 text-xs">
                {LANGUAGES.map((language) => (
                  <Button
                    key={language}
                    variant="ghost"
                    aria-pressed={i18n.language === language}
                    onClick={() => changeLanguage(language)}
                    className="rounded px-2 py-1 uppercase text-slate-500 aria-pressed:bg-slate-900 aria-pressed:text-white"
                  >
                    {language}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" onClick={() => session.end()}>
                {t('app.signOut')}
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </main>
      </div>
    </BlockingProgress>
  );
}
