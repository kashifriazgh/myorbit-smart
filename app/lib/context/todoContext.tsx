'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { Todo } from '@/app/lib/interface';
import { useAuth } from './userContext';
import {
  loadTodosCache,
  saveTodosCache,
  invalidateTodosCache,
  clearTodosCache,
} from '@/app/lib/utils/todosCache';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Where the currently displayed todos came from. Used by the debug overlay. */
export type TodoDataSource = 'firebase' | 'cache' | 'loading';

interface TodoContextType {
  todos: Todo[];
  loading: boolean;
  dataSource: TodoDataSource;
  updateStepStatus: (todoId: string, stepIndex: number, newStatus: string) => Promise<void>;
  updateSubStepStatus: (todoId: string, stepIndex: number, subIndex: number, done: boolean) => Promise<void>;
  addTodo: (todo: Omit<Todo, 'id'>) => Promise<string>;
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  refreshTodos: () => void;
  /** Expose the invalidation helper so mutations in other components can call it */
  invalidateCache: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const TodoContext = createContext<TodoContextType | undefined>(undefined);

export const useTodoContext = () => {
  const context = useContext(TodoContext);
  if (!context) throw new Error('useTodoContext must be used within a TodoProvider');
  return context;
};

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const TodoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<TodoDataSource>('loading');

  /** Prevent duplicate fetches when the user object re-renders */
  const fetchingRef = useRef(false);

  // ── Helper: normalise Firestore timestamps into JS Dates ──────────────────
  const normaliseTodo = useCallback((data: Record<string, unknown>, id: string): Todo => ({
    ...(data as unknown as Todo),
    id,
    dueDate: data.dueDate
      ? (typeof (data.dueDate as { toDate?: () => Date }).toDate === 'function'
          ? (data.dueDate as { toDate: () => Date }).toDate()
          : new Date(data.dueDate as string))
      : null,
    createdAt: data.createdAt
      ? (typeof (data.createdAt as { toDate?: () => Date }).toDate === 'function'
          ? (data.createdAt as { toDate: () => Date }).toDate()
          : new Date(data.createdAt as string))
      : new Date(),
    updatedAt: data.updatedAt
      ? (typeof (data.updatedAt as { toDate?: () => Date }).toDate === 'function'
          ? (data.updatedAt as { toDate: () => Date }).toDate()
          : new Date(data.updatedAt as string))
      : new Date(),
  }), []);

