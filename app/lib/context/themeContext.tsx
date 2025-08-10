'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { Theme } from '@/app/lib/interface';

interface ThemeData {
  theme: Theme;
  setThemeMode: (mode: 'light' | 'dark') => Promise<void>;
  refreshTheme: () => Promise<void>;
}

const CustomThemeContext = createContext<ThemeData | null>(null);
const THEME_CACHE_KEY = 'cachedTheme';

export function CustomThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [themeData, setThemeData] = useState<Theme | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Load from localStorage & subscribe to Firestore
  useEffect(() => {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached) {
      try {
        const parsed: Theme = JSON.parse(cached);
        setThemeData(parsed);
      } catch (err) {
        console.warn('Failed to parse cached theme', err);
      }
    }

    const ref = doc(db, 'theme', 'activeTheme');
    const unsub = onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        const theme = docSnap.data() as Theme;
        localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(theme));
        setThemeData(theme);
      }
    });

    return () => unsub();
  }, []);

  const setThemeMode = async (mode: 'light' | 'dark') => {
    if (!themeData) return;
    const ref = doc(db, 'theme', 'activeTheme');
    const newTheme = { ...themeData, mode };
    await import('firebase/firestore').then(({ setDoc }) =>
      setDoc(ref, newTheme, { merge: true })
    );
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(newTheme));
    setThemeData(newTheme);
  };

  const refreshTheme = async () => {
    const ref = doc(db, 'theme', 'activeTheme');
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
      const freshTheme = docSnap.data() as Theme;
      localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(freshTheme));
      setThemeData(freshTheme);
    }
  };

  // 🔹 Listen to system dark mode changes (Battery Saver triggers this)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applySystemTheme = (isDark: boolean) => {
      if (!hasUserInteracted) {
        setThemeMode(isDark ? 'dark' : 'light');
      }
    };

    // ✅ Initial check
    applySystemTheme(media.matches);

    // ✅ Change listener
    const listener = (e: MediaQueryListEvent) => {
      applySystemTheme(e.matches);
    };

    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      media.addListener(listener);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [hasUserInteracted]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applySystemTheme = (isDark: boolean) => {
      if (!hasUserInteracted) {
        setThemeMode(isDark ? 'dark' : 'light');
      }
    };

    // ✅ Initial check
    applySystemTheme(media.matches);

    // ✅ Change listener
    const listener = (e: MediaQueryListEvent) => {
      applySystemTheme(e.matches);
    };

    if (media.addEventListener) {
      media.addEventListener('change', listener);
    } else {
      media.addListener(listener);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [hasUserInteracted]);

  const setThemeModeWithOverride = async (mode: 'light' | 'dark') => {
    setHasUserInteracted(true); // ✅ stop listening to system changes after first manual change
    await setThemeMode(mode);
  };
  const muiTheme = createTheme({
    palette: {
      mode: themeData?.mode || 'light',
      primary: { main: themeData?.primary || '#1976d2' },
      secondary: { main: themeData?.secondary || '#9c27b0' },
    },
  });

  return (
    <CustomThemeContext.Provider
      value={{
        theme: themeData as Theme,
        setThemeMode: setThemeModeWithOverride, // use the new one
        refreshTheme,
      }}
    >
      <ThemeProvider theme={muiTheme}>{children}</ThemeProvider>
    </CustomThemeContext.Provider>
  );
}

export const useCustomTheme = () => {
  const context = useContext(CustomThemeContext);
  if (!context) {
    throw new Error('useCustomTheme must be used within a CustomThemeProvider');
  }
  return context;
};
