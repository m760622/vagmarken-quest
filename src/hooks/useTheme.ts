import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'vq-theme';

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

// Apply theme class to <html> immediately (called on module load)
function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === 'light') {
    root.classList.add('light');
  } else {
    root.classList.remove('light');
  }
}

// Initialize on module load so theme is applied before first render
applyTheme(getInitialTheme());

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Sync class whenever theme state changes
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch { /* ignore */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
