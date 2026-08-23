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
import { OnboardingProvider } from '../../lib/context/onBoardingContext';
import { ProjectsProvider } from '../../lib/context/ProjectsContext';
import { GoalsProvider } from '@/app/lib/context/GoalsContext';
import { SchedulesProvider } from '@/app/lib/context/SchedulesContext';

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
            <GoalsProvider>
              <SchedulesProvider>
                <ProjectsProvider>
                  <CssBaseline />
                  <ThemeBodyEffect />
                  {children}
                </ProjectsProvider>
              </SchedulesProvider>
            </GoalsProvider>
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
