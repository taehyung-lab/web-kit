// 파일 책임: 전역 안내(notices) 목록을 화면 구석에 그린다.
import { useTranslation } from 'react-i18next';
import { notices, useNotices } from './notices';

/** 떠 있는 안내들. 각 안내는 닫을 수 있다. */
export function NoticeOutlet() {
  const { t } = useTranslation();
  const items = useNotices();
  if (items.length === 0) return null;
  return (
    <div className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} role="status" className="flex items-start justify-between gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          <span>{t(item.messageKey)}</span>
          <button type="button" className="text-slate-300 hover:text-white" aria-label={t('app.dismiss')} onClick={() => notices.dismiss(item.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
