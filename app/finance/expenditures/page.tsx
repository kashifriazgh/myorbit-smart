'use client';

import React from 'react';
import ExpendituresComponent from '@/app/components/finance/Expenditures';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Box } from '@mui/material';

export default function ExpendituresPage() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();

  if (!user) return null;

  return (
    <Box
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      <ExpendituresComponent userId={user.uid} />
    </Box>
  );
}
