'use client';

import { onAuthStateChanged, getAuth, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { app, db } from '../firebase'; // ✅ make sure you export db from firebase.ts

const auth = getAuth(app);

interface UserContextType {
  user: User | null;
  loading: boolean;
  role: 'master' | 'sub' | null;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  role: null,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'master' | 'sub' | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // ✅ Fetch role from Firestore
        try {
          const ref = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(ref);
          const data = snap.data();
          setRole(data?.role || null);
        } catch (err) {
          console.error('Error fetching user role:', err);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, role }}>
      {children}
    </UserContext.Provider>
  );
}

export const useAuth = () => useContext(UserContext);
export { UserContext };
