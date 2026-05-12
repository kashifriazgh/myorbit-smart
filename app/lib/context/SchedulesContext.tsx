'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { SchedulesProps } from '../interface';
import {
  getSchedulesByUserAndDate,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedulesByUserAndDateRange,
  getAllSchedulesByUser,
} from '../functions/schedules';
import { useAuth } from './userContext';

interface SchedulesContextType {
  schedules: SchedulesProps[];
  allSchedules: SchedulesProps[];
  loading: boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  fetchSchedules: (date: string) => Promise<void>;
  addSchedule: (schedule: Omit<SchedulesProps, 'id'>) => Promise<string>;
  editSchedule: (
    scheduleId: string,
    updates: Partial<SchedulesProps>
  ) => Promise<void>;
  removeSchedule: (scheduleId: string) => Promise<void>;
  getSchedulesForDateRange: (
    startDate: string,
    endDate: string
  ) => Promise<SchedulesProps[]>;
}

const SchedulesContext = createContext<SchedulesContextType | undefined>(
  undefined
);

export const SchedulesProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const [schedules, setSchedules] = useState<SchedulesProps[]>([]);
  const [allSchedules, setAllSchedules] = useState<SchedulesProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Set initial date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  const fetchSchedules = useCallback(
    async (date: string) => {
      if (!userId || !date) return;

      setLoading(true);
      try {
        const fetchedSchedules = await getSchedulesByUserAndDate(userId, date);
        setSchedules(fetchedSchedules);
      } catch (error) {
        console.error('Error fetching schedules:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const fetchAllSchedules = useCallback(async () => {
    if (!userId) return;
    try {
      const fetched = await getAllSchedulesByUser(userId, 500);
      setAllSchedules(fetched);
    } catch (error) {
      console.error('Error fetching all schedules:', error);
    }
  }, [userId]);

  const addSchedule = async (scheduleData: Omit<SchedulesProps, 'id'>) => {
    try {
      const scheduleId = await createSchedule(scheduleData);
      const newSchedule: SchedulesProps = {
        ...scheduleData,
        id: scheduleId,
      };

      // Add to local state if it's for the currently selected date
      if (scheduleData.date === selectedDate) {
        setSchedules((prev) =>
          [...prev, newSchedule].sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
          )
        );
      }
      // Also add to allSchedules
      setAllSchedules((prev) => [newSchedule, ...prev]);
      return scheduleId;
    } catch (error) {
      console.error('Error adding schedule:', error);
      throw error;
    }
  };

  const editSchedule = async (
    scheduleId: string,
    updates: Partial<SchedulesProps>
  ) => {
    try {
      await updateSchedule(scheduleId, updates);

      // Update local state
      setSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === scheduleId ? { ...schedule, ...updates } : schedule
        )
      );
      setAllSchedules((prev) =>
        prev.map((schedule) =>
          schedule.id === scheduleId ? { ...schedule, ...updates } : schedule
        )
      );
    } catch (error) {
      console.error('Error editing schedule:', error);
      throw error;
    }
  };

  const removeSchedule = async (scheduleId: string) => {
    try {
      await deleteSchedule(scheduleId);

      // Remove from local state
      setSchedules((prev) =>
        prev.filter((schedule) => schedule.id !== scheduleId)
      );
      setAllSchedules((prev) =>
        prev.filter((schedule) => schedule.id !== scheduleId)
      );
    } catch (error) {
      console.error('Error removing schedule:', error);
      throw error;
    }
  };

  const getSchedulesForDateRange = async (
    startDate: string,
    endDate: string
  ) => {
    try {
      return await getSchedulesByUserAndDateRange(userId, startDate, endDate);
    } catch (error) {
      console.error('Error fetching schedules for date range:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (selectedDate && userId) {
      fetchSchedules(selectedDate);
    }
  }, [selectedDate, userId, fetchSchedules]);

  useEffect(() => {
    if (userId) {
      fetchAllSchedules();
    }
  }, [userId, fetchAllSchedules]);

  const value: SchedulesContextType = {
    schedules,
    allSchedules,
    loading,
    selectedDate,
    setSelectedDate,
    fetchSchedules,
    addSchedule,
    editSchedule,
    removeSchedule,
    getSchedulesForDateRange,
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
