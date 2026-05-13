export function formatCurrency(
  amount: number,
  currency: 'PKR' | 'USD'
): string {
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`; // supports cents
  }

  // Default is PKR
  return `Rs ${amount.toLocaleString('en-PK', {
    maximumFractionDigits: 0,
  })}`;
}

export function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const v = value as { seconds: number; nanoseconds?: number };
    return new Date(v.seconds * 1000 + (v.nanoseconds || 0) / 1000000);
  }
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? null : d;
}

// lib/utils/timeAnalysis.ts

export function extractHoursAndDaysFromTimestamps(timestamps: Date[]) {
  const hoursMap = new Map<number, number>();
  const daysMap = new Map<number, number>();

  timestamps.forEach((date) => {
    const hour = date.getHours(); // 0 to 23
    const day = date.getDay(); // 0 (Sun) to 6 (Sat)

    hoursMap.set(hour, (hoursMap.get(hour) || 0) + 1);
    daysMap.set(day, (daysMap.get(day) || 0) + 1);
  });

  const mostFrequent = (map: Map<number, number>) => {
    const entries = Array.from(map.entries());
    const maxCount = Math.max(...entries.map(([, count]) => count));
    return entries
      .filter(([, count]) => count === maxCount)
      .map(([key]) => key);
  };

  return {
    hourFrequency: hoursMap,
    dayFrequency: daysMap,
    mostFocusedHours: mostFrequent(hoursMap),
    mostFocusedDays: mostFrequent(daysMap),
  };
}

export const weekdayMap = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// log focus time
import { doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import moment from 'moment-timezone';

export const logFocusTime = async (userId: string) => {
  const now = moment().tz('Asia/Karachi');
  const minute = now.minute();
  let hour = now.hour();
  if (minute >= 40) hour = (hour + 1) % 24;

  const docRef = doc(db, 'pmc', userId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);

    if (!snap.exists()) {
      const focusTimeInit: Record<number, number> = {};
      for (let i = 0; i < 24; i++) {
        focusTimeInit[i] = 0;
      }
      focusTimeInit[hour] = 1; // First increment
      transaction.set(docRef, { focusTime: focusTimeInit });
    } else {
      const data = snap.data();
      const currentCount = data.focusTime?.[hour] || 0;
      transaction.update(docRef, {
        [`focusTime.${hour}`]: currentCount + 1,
      });
    }
  });
};

export function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    // Check if it's a Date, Timestamp, or FieldValue
    if (obj instanceof Date) return obj;
    
    // For Firestore Timestamps and FieldValues (sentinels)
    // They usually have a custom constructor or specific method
    const constructorName = obj.constructor?.name;
    if (constructorName === 'Timestamp' || constructorName === 'FieldValueImpl' || constructorName === 'FieldValue') {
      return obj;
    }

    // Also check for toDate method which Timestamps have
    if ('toDate' in obj && typeof (obj as { toDate: unknown }).toDate === 'function') {
      return obj;
    }
    
    const out: Record<string, unknown> = {};
    const objAsRecord = obj as Record<string, unknown>;
    Object.keys(objAsRecord).forEach((k) => {
      const v = objAsRecord[k];
      if (v === undefined) return; // skip undefined fields
      out[k] = sanitizeObject(v);
    });
    return out;
  }
  return obj;
}
