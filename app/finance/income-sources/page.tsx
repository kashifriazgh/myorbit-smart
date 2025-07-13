'use client';

import React from 'react';
import IncomeSourcesComponent from '@/app/components/finance/IncomeSource';
import { useAuth } from '@/app/lib/context/userContext';

export default function IncomeSourcesPage() {
  const { user } = useAuth();

  if (!user) return null; // ⛔ Don’t render if user not available

  return (
    <div>
      <IncomeSourcesComponent userId={user.uid} />
    </div>
  );
}
