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
    <Box maxWidth="600px" mx="auto" p={1.5}>
      <Typography variant="h4" gutterBottom>
        🔥 My Streaks
      </Typography>
      {/* Modal */}
      <CreateStreakForm onSave={handleSave} />
      <StreaksList />
    </Box>
  );
}
