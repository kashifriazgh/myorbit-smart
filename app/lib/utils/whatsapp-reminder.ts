import { ref as rtdbRef, push, set, remove, get } from 'firebase/database';
import { database } from '../firebase';

// Base interface for anything that can have a reminder
interface RemindableItem {
  title: string;
  reminderDate?: Date;
  id?: string;
}

interface ReminderConfig {
  userId: string;
  phone: string; // User's WhatsApp number
  clientId: string; // WhatsApp session ID (e.g., 'user_abc123')
  itemType: 'todo' | 'schedule' | 'goal' | 'habit'; // What kind of item
  customMessage?: string; // Optional custom message template
}

/**
 * Create a WhatsApp reminder in RTDB
 */
export async function createWhatsAppReminder(
  item: RemindableItem,
  config: ReminderConfig
): Promise<string | null> {
  
  if (!item.reminderDate) {
    console.log('No reminder date set, skipping WhatsApp reminder');
    return null;
  }

  const reminderTimestamp = item.reminderDate instanceof Date 
    ? item.reminderDate.getTime() 
    : new Date(item.reminderDate).getTime();

  // Check if reminder is in the future
  if (reminderTimestamp <= Date.now()) {
    console.warn('Reminder time is in the past, skipping');
    return null;
  }

  // Calculate unix minute
  const unixMinute = Math.floor(reminderTimestamp / 60000);

  // Build message based on item type
  const message = config.customMessage || buildDefaultMessage(item, config.itemType);

  // Create reminder in RTDB
  const reminderRef = push(rtdbRef(database, `reminders/${unixMinute}`));
  
  await set(reminderRef, {
    clientId: config.clientId,
    userId: config.userId,
    itemId: item.id,
    itemType: config.itemType,
    phone: config.phone,
    whatsappId: `${config.phone}@c.us`,
    message: message,
    createdAt: Date.now()
  });

  console.log(`✅ WhatsApp reminder created for ${config.itemType}: ${item.title}`);
  return reminderRef.key;
}

/**
 * Update WhatsApp reminder (delete old, create new)
 */
export async function updateWhatsAppReminder(
  oldReminderDate: Date | undefined,
  newItem: RemindableItem,
  config: ReminderConfig
): Promise<string | null> {
  
  // Delete old reminder if it exists
  if (oldReminderDate && newItem.id) {
    await deleteWhatsAppReminder(oldReminderDate, newItem.id, config.itemType);
  }

  // Create new reminder
  return createWhatsAppReminder(newItem, config);
}

/**
 * Delete WhatsApp reminder from RTDB
 */
export async function deleteWhatsAppReminder(
  reminderDate: Date,
  itemId: string,
  itemType: string
): Promise<void> {
  
  const reminderTimestamp = reminderDate instanceof Date 
    ? reminderDate.getTime() 
    : new Date(reminderDate).getTime();

  const unixMinute = Math.floor(reminderTimestamp / 60000);

  // Find and delete the reminder using client-side filtering to avoid index rule errors
  const minuteRef = rtdbRef(database, `reminders/${unixMinute}`);
  const snapshot = await get(minuteRef);

  if (snapshot.exists()) {
    const reminders = snapshot.val();
    for (const [key, reminder] of Object.entries(reminders) as [string, { itemId?: string }][]) {
      if (reminder.itemId === itemId) {
        await remove(rtdbRef(database, `reminders/${unixMinute}/${key}`));
        console.log(`🗑️ Deleted WhatsApp reminder for ${itemType}: ${itemId}`);
      }
    }
  }
}

/**
 * Build default message based on item type
 */
function buildDefaultMessage(item: RemindableItem, itemType: string): string {
  switch (itemType) {
    case 'todo':
      return `⏰ Task Reminder!\n\n"${item.title}"\n\nHave you completed this task?\n\nReply "yes" or "completed" to mark it done.`;
    
    case 'schedule':
      return `📅 Schedule Reminder!\n\n"${item.title}"\n\nYour scheduled event is coming up.\n\nReply "done" to mark as completed.`;
    
    case 'goal':
      return `🎯 Goal Reminder!\n\n"${item.title}"\n\nTime to work on your goal!\n\nReply "done" when you've made progress.`;
    
    case 'habit':
      return `💪 Habit Reminder!\n\n"${item.title}"\n\nDid you complete this habit today?\n\nReply "yes" to mark it done.`;
    
    default:
      return `⏰ Reminder!\n\n"${item.title}"\n\nReply "done" when completed.`;
  }
}

/**
 * Helper to get user's WhatsApp config from their profile
 */
export function getUserWhatsAppConfig(userId: string, phone: string): ReminderConfig {
  return {
    userId,
    phone,
    clientId: `user_${userId}`, // In production, this will be unique per user
    itemType: 'todo' // Will be overridden when called
  };
}