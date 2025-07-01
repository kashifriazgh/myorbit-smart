'use client';

import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from '../lib/theme';
import React from 'react';
import { UserProvider } from '../lib/context/userContext'; // ✅ Import the provider

export default function ClientThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      {' '}
      {/* ✅ Correct usage */}
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </UserProvider>
  );
}
