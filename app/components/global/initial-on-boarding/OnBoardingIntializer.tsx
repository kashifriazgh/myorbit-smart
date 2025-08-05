'use client';

import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import { db } from '@/app/lib/firebase';
import OnBoardingModal from './OnBoardingModal';

interface OnboardingData {
  gender?: string;
  ageGroup?: string;
  // Add any other expected fields here
}

export default function OnBoardingInitializer() {
  const { user, loading } = useAuth();

  const [openOnboarding, setOpenOnboarding] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [initialOnboarding, setInitialOnboarding] =
    useState<OnboardingData | null>(null);

  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchOnboarding = async () => {
      if (!user?.uid) return;
      const ref = doc(db, 'initialOnBoarding', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setInitialOnboarding(snap.data());
      }
      setFetching(false);
    };
    if (!loading) fetchOnboarding();
  }, [user, loading]);

  if (loading || fetching) return null; // or show a loading skeleton

  return (
    <>
      <OnBoardingModal
        open={openOnboarding}
        onClose={() => setOpenOnboarding(false)}
      />
    </>
  );
}
