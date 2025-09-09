'use client';

import React from 'react';
import IncomeSourcesComponent from '@/app/components/finance/IncomeSource';
import { useAuth } from '@/app/lib/context/userContext';
import { IncomeSourcesProvider } from '@/app/lib/context/IncomeSourcesContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Box } from '@mui/material';

export default function IncomeSourcesPage() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();

  if (!user) return null; // ⛔ Don't render if user not available

  return (
    <Box
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      <IncomeSourcesProvider userId={user.uid}>
        <IncomeSourcesComponent userId={user.uid} />
      </IncomeSourcesProvider>
    </Box>
  );
}
