import { useSyncExternalStore } from 'react';
import { Language } from '@/types/game';

const STORAGE_KEY = 'vq-lang';

function readStored(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored === 'en' || stored === 'sv' || stored === 'ar') return stored;
  } catch { /* ignore */ }
  return 'en';
}

// One shared value, so every user of the hook (and the toaster in App) sees language changes
let current: Language = readStored();
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};
const getSnapshot = () => current;

const setLang = (l: Language) => {
  current = l;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch { /* ignore */ }
  listeners.forEach(cb => cb());
};

export function useLang() {
  const lang = useSyncExternalStore(subscribe, getSnapshot);
  return { lang, setLang };
}
