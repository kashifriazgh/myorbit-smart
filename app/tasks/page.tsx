'use client';

import React, { Suspense, lazy } from 'react';
import { Container, Typography, Box } from '@mui/material';
import { useAuth } from '../lib/context/userContext';
import { useCustomTheme } from '../lib/context/themeContext';
import SkeletonLoader from '../components/global/SkeletonLoader';

const ImportantTasks = lazy(() => import('../components/homepage/ImportantTasks'));
const OverdueTasks = lazy(() => import('../components/homepage/OverdueTasks'));

export default function TasksPage() {
  const { user, loading } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  if (loading || !user) {
    return (
      <div
        className="p-4 mx-auto max-w-6xl"
        style={{
          backgroundColor: isDark ? '#181c24' : '#f8fafc',
          color: isDark ? '#f1f5f9' : '#0f172a',
          minHeight: '100vh',
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <SkeletonLoader variant="list" count={5} />
          <SkeletonLoader variant="list" count={5} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: isDark ? '#181c24' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#0f172a',
        minHeight: '100vh',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              color: isDark ? '#f1f5f9' : '#0f172a',
            }}
          >
            Tasks Overview
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: isDark ? '#94a3b8' : '#64748b',
              mt: 0.5,
            }}
          >
            Focus on your important and overdue tasks
          </Typography>
        </Box>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Suspense fallback={<SkeletonLoader variant="list" count={5} />}>
              <ImportantTasks />
            </Suspense>
          </div>
          <div>
            <Suspense fallback={<SkeletonLoader variant="list" count={5} />}>
              <OverdueTasks />
            </Suspense>
          </div>
        </div>
      </Container>
    </div>
  );
}

