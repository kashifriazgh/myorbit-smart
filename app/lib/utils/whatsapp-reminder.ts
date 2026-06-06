import { ref as rtdbRef, push, set, remove, get } from 'firebase/database';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getSharedDatabase } from './fcm';

// Base interface for anything that can have a reminder, matching the EnhancedReminder requirements
interface RemindableItem {
  title: string;
  reminderDate?: Date;
  id?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  dueDate?: string; // ISO string or datetime-local string
  scheduleTime?: string; // For schedules
  linkedGoalId?: string; // For todos linked to goals
}

interface ReminderConfig {
  userId: string;
  phone: string; // User's WhatsApp number
  clientId: string; // Client instance / session identification (from env manually)
  itemType: 'todo' | 'schedule' | 'goal' | 'habit'; // What kind of item
  customMessage?: string; // Optional custom message template override
  method?: 'whatsapp' | 'push'; // Reminder method choice
}

/**
 * Create a WhatsApp or push notification reminder in RTDB using the EnhancedReminder schema
 */
export async function createWhatsAppReminder(
  item: RemindableItem,
  config: ReminderConfig,
): Promise<string | null> {
  if (!item.reminderDate) {
    console.log('No reminder date set, skipping reminder');
    return null;
  }

  const reminderTimestamp =
    item.reminderDate instanceof Date
      ? item.reminderDate.getTime()
      : new Date(item.reminderDate).getTime();

  // Check if reminder is in the future
  if (reminderTimestamp <= Date.now()) {
    console.warn('Reminder time is in the past, skipping');
    return null;
  }

  // Calculate unix minute
  const unixMinute = Math.floor(reminderTimestamp / 60000);

  // Build message based on item type and priority
  const message =
    config.customMessage || buildDefaultMessage(item, config.itemType);

  // Map itemType to template name
  const messageTemplateMap = {
    todo: 'task_due',
    schedule: 'schedule_upcoming',
    goal: 'goal_checkin',
    habit: 'habit_daily',
  } as const;

  const messageTemplate = messageTemplateMap[config.itemType] || 'task_due';
  const firestoreProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!firestoreProjectId) {
    throw new Error(
      'Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID. Firestore project ID must be provided for reminders.',
    );
  }

  // Dynamic Webhook callback capture
  const appUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || '';

  // Get shared database dynamically
  const database = await getSharedDatabase();

  // Create reminder in RTDB
  const reminderRef = push(rtdbRef(database, `reminders/${unixMinute}`));

  await set(reminderRef, {
    // Identity
    clientId: config.clientId,
    userId: config.userId,
    itemId: item.id || '',
    itemType: config.itemType,
    firestoreProjectId: firestoreProjectId,
    method: config.method || 'whatsapp', // Store method: 'whatsapp' or 'push'

    // Contact
    phone: config.phone,
    whatsappId: `${config.phone}@c.us`,

    // Message context
    message: message,
    messageTemplate: messageTemplate,

    // Item-specific metadata
    metadata: {
      title: item.title,
      priority: item.priority || null,
      dueDate: item.dueDate || null,
      scheduleTime: item.scheduleTime || null,
      linkedGoalId: item.linkedGoalId || null,
    },

    // Security & Routing callback
    appUrl: appUrl,
    createdAt: Date.now(),
  });

  console.log(
    `✅ Enhanced reminder (${config.method || 'whatsapp'}) created for ${config.itemType}: ${item.title}`,
  );
  return reminderRef.key;
}

/**
 * Update reminder (delete old, create new)
 */
export async function updateWhatsAppReminder(
  oldReminderDate: Date | undefined,
  newItem: RemindableItem,
  config: ReminderConfig,
): Promise<string | null> {
  // Delete old reminder if it exists
  if (oldReminderDate && newItem.id) {
    await deleteWhatsAppReminder(oldReminderDate, newItem.id, config.itemType);
  }

  // Create new reminder
  return createWhatsAppReminder(newItem, config);
}

/**
 * Delete reminder from RTDB
 */
export async function deleteWhatsAppReminder(
  reminderDate: Date,
  itemId: string,
  itemType: string,
): Promise<void> {
  const reminderTimestamp =
    reminderDate instanceof Date
      ? reminderDate.getTime()
      : new Date(reminderDate).getTime();

  const unixMinute = Math.floor(reminderTimestamp / 60000);

  // Get shared database dynamically
  const database = await getSharedDatabase();

  // Find and delete the reminder using client-side filtering to avoid index rule errors
  const minuteRef = rtdbRef(database, `reminders/${unixMinute}`);
  const snapshot = await get(minuteRef);

  if (snapshot.exists()) {
    const reminders = snapshot.val();
    for (const [key, reminder] of Object.entries(reminders) as [
      string,
      { itemId?: string },
    ][]) {
      if (reminder.itemId === itemId) {
        await remove(rtdbRef(database, `reminders/${unixMinute}/${key}`));
        console.log(`🗑️ Deleted reminder for ${itemType}: ${itemId}`);
      }
    }
  }
}

