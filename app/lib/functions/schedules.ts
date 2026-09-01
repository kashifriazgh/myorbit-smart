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
  getDoc,
} from 'firebase/firestore';
import { db, userDb } from '../firebase';
import { SchedulesProps } from '../interface';
import {
  createWhatsAppReminder,
  updateWhatsAppReminder,
  deleteWhatsAppReminder,
  deleteScheduleReminder,
  rescheduleScheduleReminder,
  getUserWhatsAppConfig,
} from '../utils/whatsapp-reminder';
import { registerNotificationDevice } from '../utils/fcm';

const COLLECTION_NAME = 'schedules';

type DateWithToDate = {
  toDate: () => Date;
};

const hasToDate = (value: unknown): value is DateWithToDate =>
  typeof value === 'object' &&
  value !== null &&
  'toDate' in value &&
  typeof (value as DateWithToDate).toDate === 'function';

const toReminderDate = (
  reminderDate: NonNullable<SchedulesProps['reminderDate']>
): Date => (hasToDate(reminderDate) ? reminderDate.toDate() : new Date(reminderDate));

// Create a new schedule
export const createSchedule = async (
  scheduleData: Omit<SchedulesProps, 'id'>
): Promise<string> => {
  try {
    console.log('Creating schedule in Firebase:', scheduleData);
    const cleanPayload: Record<string, unknown> = {};
    Object.entries(scheduleData).forEach(([key, val]) => {
      if (val !== undefined) {
        cleanPayload[key] = val;
      }
    });

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...cleanPayload,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log('Schedule created with ID:', docRef.id);

    // Schedule WhatsApp/push reminder if enabled
    if (scheduleData.hasReminder && scheduleData.reminderDate) {
      try {
        let phone = '923164709208';
        const userDoc = await getDoc(doc(db, 'users', scheduleData.userId));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          phone = uData.phone || uData.whatsapp || '923164709208';
        }

        const config = getUserWhatsAppConfig(scheduleData.userId, phone);
        config.itemType = 'schedule';
        // Pass the reminder method so the RTDB worker knows whether to send WhatsApp or push
        config.method = (scheduleData.reminder?.method as 'whatsapp' | 'push') || 'whatsapp';

        // For push reminders: ensure the device is registered under the real userId
        if (config.method === 'push') {
          if (typeof window !== 'undefined') {
            try {
              await registerNotificationDevice(scheduleData.userId);
            } catch (tokenErr) {
              console.warn('Could not register FCM device before push reminder:', tokenErr);
            }
          }
          
          // Fetch active device tokens from Firestore to store in the reminder payload
          try {
            const deviceCol = collection(userDb, 'users', scheduleData.userId, 'notificationDevices');
            const deviceSnapshot = await getDocs(deviceCol);
            const activeTokens: string[] = [];
            deviceSnapshot.forEach((dDoc) => {
              const dData = dDoc.data();
              if (dData.enabled && dData.fid) {
                activeTokens.push(dData.fid);
              }
            });
            config.tokens = activeTokens;
          } catch (tokenFetchErr) {
            console.error('Failed to fetch device tokens for schedule reminder:', tokenFetchErr);
          }
        }
        
        const rDate = toReminderDate(scheduleData.reminderDate);

        await createWhatsAppReminder(
          {
            id: docRef.id,
            title: scheduleData.title,
            reminderDate: rDate,
            priority: scheduleData.priority || 'medium',
            scheduleTime: scheduleData.startTime
          },
          config
        );
        console.log(`✅ Reminder (${config.method}) created for schedule ${docRef.id} at ${rDate}`);
      } catch (err) {
        console.error('Failed to create reminder for schedule:', err);
      }
    }

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
    
    // Fetch old data to calculate dynamic changes and keep reminder in sync
    try {
      const oldDoc = await getDoc(scheduleRef);
      if (oldDoc.exists()) {
        const oldData = oldDoc.data();

        // 1. If it was completed/cancelled OR toggled off, delete reminder
        const isCancelledOrCompleted = updates.status === 'completed' || updates.status === 'cancelled';
        const toggledOff = updates.hasReminder === false;

        if ((isCancelledOrCompleted || toggledOff) && oldData.reminderDate) {
          const rDate = toReminderDate(oldData.reminderDate);
          await deleteWhatsAppReminder(rDate, scheduleId, 'schedule');
        }
        // 2. If reminder is toggled on OR updated
        else if (updates.hasReminder === true || (updates.reminderDate && oldData.hasReminder)) {
          const newRDate = updates.reminderDate
            ? toReminderDate(updates.reminderDate)
            : null;
          
          const oldRDate = oldData.reminderDate
            ? toReminderDate(oldData.reminderDate)
            : null;

          if (newRDate) {
            let phone = '923164709208';
            const userDoc = await getDoc(doc(db, 'users', oldData.userId));
            if (userDoc.exists()) {
              const uData = userDoc.data();
              phone = uData.phone || uData.whatsapp || '923164709208';
            }
            
            const config = getUserWhatsAppConfig(oldData.userId, phone);
            config.itemType = 'schedule';
            // Use the updated method if provided, else fall back to stored method
            const resolvedMethod = (updates.reminder?.method || oldData.reminder?.method || 'whatsapp') as 'whatsapp' | 'push';
            config.method = resolvedMethod;

            // For push reminders: ensure the device is registered under the real userId
            if (resolvedMethod === 'push') {
              if (typeof window !== 'undefined') {
                try {
                  await registerNotificationDevice(oldData.userId);
                } catch (tokenErr) {
                  console.warn('Could not register FCM device on schedule update:', tokenErr);
                }
              }

              // Fetch active device tokens from Firestore to store in the reminder payload
              try {
                const deviceCol = collection(userDb, 'users', oldData.userId, 'notificationDevices');
                const deviceSnapshot = await getDocs(deviceCol);
                const activeTokens: string[] = [];
                deviceSnapshot.forEach((dDoc) => {
                  const dData = dDoc.data();
                  if (dData.enabled && dData.fid) {
                    activeTokens.push(dData.fid);
                  }
                });
                config.tokens = activeTokens;
              } catch (tokenFetchErr) {
                console.error('Failed to fetch device tokens for schedule update:', tokenFetchErr);
              }
            }

            await updateWhatsAppReminder(
              oldRDate || undefined,
              {
                id: scheduleId,
                title: updates.title || oldData.title,
                reminderDate: newRDate,
                priority: updates.priority || oldData.priority || 'medium',
                scheduleTime: updates.startTime || oldData.startTime
              },
              config
            );
          }
        }
        // 3. Rescheduled via date or startTime change (without explicit reminderDate update)
        else if ((updates.date || updates.startTime) && oldData.hasReminder && oldData.reminderDate && !updates.reminderDate) {
          const newDate = updates.date || oldData.date;
          const newStart = updates.startTime || oldData.startTime;
          let phone = '923164709208';
          const userDoc = await getDoc(doc(db, 'users', oldData.userId));
          if (userDoc.exists()) {
            const uData = userDoc.data();
            phone = uData.phone || uData.whatsapp || '923164709208';
          }
          // Pass method through so reschedule helper can carry it
          await rescheduleScheduleReminder(scheduleId, newDate, newStart, oldData.userId, phone);
        }
      }
    } catch (err) {
      console.error('Error syncing schedule reminder updates:', err);
    }

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
    await deleteScheduleReminder(scheduleId);
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
    if (status === 'completed' || status === 'cancelled') {
      await deleteScheduleReminder(scheduleId);
    }
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
