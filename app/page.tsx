'use client';
import React, { Suspense, lazy } from 'react';
import { IncomeSourcesProvider } from './lib/context/IncomeSourcesContext';
import { useAuth } from './lib/context/userContext';
import { useCustomTheme } from './lib/context/themeContext';
import { CircularProgress, Box } from '@mui/material';
import GuestUserBanner from './components/global/GuestUserBanner';

// Lazy load components for better performance
// const TimeTableNotifier = lazy(
//   () => import('./components/homepage/TimeTableNotifier')
// );
const DashboardHome = lazy(() => import('./components/homepage/Opener'));
const FinancialCheckPoints = lazy(
  () => import('./components/finance/FinancialCheckPoints')
);
const ImportantTasks = lazy(
  () => import('./components/homepage/ImportantTasks')
);
const OverdueTasks = lazy(() => import('./components/homepage/OverdueTasks'));
const OnGoingStreaks = lazy(
  () => import('./components/homepage/OnGoingStreaks')
);
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

// Loading component
const ComponentLoader = () => (
  <Box display="flex" justifyContent="center" p={2}>
    <CircularProgress size={24} />
  </Box>
);
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
        className="p-2 mx-auto flex-col flex max-w-2xl my-10 justify-center"
        style={{
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
          minHeight: '100vh',
          borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
        }}
      >
        <GuestUserBanner />
        {/* <OnBoardingInitializer /> */}
        {/* <Suspense fallback={<ComponentLoader />}>
          <TimeTableNotifier />
        </Suspense> */}

        <Suspense fallback={<ComponentLoader />}>
          <ImportantTasks />
        </Suspense>
        <Suspense fallback={<ComponentLoader />}>
          <OverdueTasks />
        </Suspense>
        <Suspense fallback={<ComponentLoader />}>
          <DashboardHome />
        </Suspense>
        <Suspense fallback={<ComponentLoader />}>
          <FinancialCheckPoints />
        </Suspense>
        <Suspense fallback={<ComponentLoader />}>
          <OnGoingStreaks />
        </Suspense>
        <Suspense fallback={<ComponentLoader />}>
          <Mood />
        </Suspense>
        <Suspense fallback={<ComponentLoader />}>
          <ExpectedExpenses />
        </Suspense>
        <Suspense fallback={<ComponentLoader />}>
          <ExpectedIncome />
        </Suspense>
        <Suspense fallback={<ComponentLoader />}>
          <JournalMemory />
        </Suspense>
        <Suspense fallback={<ComponentLoader />}>
          <MostProductiveDay />
        </Suspense>

        {/* <MostFocusedTime
          data={{
            hourStart: 21,
            hourEnd: 22,
            day: 'Sunday',
          }}
        /> */}
      </div>
    </IncomeSourcesProvider>
  );
}
