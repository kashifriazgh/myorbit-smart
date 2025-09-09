'use client';

import React from 'react';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Box, Typography } from '@mui/material';

export default function Procedures() {
  const { theme } = useCustomTheme();

  return (
    <Box
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
        p: 2,
      }}
    >
      <Typography variant="h4">Procedures</Typography>
    </Box>
  );
}
