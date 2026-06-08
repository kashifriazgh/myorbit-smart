'use client';

import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { app, db } from '../firebase';
import { FirestoreUser, OnboardingData } from '../interface';
import { getOrCreateGuestUser } from '../guestUser';
import Cookies from 'js-cookie';
const auth = getAuth(app);

interface UserContextType {
  user: FirestoreUser | null;
  loading: boolean;
  isGuest: boolean;
  onboardingData: OnboardingData | null;
  updateOnboardingData: (data: Partial<OnboardingData>) => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  isGuest: false,
  onboardingData: null,
  updateOnboardingData: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);

  useEffect(() => {
    let unsubscribeOnboarding: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(
        '🔍 Firebase auth state changed:',
        firebaseUser ? 'User logged in' : 'No user'
      );

      // Clean up previous snapshot listener
      if (unsubscribeOnboarding) {
        unsubscribeOnboarding();
        unsubscribeOnboarding = null;
      }

      if (firebaseUser) {
        // User is authenticated with Firebase
        try {
          const ref = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(ref);

          if (snap.exists()) {
            const data = snap.data();
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              role: data.role || 'viewer',
              createdAt: data.createdAt,
              isGuest: false,
            };

            setUser(userData);
            setIsGuest(false);

            // Set cookies for session persistence with path '/'
            Cookies.set('uid', firebaseUser.uid, { expires: 7, path: '/' });
            Cookies.set('role', data.role || 'viewer', { expires: 7, path: '/' });

            console.log('✅ Firebase user authenticated and cookies set');
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

        // Subscribe to initialOnboarding document updates
        unsubscribeOnboarding = onSnapshot(
          doc(db, 'initialOnboarding', firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              setOnboardingData(snap.data() as OnboardingData);
            } else {
              setOnboardingData(null);
            }
          },
          (err) => {
            console.error('❌ Error listening to initialOnboarding:', err);
          }
        );
      } else {
        // No Firebase user - check for guest user or create one
        console.log('🔍 No Firebase user, checking for guest user');
        Cookies.remove('uid', { path: '/' });
        Cookies.remove('role', { path: '/' });
        const guestUser = getOrCreateGuestUser();
        setUser(guestUser);
        setIsGuest(true);
        setOnboardingData(null);
      }

      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeOnboarding) {
        unsubscribeOnboarding();
      }
    };
  }, []);

  const updateOnboardingData = async (data: Partial<OnboardingData>) => {
    if (!user || isGuest) return;
    try {
      const ref = doc(db, 'initialOnboarding', user.uid);
      await setDoc(ref, data, { merge: true });

      // If firstName or lastName changed, also update the main user document
      if (data.firstName || data.lastName) {
        const userRef = doc(db, 'users', user.uid);
        const nameUpdates: Record<string, string> = {};
        if (data.firstName !== undefined) nameUpdates.firstName = data.firstName;
        if (data.lastName !== undefined) nameUpdates.lastName = data.lastName;
        await setDoc(userRef, nameUpdates, { merge: true });

        // Update local state user object as well
        setUser((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            firstName: data.firstName !== undefined ? data.firstName : prev.firstName,
            lastName: data.lastName !== undefined ? data.lastName : prev.lastName,
          };
        });
      }
    } catch (err) {
      console.error('❌ Error updating onboarding/profile data:', err);
      throw err;
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        isGuest,
        onboardingData,
        updateOnboardingData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useAuth = () => useContext(UserContext);
