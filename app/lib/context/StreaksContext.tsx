'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { StreakProps } from '@/app/lib/interface';
import moment from 'moment';

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

  useEffect(() => {
    const streaksRef = collection(db, 'streaks');
    const unsub = onSnapshot(streaksRef, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as StreakProps),
      }));
      setStreaks(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ✅ Mark streak as done (with or without remarks)
  const markStreakDone = async (streak: StreakProps, progress: string = '') => {
    const today = moment().format('YYYY-MM-DD');
    const dayName = moment().format('dddd');

    const alreadyDone = streak.attendance?.some((a) => a.date === today);
    if (alreadyDone) return;

    const updatedAttendance = [
      ...(streak.attendance || []),
      { date: today, day: dayName, progress },
    ];

    await updateDoc(doc(db, 'streaks', streak.id!), {
      lastChecked: Timestamp.now(),
      updatedAt: Timestamp.now(),
      attendance: updatedAttendance,
      streaksCount: (streak.streaksCount || 0) + 1,
      currentProgress: progress,
    });
  };

  // ✅ Only update remarks (without marking done)
  const updateRemarks = async (streak: StreakProps, progress: string) => {
    await updateDoc(doc(db, 'streaks', streak.id!), {
      currentProgress: progress,
      updatedAt: Timestamp.now(),
    });
  };

  return (
    <StreaksContext.Provider
      value={{ streaks, loading, markStreakDone, updateRemarks }}
    >
      {children}
    </StreaksContext.Provider>
  );
};
