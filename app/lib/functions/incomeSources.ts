// lib/functions/incomeSources.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { Bank, IncomeSource } from '@/app/lib/interface';

/**
 * Fetch income sources for a given userId (returns normalized Date fields)
 */
export async function fetchIncomeSources(userId: string) {
  const q = query(
    collection(db, 'incomeSources'),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as IncomeSource;
    const expected = data.expectedDate as Timestamp | Date | undefined;
    const lastReceived = data.lastReceivedDate as Timestamp | Date | undefined;

    return {
      ...data,
      id: d.id,
      createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
      updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
      expectedDate: expected
        ? expected instanceof Timestamp
          ? expected.toDate()
          : expected
        : undefined,
      // normalize lastReceivedDate to Date if present
      lastReceivedDate: lastReceived
        ? lastReceived instanceof Timestamp
          ? lastReceived.toDate()
          : lastReceived
        : undefined,
    } as IncomeSource & { id: string; lastReceivedDate?: Date };
  });
}

export async function fetchBanks(userId: string) {
  const q = query(collection(db, 'banks'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Bank, 'id'>),
  }));
}

export async function addNewBank(userId: string, newBankName: string) {
  const docRef = await addDoc(collection(db, 'banks'), {
    userId,
    name: newBankName.trim(),
    createdAt: Timestamp.now(),
  });
  return {
    id: docRef.id,
    userId,
    name: newBankName.trim(),
    createdAt: Timestamp.now(),
  } as Bank;
}

export async function updateIncomeAmount(incomeId: string, amount: number) {
  await updateDoc(doc(db, 'incomeSources', incomeId), {
    amount,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteIncomeSource(incomeId: string) {
  await deleteDoc(doc(db, 'incomeSources', incomeId));
}

export async function saveIncomeSource(payload: IncomeSource) {
  const res = await addDoc(collection(db, 'incomeSources'), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return res.id;
}

/* --------------------------------------------------------------------------
   Helpers for recurring reset logic
   - shouldResetReceived(src) returns true when the recurring income's
     isReceived should be reset for the current cycle (i.e. allow marking
     as received again).
   - Works for frequency: 'daily' | 'weekly' | 'monthly'
   - Uses fields (if present on the src):
       dayOfWeek?: number    // 0 = Sunday .. 6 = Saturday
       dayOfMonth?: number   // 1..30 (we clamp to month days)
       lastReceivedDate?: Date | Timestamp
   ------------------------------------------------------------------------ */

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysInMonth(year: number, monthZeroBased: number) {
  // monthZeroBased: 0 = Jan
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

/** get the most recent date (<= now) that falls on the target weekday (0..6) */
function getMostRecentWeekdayDate(now: Date, targetWeekday: number) {
  const today = new Date(now);
  const diff = (today.getDay() - targetWeekday + 7) % 7; // 0..6
  const candidate = new Date(today);
  candidate.setDate(today.getDate() - diff);
  return startOfDay(candidate);
}

/** get the most recent date (<= now) that is the target day-of-month (1..30) */
function getMostRecentMonthDay(now: Date, dom: number) {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  // clamp requested dom to valid days in month
  const clamp = (year: number, month: number, day: number) =>
    Math.min(day, daysInMonth(year, month));
  // candidate in this month
  const candidateThisMonth = new Date(y, m, clamp(y, m, dom));
  if (candidateThisMonth <= startOfDay(now)) {
    return startOfDay(candidateThisMonth);
  }
  // otherwise previous month
  const prevMonth = new Date(y, m - 1, 1); // js adjusts year if month < 0
  const py = prevMonth.getFullYear();
  const pm = prevMonth.getMonth();
  const candidatePrev = new Date(py, pm, clamp(py, pm, dom));
  return startOfDay(candidatePrev);
}

/**
 * Determine if a recurring income should have its `isReceived` reset for the current cycle.
 *
 * Note: expects `src.lastReceivedDate` to be normalized to a Date if it exists.
 */
export function shouldResetReceived(src: IncomeSource): boolean {
  // Only recurring incomes need resetting logic
  if (!src || src.type !== 'recurring') return false;

  // Normalize lastReceivedDate if it's a Timestamp or string
  const rawLast = src.lastReceivedDate;
  if (!rawLast) {
    // No lastReceivedDate — nothing to "reset" because it hasn't been received yet.
    // Return false so we don't override existing isReceived values unexpectedly.
    return false;
  }
  const last =
    rawLast instanceof Timestamp ? rawLast.toDate() : new Date(rawLast);

  const now = new Date();

  // DAILY: if last received is not today -> reset
  if (src.frequency === 'daily') {
    return !isSameDay(last, now);
  }

  // WEEKLY:
  if (src.frequency === 'weekly') {
    // prefer numeric dayOfWeek (0..6). Accept either `dayOfWeek` or `weekDay` if exists.
    let targetDay: number | null = null;
    const possible =
      src.dayOfWeek ??
      (src as IncomeSource & { weekDay?: number | string }).weekDay ??
      null;
    if (typeof possible === 'number') {
      targetDay = possible;
    } else if (typeof possible === 'string') {
      const name = possible.toLowerCase();
      const idx = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ].indexOf(name);
      if (idx >= 0) targetDay = idx;
    }

    if (targetDay !== null && !Number.isNaN(targetDay)) {
      const recentScheduled = getMostRecentWeekdayDate(now, targetDay);
      // if lastReceivedDate is before the most recent scheduled occurrence => reset
      return last < recentScheduled;
    }

    // fallback: if no target day available, reset if it's been >= 7 days since last
    return now.getTime() - last.getTime() > 7 * 24 * 60 * 60 * 1000;
  }

  // MONTHLY:
  if (src.frequency === 'monthly') {
    const possible =
      src.dayOfMonth ??
      (src as IncomeSource & { monthDay?: number | string }).monthDay ??
      null;
    const dayNum = Number(possible);
    if (!Number.isNaN(dayNum) && dayNum >= 1 && dayNum <= 30) {
      const recentScheduled = getMostRecentMonthDay(now, dayNum);
      return last < recentScheduled;
    }

    // fallback: if no target day, reset if >= 30 days since last
    return now.getTime() - last.getTime() > 30 * 24 * 60 * 60 * 1000;
  }

  return false;
}
