'use client';

import React from 'react';
import { useAuth } from '@/app/lib/context/userContext';
import InitialOnboarding from '../../onboarding/InitialOnboarding';

export default function OnBoardingInitializer() {
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  return (
    <InitialOnboarding />
  );
}
