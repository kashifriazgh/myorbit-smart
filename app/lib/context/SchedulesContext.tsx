'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { SchedulesProps } from '../interface';
import {
  getSchedulesByUserAndDate,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedulesByUserAndDateRange,
} from '../functions/schedules';

interface SchedulesContextType {
  schedules: SchedulesProps[];
  loading: boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  fetchSchedules: (date: string) => Promise<void>;
  addSchedule: (schedule: Omit<SchedulesProps, 'id'>) => Promise<void>;
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

interface SchedulesProviderProps {
  children: ReactNode;
  userId: string;
}

export const SchedulesProvider: React.FC<SchedulesProviderProps> = ({
  children,
  userId,
}) => {
  const [schedules, setSchedules] = useState<SchedulesProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Set initial date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  const fetchSchedules = async (date: string) => {
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
  };

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

  // Fetch schedules when selected date changes
  useEffect(() => {
    if (selectedDate && userId) {
      fetchSchedules(selectedDate);
    }
  }, [selectedDate, userId]);

  const value: SchedulesContextType = {
    schedules,
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
