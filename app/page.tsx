'use client';
import React, { Suspense, lazy } from 'react';
import { IncomeSourcesProvider } from './lib/context/IncomeSourcesContext';
import { GoalsProvider } from './lib/context/GoalsContext';
import { useAuth } from './lib/context/userContext';
import { useCustomTheme } from './lib/context/themeContext';
import { CircularProgress, Box } from '@mui/material';
import Switch from '@mui/material/Switch';
import GuestUserBanner from './components/global/GuestUserBanner';
import HomepageHeader from './components/homepage/HomepageHeader';
import SkeletonLoader from './components/global/SkeletonLoader';
import Goals from './components/homepage/Goals';
import Schedules from './components/homepage/Schedules';
import DailyCheckouts from './components/homepage/DailyCheckouts';

// Lazy load components
const ImportantTasks = lazy(
  () => import('./components/homepage/ImportantTasks'),
);
const OverdueTasks = lazy(() => import('./components/homepage/OverdueTasks'));
const OnGoingStreaks = lazy(
  () => import('./components/homepage/OnGoingStreaks'),
);

// Loading component with skeleton
const ComponentLoader = ({
  variant = 'card',
}: {
  variant?: 'card' | 'list' | 'text';
}) => <SkeletonLoader variant={variant} />;

export default function Homepage() {
  const { user, loading } = useAuth();
  const { theme } = useCustomTheme();

  const [focusToday, setFocusToday] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('focusOnToday');
      return stored === null ? true : stored === 'true';
    }
    return true;
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('focusOnToday', String(focusToday));
    }
  }, [focusToday]);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <IncomeSourcesProvider userId={user.uid}>
      <GoalsProvider userId={user.uid}>
        <div
          className="p-4 mx-auto max-w-7xl"
          style={{
            backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#f8fafc',
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
            minHeight: '100vh',
          }}
        >
          <GuestUserBanner />

          <div className="flex justify-end items-center mb-4 w-full">
            <label className="flex items-center gap-2 cursor-pointer select-none text-base font-medium text-slate-700 dark:text-slate-200">
              <span>Focus on Today</span>
              <Switch
                checked={focusToday}
                onChange={(e) => setFocusToday(e.target.checked)}
                slotProps={{ input: { 'aria-label': 'Focus on Today' } }}
                color="primary"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Suspense fallback={<SkeletonLoader variant="card" height={120} />}>
              <HomepageHeader />
            </Suspense>
            <Suspense fallback={<SkeletonLoader variant="card" height={200} />}>
              <DailyCheckouts focusToday={focusToday} />
            </Suspense>
          </div>

          {/* Updated Three Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            {/* Column 1 - Schedules */}
            <div className="lg:col-span-4">
              <Suspense
                fallback={<SkeletonLoader variant="card" height={400} />}
              >
                <Schedules />
              </Suspense>
            </div>

            {/* Column 2 - ImportantTasks */}
            <div className="lg:col-span-4">
              <Suspense fallback={<ComponentLoader variant="list" />}>
                <ImportantTasks />
              </Suspense>
            </div>

            {/* Column 3 - OverdueTasks */}
            <div className="lg:col-span-4">
              <Suspense fallback={<ComponentLoader variant="list" />}>
                <OverdueTasks />
              </Suspense>
            </div>
          </div>

          <div className="w-full mb-8 p-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
            <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              Quick Links (Coming Soon)
            </span>
          </div>

          {!focusToday && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Suspense
                fallback={<SkeletonLoader variant="card" height={400} />}
              >
                <Goals />
              </Suspense>
              <Suspense
                fallback={<SkeletonLoader variant="card" height={400} />}
              >
                <OnGoingStreaks />
              </Suspense>
            </div>
          )}
        </div>
      </GoalsProvider>
    </IncomeSourcesProvider>
  );
}
