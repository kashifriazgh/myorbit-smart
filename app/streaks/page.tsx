'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import CreateStreakForm from '../components/streaks/StreaksModal';
import { StreakProps } from '../lib/interface';
import StreaksList from '../components/streaks/StreaksList';

export default function Streaks() {
  const { theme } = useCustomTheme();

  if (!theme) return null;

  // Function called when streak is saved
  const handleSave = (data: StreakProps) => {
    console.log('✅ New Streak Saved:', data);
  };

  return (
    <Box
      maxWidth="600px"
      mx="auto"
      p={1.5}
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      <Typography variant="h4" gutterBottom>
        🔥 My Streaks
      </Typography>
      {/* Modal */}
      <CreateStreakForm onSave={handleSave} />
      <StreaksList />
    </Box>
  );
}
