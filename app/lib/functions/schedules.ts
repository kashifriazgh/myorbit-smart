import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { SchedulesProps } from '../interface';

const COLLECTION_NAME = 'schedules';

// Create a new schedule
export const createSchedule = async (
  scheduleData: Omit<SchedulesProps, 'id'>
): Promise<string> => {
  try {
    console.log('Creating schedule in Firebase:', scheduleData);
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...scheduleData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log('Schedule created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating schedule:', error);
    throw error;
  }
};

// Update an existing schedule
export const updateSchedule = async (
  scheduleId: string,
  updates: Partial<SchedulesProps>
): Promise<void> => {
  try {
    const scheduleRef = doc(db, COLLECTION_NAME, scheduleId);
    await updateDoc(scheduleRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    throw error;
  }
};

// Delete a schedule
export const deleteSchedule = async (scheduleId: string): Promise<void> => {
  try {
    const scheduleRef = doc(db, COLLECTION_NAME, scheduleId);
    await deleteDoc(scheduleRef);
  } catch (error) {
    console.error('Error deleting schedule:', error);
    throw error;
  }
};

// Get schedules for a specific user and date range
export const getSchedulesByUserAndDate = async (
  userId: string,
  date: string
): Promise<SchedulesProps[]> => {
  try {
    console.log('Fetching schedules for user:', userId, 'date:', date);

    // Only filter by userId to avoid composite index issues
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const schedules: SchedulesProps[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      schedules.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as SchedulesProps);
    });

    // Filter for the specific date and sort by start time on client side
    const filteredSchedules = schedules
      .filter((schedule) => schedule.date === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    console.log('Fetched and filtered schedules:', filteredSchedules);
    return filteredSchedules;
  } catch (error) {
    console.error('Error fetching schedules:', error);
    throw error;
  }
};

// Get schedules for a specific user within a date range
export const getSchedulesByUserAndDateRange = async (
  userId: string,
  startDate: string,
  endDate: string
): Promise<SchedulesProps[]> => {
  try {
    // Only filter by userId to avoid composite index issues
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const schedules: SchedulesProps[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      schedules.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as SchedulesProps);
    });

    // Filter by date range and sort on client side
    const filteredSchedules = schedules
      .filter(
        (schedule) => schedule.date >= startDate && schedule.date <= endDate
      )
      .sort((a, b) => {
        // First sort by date, then by start time
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return a.startTime.localeCompare(b.startTime);
      });

    return filteredSchedules;
  } catch (error) {
    console.error('Error fetching schedules by date range:', error);
    throw error;
  }
};

// Get all schedules for a user (limited to avoid too many results)
export const getAllSchedulesByUser = async (
  userId: string,
  limit: number = 100
): Promise<SchedulesProps[]> => {
  try {
    // Only filter by userId to avoid composite index issues
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const schedules: SchedulesProps[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      schedules.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as SchedulesProps);
    });

    // Sort and limit on client side
    const sortedSchedules = schedules
      .sort((a, b) => {
        // First sort by date (desc), then by start time (asc)
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date); // Descending order
        }
        return a.startTime.localeCompare(b.startTime); // Ascending order
      })
      .slice(0, limit);

    return sortedSchedules;
  } catch (error) {
    console.error('Error fetching all schedules:', error);
    throw error;
  }
};

// Get schedules by status for a user
export const getSchedulesByStatus = async (
  userId: string,
  status: 'pending' | 'completed' | 'cancelled',
  date?: string
): Promise<SchedulesProps[]> => {
  try {
    // Only filter by userId to avoid composite index issues
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    const schedules: SchedulesProps[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      schedules.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as SchedulesProps);
    });

    // Filter by status and date on client side
    let filteredSchedules = schedules.filter(
      (schedule) => schedule.status === status
    );

    if (date) {
      filteredSchedules = filteredSchedules.filter(
        (schedule) => schedule.date === date
      );
    }

    // Sort on client side
    const sortedSchedules = filteredSchedules.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.startTime.localeCompare(b.startTime);
    });

    return sortedSchedules;
  } catch (error) {
    console.error('Error fetching schedules by status:', error);
    throw error;
  }
};

// Update schedule status (useful for marking as completed)
export const updateScheduleStatus = async (
  scheduleId: string,
  status: 'pending' | 'completed' | 'cancelled'
): Promise<void> => {
  try {
    const scheduleRef = doc(db, COLLECTION_NAME, scheduleId);
    await updateDoc(scheduleRef, {
      status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating schedule status:', error);
    throw error;
  }
};

// Get today's pending schedules for a user
export const getTodaysPendingSchedules = async (
  userId: string
): Promise<SchedulesProps[]> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    return await getSchedulesByStatus(userId, 'pending', today);
  } catch (error) {
    console.error("Error fetching today's pending schedules:", error);
    throw error;
  }
};

// Helper function to generate time slots for a day (5AM to 10PM)
export const generateTimeSlots = (): string[] => {
  const slots: string[] = [];
  for (let hour = 5; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute
        .toString()
        .padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  return slots;
};

// Helper function to check if two time ranges overlap
export const isTimeOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean => {
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = timeToMinutes(end1);
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = timeToMinutes(end2);

  return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
};
