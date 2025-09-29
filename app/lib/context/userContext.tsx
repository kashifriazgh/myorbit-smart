'use client';

import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { app, db } from '../firebase';
import { FirestoreUser } from '../interface';
import { getOrCreateGuestUser } from '../guestUser';
import Cookies from 'js-cookie';
const auth = getAuth(app);

interface UserContextType {
  user: FirestoreUser | null;
  loading: boolean;
  isGuest: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  isGuest: false,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log(
        '🔍 Firebase auth state changed:',
        firebaseUser ? 'User logged in' : 'No user'
      );

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

            // Set cookies for session persistence
            Cookies.set('uid', firebaseUser.uid, { expires: 7 });
            Cookies.set('role', data.role || 'viewer', { expires: 7 });

            console.log('✅ Firebase user authenticated and cookies set');
          } else {
            console.warn('⚠️ No Firestore user document found.');
            setUser(null);
            setIsGuest(false);
          }
        } catch (err) {
          console.error('❌ Error fetching Firestore user:', err);
          setUser(null);
          setIsGuest(false);
        }
      } else {
        // No Firebase user - check for guest user or create one
        console.log('🔍 No Firebase user, checking for guest user');
        const guestUser = getOrCreateGuestUser();
        setUser(guestUser);
        setIsGuest(true);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, isGuest }}>
      {children}
    </UserContext.Provider>
  );
}

export const useAuth = () => useContext(UserContext);
