// app/components/ClientThemeProvider.tsx

'use client';

import { CssBaseline } from '@mui/material';
import React from 'react';
import { UserProvider } from '../../lib/context/userContext';
import { CustomThemeProvider } from '@/app/lib/context/themeContext';
export default function ClientThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <CustomThemeProvider>
        <CssBaseline />
        {children}
      </CustomThemeProvider>
    </UserProvider>
  );
}
