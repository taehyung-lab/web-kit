// 파일 책임: 로그인 뒤 첫 화면이 아직 없을 때 보이는 시작 화면. 첫 업무 화면을 만들면 app/screens.ts의 firstScreen으로 그 화면을 정한다.
import { useTranslation } from 'react-i18next';

export function AppHome() {
  const { t } = useTranslation();
  return (
    <section className="space-y-2">
      <h1 className="text-xl font-semibold text-slate-900">{t('app.home.title')}</h1>
      <p className="text-sm text-slate-600">{t('app.home.body')}</p>
    </section>
  );
}
