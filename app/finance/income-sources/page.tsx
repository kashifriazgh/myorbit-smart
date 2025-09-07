'use client';

import React from 'react';
import IncomeSourcesComponent from '@/app/components/finance/IncomeSource';
import { useAuth } from '@/app/lib/context/userContext';
import { IncomeSourcesProvider } from '@/app/lib/context/IncomeSourcesContext';

export default function IncomeSourcesPage() {
  const { user } = useAuth();

  if (!user) return null; // ⛔ Don't render if user not available

  return (
    <IncomeSourcesProvider userId={user.uid}>
      <IncomeSourcesComponent userId={user.uid} />
    </IncomeSourcesProvider>
  );
}
