'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { isValidBudgetStartDay, normalizeBudgetStartDay } from './budgetCycle';

const STORAGE_KEY_PREFIX = 'myorbit_budget_start_day_';

export function useBudgetStartDay(userId?: string | null) {
  const [startDay, setStartDay] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  // Instant localStorage hydration + live Firestore sync
  useEffect(() => {
    if (!userId) {
      setStartDay(1);
      return;
    }

    try {
      const cached = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
      if (cached) {
        const parsed = normalizeBudgetStartDay(Number(cached));
        setStartDay(parsed);
      }
    } catch {
      // ignore storage errors
    }

    const ref = doc(db, 'budgetSettings', userId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const normalized = normalizeBudgetStartDay(data?.budgetStartDay);
          setStartDay(normalized);
          try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, String(normalized));
          } catch {
            // ignore
          }
        }
      },
      (err) => {
        console.warn('Error syncing budgetSettings:', err);
      }
    );

    return () => unsub();
  }, [userId]);

  const updateStartDay = useCallback(
    async (day: number): Promise<boolean> => {
      if (!userId || !isValidBudgetStartDay(day)) return false;
      setSaving(true);
      try {
        const ref = doc(db, 'budgetSettings', userId);
        await setDoc(
          ref,
          {
            userId,
            budgetStartDay: day,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setStartDay(day);
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, String(day));
        } catch {
          // ignore
        }
        return true;
      } catch (err) {
        console.error('Error saving budgetStartDay:', err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  return { startDay, saving, updateStartDay };
}
