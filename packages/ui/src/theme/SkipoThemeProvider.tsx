\'use client\';
import React, { createContext, useContext, useState, useCallback } from 'react';

type SkipoTheme = 'dark' | 'light';

interface SkipoThemeContextValue {
  theme: SkipoTheme;
  setTheme: (theme: SkipoTheme) => void;
  toggleTheme: () => void;
}

const SkipoThemeContext = createContext<SkipoThemeContextValue | null>(null);

export function SkipoThemeProvider({ children, defaultTheme = 'dark' }: { children: React.ReactNode; defaultTheme?: SkipoTheme }) {
  const [theme, setTheme] = useState<SkipoTheme>(defaultTheme);
  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);
  return (
    <SkipoThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <div data-skipo-theme={theme} className="skipo-root">
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
