'use client';

import { StreakProps } from '@/app/lib/interface';

const CACHE_KEY = 'streaks_cache';
const CACHE_UID_KEY = 'streaks_cache_uid';
const CACHE_TS_KEY = 'streaks_cache_ts';
const REFRESH_FLAG_KEY = 'streaks_needs_refresh';

const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours as requested!

export function saveStreaksCache(streaks: StreakProps[], uid: string): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(streaks));
    localStorage.setItem(CACHE_UID_KEY, uid);
    localStorage.setItem(CACHE_TS_KEY, new Date().toISOString());
    localStorage.setItem(REFRESH_FLAG_KEY, 'false');
  } catch {
    // ignore
  }
}

export function loadStreaksCache(uid: string): StreakProps[] | null {
  try {
    const cachedUid = localStorage.getItem(CACHE_UID_KEY);
    if (cachedUid !== uid) return null;

    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (ts) {
      const age = Date.now() - new Date(ts).getTime();
      if (age > MAX_CACHE_AGE_MS) {
        // Automatically mark as needs refresh after 24 hrs
        localStorage.setItem(REFRESH_FLAG_KEY, 'true');
        return null;
      }
    }

    const refreshFlag = localStorage.getItem(REFRESH_FLAG_KEY);
    if (refreshFlag === 'true') return null;

    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as StreakProps[];
  } catch {
    return null;
  }
}

export function invalidateStreaksCache(): void {
  try {
    localStorage.setItem(REFRESH_FLAG_KEY, 'true');
  } catch {
    // ignore
  }
}

export function clearStreaksCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_UID_KEY);
    localStorage.removeItem(CACHE_TS_KEY);
    localStorage.removeItem(REFRESH_FLAG_KEY);
  } catch {
    // ignore
  }
}

export function getStreaksCacheDebugInfo() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts = localStorage.getItem(CACHE_TS_KEY);
    const flag = localStorage.getItem(REFRESH_FLAG_KEY);
    const count = raw ? (JSON.parse(raw) as unknown[]).length : 0;
    const ageSeconds = ts ? Math.round((Date.now() - new Date(ts).getTime()) / 1000) : null;
    const needsRefresh = flag === 'true' || (ageSeconds != null && ageSeconds > 24 * 3600);
    return {
      hasCache: !!raw,
      needsRefresh,
      cachedAt: ts,
      count,
      ageSeconds,
    };
  } catch {
    return { hasCache: false, needsRefresh: false, cachedAt: null, count: 0, ageSeconds: null };
  }
}
