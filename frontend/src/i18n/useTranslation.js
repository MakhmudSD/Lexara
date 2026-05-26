import { useEffect, useState } from 'react';
import { languageOptions, translations } from './translations';

const STORAGE_KEY = 'lexara_lang';
const DEFAULT_LANG = 'en';
const SUPPORTED_LANGS = ['en', 'ko', 'ru', 'uz', 'ja'];

function resolveLang() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && SUPPORTED_LANGS.includes(stored) ? stored : DEFAULT_LANG;
}

export function useTranslation() {
  const [lang, setLangState] = useState(resolveLang);

  useEffect(() => {
    const syncLang = () => setLangState(resolveLang());
    window.addEventListener('storage', syncLang);
    window.addEventListener('app:lang-change', syncLang);
    return () => {
      window.removeEventListener('storage', syncLang);
      window.removeEventListener('app:lang-change', syncLang);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (nextLang) => {
    const resolved = translations[nextLang] ? nextLang : DEFAULT_LANG;
    localStorage.setItem(STORAGE_KEY, resolved);
    setLangState(resolved);
    window.dispatchEvent(new Event('app:lang-change'));
  };

  const t = (key) => translations[lang]?.[key] ?? translations.en?.[key] ?? key;
  const currentLanguage = languageOptions.find((option) => option.code === lang) ?? languageOptions[0];

  return { lang, setLang, t, currentLanguage, languageOptions };
}
