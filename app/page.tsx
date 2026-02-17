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
// import ShoppingList from './components/homepage/ShoppingList';
import Schedules from './components/homepage/Schedules';
import DailyCheckouts from './components/homepage/DailyCheckouts';
// import ProductivityEditor from './components/global/QuickEditor';

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

const ImportantTasks = lazy(
  () => import('./components/homepage/ImportantTasks'),
);
const OverdueTasks = lazy(() => import('./components/homepage/OverdueTasks'));
const OnGoingStreaks = lazy(
  () => import('./components/homepage/OnGoingStreaks'),
);
// const Mood = lazy(() => import('./components/homepage/Mood'));
// const ExpectedExpenses = lazy(
//   () => import('./components/homepage/ExpectedExpenses'),
// );
// const ExpectedIncome = lazy(
//   () => import('./components/homepage/ExpectedIncomes'),
// );
// const JournalMemory = lazy(() => import('./components/homepage/JournalMemory'));
// const MostProductiveDay = lazy(
//   () => import('./components/homepage/MostProductiveDay')
// );

// Loading component with skeleton
const ComponentLoader = ({
  variant = 'card',
}: {
  variant?: 'card' | 'list' | 'text';
}) => <SkeletonLoader variant={variant} />;
export default function Homepage() {
  const { user, loading } = useAuth();
  const { theme } = useCustomTheme();

  // Focus on Today Switch State (persisted in localStorage)
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

  if (!user) return null;

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

          {/* Focus on Today Switch - Top right on desktop, full width on mobile */}
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

          {/* Top Row: HomepageHeader & DailyCheckouts side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Suspense fallback={<SkeletonLoader variant="card" height={120} />}>
              <HomepageHeader />
            </Suspense>
            <Suspense fallback={<SkeletonLoader variant="card" height={200} />}>
              <DailyCheckouts focusToday={focusToday} />
            </Suspense>
          </div>

          {/* Three Column Layout: ImportantTasks, OverdueTasks, Schedules */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            {/* Column 1 - ImportantTasks */}
            <div className="lg:col-span-4">
              <Suspense fallback={<ComponentLoader variant="list" />}>
                <ImportantTasks />
              </Suspense>
            </div>
            {/* Column 2 - OverdueTasks */}
            <div className="lg:col-span-4">
              <Suspense fallback={<ComponentLoader variant="list" />}>
                <OverdueTasks />
              </Suspense>
            </div>
            {/* Column 3 - Schedules */}
            <div className="lg:col-span-4">
              <Suspense
                fallback={<SkeletonLoader variant="card" height={400} />}
              >
                <Schedules />
              </Suspense>
            </div>
          </div>

          {/* Quick Links Section - Full Width Placeholder */}
          <div className="w-full mb-8 p-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
            <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              Quick Links (Coming Soon)
            </span>
          </div>

          {/* Goals & Streaks - 50/50 Split */}
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

          {/* Temporarily commented out: Monthly Shopping List, Estimated Expenses & Income */}
          {/**
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            <div className="lg:col-span-4">
              <Suspense fallback={<ComponentLoader variant="card" />}>
                <ShoppingList />
              </Suspense>
            </div>
            <div className="lg:col-span-4">
              <Suspense fallback={<ComponentLoader variant="card" />}>
                <ExpectedExpenses />
              </Suspense>
            </div>
            <div className="lg:col-span-4">
              <Suspense fallback={<ComponentLoader variant="card" />}>
                <ExpectedIncome />
              </Suspense>
            </div>
          </div>
          */}
        </div>
      </GoalsProvider>
    </IncomeSourcesProvider>
  );
}
