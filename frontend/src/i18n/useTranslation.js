import { useEffect, useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import './i18n';
import { languageOptions } from './translations';

const STORAGE_KEY = 'lexara_lang';
const SUPPORTED_LANGS = ['en', 'ko', 'ru', 'uz', 'ja'];

function resolveLang() {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return stored && SUPPORTED_LANGS.includes(stored) ? stored : 'en';
}

export function useTranslation() {
  const { t: i18nT, i18n } = useI18nTranslation();

  // Sync i18next with localStorage on mount — handles test isolation and page refresh
  const [lang, setLangState] = useState(() => {
    const resolved = resolveLang();
    if (i18n.language !== resolved) {
      i18n.changeLanguage(resolved);
    }
    return resolved;
  });

  useEffect(() => {
    const syncLang = () => {
      const resolved = resolveLang();
      if (i18n.language !== resolved) {
        i18n.changeLanguage(resolved);
      }
      setLangState(resolved);
    };
    window.addEventListener('storage', syncLang);
    window.addEventListener('app:lang-change', syncLang);

    // Keep local state in sync with i18next changes
    const onLanguageChanged = (lng) => setLangState(SUPPORTED_LANGS.includes(lng) ? lng : 'en');
    i18n.on('languageChanged', onLanguageChanged);

    return () => {
      window.removeEventListener('storage', syncLang);
      window.removeEventListener('app:lang-change', syncLang);
      i18n.off('languageChanged', onLanguageChanged);
    };
  }, [i18n]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = (nextLang) => {
    const resolved = SUPPORTED_LANGS.includes(nextLang) ? nextLang : 'en';
    localStorage.setItem(STORAGE_KEY, resolved);
    i18n.changeLanguage(resolved);
    setLangState(resolved);
    window.dispatchEvent(new Event('app:lang-change'));
  };

  const t = (key) => {
    const result = i18nT(key, { defaultValue: '' });
    return result || key;
  };

  const currentLanguage = languageOptions.find((option) => option.code === lang) ?? languageOptions[0];

  return { lang, setLang, t, currentLanguage, languageOptions };
}
