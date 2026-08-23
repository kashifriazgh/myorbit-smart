'use client';

/**
 * Todo Cache Utility
 * ------------------
 * Manages localStorage caching for todos with an invalidation flag.
 * 
 * Key schema in localStorage:
 *   todos_cache          → JSON string of Todo[]
 *   todos_cache_uid      → userId the cache belongs to
 *   todos_cache_ts       → ISO timestamp when cache was last written
 *   todos_needs_refresh  → "true" | "false"
 */

import { Todo } from '@/app/lib/interface';

const CACHE_KEY = 'todos_cache';
const CACHE_UID_KEY = 'todos_cache_uid';
const CACHE_TS_KEY = 'todos_cache_ts';
const REFRESH_FLAG_KEY = 'todos_needs_refresh';

/** Maximum age of the cache before it is considered stale (ms). Default: 30 minutes. */
const MAX_CACHE_AGE_MS = 30 * 60 * 1000;

// ─── Serialisation helpers ────────────────────────────────────────────────────

/** Convert a Todo[] to a JSON-safe representation (dates as ISO strings). */
function serialise(todos: Todo[]): string {
  return JSON.stringify(
    todos.map((t) => ({
      ...t,
      dueDate: t.dueDate instanceof Date ? t.dueDate.toISOString() : t.dueDate,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
      updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
    }))
  );
}

/** Restore dates from a JSON-parsed Todo array. */
function deserialise(raw: unknown[]): Todo[] {
  return raw.map((t: unknown) => {
    const item = t as Record<string, unknown>;
    return {
      ...item,
      dueDate: item.dueDate ? new Date(item.dueDate as string) : null,
      createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt as string) : new Date(),
    } as Todo;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Write a fresh fetch result to the cache. Clears the refresh flag. */
export function saveTodosCache(todos: Todo[], uid: string): void {
  try {
    localStorage.setItem(CACHE_KEY, serialise(todos));
    localStorage.setItem(CACHE_UID_KEY, uid);
    localStorage.setItem(CACHE_TS_KEY, new Date().toISOString());
    localStorage.setItem(REFRESH_FLAG_KEY, 'false');
  } catch {
    // localStorage unavailable (SSR or quota exceeded) — silently ignore
  }
}

/**
 * Read the cached todos.
 * Returns null when:
 *  - no cache exists
 *  - cache belongs to a different user
 *  - the refresh flag is set to "true"
 *  - the cache is older than MAX_CACHE_AGE_MS
 */
export function loadTodosCache(uid: string): { todos: Todo[]; source: 'cache' } | null {
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

    const parsed = JSON.parse(raw) as unknown[];
    return { todos: deserialise(parsed), source: 'cache' };
  } catch {
    return null;
  }
}

/**
 * Set the refresh flag so the next load triggers a fresh Firebase fetch.
 * Call this whenever todos are mutated (add / update / delete / complete).
 */
export function invalidateTodosCache(): void {
  try {
    localStorage.setItem(REFRESH_FLAG_KEY, 'true');
  } catch {
    // silently ignore
  }
}

/** Clear the entire cache (e.g. on sign-out). */
export function clearTodosCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_UID_KEY);
    localStorage.removeItem(CACHE_TS_KEY);
    localStorage.removeItem(REFRESH_FLAG_KEY);
  } catch {
    // silently ignore
  }
}

/** Check the raw localStorage flag values for the debug overlay. */
export function getTodosCacheDebugInfo(): {
  hasCache: boolean;
  needsRefresh: boolean;
  cachedAt: string | null;
  count: number;
  ageSeconds: number | null;
} {
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
