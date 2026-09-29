import { Language } from '@/types/game';

/** Read persisted prefs directly — used by code that lives outside React (toasts, overlays). */
export function readLang(): Language {
  try {
    const v = localStorage.getItem('vq-lang');
    if (v === 'en' || v === 'sv' || v === 'ar') return v;
  } catch { /* ignore */ }
  return 'en';
}

export function readMuted(): boolean {
  try {
    return localStorage.getItem('vagmarken_muted') === 'true';
  } catch {
    return false;
  }
}
