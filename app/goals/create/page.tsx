'use client';

import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useCustomTheme } from '../../lib/context/themeContext';
import { useAuth } from '../../lib/context/userContext';
import GoalModal from '../../components/goals/GoalModal';

const CreateGoalPage: React.FC = () => {
  const router = useRouter();
  const { theme } = useCustomTheme();
  useAuth();

  return (
    <Box
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#f8fafc',
        minHeight: '100vh',
        p: 3,
      }}
    >
      <Box className="max-w-4xl mx-auto">
        {/* Header */}
        <Box className="flex items-center gap-4 mb-6">
          <IconButton
            onClick={() => router.back()}
            sx={{
              backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
            }}
          >
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h4"
            className="font-bold"
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
            }}
          >
            Create New Goal
          </Typography>
        </Box>

        {/* Goal Creation Form */}
        <GoalModal open={true} onClose={() => router.push('/goals')} />
      </Box>
    </Box>
  );
};

export default CreateGoalPage;
