'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  Timestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { StreakProps } from '@/app/lib/interface';
import { useAuth } from './userContext';
import moment from 'moment';

// ✅ Helper function to convert date to Date object
function convertToDate(date: Timestamp | string | Date): Date {
  if (date instanceof Timestamp) {
    return date.toDate();
  } else if (typeof date === 'string') {
    return new Date(date);
  } else {
    return date;
  }
}

interface StreaksContextType {
  streaks: StreakProps[];
  loading: boolean;
  markStreakDone: (streak: StreakProps, progress?: string) => Promise<void>;
  updateRemarks: (streak: StreakProps, progress: string) => Promise<void>;
}

const StreaksContext = createContext<StreaksContextType | null>(null);

export const useStreaks = () => {
  const ctx = useContext(StreaksContext);
  if (!ctx) throw new Error('useStreaks must be used inside StreaksProvider');
  return ctx;
};

export const StreaksProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [streaks, setStreaks] = useState<StreakProps[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return; // Wait for auth to resolve

    if (!user?.uid) {
      setStreaks([]);
      setLoading(false);
      return;
    }

    setLoading(true); // Ensure loading is true when starting to fetch
    const streaksRef = collection(db, 'streaks');
    const q = query(streaksRef, where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as StreakProps),
      }));
      setStreaks(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid, authLoading]);

  // ✅ Mark streak as done (with or without remarks)
  const markStreakDone = useCallback(
    async (streak: StreakProps, progress: string = '') => {
      const today = moment().startOf('day');
      const dayName = moment().format('dddd');

      const alreadyDone = streak.attendance?.some((a) => {
        // Handle both Timestamp and string dates
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

      await updateDoc(doc(db, 'streaks', streak.id!), {
        lastChecked: Timestamp.now(),
        updatedAt: Timestamp.now(),
        attendance: updatedAttendance,
        streaksCount: (streak.streaksCount || 0) + 1,
        currentProgress: progress,
      });
    },
    []
  );

  // ✅ Only update remarks (without marking done)
  const updateRemarks = useCallback(
    async (streak: StreakProps, progress: string) => {
      await updateDoc(doc(db, 'streaks', streak.id!), {
        currentProgress: progress,
        updatedAt: Timestamp.now(),
      });
    },
    []
  );

  return (
    <StreaksContext.Provider
      value={{ streaks, loading, markStreakDone, updateRemarks }}
    >
      {children}
    </StreaksContext.Provider>
  );
};

