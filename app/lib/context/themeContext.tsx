'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { Theme } from '@/app/lib/interface';
import { useAuth } from './userContext';

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
  const { user } = useAuth();
  const [themeData, setThemeData] = useState<Theme | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Load from localStorage & subscribe to Firestore
  useEffect(() => {
    if (!user) {
      // If no user, use default theme
      setThemeData({
        name: 'Default',
        primary: '#1976d2',
        secondary: '#9c27b0',
        mode: 'light',
      });
      return;
    }

    const userCacheKey = `${THEME_CACHE_KEY}_${user.uid}`;
    const cached = localStorage.getItem(userCacheKey);
    if (cached) {
      try {
        const parsed: Theme = JSON.parse(cached);
        setThemeData(parsed);
      } catch (err) {
        console.warn('Failed to parse cached theme', err);
      }
    }

    // Subscribe to user-specific theme document
    const ref = doc(db, 'theme', user.uid);
    const unsub = onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        const theme = docSnap.data() as Theme;
        localStorage.setItem(userCacheKey, JSON.stringify(theme));
        setThemeData(theme);
      } else {
        // If no user theme exists, create a default one
        const defaultTheme: Theme = {
          name: 'Default',
          primary: '#1976d2',
          secondary: '#9c27b0',
          mode: 'light',
          userId: user.uid,
        };
        setDoc(ref, defaultTheme);
        localStorage.setItem(userCacheKey, JSON.stringify(defaultTheme));
        setThemeData(defaultTheme);
      }
    });

    return () => unsub();
  }, [user]);

  const setThemeMode = async (mode: 'light' | 'dark') => {
    if (!themeData || !user) return;
    const ref = doc(db, 'theme', user.uid);
    const newTheme = { ...themeData, mode };
    await setDoc(ref, newTheme, { merge: true });
    const userCacheKey = `${THEME_CACHE_KEY}_${user.uid}`;
    localStorage.setItem(userCacheKey, JSON.stringify(newTheme));
    setThemeData(newTheme);
  };

  const refreshTheme = async () => {
    if (!user) return;
    const ref = doc(db, 'theme', user.uid);
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
      const freshTheme = docSnap.data() as Theme;
      const userCacheKey = `${THEME_CACHE_KEY}_${user.uid}`;
      localStorage.setItem(userCacheKey, JSON.stringify(freshTheme));
      setThemeData(freshTheme);
    }
  };

  // 🔹 Listen to system dark mode changes (Battery Saver triggers this)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia || !user) return;

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
  }, [hasUserInteracted, user]);

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
