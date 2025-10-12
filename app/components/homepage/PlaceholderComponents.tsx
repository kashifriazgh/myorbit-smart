'use client';

import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import { useCustomTheme } from '@/app/lib/context/themeContext';

// Placeholder component for Schedules
export const SchedulesPlaceholder = () => {
  const { theme } = useCustomTheme();

  return (
    <Card
      className="h-full"
      sx={{
        borderRadius: 2,
        boxShadow: 2,
        background: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
      }}
    >
      <CardContent className="p-6">
        <Typography
          variant="h6"
          fontWeight="bold"
          sx={{
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          📅 Schedules
        </Typography>
        <Box
          className="flex items-center justify-center h-32 rounded-lg"
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#334155' : '#f8fafc',
            border: `2px dashed ${
              theme?.mode === 'dark' ? '#475569' : '#cbd5e1'
            }`,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
              textAlign: 'center',
            }}
          >
            Coming Soon
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// Placeholder component for Shopping List
export const ShoppingListPlaceholder = () => {
  const { theme } = useCustomTheme();

  return (
    <Card
      sx={{
        borderRadius: 2,
        boxShadow: 2,
        background: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
        mb: 2,
      }}
    >
      <CardContent className="p-4">
        <Typography
          variant="h6"
          fontWeight="bold"
          sx={{
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          🛒 This Month Shopping List
        </Typography>
        <Box
          className="flex items-center justify-center h-24 rounded-lg"
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#334155' : '#f8fafc',
            border: `2px dashed ${
              theme?.mode === 'dark' ? '#475569' : '#cbd5e1'
            }`,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
              textAlign: 'center',
            }}
          >
            Coming Soon
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// Placeholder component for Goals
export const GoalsPlaceholder = () => {
  const { theme } = useCustomTheme();

  return (
    <Card
      sx={{
        borderRadius: 2,
        boxShadow: 2,
        background: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
        h: 'full',
      }}
    >
      <CardContent className="p-6">
        <Typography
          variant="h6"
          fontWeight="bold"
          sx={{
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          🎯 Goals
        </Typography>
        <Box
          className="flex items-center justify-center h-32 rounded-lg"
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#334155' : '#f8fafc',
            border: `2px dashed ${
              theme?.mode === 'dark' ? '#475569' : '#cbd5e1'
            }`,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
              textAlign: 'center',
            }}
          >
            Coming Soon
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// Placeholder component for Streaks
export const StreaksPlaceholder = () => {
  const { theme } = useCustomTheme();

  return (
    <Card
      sx={{
        borderRadius: 2,
        boxShadow: 2,
        background: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
        h: 'full',
      }}
    >
      <CardContent className="p-6">
        <Typography
          variant="h6"
          fontWeight="bold"
          sx={{
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          🔥 Streaks
        </Typography>
        <Box
          className="flex items-center justify-center h-32 rounded-lg"
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#334155' : '#f8fafc',
            border: `2px dashed ${
              theme?.mode === 'dark' ? '#475569' : '#cbd5e1'
            }`,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
              textAlign: 'center',
            }}
          >
            Coming Soon
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
