'use client';

import { Box, Typography, LinearProgress, useTheme } from '@mui/material';
import moment from 'moment-timezone';

interface MostProductiveDayProps {
  data: {
    date: Date | string;
    tasksCompleted: number;
    focusScore: number; // e.g., 0 to 100
  };
}

export default function MostProductiveDay({ data }: MostProductiveDayProps) {
  const theme = useTheme();

  if (!data) return null;

  const formattedDate = moment(data.date).format('dddd, MMM D');
  const primaryColor = theme.palette.mode === 'dark' ? '#4ade80' : '#059669';
  const bgColor = theme.palette.mode === 'dark' ? '#1e293b' : '#f0fdf4';
  const borderColor = theme.palette.mode === 'dark' ? '#15803d' : '#bbf7d0';

  return (
    <Box
      sx={{
        background: bgColor,
        borderRadius: 2,
        px: 3,
        py: 2.5,
        border: `1px solid ${borderColor}`,
        boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
        minWidth: 300,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          color: primaryColor,
          fontWeight: 700,
          fontSize: '0.9rem',
          mb: 1.5,
        }}
      >
        🌟 Most Productive Day
      </Typography>

      <Typography
        variant="h6"
        fontWeight="bold"
        sx={{ color: theme.palette.text.primary, mb: 0.5 }}
      >
        {formattedDate}
      </Typography>

      <Typography
        variant="body2"
        sx={{ color: theme.palette.text.secondary, mb: 1 }}
      >
        Tasks Completed: <strong>{data.tasksCompleted}</strong>
      </Typography>

      <Typography
        variant="body2"
        sx={{
          color: theme.palette.text.secondary,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        Focus Score: <strong>{data.focusScore}%</strong>
      </Typography>

      <LinearProgress
        variant="determinate"
        value={data.focusScore}
        sx={{
          height: 8,
          borderRadius: 4,
          mt: 0.5,
          backgroundColor:
            theme.palette.mode === 'dark' ? '#334155' : '#d1fae5',
          '& .MuiLinearProgress-bar': {
            backgroundColor: primaryColor,
          },
        }}
      />
    </Box>
  );
}
