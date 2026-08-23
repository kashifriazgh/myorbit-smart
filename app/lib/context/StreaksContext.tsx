'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  collection,
  updateDoc,
  doc,
  Timestamp,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { StreakProps } from '@/app/lib/interface';
import { useAuth } from './userContext';
import moment from 'moment';
import {
  loadStreaksCache,
  saveStreaksCache,
  invalidateStreaksCache,
  clearStreaksCache,
} from '@/app/lib/utils/streaksCache';

export type StreaksDataSource = 'firebase' | 'cache' | 'loading';

interface StreaksContextType {
  streaks: StreakProps[];
  loading: boolean;
  dataSource: StreaksDataSource;
  addStreak: (streakData: Omit<StreakProps, 'id'>) => Promise<string>;
  editStreak: (streakId: string, updates: Partial<StreakProps>) => Promise<void>;
  deleteStreakItem: (streakId: string) => Promise<void>;
  markStreakDone: (streak: StreakProps, progress?: string) => Promise<void>;
  updateRemarks: (streak: StreakProps, progress: string) => Promise<void>;
  refreshStreaks: () => void;
}

const StreaksContext = createContext<StreaksContextType | null>(null);

export const useStreaks = () => {
  const ctx = useContext(StreaksContext);
  if (!ctx) throw new Error('useStreaks must be used inside StreaksProvider');
  return ctx;
};

// Helper function to convert date to Date object
function convertToDate(date: Timestamp | string | Date): Date {
  if (date instanceof Timestamp) {
    return date.toDate();
  } else if (typeof date === 'string') {
    return new Date(date);
  } else {
    return date;
  }
}

