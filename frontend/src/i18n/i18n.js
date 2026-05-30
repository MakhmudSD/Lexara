import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { translations } from './translations';

const resources = Object.fromEntries(
  Object.entries(translations).map(([lang, strings]) => [
    lang,
    { translation: strings },
  ])
);

i18next
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('lexara_lang') || 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18next;
