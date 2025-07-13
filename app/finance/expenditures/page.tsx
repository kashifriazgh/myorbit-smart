'use client';

import React from 'react';
import ExpendituresComponent from '@/app/components/finance/Expenditures';
import { useAuth } from '@/app/lib/context/userContext';

export default function ExpendituresPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div>
      <ExpendituresComponent userId={user.uid} />
    </div>
  );
}