export const StreaksProvider = ({ children }: { children: React.ReactNode }) => {
  const [streaks, setStreaks] = useState<StreakProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<StreaksDataSource>('loading');
  const { user, loading: authLoading } = useAuth();

  const fetchingRef = useRef(false);

  const fetchFromFirebase = useCallback(async (uid: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      console.log('%c[StreaksCache] 🔥 Fetching streaks from Firebase…', 'color:#f59e0b;font-weight:bold');
      const q = query(collection(db, 'streaks'), where('userId', '==', uid));
      const snap = await getDocs(q);
      const fetched: StreakProps[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as StreakProps),
      }));

      setStreaks(fetched);
      setDataSource('firebase');
      setLoading(false);

      // Save to localStorage cache
      saveStreaksCache(fetched, uid);
      console.log(`%c[StreaksCache] ✅ Cached ${fetched.length} streaks locally`, 'color:#22c55e;font-weight:bold');
    } catch (error) {
      console.error('[StreaksCache] ❌ Failed to fetch streaks:', error);
      setLoading(false);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Bootstrap from cache
  useEffect(() => {
    if (authLoading) return;

    if (!user?.uid) {
      setStreaks([]);
      setLoading(false);
      setDataSource('loading');
      clearStreaksCache();
      return;
    }

    // Try cache first
    const cached = loadStreaksCache(user.uid);
    if (cached) {
      console.log(`%c[StreaksCache] 📦 Loaded ${cached.length} streaks from cache`, 'color:#6366f1;font-weight:bold');
      setStreaks(cached);
      setDataSource('cache');
      setLoading(false);
      return;
    }

    // Cache miss or stale -> fetch from Firebase
    setLoading(true);
    setDataSource('loading');
    fetchFromFirebase(user.uid);
  }, [user, authLoading, fetchFromFirebase]);

  const refreshStreaks = useCallback(() => {
    if (!user) return;
    invalidateStreaksCache();
    setLoading(true);
    setDataSource('loading');
    fetchFromFirebase(user.uid);
  }, [user, fetchFromFirebase]);

  // Atomic state + cache helper
  const applyAndCache = useCallback((updater: (prev: StreakProps[]) => StreakProps[]) => {
    setStreaks((prev) => {
      const next = updater(prev);
      if (user) saveStreaksCache(next, user.uid);
      return next;
    });
  }, [user]);

  // ─────────────────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────────────────

  const addStreak = async (streakData: Omit<StreakProps, 'id'>) => {
    const tempId = `temp_${Date.now()}`;
    const optimisticStreak: StreakProps = { ...streakData, id: tempId };

    // 1. Optimistic insert
    applyAndCache((prev) => [optimisticStreak, ...prev]);

    try {
      const docRef = await addDoc(collection(db, 'streaks'), streakData);
      // 2. Replace tempId with realId
      applyAndCache((prev) => prev.map((s) => s.id === tempId ? { ...s, id: docRef.id } : s));
      return docRef.id;
    } catch (error) {
      console.error('[StreaksCache] addStreak failed:', error);
      invalidateStreaksCache();
      throw error;
    }
  };

  const editStreak = async (streakId: string, updates: Partial<StreakProps>) => {
    // 1. Optimistic update
    applyAndCache((prev) =>
      prev.map((s) => s.id === streakId ? { ...s, ...updates } : s)
    );

    try {
      await updateDoc(doc(db, 'streaks', streakId), {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('[StreaksCache] editStreak failed:', error);
      invalidateStreaksCache();
      throw error;
    }
  };

  const deleteStreakItem = async (streakId: string) => {
    // 1. Optimistic remove
    applyAndCache((prev) => prev.filter((s) => s.id !== streakId));

    try {
      await deleteDoc(doc(db, 'streaks', streakId));
    } catch (error) {
      console.error('[StreaksCache] deleteStreakItem failed:', error);
      invalidateStreaksCache();
      throw error;
    }
  };

  const markStreakDone = useCallback(
    async (streak: StreakProps, progress: string = '') => {
      const today = moment().startOf('day');
      const dayName = moment().format('dddd');

      const alreadyDone = streak.attendance?.some((a) => {
        const date = convertToDate(a.date);
        return moment(date).isSame(today, 'day');
      });
      if (alreadyDone) return;

      const updatedAttendance = [
        ...(streak.attendance || []),
        {
          date: Timestamp.now(),
          day: dayName,
          progress: progress || undefined,
        },
      ];

      // Optimistic state + cache write
      applyAndCache((prev) =>
        prev.map((s) =>
          s.id === streak.id
            ? {
                ...s,
                lastChecked: Timestamp.now(),
                attendance: updatedAttendance,
                streaksCount: (s.streaksCount || 0) + 1,
                currentProgress: progress,
              }
            : s
        )
      );

      try {
        await updateDoc(doc(db, 'streaks', streak.id!), {
          lastChecked: Timestamp.now(),
          updatedAt: Timestamp.now(),
          attendance: updatedAttendance,
          streaksCount: (streak.streaksCount || 0) + 1,
          currentProgress: progress,
        });
      } catch (error) {
        console.error('[StreaksCache] markStreakDone failed:', error);
        invalidateStreaksCache();
      }
    },
    [applyAndCache]
  );

  const updateRemarks = useCallback(
    async (streak: StreakProps, progress: string) => {
      // Optimistic update
      applyAndCache((prev) =>
        prev.map((s) => s.id === streak.id ? { ...s, currentProgress: progress } : s)
      );

      try {
        await updateDoc(doc(db, 'streaks', streak.id!), {
          currentProgress: progress,
          updatedAt: Timestamp.now(),
        });
      } catch (error) {
        console.error('[StreaksCache] updateRemarks failed:', error);
        invalidateStreaksCache();
      }
    },
    [applyAndCache]
  );

  return (
    <StreaksContext.Provider
      value={{
        streaks,
        loading,
        dataSource,
        addStreak,
        editStreak,
        deleteStreakItem,
        markStreakDone,
        updateRemarks,
        refreshStreaks,
      }}
    >
      {children}
    </StreaksContext.Provider>
  );
};
