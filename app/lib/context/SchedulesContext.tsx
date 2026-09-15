'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SchedulesProps } from '../interface';
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '../functions/schedules';
import { useAuth } from './userContext';
import {
  loadSchedulesCache,
  saveSchedulesCache,
  invalidateSchedulesCache,
  clearSchedulesCache,
} from '@/app/lib/utils/schedulesCache';
import { useGoals } from './GoalsContext';

export type SchedulesDataSource = 'firebase' | 'cache' | 'loading';

interface SchedulesContextType {
  schedules: SchedulesProps[]; // Derived schedules for the selected date
  allSchedules: SchedulesProps[]; // All user schedules
  loading: boolean;
  dataSource: SchedulesDataSource;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  addSchedule: (schedule: Omit<SchedulesProps, 'id'>) => Promise<string>;
  editSchedule: (scheduleId: string, updates: Partial<SchedulesProps>) => Promise<void>;
  removeSchedule: (scheduleId: string, forceDelete?: boolean) => Promise<void>;
  getSchedulesForDateRange: (startDate: string, endDate: string) => SchedulesProps[];
  refreshSchedules: () => void;
}

const SchedulesContext = createContext<SchedulesContextType | undefined>(undefined);

export const SchedulesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { updateLinkedItemStatusInGoal, unlinkOrRemoveItemFromGoal } = useGoals();
  const [allSchedules, setAllSchedules] = useState<SchedulesProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<SchedulesDataSource>('loading');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Set initial date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // Real-time synchronization from Firestore + localStorage priority bootstrap
  useEffect(() => {
    if (!user) {
      setAllSchedules([]);
      setLoading(false);
      setDataSource('loading');
      clearSchedulesCache();
      return;
    }

    // 1. Priority 1: Load from localStorage cache immediately for instant UI
    const cached = loadSchedulesCache(user.uid);
    if (cached) {
      console.log(`%c[ScheduleCache] 📦 Loaded ${cached.length} schedules from cache`, 'color:#6366f1;font-weight:bold');
      setAllSchedules(cached);
      setDataSource('cache');
      setLoading(false);
    } else {
      setLoading(true);
      setDataSource('loading');
    }

    // 2. Real-time Firestore listener for live sync across mobile & desktop devices
    const q = query(
      collection(db, 'schedules'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: SchedulesProps[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetched.push({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          } as SchedulesProps);
        });

        setAllSchedules(fetched);
        setDataSource('firebase');
        setLoading(false);

        // Update localStorage cache with real-time data
        saveSchedulesCache(fetched, user.uid);
        console.log(`%c[ScheduleCache] ✅ Realtime synced ${fetched.length} schedules`, 'color:#22c55e;font-weight:bold');
      },
      (error) => {
        console.error('[ScheduleCache] ❌ Realtime sync failed:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Shared state helper to atomically update React state + localStorage cache
  const applyAndCache = useCallback((updater: (prev: SchedulesProps[]) => SchedulesProps[]) => {
    setAllSchedules((prev) => {
      const next = updater(prev);
      if (user) saveSchedulesCache(next, user.uid);
      return next;
    });
  }, [user]);

  // Listen for external sync events from Goal milestone toggles
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEv = e as CustomEvent<{ id: string; isDone: boolean }>;
      if (customEv.detail) {
        const { id, isDone } = customEv.detail;
        applyAndCache((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: isDone ? 'completed' : 'pending',
                }
              : s,
          ),
        );
      }
    };
    window.addEventListener('orbit_schedule_updated', handleSync);
    return () => window.removeEventListener('orbit_schedule_updated', handleSync);
  }, [applyAndCache]);

  // Force refresh cache helper
  const refreshSchedules = useCallback(() => {
    if (!user) return;
    invalidateSchedulesCache();
  }, [user]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived / Filtered state
  // ─────────────────────────────────────────────────────────────────────────

  // Derived schedules for the selectedDate
  const schedules = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const selDate = selectedDate || todayStr;

    return allSchedules
      .filter((s) => {
        const sDate = s.date ? (s.date.includes('T') ? s.date.split('T')[0] : s.date) : todayStr;

        if ((s.isFlexible || s.frequencyMode === 'daily') && selDate === todayStr) return true;
        if (sDate === selDate) return true;

        if (s.frequencyMode === 'weekly' && Array.isArray(s.selectedDaysOfWeek) && s.selectedDaysOfWeek.length > 0 && selDate) {
          const selDateObj = new Date(selDate + 'T00:00:00');
          if (!isNaN(selDateObj.getTime())) {
            const dayIdx = selDateObj.getDay(); // 0 (Sun) - 6 (Sat)
            if (s.selectedDaysOfWeek.includes(dayIdx)) return true;
          }
        }

        if (s.frequencyMode === 'monthly' && Array.isArray(s.selectedDaysOfMonth) && s.selectedDaysOfMonth.length > 0 && selDate) {
          const selDateObj = new Date(selDate + 'T00:00:00');
          if (!isNaN(selDateObj.getTime())) {
            const monthDay = selDateObj.getDate(); // 1-31
            if (s.selectedDaysOfMonth.includes(monthDay)) return true;
          }
        }

        return false;
      })
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [allSchedules, selectedDate]);

  // Client-side date range filtering (removes Firebase read requests)
  const getSchedulesForDateRange = useCallback((startDate: string, endDate: string) => {
    return allSchedules.filter((s) => {
      if (s.isFlexible) return false; // flexible schedules are handled separately
      return s.date >= startDate && s.date <= endDate;
    });
  }, [allSchedules]);

  // ─────────────────────────────────────────────────────────────────────────
  // Mutation handlers
  // ─────────────────────────────────────────────────────────────────────────

  const addSchedule = async (scheduleData: Omit<SchedulesProps, 'id'>) => {
    const tempId = `temp_${Date.now()}`;
    const optimisticSchedule: SchedulesProps = { ...scheduleData, id: tempId };

    // 1. Optimistic insert
    applyAndCache((prev) => [optimisticSchedule, ...prev]);

    try {
      const realId = await createSchedule(scheduleData);
      // 2. Replace tempId with realId
      applyAndCache((prev) => prev.map((s) => s.id === tempId ? { ...s, id: realId } : s));
      return realId;
    } catch (error) {
      console.error('[ScheduleCache] addSchedule failed:', error);
      invalidateSchedulesCache();
      throw error;
    }
  };

  const editSchedule = async (scheduleId: string, updates: Partial<SchedulesProps>) => {
    const existingSched = allSchedules.find((s) => s.id === scheduleId);

    // 1. Optimistic update
    applyAndCache((prev) =>
      prev.map((s) => s.id === scheduleId ? { ...s, ...updates } : s)
    );

    try {
      await updateSchedule(scheduleId, updates);

      if (updates.status && existingSched?.linkedGoalId) {
        const isDone = updates.status === 'completed';
        await updateLinkedItemStatusInGoal(existingSched.linkedGoalId, scheduleId, 'schedule', isDone);
      }
    } catch (error) {
      console.error('[ScheduleCache] editSchedule failed:', error);
      invalidateSchedulesCache();
      throw error;
    }
  };

  const removeSchedule = async (scheduleId: string, _forceDelete?: boolean) => {
    const existingSched = allSchedules.find((s) => s.id === scheduleId);
    if (existingSched?.linkedGoalId && unlinkOrRemoveItemFromGoal) {
      await unlinkOrRemoveItemFromGoal(existingSched.linkedGoalId, scheduleId, 'schedule').catch((e) => console.warn(e));
    }

    // 1. Optimistic remove
    applyAndCache((prev) => prev.filter((s) => s.id !== scheduleId));

    try {
      await deleteSchedule(scheduleId);
    } catch (error) {
      console.error('[ScheduleCache] removeSchedule failed:', error);
      invalidateSchedulesCache();
      throw error;
    }
  };

  const value: SchedulesContextType = {
    schedules,
    allSchedules,
    loading,
    dataSource,
    selectedDate,
    setSelectedDate,
    addSchedule,
    editSchedule,
    removeSchedule,
    getSchedulesForDateRange,
    refreshSchedules,
  };

  return (
    <SchedulesContext.Provider value={value}>
      {children}
    </SchedulesContext.Provider>
  );
};

export const useSchedules = (): SchedulesContextType => {
  const context = useContext(SchedulesContext);
  if (context === undefined) {
    throw new Error('useSchedules must be used within a SchedulesProvider');
  }
  return context;
};
