// 파일 책임: 화면 언어의 실행 기반. i18next 인스턴스와 고른 언어의 기억을 둔다.
// 문구 원문은 app/i18n이 등록한다. runtime은 feature를 모르므로 여기서 feature 문구를 import하지 않는다.
import i18next, { type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

export const LANGUAGES = ['ko', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
const LANGUAGE_KEY = 'app.language';

function storedLanguage(): Language {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return value === 'en' ? 'en' : 'ko';
  } catch {
    return 'ko';
  }
}

export const i18n: I18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  lng: storedLanguage(),
  fallbackLng: 'ko',
  initAsync: false,
  interpolation: { escapeValue: false },
  resources: {},
});

/** 언어를 바꾸고 기억한다. 문서 lang도 맞춘다. */
export function changeLanguage(language: Language) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // 기억하지 못해도 이 탭에서는 바뀐다.
  }
  document.documentElement.lang = language;
  void i18n.changeLanguage(language);
}
