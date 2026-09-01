'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { SchedulesProps } from '../interface';
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getAllSchedulesByUser,
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
  removeSchedule: (scheduleId: string) => Promise<void>;
  getSchedulesForDateRange: (startDate: string, endDate: string) => SchedulesProps[];
  refreshSchedules: () => void;
}

const SchedulesContext = createContext<SchedulesContextType | undefined>(undefined);

export const SchedulesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { updateLinkedItemStatusInGoal } = useGoals();
  const [allSchedules, setAllSchedules] = useState<SchedulesProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<SchedulesDataSource>('loading');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const fetchingRef = useRef(false);

  // Set initial date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  // Fetch all schedules from Firebase and store in state + cache
  const fetchAllFromFirebase = useCallback(async (uid: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      console.log('%c[ScheduleCache] 🔥 Fetching schedules from Firebase…', 'color:#f59e0b;font-weight:bold');
      const fetched = await getAllSchedulesByUser(uid, 1000);
      setAllSchedules(fetched);
      setDataSource('firebase');
      setLoading(false);

      // Save to localStorage cache
      saveSchedulesCache(fetched, uid);
      console.log(`%c[ScheduleCache] ✅ Cached ${fetched.length} schedules locally`, 'color:#22c55e;font-weight:bold');
    } catch (error) {
      console.error('[ScheduleCache] ❌ Failed to fetch schedules:', error);
      setLoading(false);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Bootstrap from cache on mount / user change
  useEffect(() => {
    if (!user) {
      setAllSchedules([]);
      setLoading(false);
      setDataSource('loading');
      clearSchedulesCache();
      return;
    }

    // Try cache first
    const cached = loadSchedulesCache(user.uid);
    if (cached) {
      console.log(`%c[ScheduleCache] 📦 Loaded ${cached.length} schedules from cache`, 'color:#6366f1;font-weight:bold');
      setAllSchedules(cached);
      setDataSource('cache');
      setLoading(false);
      return;
    }

    // Cache miss or stale -> fetch from Firebase
    setLoading(true);
    setDataSource('loading');
    fetchAllFromFirebase(user.uid);
  }, [user, fetchAllFromFirebase]);

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

  // Force re-fetch from Firebase
  const refreshSchedules = useCallback(() => {
    if (!user) return;
    invalidateSchedulesCache();
    setLoading(true);
    setDataSource('loading');
    fetchAllFromFirebase(user.uid);
  }, [user, fetchAllFromFirebase]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived / Filtered state
  // ─────────────────────────────────────────────────────────────────────────

  // Derived schedules for the selectedDate
  const schedules = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return allSchedules
      .filter((s) => {
        if ((s.isFlexible || s.frequencyMode === 'daily') && selectedDate === todayStr) return true;
        if (s.date === selectedDate) return true;

        if (s.frequencyMode === 'weekly' && Array.isArray(s.selectedDaysOfWeek) && s.selectedDaysOfWeek.length > 0 && selectedDate) {
          const selDateObj = new Date(selectedDate + 'T00:00:00');
          if (!isNaN(selDateObj.getTime())) {
            const dayIdx = selDateObj.getDay(); // 0 (Sun) - 6 (Sat)
            if (s.selectedDaysOfWeek.includes(dayIdx)) return true;
          }
        }

        if (s.frequencyMode === 'monthly' && Array.isArray(s.selectedDaysOfMonth) && s.selectedDaysOfMonth.length > 0 && selectedDate) {
          const selDateObj = new Date(selectedDate + 'T00:00:00');
          if (!isNaN(selDateObj.getTime())) {
            const monthDay = selDateObj.getDate(); // 1-31
            if (s.selectedDaysOfMonth.includes(monthDay)) return true;
          }
        }

        return false;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
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

  const removeSchedule = async (scheduleId: string) => {
    const existingSched = allSchedules.find((s) => s.id === scheduleId);
    if (existingSched?.linkedGoalId) {
      const gTitle = existingSched.goalTitle ? ` "${existingSched.goalTitle}"` : '';
      alert(`⚠️ This schedule is associated with Goal${gTitle}. Please delete or remove this milestone from the Goal detail page first.`);
      return;
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
