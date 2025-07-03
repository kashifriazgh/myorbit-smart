'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { Theme } from '@/app/lib/interface'; // Your theme type

interface ThemeData {
  theme: Theme;
}

const CustomThemeContext = createContext<ThemeData | null>(null);

export function CustomThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [themeData, setThemeData] = useState<Theme | null>(null);

  useEffect(() => {
    const ref = doc(db, 'theme', 'activeTheme');
    const unsub = onSnapshot(ref, (docSnap) => {
      if (docSnap.exists()) {
        setThemeData(docSnap.data() as Theme);
      }
    });
    return () => unsub();
  }, []);

  const muiTheme = createTheme({
    palette: {
      mode: themeData?.mode || 'light',
      primary: { main: themeData?.primary || '#1976d2' },
      secondary: { main: themeData?.secondary || '#9c27b0' },
    },
  });

  return (
    <CustomThemeContext.Provider value={{ theme: themeData as Theme }}>
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
