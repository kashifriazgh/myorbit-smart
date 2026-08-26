'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/lib/context/userContext';
import { db } from '@/app/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import InitialOnboarding from '../../onboarding/InitialOnboarding';

export default function OnBoardingInitializer() {
  const { user, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (loading) return;
    
    // For guest or logged in user, we check the status
    if (!user) {
      setInitialized(true);
      return;
    }

    // 1. First check localStorage for immediate skip (Performance optimization)
    const localStatus = localStorage.getItem('onboarding_first_interaction');
    const dismissUntilKey = `onboarding_dismissed_until_${user.uid}`;
    const dismissUntil = localStorage.getItem(dismissUntilKey);
    const isDismissed = dismissUntil && Date.now() < parseInt(dismissUntil);

    if (localStatus === 'true' || isDismissed) {
      setShowOnboarding(false);
      setInitialized(true);
      return;
    }

    // 2. If not in localStorage or false, listen to Firebase (Debugger pattern)
    const ref = doc(db, 'initialOnboarding', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      const hasInteracted = data?.onBoardingFirstInteraction === true;
      
      if (hasInteracted) {
        localStorage.setItem('onboarding_first_interaction', 'true');
      } else {
        // Only open if they haven't interacted yet AND it isn't currently dismissed locally
        const currentDismiss = localStorage.getItem(`onboarding_dismissed_until_${user.uid}`);
        const currentlyDismissed = currentDismiss && Date.now() < parseInt(currentDismiss);
        if (!currentlyDismissed) {
          setShowOnboarding(true);
        }
      }
      setInitialized(true);
    }, (error) => {
      console.error("Error listening to onboarding status:", error);
      setInitialized(true);
    });

    return () => unsub();
  }, [user, loading]);

  if (loading || !initialized) return null;

  // We only render InitialOnboarding if showOnboarding is true
  return (
    <InitialOnboarding 
      open={showOnboarding} 
      onClose={() => setShowOnboarding(false)} 
    />
  );
}