/**
 * Safely delete a task reminder by fetching its current reminderDate from Firestore first
 */
export async function deleteTodoReminder(todoId: string): Promise<void> {
  try {
    const todoRef = doc(db, 'todos', todoId);
    const todoDoc = await getDoc(todoRef);
    if (todoDoc.exists()) {
      const data = todoDoc.data();
      if (data.reminderDate) {
        const rDate = data.reminderDate.toDate
          ? data.reminderDate.toDate()
          : new Date(data.reminderDate);
        await deleteWhatsAppReminder(rDate, todoId, 'todo');
      }
    }
  } catch (err) {
    console.error('Failed to delete todo reminder:', err);
  }
}

/**
 * Safely delete a schedule reminder by fetching its current reminderDate from Firestore first
 */
export async function deleteScheduleReminder(
  scheduleId: string,
): Promise<void> {
  try {
    const scheduleRef = doc(db, 'schedules', scheduleId);
    const scheduleDoc = await getDoc(scheduleRef);
    if (scheduleDoc.exists()) {
      const data = scheduleDoc.data();
      if (data.reminderDate) {
        const rDate = data.reminderDate.toDate
          ? data.reminderDate.toDate()
          : new Date(data.reminderDate);
        await deleteWhatsAppReminder(rDate, scheduleId, 'schedule');
      }
    }
  } catch (err) {
    console.error('Failed to delete schedule reminder:', err);
  }
}

/**
 * Reschedule a task's WhatsApp reminder when it is rescheduled
 */
export async function rescheduleTodoReminder(
  todoId: string,
  newDueDate: Date,
  userId: string,
  userPhone?: string,
): Promise<void> {
  try {
    const todoRef = doc(db, 'todos', todoId);
    const todoDoc = await getDoc(todoRef);
    if (!todoDoc.exists()) return;

    const data = todoDoc.data();
    if (!data.hasReminder || !data.reminderDate) {
      console.log('Task does not have an active reminder to reschedule');
      return;
    }

    // Resolve user's phone number
    let finalPhone = userPhone || '923164709208';
    if (!userPhone) {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const uData = userDoc.data();
        finalPhone = uData.phone || uData.whatsapp || '923164709208';
      }
    }

    const oldReminderDate = data.reminderDate.toDate
      ? data.reminderDate.toDate()
      : new Date(data.reminderDate);
    const oldDueDate = data.dueDate
      ? data.dueDate.toDate
        ? data.dueDate.toDate()
        : new Date(data.dueDate)
      : null;

    let newReminderDate: Date;

    if (oldDueDate && oldReminderDate) {
      // Calculate original offset and apply it to the new due date
      const offsetMs = oldDueDate.getTime() - oldReminderDate.getTime();
      newReminderDate = new Date(newDueDate.getTime() - offsetMs);

      // If the computed reminder is in the past, default to new due date or 15m before
      if (newReminderDate.getTime() <= Date.now()) {
        newReminderDate = new Date(newDueDate.getTime() - 15 * 60000); // 15 mins before due date
      }
    } else {
      newReminderDate = new Date(newDueDate.getTime() - 15 * 60000); // 15 mins before due date
    }

    // Ensure it's in the future
    if (newReminderDate.getTime() <= Date.now()) {
      newReminderDate = new Date(Date.now() + 5 * 60000); // 5 mins from now as a safe buffer
    }

    // Update RTDB: delete old, create new
    const config = getUserWhatsAppConfig(userId, finalPhone);
    config.itemType = 'todo';

    await updateWhatsAppReminder(
      oldReminderDate,
      {
        id: todoId,
        title: data.title,
        reminderDate: newReminderDate,
        priority: data.priority,
        dueDate: newDueDate.toISOString(),
      },
      config,
    );

    // Update Firestore document with new reminder date
    await updateDoc(todoRef, {
      reminderDate: Timestamp.fromDate(newReminderDate),
      updatedAt: new Date(),
    });

    console.log(
      `✅ Rescheduled WhatsApp reminder for task ${todoId} to ${newReminderDate}`,
    );
  } catch (err) {
    console.error('Failed to reschedule todo reminder:', err);
  }
}

