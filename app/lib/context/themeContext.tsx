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

  // Load from localStorage on first mount
  useEffect(() => {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached) {
      try {
        const parsed: Theme = JSON.parse(cached);
        setThemeData(parsed);
      } catch (err) {
        console.warn('Failed to parse cached theme' + err);
      }
    }

    // Subscribe to Firebase for theme updates
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

    // Update cache and state
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
        setThemeMode,
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
