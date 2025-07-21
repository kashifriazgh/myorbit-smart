// components/dashboard/MostFocusedTime.tsx

'use client';

import { Box, Typography, Paper, useTheme } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TodayIcon from '@mui/icons-material/Today';
import React from 'react';

export interface FocusedTimeData {
  hourStart: number; // e.g., 21
  hourEnd: number; // e.g., 22
  day: string; // e.g., 'Sunday'
}

interface MostFocusedTimeProps {
  data?: FocusedTimeData | null;
}

const MostFocusedTime: React.FC<MostFocusedTimeProps> = ({ data }) => {
  const theme = useTheme();

  if (!data) return null;

  const { hourStart, hourEnd, day } = data;

  return (
    <Paper
      elevation={3}
      sx={{
        my: 2,
        p: 3,
        borderRadius: 3,
        bgcolor: theme.palette.background.default,
        borderLeft: `6px solid ${theme.palette.primary.main}`,
      }}
    >
      <Typography
        variant="subtitle2"
        fontWeight={700}
        color="primary"
        sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
      >
        <AccessTimeIcon fontSize="small" sx={{ mr: 1 }} />
        Most Focused Time
      </Typography>

      <Box sx={{ ml: 1 }}>
        <Typography variant="body1" fontWeight={600}>
          You were most focused between{' '}
          <strong>
            {hourStart}:00 – {hourEnd}:00
          </strong>
        </Typography>

        <Box display="flex" alignItems="center" mt={1}>
          <TodayIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            Your focus on <strong>{day}</strong> was at its peak.
          </Typography>
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            mt: 2,
            display: 'block',
            textAlign: 'right',
          }}
        >
          based on last 30 days
        </Typography>
      </Box>
    </Paper>
  );
};

export default MostFocusedTime;
