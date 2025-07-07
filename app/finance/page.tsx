'use client';

import React from 'react';
import TotalCashSnapshotComponent from '../components/finance/TotalCashSnapshot';
import { useAuth } from '../lib/context/userContext';
import IncomeSourcesComponent from '../components/finance/IncomeSource';
import ExpendituresComponent from '../components/finance/Expenditures';
export default function Finance() {
  const { user } = useAuth();
  if (!user) return null;
  const userId = user.uid;

  return (
    <>
      <TotalCashSnapshotComponent userId={userId} />

      <IncomeSourcesComponent userId={userId} />
      <ExpendituresComponent userId={userId} />
    </>
  );
}
