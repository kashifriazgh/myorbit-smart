'use client';

import { SchedulesProps } from '@/app/lib/interface';

const CACHE_KEY = 'schedules_cache';
const CACHE_UID_KEY = 'schedules_cache_uid';
const CACHE_TS_KEY = 'schedules_cache_ts';
const REFRESH_FLAG_KEY = 'schedules_needs_refresh';

const MAX_CACHE_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function saveSchedulesCache(schedules: SchedulesProps[], uid: string): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(schedules));
    localStorage.setItem(CACHE_UID_KEY, uid);
    localStorage.setItem(CACHE_TS_KEY, new Date().toISOString());
    localStorage.setItem(REFRESH_FLAG_KEY, 'false');
  } catch {
    // localStorage unavailable
  }
}

export function loadSchedulesCache(uid: string): SchedulesProps[] | null {
  try {
    const cachedUid = localStorage.getItem(CACHE_UID_KEY);
    if (cachedUid !== uid) return null;

    const refreshFlag = localStorage.getItem(REFRESH_FLAG_KEY);
    if (refreshFlag === 'true') return null;

    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (ts) {
      const age = Date.now() - new Date(ts).getTime();
      if (age > MAX_CACHE_AGE_MS) return null;
    }

    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as SchedulesProps[];
  } catch {
    return null;
  }
}

export function invalidateSchedulesCache(): void {
  try {
    localStorage.setItem(REFRESH_FLAG_KEY, 'true');
  } catch {
    // ignore
  }
}

export function clearSchedulesCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_UID_KEY);
    localStorage.removeItem(CACHE_TS_KEY);
    localStorage.removeItem(REFRESH_FLAG_KEY);
  } catch {
    // ignore
  }
}

export function getSchedulesCacheDebugInfo() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    const flag = localStorage.getItem(REFRESH_FLAG_KEY);
    const count = raw ? (JSON.parse(raw) as unknown[]).length : 0;
    const ageSeconds = ts ? Math.round((Date.now() - new Date(ts).getTime()) / 1000) : null;
    return {
      hasCache: !!raw,
      needsRefresh: flag === 'true',
      cachedAt: ts,
      count,
      ageSeconds,
    };
  } catch {
    return { hasCache: false, needsRefresh: false, cachedAt: null, count: 0, ageSeconds: null };
  }
}
