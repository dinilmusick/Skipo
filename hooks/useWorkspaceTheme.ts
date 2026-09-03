import { useState, useEffect, useRef } from 'react';
import { ThemeMode, CustomThemeConfig, BiomeType } from '../lib/types';
import { DEFAULT_THEME_PRESETS, applyThemeVariables } from '../lib/theme';

export function useWorkspaceTheme(setWorkspaceToast: (msg: string | null) => void) {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [themeConfig, setThemeConfig] = useState<CustomThemeConfig>(DEFAULT_THEME_PRESETS[0]);
  const [savedThemes, setSavedThemes] = useState<CustomThemeConfig[]>([]);
  const [biome, setBiome] = useState<BiomeType>('forest');
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [appWallpaper, setAppWallpaper] = useState<string | null>(null);
  const canvasWallpaperInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedList = localStorage.getItem('docustackSavedThemes');
        if (savedList) {
          setSavedThemes(JSON.parse(savedList));
        }
        const activeSaved = localStorage.getItem('activeThemeConfig');
        if (activeSaved) {
          const parsed = JSON.parse(activeSaved);
          setThemeConfig(parsed);
          applyThemeVariables(parsed);
          setTheme(parsed.base === '#F5EDE4' ? 'light' : 'dark');
        } else {
          applyThemeVariables(DEFAULT_THEME_PRESETS[0]);
        }
      } catch (err) {
        console.error('Failed to parse theme from localStorage', err);
      }
    }
  }, []);

  const handleChangeThemeConfig = (config: CustomThemeConfig) => {
    setThemeConfig(config);
    applyThemeVariables(config);
    setTheme(config.base === '#F5EDE4' ? 'light' : 'dark');
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeThemeConfig', JSON.stringify(config));
    }
  };

  const handleSaveCustomTheme = (config: CustomThemeConfig) => {
    setSavedThemes((prev) => {
      const idx = prev.findIndex((t) => t.id === config.id);
      let updated: CustomThemeConfig[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = config;
      } else {
        updated = [...prev, config];
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('docustackSavedThemes', JSON.stringify(updated));
      }
      return updated;
    });
    handleChangeThemeConfig(config);
  };

  const handleDeleteCustomTheme = (themeId: string) => {
    setSavedThemes((prev) => {
      const updated = prev.filter((t) => t.id !== themeId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('docustackSavedThemes', JSON.stringify(updated));
      }
      return updated;
    });
  };

  useEffect(() => {
    fetch('/api/wallpapers')
      .then((res) => res.json())
      .then((data) => {
        if (data.rootWallpaperUrl) {
          setAppWallpaper(data.rootWallpaperUrl);
        } else if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('appWallpaper');
          if (stored) setAppWallpaper(stored);
        }
      })
      .catch(() => {});
  }, []);

  const handleChangeWallpaper = (wp: string | null) => {
    setAppWallpaper(wp);
    if (wp) {
      localStorage.setItem('appWallpaper', wp);
    } else {
      localStorage.removeItem('appWallpaper');
    }
  };

  const handleUploadCanvasWallpaperFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('target', 'root');
    try {
      const res = await fetch('/api/wallpapers', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.wallpaperUrl) {
        setAppWallpaper(data.wallpaperUrl);
        localStorage.setItem('appWallpaper', data.wallpaperUrl);
        setWorkspaceToast('[CANVAS WALLPAPER UPDATED] SAVED TO WORKSPACE VAULT ROOT');
        setTimeout(() => setWorkspaceToast(null), 3500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCanvasWallpaperFile = async () => {
    try {
      await fetch('/api/wallpapers?target=root', { method: 'DELETE' });
      setAppWallpaper(null);
      localStorage.removeItem('appWallpaper');
      setWorkspaceToast('[CANVAS WALLPAPER REMOVED]');
      setTimeout(() => setWorkspaceToast(null), 3500);
    } catch (err) {
      console.error(err);
    }
  };

  return {
    theme,
    setTheme,
    themeConfig,
    savedThemes,
    biome,
    setBiome,
    motionEnabled,
    setMotionEnabled,
    appWallpaper,
    setAppWallpaper,
    canvasWallpaperInputRef,
    handleChangeThemeConfig,
    handleSaveCustomTheme,
    handleDeleteCustomTheme,
    handleChangeWallpaper,
    handleUploadCanvasWallpaperFile,
    handleDeleteCanvasWallpaperFile,
  };
}
