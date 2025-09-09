'use client';

import React from 'react';
import LogoutButton from '@/app/components/user/LogoutButton';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Box } from '@mui/material';

export default function ForceLogoutPage() {
  const { theme } = useCustomTheme();

  return (
    <Box
      className="flex justify-center my-20"
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      <LogoutButton />
    </Box>
  );
}
