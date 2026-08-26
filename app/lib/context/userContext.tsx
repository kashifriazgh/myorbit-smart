'use client';

import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { userAuth as auth, userDb as db } from '../firebase';
import { FirestoreUser, OnboardingData } from '../interface';
import { getOrCreateGuestUser } from '../guestUser';
import Cookies from 'js-cookie';

interface UserContextType {
  user: FirestoreUser | null;
  loading: boolean;
  isGuest: boolean;
  onboardingData: OnboardingData | null;
  updateOnboardingData: (data: Partial<OnboardingData>) => Promise<void>;
  markGuideAsVisited: () => Promise<void>;
  contextParagraph: string;
  updateContextParagraph: (paragraph: string) => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  isGuest: false,
  onboardingData: null,
  updateOnboardingData: async () => {},
  markGuideAsVisited: async () => {},
  contextParagraph: '',
  updateContextParagraph: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [contextParagraph, setContextParagraph] = useState<string>('');

  // ── Auth & Session effect ──────────────────────────────────────────────────
  useEffect(() => {
    // 1. Try to load cached user and onboarding from localStorage on mount
    const cachedUserStr = localStorage.getItem('myorbit_cached_user');
    const cachedOnboardingStr = localStorage.getItem('myorbit_cached_onboarding');
    const cachedParagraph = localStorage.getItem('myorbit_cached_context_paragraph');

    let initialUser: FirestoreUser | null = null;
    if (cachedUserStr) {
      try {
        initialUser = JSON.parse(cachedUserStr);
        setUser(initialUser);
        setIsGuest(initialUser?.isGuest ?? false);
        setLoading(false);
        console.log('📦 Served user session from local cache:', initialUser?.email);
      } catch (e) {
        console.error('Error parsing cached user:', e);
      }
    }

    if (cachedOnboardingStr) {
      try {
        const initialOnboarding = JSON.parse(cachedOnboardingStr);
        setOnboardingData(initialOnboarding);
        console.log('📦 Served onboarding profile from local cache');
      } catch (e) {
        console.error('Error parsing cached onboarding:', e);
      }
    }

    if (cachedParagraph) {
      setContextParagraph(cachedParagraph);
    }

    // 2. Subscribe to Auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔍 Firebase auth state changed:', firebaseUser ? 'User logged in' : 'No user');

      if (firebaseUser) {
        // If we have a cached user and UIDs match, we can skip the Firestore document read request!
        if (initialUser && initialUser.uid === firebaseUser.uid) {
          console.log('✅ Local session matched active auth user. Skipped Firestore user read.');
          // Ensure cookies are present
          Cookies.set('uid', firebaseUser.uid, { expires: 7, path: '/' });
          Cookies.set('role', initialUser.role || 'viewer', { expires: 7, path: '/' });
          return;
        }

        // If no cached user or UID mismatch, fetch from Firestore
        try {
          console.log('🔥 Cache miss: Fetching user document from Firestore...');
          const ref = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(ref);

          if (snap.exists()) {
            const data = snap.data();
            if (data.role !== 'master' && (data.status === 'pending' || data.status === 'rejected')) {
              console.warn('⚠️ User account is pending or rejected. Signing out.');
              await signOut(auth);
              Cookies.remove('uid', { path: '/' });
              Cookies.remove('role', { path: '/' });
              localStorage.removeItem('myorbit_cached_user');
              localStorage.removeItem('myorbit_cached_onboarding');
              localStorage.removeItem('myorbit_cached_context_paragraph');
              setUser(getOrCreateGuestUser());
              setIsGuest(true);
              return;
            }

            const userObj: FirestoreUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: data.displayName || firebaseUser.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'User',
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              role: data.role || 'viewer',
              createdAt: data.createdAt,
              isGuest: false,
              guideVisited: data.guideVisited || false,
            };

            setUser(userObj);
            setIsGuest(false);
            localStorage.setItem('myorbit_cached_user', JSON.stringify(userObj));
            Cookies.set('uid', firebaseUser.uid, { expires: 7, path: '/' });
            Cookies.set('role', data.role || 'viewer', { expires: 7, path: '/' });
            console.log('✅ Firebase user session cached and initialized');

            // Fetch onboarding once if mismatch / missing
            if (!cachedOnboardingStr) {
              const obSnap = await getDoc(doc(db, 'initialOnboarding', firebaseUser.uid));
              if (obSnap.exists()) {
                const obData = obSnap.data() as OnboardingData;
                setOnboardingData(obData);
                localStorage.setItem('myorbit_cached_onboarding', JSON.stringify(obData));
              }
            }

            // Fetch context paragraph once if missing
            if (!cachedParagraph) {
              const contextSnap = await getDoc(doc(db, 'context', firebaseUser.uid));
              if (contextSnap.exists()) {
                const paragraphVal = contextSnap.data()?.paragraph || '';
                setContextParagraph(paragraphVal);
                localStorage.setItem('myorbit_cached_context_paragraph', paragraphVal);
              }
            }
          } else {
            console.warn('⚠️ No Firestore user document found.');
            Cookies.remove('uid', { path: '/' });
            Cookies.remove('role', { path: '/' });
            setUser(null);
            setIsGuest(false);
          }
        } catch (err) {
          console.error('❌ Error fetching Firestore user:', err);
          Cookies.remove('uid', { path: '/' });
          Cookies.remove('role', { path: '/' });
          setUser(null);
          setIsGuest(false);
        }
      } else {
        console.log('🔍 No Firebase user, initializing guest user');
        Cookies.remove('uid', { path: '/' });
        Cookies.remove('role', { path: '/' });
        localStorage.removeItem('myorbit_cached_user');
        localStorage.removeItem('myorbit_cached_onboarding');
        localStorage.removeItem('myorbit_cached_context_paragraph');
        setUser(getOrCreateGuestUser());
        setIsGuest(true);
        setOnboardingData(null);
        setContextParagraph('');
      }

      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // ── updateOnboardingData (Write-through Cache) ─────────────────────────────
  const updateOnboardingData = async (data: Partial<OnboardingData>) => {
    if (!user || isGuest) return;
    try {
      const obRef = doc(db, 'initialOnboarding', user.uid);
      const updatedOnboarding = { ...(onboardingData || {}), ...data };
      
      // Save to Firestore
      await setDoc(obRef, data, { merge: true });
      
      // Update local state and write to localStorage
      setOnboardingData(updatedOnboarding);
      localStorage.setItem('myorbit_cached_onboarding', JSON.stringify(updatedOnboarding));

      // Also update Name in 'users' collection if applicable
      if (data.firstName || data.lastName) {
        const nameUpdates: Record<string, string> = {};
        if (data.firstName !== undefined) nameUpdates.firstName = data.firstName;
        if (data.lastName !== undefined) nameUpdates.lastName = data.lastName;
        
        await setDoc(doc(db, 'users', user.uid), nameUpdates, { merge: true });
        
        setUser((prev) => {
          if (!prev) return null;
          const updatedUserObj = {
            ...prev,
            firstName: data.firstName !== undefined ? data.firstName : prev.firstName,
            lastName: data.lastName !== undefined ? data.lastName : prev.lastName,
          };
          localStorage.setItem('myorbit_cached_user', JSON.stringify(updatedUserObj));
          return updatedUserObj;
        });
      }
      console.log('✅ Onboarding details synced to Firestore & Local Cache');
    } catch (err) {
      console.error('❌ Error updating onboarding/profile data:', err);
      throw err;
    }
  };

  // ── updateContextParagraph (Write-through Cache) ───────────────────────────
  const updateContextParagraph = async (paragraph: string) => {
    setContextParagraph(paragraph);
    localStorage.setItem('myorbit_cached_context_paragraph', paragraph);

    if (user && !isGuest) {
      try {
        const ref = doc(db, 'context', user.uid);
        await setDoc(ref, {
          userId: user.uid,
          paragraph,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('✅ AI paragraph context synced to Firestore');
      } catch (err) {
        console.error('❌ Error writing context paragraph to Firestore:', err);
      }
    }
  };

  const markGuideAsVisited = useCallback(async () => {
    try {
      localStorage.setItem('myorbit_guide_visited', 'true');
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }

    if (user && !isGuest) {
      try {
        await setDoc(doc(db, 'users', user.uid), { guideVisited: true }, { merge: true });
        setUser((prev) => {
          if (!prev) return null;
          const updatedUserObj = { ...prev, guideVisited: true };
          localStorage.setItem('myorbit_cached_user', JSON.stringify(updatedUserObj));
          return updatedUserObj;
        });
      } catch (err) {
        console.error('Error updating guideVisited in Firestore:', err);
      }
    } else {
      setUser((prev) => {
        if (!prev) return null;
        return { ...prev, guideVisited: true };
      });
    }
  }, [user, isGuest]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        isGuest,
        onboardingData,
        updateOnboardingData,
        contextParagraph,
        updateContextParagraph,
        markGuideAsVisited,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useAuth = () => useContext(UserContext);