  // ── Core fetch function (talks to Firebase) ───────────────────────────────
  const fetchFromFirebase = useCallback(async (uid: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      console.log('%c[TodoCache] 🔥 Fetching from Firebase…', 'color:#f59e0b;font-weight:bold');
      const q = query(collection(db, 'todos'), where('authorId', '==', uid));
      const snapshot = await getDocs(q);
      const fetched: Todo[] = snapshot.docs.map((d) => normaliseTodo(d.data(), d.id));

      setTodos(fetched);
      setDataSource('firebase');
      setLoading(false);

      // Persist fresh data to localStorage
      saveTodosCache(fetched, uid);
      console.log(`%c[TodoCache] ✅ Saved ${fetched.length} todos to cache`, 'color:#22c55e;font-weight:bold');
    } catch (error) {
      console.error('[TodoCache] ❌ Firebase fetch failed:', error);
      setLoading(false);
    } finally {
      fetchingRef.current = false;
    }
  }, [normaliseTodo]);

  // ── Bootstrap on mount / user change ─────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setTodos([]);
      setLoading(false);
      setDataSource('loading');
      clearTodosCache();
      return;
    }

    // 1. Try cache first
    const cached = loadTodosCache(user.uid);
    if (cached) {
      console.log(`%c[TodoCache] 📦 Serving ${cached.todos.length} todos from localStorage cache`, 'color:#6366f1;font-weight:bold');
      setTodos(cached.todos);
      setDataSource('cache');
      setLoading(false);
      // No Firebase call — done ✅
      return;
    }

    // 2. Cache miss or stale — fetch from Firebase
    console.log('%c[TodoCache] ⚠️  Cache miss or stale — fetching from Firebase', 'color:#ef4444;font-weight:bold');
    setLoading(true);
    setDataSource('loading');
    fetchFromFirebase(user.uid);
  }, [user, fetchFromFirebase]);

  // ── Public refresh (force re-fetch) ──────────────────────────────────────
  const refreshTodos = useCallback(() => {
    if (!user) return;
    invalidateTodosCache();
    setLoading(true);
    setDataSource('loading');
    fetchFromFirebase(user.uid);
  }, [user, fetchFromFirebase]);

  // ── Cache invalidation (called after any mutation) ────────────────────────
  const invalidateCache = useCallback(() => {
    invalidateTodosCache();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Shared helper: update state and persist to cache atomically
  // ─────────────────────────────────────────────────────────────────────────

  const applyAndCache = useCallback((updater: (prev: Todo[]) => Todo[]) => {
    setTodos((prev) => {
      const next = updater(prev);
      // Persist updated list to cache immediately (no 'needsRefresh' flag set)
      if (user) saveTodosCache(next, user.uid);
      return next;
    });
  }, [user]);

  // ─────────────────────────────────────────────────────────────────────────
  // Mutation helpers
  //  1. Optimistic React state + localStorage update (instant UI)
  //  2. Then write to Firebase
  //  3. Only set needsRefresh if something goes wrong
  // ─────────────────────────────────────────────────────────────────────────

  const updateStepStatus = async (todoId: string, stepIndex: number, newStatus: string) => {
    const todo = todos.find((t) => t.id === todoId);
    if (!todo || !todo.steps) return;

    const updatedSteps = [...todo.steps];
    updatedSteps[stepIndex].status = newStatus as 'in_progress' | 'completed' | 'hold' | 'left-over';
    updatedSteps[stepIndex].done = newStatus === 'completed';

    applyAndCache((prev) => prev.map((t) => t.id === todoId ? { ...t, steps: updatedSteps } : t));

    try {
      await updateDoc(doc(db, 'todos', todoId), { steps: updatedSteps, updatedAt: new Date() });
    } catch (e) {
      console.error('[TodoCache] updateStepStatus failed:', e);
      invalidateTodosCache(); // force refresh on next load
    }
  };

  const updateSubStepStatus = async (todoId: string, stepIndex: number, subIndex: number, done: boolean) => {
    const todo = todos.find((t) => t.id === todoId);
    if (!todo || !todo.steps) return;

    const updatedSteps = [...todo.steps];
    if (updatedSteps[stepIndex].subSteps) {
      updatedSteps[stepIndex].subSteps![subIndex].done = done;
      updatedSteps[stepIndex].subSteps![subIndex].status = done ? 'completed' : 'in_progress';
    }

    applyAndCache((prev) => prev.map((t) => t.id === todoId ? { ...t, steps: updatedSteps } : t));

    try {
      await updateDoc(doc(db, 'todos', todoId), { steps: updatedSteps, updatedAt: new Date() });
    } catch (e) {
      console.error('[TodoCache] updateSubStepStatus failed:', e);
      invalidateTodosCache();
    }
  };

  const addTodo = async (todoData: Omit<Todo, 'id'>): Promise<string> => {
    const now = new Date();
    // Temporary client-side ID for instant render
    const tempId = `temp_${Date.now()}`;

    // Normalize dueDate to Date for local React state/cache consistency
    const dueDateParsed = todoData.dueDate
      ? (typeof (todoData.dueDate as { toDate?: () => Date }).toDate === 'function'
          ? (todoData.dueDate as { toDate: () => Date }).toDate()
          : new Date(todoData.dueDate as Date))
      : null;

    const optimisticTodo: Todo = {
      ...todoData,
      id: tempId,
      dueDate: dueDateParsed,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Show immediately in UI
    applyAndCache((prev) => [...prev, optimisticTodo]);

    try {
      // 2. Write to Firebase
      const docRef = await addDoc(collection(db, 'todos'), {
        ...todoData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 3. Replace temp ID with real ID
      applyAndCache((prev) => prev.map((t) => t.id === tempId ? { ...t, id: docRef.id } : t));

      return docRef.id;
    } catch (e) {
      // Rollback optimistic update
      applyAndCache((prev) => prev.filter((t) => t.id !== tempId));
      throw e;
    }
  };

  const updateTodo = async (id: string, updates: Partial<Todo>) => {
    // 1. Optimistic update
    applyAndCache((prev) => prev.map((t) => t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t));

    // 2. Write to Firebase
    try {
      await updateDoc(doc(db, 'todos', id), { ...updates, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error('[TodoCache] updateTodo failed:', e);
      invalidateTodosCache();
    }
  };

  const deleteTodo = async (id: string) => {
    // 1. Optimistic remove
    applyAndCache((prev) => prev.filter((t) => t.id !== id));

    // 2. Delete from Firebase
    try {
      await deleteDoc(doc(db, 'todos', id));
    } catch (e) {
      console.error('[TodoCache] deleteTodo failed:', e);
      invalidateTodosCache();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Context value
  // ─────────────────────────────────────────────────────────────────────────

  const value: TodoContextType = {
    todos,
    loading,
    dataSource,
    updateStepStatus,
    updateSubStepStatus,
    addTodo,
    updateTodo,
    deleteTodo,
    refreshTodos,
    invalidateCache,
  };

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
};
