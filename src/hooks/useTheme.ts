import { useLayoutEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem('phasscode-theme') === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  });
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    document.body.classList.toggle('modo-escuro', theme === 'dark');
    document.body.classList.toggle('modo-claro', theme === 'light');
    try { localStorage.setItem('phasscode-theme', theme); } catch { /* Storage may be disabled. */ }
  }, [theme]);
  return { theme, toggleTheme: () => setTheme(current => current === 'dark' ? 'light' : 'dark') };
}
