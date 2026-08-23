'use client';
import React, { Suspense, lazy } from 'react';
import { useAuth } from './lib/context/userContext';
import { useCustomTheme } from './lib/context/themeContext';
import { CircularProgress, Box } from '@mui/material';
import GuestUserBanner from './components/global/GuestUserBanner';
import GuideBanner from './components/homepage/GuideBanner';
import HomepageHeader from './components/homepage/HomepageHeader';
import SkeletonLoader from './components/global/SkeletonLoader';
import Goals from './components/homepage/Goals';
import Schedules from './components/homepage/Schedules';
import QuickLinks from './components/homepage/QuickLinks';
import OnBoardingInitializer from './components/global/initial-on-boarding/OnBoardingInitializer';

// Lazy load components
const ImportantTasks = lazy(
  () => import('./components/homepage/ImportantTasks'),
);
const OverdueTasks = lazy(() => import('./components/homepage/OverdueTasks'));

// Loading component with skeleton
const ComponentLoader = ({
  variant = 'card',
}: {
  variant?: 'card' | 'list' | 'text';
}) => <SkeletonLoader variant={variant} />;

export default function Homepage() {
  const { user, loading } = useAuth();
  const { theme } = useCustomTheme();

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
    <div
      className="p-4 mx-auto max-w-7xl"
      style={{
        backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#f8fafc',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
      }}
    >
      <OnBoardingInitializer />
      <GuestUserBanner />
      <GuideBanner />

      <div className="grid grid-cols-1 gap-6 mb-8 mt-4">
        <Suspense fallback={<SkeletonLoader variant="card" height={120} />}>
          <HomepageHeader />
        </Suspense>
      </div>

      {/* Updated Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Column 1 - Schedules */}
        <div className="lg:col-span-4">
          <Suspense fallback={<SkeletonLoader variant="card" height={400} />}>
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

      <div className="w-full mb-8">
        <QuickLinks />
      </div>

      <div className="w-full mb-8">
        <Suspense fallback={<SkeletonLoader variant="card" height={400} />}>
          <Goals />
        </Suspense>
      </div>
    </div>
  );
}

