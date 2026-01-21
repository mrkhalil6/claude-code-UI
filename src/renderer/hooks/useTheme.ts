import { useEffect } from 'react';
import { useUI, useUIActions } from '../store';
import type { ThemeMode, ResolvedTheme } from '../store/slices/ui.slice';

export function useTheme() {
  const { themeMode, resolvedTheme } = useUI();
  const { setThemeMode, setResolvedTheme } = useUIActions();

  // Compute and apply resolved theme
  useEffect(() => {
    const computeTheme = (): ResolvedTheme => {
      if (themeMode === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
      }
      return themeMode;
    };

    const applyTheme = (theme: ResolvedTheme) => {
      document.documentElement.setAttribute('data-theme', theme);
      setResolvedTheme(theme);
    };

    // Initial application
    applyTheme(computeTheme());

    // Listen for system preference changes when in system mode
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode, setResolvedTheme]);

  return { themeMode, resolvedTheme, setThemeMode };
}

export type { ThemeMode, ResolvedTheme };
