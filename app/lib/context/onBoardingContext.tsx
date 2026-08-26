'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { userDb as db } from '@/app/lib/firebase';
import { useAuth } from './userContext';
import { InitialOnBoarding } from '@/app/lib/interface';

interface OnboardingContextType {
  onboarding: InitialOnBoarding | null;
  loading: boolean;
  refreshOnboarding: () => Promise<void>;
  updateOnboarding: (data: Partial<InitialOnBoarding>) => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType>({
  onboarding: null,
  loading: true,
  refreshOnboarding: async () => {},
  updateOnboarding: async () => {},
});

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [onboarding, setOnboarding] = useState<InitialOnBoarding | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOnboarding = useCallback(async () => {
    if (!user?.uid) {
      setOnboarding(null);
      setLoading(false);
      return;
    }

    // Try loading from localStorage cache first
    const cached = localStorage.getItem('myorbit_cached_onboarding');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setOnboarding(parsed);
        setLoading(false);
        console.log('📦 Served onboarding data from local cache in OnboardingProvider');
        return;
      } catch (e) {
        console.error('Error parsing cached onboarding in provider:', e);
      }
    }

    try {
      console.log('🔥 Fetching onboarding from userDb...');
      const ref = doc(db, 'initialOnboarding', user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        const obData = {
          userId: user.uid,
          ...data,
        } as InitialOnBoarding;
        setOnboarding(obData);
        localStorage.setItem('myorbit_cached_onboarding', JSON.stringify(obData));
      } else {
        console.warn('⚠️ No onboarding document found in userDb initialOnboarding');
        setOnboarding(null);
      }
    } catch (err) {
      console.error('❌ Error fetching onboarding:', err);
      setOnboarding(null);
    }
    setLoading(false);
  }, [user?.uid]);

  const updateOnboarding = useCallback(async (data: Partial<InitialOnBoarding>) => {
    if (!user?.uid) return;

    try {
      const ref = doc(db, 'initialOnboarding', user.uid);
      const updatedData = {
        ...data,
        userId: user.uid,
        updatedAt: new Date()
      };

      // 1. Write to Firestore
      await setDoc(ref, updatedData, { merge: true });
      
      // 2. Update local React state and localStorage cache immediately (write-through)
      const currentOnboarding = onboarding || {};
      const newOnboardingObj = { ...currentOnboarding, ...updatedData } as InitialOnBoarding;
      setOnboarding(newOnboardingObj);
      localStorage.setItem('myorbit_cached_onboarding', JSON.stringify(newOnboardingObj));
      
      console.log('✅ Onboarding write-through cache updated');
    } catch (err) {
      console.error('❌ Error updating onboarding:', err);
      throw err;
    }
  }, [user?.uid, onboarding]);

  useEffect(() => {
    console.log('🔍 Onboarding Context useEffect triggered with user.uid:', user?.uid);
    fetchOnboarding();
  }, [fetchOnboarding, user?.uid]);

  return (
    <OnboardingContext.Provider
      value={{
        onboarding,
        loading,
        refreshOnboarding: fetchOnboarding,
        updateOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext);
