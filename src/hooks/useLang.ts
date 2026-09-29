import { useState, useCallback } from 'react';
import { Language } from '@/types/game';

const STORAGE_KEY = 'vq-lang';

export function useLang() {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored === 'en' || stored === 'sv' || stored === 'ar') return stored;
    } catch { /* ignore */ }
    return 'en';
  });

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch { /* ignore */ }
  }, []);

  return { lang, setLang };
}
