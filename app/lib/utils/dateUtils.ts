/**
 * Date utility functions for handling timezone issues
 * Specifically for Pakistan timezone (Asia/Karachi)
 */

/**
 * Gets current date in Pakistan timezone (YYYY-MM-DD format)
 */
export function getCurrentDatePK(): string {
  const now = new Date();
  // Convert to Pakistan timezone (UTC+5)
  const pkDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  return pkDate.toISOString().split('T')[0];
}

/**
 * Gets tomorrow's date in Pakistan timezone (YYYY-MM-DD format)
 */
export function getTomorrowDatePK(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  // Convert to Pakistan timezone
  const pkDate = new Date(tomorrow.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  return pkDate.toISOString().split('T')[0];
}

/**
 * Gets current time in Pakistan timezone (HH:mm format)
 */
export function getCurrentTimePK(): string {
  const now = new Date();
  // Convert to Pakistan timezone
  const pkTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Karachi' }));
  const hours = pkTime.getHours().toString().padStart(2, '0');
  const minutes = pkTime.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Converts a date string (YYYY-MM-DD) to Date object in Pakistan timezone
 * Adjusts for timezone offset to ensure correct date
 */
export function parseDatePK(dateString: string): Date {
  if (!dateString) return new Date();
  
  // Parse the date string and create date in local timezone
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  // Adjust for Pakistan timezone offset (UTC+5)
  // Get current timezone offset
  const localOffset = date.getTimezoneOffset() * 60000; // in milliseconds
  const pkOffset = -5 * 60 * 60000; // Pakistan is UTC+5
  const offsetDiff = pkOffset - localOffset;
  
  return new Date(date.getTime() + offsetDiff);
}

/**
 * Gets a Date object for tomorrow in Pakistan timezone
 */
export function getTomorrowDateObjectPK(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return parseDatePK(getTomorrowDatePK());
}

