'use client';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useAuth } from './lib/context/userContext';
import { useCustomTheme } from './lib/context/themeContext';
import GuestUserBanner from './components/global/GuestUserBanner';
import GuideBanner from './components/homepage/GuideBanner';
import HomepageHeader from './components/homepage/HomepageHeader';
import SkeletonLoader from './components/global/SkeletonLoader';
import Goals from './components/homepage/Goals';
import Schedules from './components/homepage/Schedules';
import QuickLinks from './components/homepage/QuickLinks';
import OnBoardingInitializer from './components/global/initial-on-boarding/OnBoardingInitializer';
import InstallShortcutBanner from './components/global/InstallShortcutBanner';

import DaySummary from './components/homepage/DaySummary';

// Lazy load components
const ImportantTasks = lazy(
  () => import('./components/homepage/ImportantTasks'),
);
const OverdueTasks = lazy(() => import('./components/homepage/OverdueTasks'));

// Skeleton shell — renders instantly from cache, avoids blank white screen on PWA launch
function HomepageSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="p-4 mx-auto max-w-7xl"
      style={{
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
      }}
    >
      {/* Header skeleton */}
      <div className="mb-4 mt-4">
        <SkeletonLoader variant="card" height={120} />
      </div>
      {/* Day summary skeleton */}
      <div className="mb-6">
        <SkeletonLoader variant="card" height={200} />
      </div>
      {/* Three column layout skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        <div className="lg:col-span-4"><SkeletonLoader variant="card" height={400} /></div>
        <div className="lg:col-span-4"><SkeletonLoader variant="list" count={5} /></div>
        <div className="lg:col-span-4"><SkeletonLoader variant="list" count={5} /></div>
      </div>
      <div className="w-full mb-8"><SkeletonLoader variant="card" height={80} /></div>
      <div className="w-full mb-8"><SkeletonLoader variant="card" height={300} /></div>
    </div>
  );
}

export default function Homepage() {
  const { user, loading } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  // Check for cached user so we can show the shell immediately on PWA launch
  // instead of blocking on Firebase auth state resolution
  const [hasCachedUser, setHasCachedUser] = useState(false);
  useEffect(() => {
    try {
      const cached = localStorage.getItem('myorbit_cached_user');
      if (cached) setHasCachedUser(true);
    } catch {
      // localStorage not available (SSR / private mode)
    }
  }, []);

  // Show skeleton shell if:
  // - Auth is still loading AND we have no cached user (cold launch, no cache)
  // - This means: if cached user exists, we skip the spinner entirely → instant render
  if (loading && !hasCachedUser) {
    return <HomepageSkeleton isDark={isDark} />;
  }

  if (!user) {
    return <HomepageSkeleton isDark={isDark} />;
  }

  return (
    <div
      className="p-4 mx-auto max-w-7xl"
      style={{
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
      }}
    >
      <OnBoardingInitializer />
      <InstallShortcutBanner />
      <GuestUserBanner />
      <GuideBanner />

      <div className="grid grid-cols-1 gap-6 mb-4 mt-4">
        <Suspense fallback={<SkeletonLoader variant="card" height={120} />}>
          <HomepageHeader />
        </Suspense>
      </div>

      {/* Day Summary Component */}
      <div className="mb-6">
        <Suspense fallback={<SkeletonLoader variant="card" height={200} />}>
          <DaySummary />
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
          <Suspense fallback={<SkeletonLoader variant="list" count={5} />}>
            <ImportantTasks />
          </Suspense>
        </div>

        {/* Column 3 - OverdueTasks */}
        <div className="lg:col-span-4">
          <Suspense fallback={<SkeletonLoader variant="list" count={5} />}>
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
