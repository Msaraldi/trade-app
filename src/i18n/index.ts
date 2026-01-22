import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import tr from './locales/tr.json';

// Supported languages
export const languages = {
  en: { nativeName: 'English', flag: '🇺🇸' },
  tr: { nativeName: 'Türkçe', flag: '🇹🇷' },
} as const;

export type Language = keyof typeof languages;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      tr: { translation: tr },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'tr'],

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'algotrade-language',
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;
