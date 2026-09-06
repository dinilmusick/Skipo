'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { SkipoThemePack } from './types.js';
import { DEFAULT_DARK_THEME_PACK, DEFAULT_LIGHT_THEME_PACK, applyThemePack } from './ThemePackLoader.js';

type SkipoThemeMode = 'dark' | 'light';

interface SkipoThemeContextValue {
  theme: SkipoThemeMode;
  themePack: SkipoThemePack;
  setTheme: (theme: SkipoThemeMode) => void;
  setThemePack: (pack: SkipoThemePack) => void;
  toggleTheme: () => void;
}

const SkipoThemeContext = createContext<SkipoThemeContextValue | null>(null);

export interface SkipoThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: SkipoThemeMode;
  initialThemePack?: SkipoThemePack;
}

function useThemeManager(defaultTheme: SkipoThemeMode = 'dark', initialThemePack?: SkipoThemePack) {
  const [theme, setThemeState] = useState<SkipoThemeMode>(defaultTheme);
  const [themePack, setThemePackState] = useState<SkipoThemePack>(
    initialThemePack || (defaultTheme === 'dark' ? DEFAULT_DARK_THEME_PACK : DEFAULT_LIGHT_THEME_PACK)
  );

  const applyPack = useCallback((pack: SkipoThemePack) => {
    setThemePackState(pack);
    setThemeState(pack.metadata.mode);
    if (typeof document !== 'undefined') {
      applyThemePack(pack);
    }
  }, []);

  const setTheme = useCallback((mode: SkipoThemeMode) => {
    applyPack(mode === 'dark' ? DEFAULT_DARK_THEME_PACK : DEFAULT_LIGHT_THEME_PACK);
  }, [applyPack]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  useEffect(() => {
    applyPack(initialThemePack || (defaultTheme === 'dark' ? DEFAULT_DARK_THEME_PACK : DEFAULT_LIGHT_THEME_PACK));
  }, []);

  return { theme, themePack, setTheme, setThemePack: applyPack, toggleTheme };
}

export function SkipoThemeProvider({
  children,
  defaultTheme = 'dark',
  initialThemePack
}: SkipoThemeProviderProps) {
  const themeState = useThemeManager(defaultTheme, initialThemePack);

  return (
    <SkipoThemeContext.Provider value={themeState}>
      <div data-skipo-theme={themeState.theme} className="skipo-root">
        {children}
      </div>
    </SkipoThemeContext.Provider>
  );
}

export function useSkipoTheme(): SkipoThemeContextValue {
  const ctx = useContext(SkipoThemeContext);
  if (!ctx) throw new Error('useSkipoTheme must be used within <SkipoThemeProvider>');
  return ctx;
}
