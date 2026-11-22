'use client';

import React, { useState } from 'react';
import { useAuth } from './lib/context/userContext';
import { useCustomTheme } from './lib/context/themeContext';
import GuestUserBanner from './components/global/GuestUserBanner';
import SkeletonLoader from './components/global/SkeletonLoader';
import OnBoardingInitializer from './components/global/initial-on-boarding/OnBoardingInitializer';
import InstallShortcutBanner from './components/global/InstallShortcutBanner';
import FinanceHomepage from './components/finance/FinanceHomepage';

// Skeleton shell — renders instantly from cache, avoids blank white screen on PWA launch
function HomepageSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="p-4 mx-auto max-w-6xl"
      style={{
        backgroundColor: isDark ? '#181c24' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#0f172a',
        minHeight: '100vh',
      }}
    >
      <div className="mb-6 mt-4">
        <SkeletonLoader variant="card" height={180} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <SkeletonLoader variant="card" height={280} />
        <SkeletonLoader variant="card" height={280} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <SkeletonLoader variant="card" height={180} />
        <SkeletonLoader variant="card" height={180} />
        <SkeletonLoader variant="card" height={180} />
      </div>
    </div>
  );
}

export default function Homepage() {
  const { user, loading } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [hasCachedUser] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('myorbit_cached_user');
    }
    return false;
  });

  if (loading && !hasCachedUser) {
    return <HomepageSkeleton isDark={isDark} />;
  }

  if (!user && !hasCachedUser) {
    return <HomepageSkeleton isDark={isDark} />;
  }

  return (
    <div
      style={{
        backgroundColor: isDark ? '#181c24' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#0f172a',
        minHeight: '100vh',
      }}
    >
      <OnBoardingInitializer />
      <div className="mx-auto max-w-6xl px-4 pt-3">
        <InstallShortcutBanner />
        <GuestUserBanner />
      </div>
      <FinanceHomepage />
    </div>
  );
}
