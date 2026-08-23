'use client';

import { Goal } from '@/app/lib/interface';

const CACHE_KEY = 'goals_cache';
const CACHE_UID_KEY = 'goals_cache_uid';
const CACHE_TS_KEY = 'goals_cache_ts';
const REFRESH_FLAG_KEY = 'goals_needs_refresh';

const MAX_CACHE_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function saveGoalsCache(goals: Goal[], uid: string): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(goals));
    localStorage.setItem(CACHE_UID_KEY, uid);
    localStorage.setItem(CACHE_TS_KEY, new Date().toISOString());
    localStorage.setItem(REFRESH_FLAG_KEY, 'false');
  } catch {
    // localStorage unavailable
  }
}

export function loadGoalsCache(uid: string): Goal[] | null {
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

    return JSON.parse(raw) as Goal[];
  } catch {
    return null;
  }
}

export function invalidateGoalsCache(): void {
  try {
    localStorage.setItem(REFRESH_FLAG_KEY, 'true');
  } catch {
    // ignore
  }
}

export function clearGoalsCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_UID_KEY);
    localStorage.removeItem(CACHE_TS_KEY);
    localStorage.removeItem(REFRESH_FLAG_KEY);
  } catch {
    // ignore
  }
}
