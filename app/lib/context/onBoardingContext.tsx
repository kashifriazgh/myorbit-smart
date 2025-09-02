'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from './userContext';
import { InitialOnBoarding } from '@/app/lib/interface';

interface OnboardingContextType {
  onboarding: InitialOnBoarding | null;
  loading: boolean;
  refreshOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType>({
  onboarding: null,
  loading: true,
  refreshOnboarding: async () => {},
});

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [onboarding, setOnboarding] = useState<InitialOnBoarding | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOnboarding = async () => {
    if (!user?.uid) {
      setOnboarding(null);
      setLoading(false);
      return;
    }

    try {
      const ref = doc(db, 'settings', user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        console.log('🔍 Raw Firestore data:', data);
        console.log('🔍 initialOnBoarding data:', data.initialOnBoarding);

        // Ensure we have the proper structure
        const onboardingData = data.initialOnBoarding || {};
        setOnboarding({
          userId: user.uid,
          ...onboardingData,
        });
      } else {
        console.warn('⚠️ No onboarding document found for this user');
        setOnboarding(null);
      }
    } catch (err) {
      console.error('❌ Error fetching onboarding:', err);
      setOnboarding(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    console.log('🔍 useEffect triggered with user.uid:', user?.uid);
    fetchOnboarding();
  }, [user?.uid]);

  return (
    <OnboardingContext.Provider
      value={{
        onboarding,
        loading,
        refreshOnboarding: fetchOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext);
