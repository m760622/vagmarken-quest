/**
 * useMute — persistent mute toggle stored in localStorage.
 * Import this anywhere audio is played; check `muted` before calling audio functions.
 */
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'vagmarken_muted';

export function useMute() {
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { muted, toggleMute };
}
