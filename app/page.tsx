'use client';
import React, { Suspense, lazy } from 'react';
import { IncomeSourcesProvider } from './lib/context/IncomeSourcesContext';
import { useAuth } from './lib/context/userContext';
import { useCustomTheme } from './lib/context/themeContext';
import { CircularProgress, Box } from '@mui/material';
import GuestUserBanner from './components/global/GuestUserBanner';
import HomepageHeader from './components/homepage/HomepageHeader';
import SkeletonLoader from './components/global/SkeletonLoader';
import {
  ShoppingListPlaceholder,
  GoalsPlaceholder,
  StreaksPlaceholder,
} from './components/homepage/PlaceholderComponents';
import Schedules from './components/homepage/Schedules';

// Lazy load components for better performance
// const TimeTableNotifier = lazy(
//   () => import('./components/homepage/TimeTableNotifier')
// );
// const WelcomeGreeting = lazy(
//   () => import('./components/homepage/WelcomeGreeting')
// );
// const RemainingTasks = lazy(
//   () => import('./components/homepage/RemainingTasks')
// );
const FinancialCheckPoints = lazy(
  () => import('./components/finance/FinancialCheckPoints')
);
const ImportantTasks = lazy(
  () => import('./components/homepage/ImportantTasks')
);
const OverdueTasks = lazy(() => import('./components/homepage/OverdueTasks'));
// const OnGoingStreaks = lazy(
//   () => import('./components/homepage/OnGoingStreaks')
// );
const Mood = lazy(() => import('./components/homepage/Mood'));
const ExpectedExpenses = lazy(
  () => import('./components/homepage/ExpectedExpenses')
);
const ExpectedIncome = lazy(
  () => import('./components/homepage/ExpectedIncomes')
);
const JournalMemory = lazy(() => import('./components/homepage/JournalMemory'));
const MostProductiveDay = lazy(
  () => import('./components/homepage/MostProductiveDay')
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

  if (!user) return null;

  return (
    <IncomeSourcesProvider userId={user.uid}>
      <div
        className="p-4 mx-auto max-w-7xl"
        style={{
          backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#f8fafc',
          color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
          minHeight: '100vh',
        }}
      >
        <GuestUserBanner />

        {/* 1. Header Section - Full Width */}
        <Suspense fallback={<SkeletonLoader variant="card" height={120} />}>
          <HomepageHeader />
        </Suspense>

        {/* 2. Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
          {/* Column 1 - Schedules */}
          <div className="lg:col-span-3">
            <Suspense fallback={<SkeletonLoader variant="card" height={400} />}>
              <Schedules />
            </Suspense>
          </div>

          {/* Column 2 - Tasks */}
          <div className="lg:col-span-5 space-y-4">
            <Suspense fallback={<ComponentLoader variant="list" />}>
              <ImportantTasks />
            </Suspense>
            <Suspense fallback={<ComponentLoader variant="list" />}>
              <OverdueTasks />
            </Suspense>
          </div>

          {/* Column 3 - Shopping & Finance */}
          <div className="lg:col-span-4 space-y-4">
            <ShoppingListPlaceholder />
            <div className="space-y-4">
              <Suspense fallback={<ComponentLoader variant="card" />}>
                <ExpectedExpenses />
              </Suspense>
              <Suspense fallback={<ComponentLoader variant="card" />}>
                <ExpectedIncome />
              </Suspense>
            </div>
          </div>
        </div>

        {/* 3. Full Width Financial Section */}
        <div className="mb-8">
          <Suspense fallback={<SkeletonLoader variant="card" height={400} />}>
            <FinancialCheckPoints />
          </Suspense>
        </div>

        {/* 4. Goals & Streaks - 50/50 Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <GoalsPlaceholder />
          <StreaksPlaceholder />
        </div>

        {/* 5. Additional Components */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Suspense fallback={<ComponentLoader variant="card" />}>
            <Mood />
          </Suspense>
          <Suspense fallback={<ComponentLoader variant="card" />}>
            <JournalMemory />
          </Suspense>
        </div>

        {/* 6. Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Suspense fallback={<ComponentLoader variant="card" />}>
            <MostProductiveDay />
          </Suspense>
          <div className="flex items-center justify-center">
            <a
              href="/1/plans-remaining"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              style={{
                backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
              }}
            >
              See All Remaining Plans
            </a>
          </div>
        </div>
      </div>
    </IncomeSourcesProvider>
  );
}
