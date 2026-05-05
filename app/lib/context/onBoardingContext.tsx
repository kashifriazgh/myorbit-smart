'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
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

    try {
      // Use the new top-level 'initialOnboarding' collection
      const ref = doc(db, 'initialOnboarding', user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        console.log('🔍 Raw Firestore onboarding data:', data);

        // Data is now top-level in the document
        setOnboarding({
          userId: user.uid,
          ...data,
        } as InitialOnBoarding);
      } else {
        console.warn('⚠️ No onboarding document found in initialOnboarding collection');
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
      // setDoc with merge: true handles both insert and update
      await setDoc(ref, { 
        ...data, 
        userId: user.uid,
        updatedAt: new Date() 
      }, { merge: true });
      
      // Refresh local state
      await fetchOnboarding();
    } catch (err) {
      console.error('❌ Error updating onboarding:', err);
      throw err;
    }
  }, [user?.uid, fetchOnboarding]);

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
