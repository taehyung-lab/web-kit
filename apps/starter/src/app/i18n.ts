// 파일 책임: i18next 인스턴스와 ko/en 리소스 묶음. 공용·feature 문구를 모아 한 namespace로 등록하고, 고른 언어를 기억한다.
import { authResources } from '@/features/auth/i18n';
import { memberResources } from '@/features/members/i18n';
import { productResources } from '@/features/products/i18n';
import { sharedResources } from '@/shared/i18n';
import i18next, { type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { appResources } from './i18n-resources';

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
  resources: Object.fromEntries(
    LANGUAGES.map((lng) => [
      lng,
      { translation: { ...sharedResources[lng], ...appResources[lng], ...authResources[lng], ...productResources[lng], ...memberResources[lng] } },
    ]),
  ),
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
