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
import { StreaksProvider } from '../../lib/context/StreaksContext';
import { OnboardingProvider } from '../../lib/context/onBoardingContext';

export default function ClientThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <OnboardingProvider>
        <CustomThemeProvider>
          <TodoProvider>
            <StreaksProvider>
              <CssBaseline />
              <ThemeBodyEffect />
              {children}
            </StreaksProvider>
          </TodoProvider>
        </CustomThemeProvider>
      </OnboardingProvider>
    </UserProvider>
  );
}

function ThemeBodyEffect() {
  const { theme } = useCustomTheme();
  React.useEffect(() => {
    if (theme?.mode === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.style.background = '#334155'; // slate-800
      document.body.style.color = '#f8fafc'; // slate-50
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.background = '';
      document.body.style.color = '';
    }
  }, [theme?.mode]);
  return null;
}
