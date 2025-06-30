'use client';

import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from '../lib/theme';
import React from 'react';

export default function ClientThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
