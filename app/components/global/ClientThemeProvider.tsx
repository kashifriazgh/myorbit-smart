// app/components/ClientThemeProvider.tsx

'use client';

import { CssBaseline } from '@mui/material';
import React from 'react';
import { UserProvider } from '../../lib/context/userContext';
import {
  CustomThemeProvider,
  useCustomTheme,
} from '@/app/lib/context/themeContext';
import { TodoProvider } from '../../lib/context/todoContext';

export default function ClientThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <CustomThemeProvider>
        <TodoProvider>
          <CssBaseline />
          <ThemeBodyEffect />
          {children}
        </TodoProvider>
      </CustomThemeProvider>
    </UserProvider>
  );
}

function ThemeBodyEffect() {
  const { theme } = useCustomTheme();
  React.useEffect(() => {
    if (theme?.mode === 'dark') {
      document.body.style.background = '#334155'; // slate-800
      document.body.style.color = '#f8fafc'; // slate-50
    } else {
      document.body.style.background = '';
      document.body.style.color = '';
    }
  }, [theme?.mode]);
  return null;
}