/**
 * Reschedule a schedule's WhatsApp reminder when it is rescheduled
 */
export async function rescheduleScheduleReminder(
  scheduleId: string,
  newDateStr: string, // 'YYYY-MM-DD'
  newStartTimeStr: string, // 'HH:mm'
  userId: string,
  userPhone?: string,
): Promise<void> {
  try {
    const scheduleRef = doc(db, 'schedules', scheduleId);
    const scheduleDoc = await getDoc(scheduleRef);
    if (!scheduleDoc.exists()) return;

    const data = scheduleDoc.data();
    if (!data.hasReminder || !data.reminderDate) {
      console.log('Schedule does not have an active reminder to reschedule');
      return;
    }

    // Resolve user's phone number
    let finalPhone = userPhone || '923164709208';
    if (!userPhone) {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const uData = userDoc.data();
        finalPhone = uData.phone || uData.whatsapp || '923164709208';
      }
    }

    const oldReminderDate = data.reminderDate.toDate
      ? data.reminderDate.toDate()
      : new Date(data.reminderDate);

    // Calculate new start date-time
    const newStartDateTime = new Date(
      `${newDateStr}T${newStartTimeStr || '00:00'}`,
    );

    // Calculate the old schedule's start date-time if we have it
    let oldStartDateTime = newStartDateTime;
    if (data.date && data.startTime) {
      oldStartDateTime = new Date(`${data.date}T${data.startTime}`);
    }

    // Preserve the offset relative to start time
    const offsetMs = oldStartDateTime.getTime() - oldReminderDate.getTime();
    let newReminderDate = new Date(newStartDateTime.getTime() - offsetMs);

    // If computed time is in the past, set it to 10 mins before start time
    if (newReminderDate.getTime() <= Date.now()) {
      newReminderDate = new Date(newStartDateTime.getTime() - 10 * 60000);
    }
    // Safe buffer in the future
    if (newReminderDate.getTime() <= Date.now()) {
      newReminderDate = new Date(Date.now() + 5 * 60000);
    }

    const config = getUserWhatsAppConfig(userId, finalPhone);
    config.itemType = 'schedule';

    await updateWhatsAppReminder(
      oldReminderDate,
      {
        id: scheduleId,
        title: data.title,
        reminderDate: newReminderDate,
        priority: data.priority,
        scheduleTime: newStartTimeStr,
      },
      config,
    );

    // Update Firestore document with new reminder date
    await updateDoc(scheduleRef, {
      reminderDate: Timestamp.fromDate(newReminderDate),
      updatedAt: new Date(),
    });

    console.log(
      `✅ Rescheduled WhatsApp reminder for schedule ${scheduleId} to ${newReminderDate}`,
    );
  } catch (err) {
    console.error('Failed to reschedule schedule reminder:', err);
  }
}

/**
 * Build default message based on item type and priority emoji
 */
function buildDefaultMessage(
  item: RemindableItem,
  itemType: 'todo' | 'schedule' | 'goal' | 'habit',
): string {
  const title = item.title;
  const priority = item.priority;
  const scheduleTime = item.scheduleTime;

  switch (itemType) {
    case 'todo':
      const isCritical = priority === 'critical' || priority === 'high';
      const isUrgent = priority === 'urgent' || priority === 'medium';
      const priorityEmoji = isCritical ? '🔴' : isUrgent ? '🟠' : '⚪';
      return `${priorityEmoji} Task Reminder!\n\n"${title}"\n\n${isCritical ? '⚠️ CRITICAL PRIORITY\n\n' : ''}Have you completed this?\n\nReply "yes" or "done" to mark complete.`;

    case 'schedule':
      return `📅 Schedule Alert!\n\n"${title}"\n${scheduleTime ? `⏰ Starts at ${scheduleTime}\n` : ''}\n\nReply "done" when completed.`;

    case 'goal':
      return `🎯 Goal Check-in!\n\n"${title}"\n\nTime to work on your goal!\n\nReply "progress" to update.`;

    default:
      return `⏰ Reminder: "${title}"\n\nReply "done" when complete.`;
  }
}

/**
 * Helper to get user's WhatsApp config from their profile
 */
export function getUserWhatsAppConfig(
  userId: string,
  phone: string,
): ReminderConfig {
  const envClientId = process.env.NEXT_PUBLIC_CLIENT_ID || `user_${userId}`;
  return {
    userId,
    phone,
    clientId: envClientId,
    itemType: 'todo', // Will be overridden when called
  };
}
