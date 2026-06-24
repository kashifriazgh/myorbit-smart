'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { useAuth } from '../context/userContext';
import { Liability } from '../interface';

export function useLiabilities() {
  const { user } = useAuth();
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLiabilities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'liabilities'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Liability[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Keep Timestamp type
            date: data.date,
            dueDate: data.dueDate,
            settledOn: data.settledOn,
            createdAt: data.createdAt,
          };
        }) as Liability[];
        // Sort by date descending
        list.sort((a, b) => {
          const tA = a.date instanceof Timestamp ? a.date.toMillis() : new Date(a.date).getTime();
          const tB = b.date instanceof Timestamp ? b.date.toMillis() : new Date(b.date).getTime();
          return tB - tA;
        });
        setLiabilities(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching liabilities:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const addLiability = useCallback(async (data: Omit<Liability, 'id' | 'createdAt' | 'userId'>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      const docRef = await addDoc(collection(db, 'liabilities'), {
        ...data,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (err) {
      console.error('Error adding liability:', err);
      throw err;
    }
  }, [user]);

  const updateLiability = useCallback(async (id: string, data: Partial<Omit<Liability, 'id' | 'createdAt' | 'userId'>>) => {
    if (!user) throw new Error('User not authenticated');
    try {
      const docRef = doc(db, 'liabilities', id);
      await updateDoc(docRef, data);
    } catch (err) {
      console.error('Error updating liability:', err);
      throw err;
    }
  }, [user]);

  const deleteLiability = useCallback(async (id: string) => {
    if (!user) throw new Error('User not authenticated');
    try {
      const docRef = doc(db, 'liabilities', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('Error deleting liability:', err);
      throw err;
    }
  }, [user]);

  const getActiveLiabilities = useCallback(async () => {
    if (!user) return [];
    try {
      const q = query(
        collection(db, 'liabilities'),
        where('userId', '==', user.uid),
        where('status', 'in', ['active', 'overdue'])
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Liability[];
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [user]);

  const getSettledLiabilities = useCallback(async () => {
    if (!user) return [];
    try {
      const q = query(
        collection(db, 'liabilities'),
        where('userId', '==', user.uid),
        where('status', '==', 'settled')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Liability[];
    } catch (err) {
      console.error(err);
      return [];
    }
  }, [user]);

  return {
    liabilities,
    loading,
    error,
    addLiability,
    updateLiability,
    deleteLiability,
    getActiveLiabilities,
    getSettledLiabilities,
  };
}
