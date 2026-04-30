'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
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

const defaultTheme: Theme = {
  name: 'Default',
  primary: '#1976d2',
  secondary: '#9c27b0',
  mode: 'light',
};

export function CustomThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [themeData, setThemeData] = useState<Theme>(defaultTheme);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme on first load
  useEffect(() => {
    if (isInitialized) return;

    if (typeof window === 'undefined') {
      setIsInitialized(true);
      return;
    }

    // Try to load from localStorage first (for immediate display)
    const globalCache = localStorage.getItem(THEME_CACHE_KEY);
    if (globalCache) {
      try {
        const parsed: Theme = JSON.parse(globalCache);
        setThemeData(parsed);
        setIsInitialized(true);
        return;
      } catch (err) {
        console.warn('Failed to parse cached theme', err);
      }
    }

    const systemPrefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;

    setThemeData({
      ...defaultTheme,
      mode: systemPrefersDark ? 'dark' : 'light',
    });
    setIsInitialized(true);
  }, [isInitialized]);

  // Load user-specific theme when user is available
  useEffect(() => {
    if (!user || !isInitialized) return;

    const userCacheKey = `${THEME_CACHE_KEY}_${user.uid}`;

    // Fetch the user's theme from Firestore to update localStorage
    const ref = doc(db, 'theme', user.uid);
    getDoc(ref).then((docSnap) => {
      if (docSnap.exists()) {
        const theme = docSnap.data() as Theme;
        // Update localStorage with Firestore data when user logs in
        localStorage.setItem(userCacheKey, JSON.stringify(theme));
        localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(theme)); // Also update global cache
        setThemeData(theme);
      } else {
        // Only set a default theme locally if user has no cached theme (avoid Firestore write)
        const userCached = localStorage.getItem(userCacheKey);
        if (!userCached) {
          const defaultTheme: Theme = {
            name: 'Default',
            primary: '#1976d2',
            secondary: '#9c27b0',
            mode: 'light',
            userId: user.uid,
          };
          // Avoid setDoc here to minimize writes; persist only on explicit user change
          localStorage.setItem(userCacheKey, JSON.stringify(defaultTheme));
          localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(defaultTheme));
          setThemeData(defaultTheme);
        }
      }
    });

    // Also subscribe to real-time updates for future changes
    const unsub = onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        const theme = docSnap.data() as Theme;
        localStorage.setItem(userCacheKey, JSON.stringify(theme));
        localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(theme));
        setThemeData(theme);
      }
    });

    return () => unsub();
  }, [user, isInitialized]);

  const setThemeMode = useCallback(
    async (mode: 'light' | 'dark') => {
      if (!themeData || !user) return;
      if (themeData.mode === mode) return; // no-op if unchanged to avoid writes
      const ref = doc(db, 'theme', user.uid);
      const newTheme = { ...themeData, mode };
      await setDoc(ref, newTheme, { merge: true });
      const userCacheKey = `${THEME_CACHE_KEY}_${user.uid}`;
      localStorage.setItem(userCacheKey, JSON.stringify(newTheme));
      localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(newTheme)); // Also update global cache
      setThemeData(newTheme);
    },
    [themeData, user],
  );

  const refreshTheme = async () => {
    if (!user) return;
    const ref = doc(db, 'theme', user.uid);
    const docSnap = await getDoc(ref);
    if (docSnap.exists()) {
      const freshTheme = docSnap.data() as Theme;
      const userCacheKey = `${THEME_CACHE_KEY}_${user.uid}`;
      localStorage.setItem(userCacheKey, JSON.stringify(freshTheme));
      localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(freshTheme)); // Also update global cache
      setThemeData(freshTheme);
    }
  };

  // 🔹 Listen to system dark mode changes (Battery Saver triggers this)
  // Avoid persisting to Firestore unless the user explicitly changes the theme
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applySystemTheme = (isDark: boolean) => {
      if (!hasUserInteracted) {
        const mode = isDark ? 'dark' : 'light';
        // Update local state and caches only; do not write to Firestore
        setThemeData((prev) => {
          if (prev.mode === mode) return prev;

          const updated: Theme = { ...prev, mode } as Theme;
          try {
            const globalKey = THEME_CACHE_KEY;
            localStorage.setItem(globalKey, JSON.stringify(updated));
            if (user) {
              const userCacheKey = `${THEME_CACHE_KEY}_${user.uid}`;
              localStorage.setItem(userCacheKey, JSON.stringify(updated));
            }
          } catch {}
          return updated;
        });
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
      } else {
        media.removeListener(listener);
      }
    };
  }, [hasUserInteracted, user]);

  const setThemeModeWithOverride = async (mode: 'light' | 'dark') => {
    setHasUserInteracted(true); // ✅ stop listening to system changes after first manual change
    await setThemeMode(mode);
  };
  const muiTheme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeData.mode,
          primary: { main: themeData.primary },
          secondary: { main: themeData.secondary },
        },
      }),
    [themeData],
  );

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
