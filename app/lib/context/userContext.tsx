'use client';

import { onAuthStateChanged, getAuth } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { app, db } from '../firebase';
import { FirestoreUser, OnboardingData, Goal, TotalCashSnapshot, Expenditure, LoanRecord, StreakProps, SchedulesProps } from '../interface';
import { getOrCreateGuestUser } from '../guestUser';
import Cookies from 'js-cookie';
import { getTaskMetrics, TodoAggregateStats, generateTodoAnalysisSummary, getScheduleMetrics, ScheduleMetrics } from '../utilts';

const auth = getAuth(app);

// ─── Journal Context ──────────────────────────────────────────────────────────

export type ContextStatus = 'idle' | 'fetching' | 'generating' | 'saved' | 'error';

export interface JournalContextData {
  summary: string;
  journalCount: number;
  generatedAt: string;
  locked: boolean;
}

// ─── Todo Context ─────────────────────────────────────────────────────────────

export interface TodoContextData {
  summary: string;
  totalCompletedCount: number;
  totalActiveCount: number;
  sampledCompletedCount: number;
  sampledActiveCount: number;
  generatedAt: string;
  locked: boolean;
  sampledCompleted?: {
    title: string;
    priority: string;
    completedAt: string;
    progressPercent: number;
    progressLabel: string;
    pace: 'Ahead' | 'On Track' | 'Behind' | 'Overdue' | null;
    rescheduleStatus: 'Stable' | 'Minor Slippage' | 'Frequently Delayed' | 'Chronically Postponed';
    staleness: 'Fresh' | 'Aging' | 'Stale' | 'Needs Review' | null;
  }[];
  sampledActive?: {
    title: string;
    priority: string;
    progressPercent: number;
    progressLabel: string;
    pace: 'Ahead' | 'On Track' | 'Behind' | 'Overdue' | null;
    rescheduleStatus: 'Stable' | 'Minor Slippage' | 'Frequently Delayed' | 'Chronically Postponed';
    staleness: 'Fresh' | 'Aging' | 'Stale' | 'Needs Review' | null;
    status: string;
    daysPassed: number;
    createdAt: string;
    dueDate: string;
  }[];
  aggregateSummary?: TodoAggregateStats;
}

// ─── Goal Context ─────────────────────────────────────────────────────────────

export interface GoalContextData {
  summary: string;
  totalCompletedCount: number;
  totalActiveCount: number;
  sampledCompletedCount: number;
  sampledActiveCount: number;
  checkInsLast30Days: number;
  overallConsistency: number;
  generatedAt: string;
  locked: boolean;
}

// ─── Finance Context ──────────────────────────────────────────────────────────

export interface FinanceContextData {
  summary: string;
  availableAmount: number;
  freezeAmount: number;
  totalAmount: number;
  upcomingExpensesCount: number;
  upcomingExpensesTotal: number;
  outstandingBorrowTotal: number;
  outstandingLendTotal: number;
  generatedAt: string;
  locked: boolean;
}

// ─── Consolidated Context ─────────────────────────────────────────────────────

export interface ConsolidatedContextData {
  summary: string;
  generatedAt: string;
  locked: boolean;
}

// ─── Streak Context ──────────────────────────────────────────────────────────

export interface StreakContextData {
  summary: string;
  totalCount: number;
  averageStreak: number;
  longestStreak: number;
  generatedAt: string;
  locked: boolean;
}

// ─── Schedule Context ─────────────────────────────────────────────────────────

export interface ScheduleContextData {
  summary: string;
  totalCount: number;
  averageDailySchedules: number;
  flexibleCount: number;
  generatedAt: string;
  locked: boolean;
  manualMetrics?: ScheduleMetrics;
}

// ─── Main Context Type ────────────────────────────────────────────────────────

interface UserContextType {
  user: FirestoreUser | null;
  loading: boolean;
  isGuest: boolean;
  onboardingData: OnboardingData | null;
  updateOnboardingData: (data: Partial<OnboardingData>) => Promise<void>;

  // Journal AI Context
  journalContextData: JournalContextData | null;
  journalContextStatus: ContextStatus;
  journalContextLocked: boolean;
  generateJournalContext: () => Promise<void>;
  toggleJournalContextLock: (locked: boolean) => Promise<void>;

  // Todo AI Context
  todoContextData: TodoContextData | null;
  todoContextStatus: ContextStatus;
  todoContextLocked: boolean;
  generateTodoContext: () => Promise<void>;
  toggleTodoContextLock: (locked: boolean) => Promise<void>;

  // Goal AI Context
  goalContextData: GoalContextData | null;
  goalContextStatus: ContextStatus;
  goalContextLocked: boolean;
  generateGoalContext: () => Promise<void>;
  toggleGoalContextLock: (locked: boolean) => Promise<void>;

  // Finance AI Context
  financeContextData: FinanceContextData | null;
  financeContextStatus: ContextStatus;
  financeContextLocked: boolean;
  generateFinanceContext: () => Promise<void>;
  toggleFinanceContextLock: (locked: boolean) => Promise<void>;

  // Consolidated AI Context
  consolidatedContextData: ConsolidatedContextData | null;
  consolidatedContextStatus: ContextStatus;
  consolidatedContextLocked: boolean;
  generateConsolidatedContext: () => Promise<void>;
  toggleConsolidatedContextLock: (locked: boolean) => Promise<void>;

  // Streak AI Context
  streakContextData: StreakContextData | null;
  streakContextStatus: ContextStatus;
  streakContextLocked: boolean;
  generateStreakContext: () => Promise<void>;
  toggleStreakContextLock: (locked: boolean) => Promise<void>;

  // Schedule AI Context
  scheduleContextData: ScheduleContextData | null;
  scheduleContextStatus: ContextStatus;
  scheduleContextLocked: boolean;
  generateScheduleContext: () => Promise<void>;
  toggleScheduleContextLock: (locked: boolean) => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  isGuest: false,
  onboardingData: null,
  updateOnboardingData: async () => {},
  journalContextData: null,
  journalContextStatus: 'idle',
  journalContextLocked: false,
  generateJournalContext: async () => {},
  toggleJournalContextLock: async () => {},
  todoContextData: null,
  todoContextStatus: 'idle',
  todoContextLocked: false,
  generateTodoContext: async () => {},
  toggleTodoContextLock: async () => {},
  goalContextData: null,
  goalContextStatus: 'idle',
  goalContextLocked: false,
  generateGoalContext: async () => {},
  toggleGoalContextLock: async () => {},
  financeContextData: null,
  financeContextStatus: 'idle',
  financeContextLocked: false,
  generateFinanceContext: async () => {},
  toggleFinanceContextLock: async () => {},
  consolidatedContextData: null,
  consolidatedContextStatus: 'idle',
  consolidatedContextLocked: false,
  generateConsolidatedContext: async () => {},
  toggleConsolidatedContextLock: async () => {},
  streakContextData: null,
  streakContextStatus: 'idle',
  streakContextLocked: false,
  generateStreakContext: async () => {},
  toggleStreakContextLock: async () => {},
  scheduleContextData: null,
  scheduleContextStatus: 'idle',
  scheduleContextLocked: false,
  generateScheduleContext: async () => {},
  toggleScheduleContextLock: async () => {},
});

// ─── localStorage helpers ─────────────────────────────────────────────────────

const LS_JOURNAL = 'reFetchJournalsLocked';
const LS_TODO    = 'reFetchTodosLocked';
const LS_GOAL    = 'reFetchGoalsLocked';
const LS_FINANCE = 'reFetchFinanceLocked';
const LS_CONSOLIDATED = 'reFetchConsolidatedLocked';
const LS_STREAK = 'reFetchStreaksLocked';
const LS_SCHEDULE = 'reFetchSchedulesLocked';

function getLock(key: string): boolean {
  try { return localStorage.getItem(key) === 'true'; } catch { return false; }
}
function setLock(key: string, value: boolean) {
  try { localStorage.setItem(key, String(value)); } catch { /* silent */ }
}

function toDateStr(val: Timestamp | Date | undefined | null): string {
  if (!val) return '';
  const d = val instanceof Date ? val : val.toDate();
  return d.toISOString().split('T')[0];
}

function getMs(val: Timestamp | Date | unknown): number {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  const obj = val as { toDate?: () => Date; seconds?: number };
  if (typeof obj.toDate === 'function') return obj.toDate().getTime();
  if (typeof obj.seconds === 'number') return obj.seconds * 1000;
  return 0;
}


// ─── Provider ─────────────────────────────────────────────────────────────────

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);

  // Journal context state
  const [journalContextData, setJournalContextData] = useState<JournalContextData | null>(null);
  const [journalContextStatus, setJournalContextStatus] = useState<ContextStatus>('idle');
  const [journalContextLocked, setJournalContextLocked] = useState(false);

  // Todo context state
  const [todoContextData, setTodoContextData] = useState<TodoContextData | null>(null);
  const [todoContextStatus, setTodoContextStatus] = useState<ContextStatus>('idle');
  const [todoContextLocked, setTodoContextLocked] = useState(false);

  // Goal context state
  const [goalContextData, setGoalContextData] = useState<GoalContextData | null>(null);
  const [goalContextStatus, setGoalContextStatus] = useState<ContextStatus>('idle');
  const [goalContextLocked, setGoalContextLocked] = useState(false);

  // Finance context state
  const [financeContextData, setFinanceContextData] = useState<FinanceContextData | null>(null);
  const [financeContextStatus, setFinanceContextStatus] = useState<ContextStatus>('idle');
  const [financeContextLocked, setFinanceContextLocked] = useState(false);

  // Consolidated context state
  const [consolidatedContextData, setConsolidatedContextData] = useState<ConsolidatedContextData | null>(null);
  const [consolidatedContextStatus, setConsolidatedContextStatus] = useState<ContextStatus>('idle');
  const [consolidatedContextLocked, setConsolidatedContextLocked] = useState(false);

  // Streak context state
  const [streakContextData, setStreakContextData] = useState<StreakContextData | null>(null);
  const [streakContextStatus, setStreakContextStatus] = useState<ContextStatus>('idle');
  const [streakContextLocked, setStreakContextLocked] = useState(false);

  // Schedule context state
  const [scheduleContextData, setScheduleContextData] = useState<ScheduleContextData | null>(null);
  const [scheduleContextStatus, setScheduleContextStatus] = useState<ContextStatus>('idle');
  const [scheduleContextLocked, setScheduleContextLocked] = useState(false);

  // Fires once after Firestore lock status is known — prevents premature auto-triggers
  const [contextLoaded, setContextLoaded] = useState(false);

  // ── Auth effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    let unsubscribeOnboarding: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔍 Firebase auth state changed:', firebaseUser ? 'User logged in' : 'No user');

      if (unsubscribeOnboarding) { unsubscribeOnboarding(); unsubscribeOnboarding = null; }

      if (firebaseUser) {
        try {
          const ref = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(ref);

          if (snap.exists()) {
            const data = snap.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              role: data.role || 'viewer',
              createdAt: data.createdAt,
              isGuest: false,
            });
            setIsGuest(false);
            Cookies.set('uid', firebaseUser.uid, { expires: 7, path: '/' });
            Cookies.set('role', data.role || 'viewer', { expires: 7, path: '/' });
            console.log('✅ Firebase user authenticated and cookies set');
          } else {
            console.warn('⚠️ No Firestore user document found.');
            Cookies.remove('uid', { path: '/' });
            Cookies.remove('role', { path: '/' });
            setUser(null);
            setIsGuest(false);
          }
        } catch (err) {
          console.error('❌ Error fetching Firestore user:', err);
          Cookies.remove('uid', { path: '/' });
          Cookies.remove('role', { path: '/' });
          setUser(null);
          setIsGuest(false);
        }

        unsubscribeOnboarding = onSnapshot(
          doc(db, 'initialOnboarding', firebaseUser.uid),
          (snap) => {
            setOnboardingData(snap.exists() ? (snap.data() as OnboardingData) : null);
          },
          (err) => console.error('❌ Error listening to initialOnboarding:', err)
        );
      } else {
        console.log('🔍 No Firebase user, checking for guest user');
        Cookies.remove('uid', { path: '/' });
        Cookies.remove('role', { path: '/' });
        setUser(getOrCreateGuestUser());
        setIsGuest(true);
        setOnboardingData(null);
      }

      setLoading(false);
    });

    return () => { unsubscribeAuth(); if (unsubscribeOnboarding) unsubscribeOnboarding(); };
  }, []);

  // ── Load saved contexts from Firestore once per session ───────────────────
  useEffect(() => {
    if (!user || isGuest) {
      setJournalContextData(null);
      setJournalContextLocked(false);
      setTodoContextData(null);
      setTodoContextLocked(false);
      setGoalContextData(null);
      setGoalContextLocked(false);
      setFinanceContextData(null);
      setFinanceContextLocked(false);
      setConsolidatedContextData(null);
      setConsolidatedContextLocked(false);
      setStreakContextData(null);
      setStreakContextLocked(false);
      setScheduleContextData(null);
      setScheduleContextLocked(false);
      return;
    }

    const load = async () => {
      try {
        const ref = doc(db, 'context', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();

          // Journal context
          const jc = data?.journalContext as JournalContextData | undefined;
          if (jc) {
            setJournalContextData(jc);
            setJournalContextLocked(jc.locked ?? false);
            setLock(LS_JOURNAL, jc.locked ?? false);
          } else {
            setJournalContextLocked(getLock(LS_JOURNAL));
          }

          // Todo context
          const tc = data?.todoContext as TodoContextData | undefined;
          if (tc) {
            setTodoContextData(tc);
            setTodoContextLocked(tc.locked ?? false);
            setLock(LS_TODO, tc.locked ?? false);
          } else {
            setTodoContextLocked(getLock(LS_TODO));
          }

          // Goal context
          const gc = data?.goalContext as GoalContextData | undefined;
          if (gc) {
            setGoalContextData(gc);
            setGoalContextLocked(gc.locked ?? false);
            setLock(LS_GOAL, gc.locked ?? false);
          } else {
            setGoalContextLocked(getLock(LS_GOAL));
          }

          // Finance context
          const fc = data?.financeContext as FinanceContextData | undefined;
          if (fc) {
            setFinanceContextData(fc);
            setFinanceContextLocked(fc.locked ?? false);
            setLock(LS_FINANCE, fc.locked ?? false);
          } else {
            setFinanceContextLocked(getLock(LS_FINANCE));
          }

          // Consolidated context
          const cc = data?.consolidatedContext as ConsolidatedContextData | undefined;
          if (cc) {
            setConsolidatedContextData(cc);
            setConsolidatedContextLocked(cc.locked ?? false);
            setLock(LS_CONSOLIDATED, cc.locked ?? false);
          } else {
            setConsolidatedContextLocked(getLock(LS_CONSOLIDATED));
          }

          // Streak context
          const sc = data?.streakContext as StreakContextData | undefined;
          if (sc) {
            setStreakContextData(sc);
            setStreakContextLocked(sc.locked ?? false);
            setLock(LS_STREAK, sc.locked ?? false);
          } else {
            setStreakContextLocked(getLock(LS_STREAK));
          }

          // Schedule context
          const schC = data?.scheduleContext as ScheduleContextData | undefined;
          if (schC) {
            setScheduleContextData(schC);
            setScheduleContextLocked(schC.locked ?? false);
            setLock(LS_SCHEDULE, schC.locked ?? false);
          } else {
            setScheduleContextLocked(getLock(LS_SCHEDULE));
          }
        } else {
          setJournalContextLocked(getLock(LS_JOURNAL));
          setTodoContextLocked(getLock(LS_TODO));
          setGoalContextLocked(getLock(LS_GOAL));
          setFinanceContextLocked(getLock(LS_FINANCE));
          setConsolidatedContextLocked(getLock(LS_CONSOLIDATED));
          setStreakContextLocked(getLock(LS_STREAK));
          setScheduleContextLocked(getLock(LS_SCHEDULE));
        }
      } catch (err) {
        console.error('❌ Error loading contexts from Firestore:', err);
        setJournalContextLocked(getLock(LS_JOURNAL));
        setTodoContextLocked(getLock(LS_TODO));
        setGoalContextLocked(getLock(LS_GOAL));
        setFinanceContextLocked(getLock(LS_FINANCE));
        setConsolidatedContextLocked(getLock(LS_CONSOLIDATED));
        setStreakContextLocked(getLock(LS_STREAK));
        setScheduleContextLocked(getLock(LS_SCHEDULE));
      }
    };

    load().then(() => setContextLoaded(true));
  }, [user, isGuest]);

  // ── Auto-trigger both contexts globally once contextLoaded is true ─────────
  // UserProvider wraps the entire app, so this fires on ANY page the user lands on.
  useEffect(() => {
    if (!contextLoaded || !user || isGuest) return;

    if (!getLock(LS_JOURNAL)) {
      console.log('🌍 Global auto-trigger: generating journal context...');
      generateJournalContext();
    } else {
      console.log('🔒 Journal context auto-trigger skipped (locked).');
    }

    if (!getLock(LS_TODO)) {
      console.log('🌍 Global auto-trigger: generating todo context...');
      generateTodoContext();
    } else {
      console.log('🔒 Todo context auto-trigger skipped (locked).');
    }

    if (!getLock(LS_GOAL)) {
      console.log('🌍 Global auto-trigger: generating goal context...');
      generateGoalContext();
    } else {
      console.log('🔒 Goal context auto-trigger skipped (locked).');
    }

    if (!getLock(LS_FINANCE)) {
      console.log('🌍 Global auto-trigger: generating finance context...');
      generateFinanceContext();
    } else {
      console.log('🔒 Finance context auto-trigger skipped (locked).');
    }

    if (!getLock(LS_CONSOLIDATED)) {
      console.log('🌍 Global auto-trigger: generating consolidated context...');
      generateConsolidatedContext();
    } else {
      console.log('🔒 Consolidated context auto-trigger skipped (locked).');
    }

    if (!getLock(LS_STREAK)) {
      console.log('🌍 Global auto-trigger: generating streak context...');
      generateStreakContext();
    } else {
      console.log('🔒 Streak context auto-trigger skipped (locked).');
    }

    if (!getLock(LS_SCHEDULE)) {
      console.log('🌍 Global auto-trigger: generating schedule context...');
      generateScheduleContext();
    } else {
      console.log('🔒 Schedule context auto-trigger skipped (locked).');
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextLoaded]); // Runs exactly once after Firestore load completes

  // ── Generate Journal Context ───────────────────────────────────────────────
  const generateJournalContext = useCallback(async () => {
    if (!user || isGuest) return;
    if (getLock(LS_JOURNAL)) {
      console.log('🔒 Journal context locked (localStorage). Skipping.');
      return;
    }

    // Firestore double-check
    try {
      const snap = await getDoc(doc(db, 'context', user.uid));
      if (snap.exists() && snap.data()?.journalContext?.locked) {
        setLock(LS_JOURNAL, true);
        setJournalContextLocked(true);
        return;
      }
    } catch { /* continue */ }

    setJournalContextStatus('fetching');
    try {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const snapshot = await getDocs(query(
        collection(db, 'journals'),
        where('userId', '==', user.uid)
      ));

      const fifteenDaysAgoMs = fifteenDaysAgo.getTime();

      const journals = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || '',
            content: data.content || '',
            mood: data.mood || null,
            productivityOfTheDay: data.productivityOfTheDay || '',
            tags: data.tags || [],
            date: data.date || toDateStr(data.createdAt),
            createdAt: data.createdAt,
          };
        })
        .filter((j) => {
          const createdMs = getMs(j.createdAt);
          return createdMs >= fifteenDaysAgoMs;
        });

      if (journals.length === 0) {
        console.log('📔 No journals found in last 15 days.');
        setJournalContextStatus('idle');
        return;
      }

      setJournalContextStatus('generating');
      const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined;
      const res = await fetch('/api/context/journal-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journals, userName }),
      });
      if (!res.ok) throw new Error('AI summary API failed');
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      const contextData: JournalContextData = {
        summary: result.summary,
        journalCount: result.journalCount,
        generatedAt: new Date().toISOString(),
        locked: true,
      };

      await setDoc(doc(db, 'context', user.uid), { userId: user.uid, journalContext: contextData, updatedAt: new Date().toISOString() }, { merge: true });
      setLock(LS_JOURNAL, true);
      setJournalContextData(contextData);
      setJournalContextLocked(true);
      setJournalContextStatus('saved');
      console.log('✅ Journal context generated and saved.');
    } catch (err) {
      console.error('❌ Error generating journal context:', err);
      setJournalContextStatus('error');
    }
  }, [user, isGuest]);

  // ── Toggle Journal Context Lock ────────────────────────────────────────────
  const toggleJournalContextLock = useCallback(async (locked: boolean) => {
    if (!user || isGuest) return;
    setLock(LS_JOURNAL, locked);
    setJournalContextLocked(locked);
    try {
      await setDoc(doc(db, 'context', user.uid),
        { journalContext: { ...(journalContextData || {}), locked }, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      if (journalContextData) setJournalContextData({ ...journalContextData, locked });
    } catch (err) { console.error('❌ Error updating journal lock:', err); }
  }, [user, isGuest, journalContextData]);

  // ── Generate Todo Context ──────────────────────────────────────────────────
  const generateTodoContext = useCallback(async () => {
    if (!user || isGuest) return;
    if (getLock(LS_TODO)) {
      console.log('🔒 Todo context locked (localStorage). Skipping.');
      return;
    }

    // Firestore double-check
    try {
      const snap = await getDoc(doc(db, 'context', user.uid));
      if (snap.exists() && snap.data()?.todoContext?.locked) {
        setLock(LS_TODO, true);
        setTodoContextLocked(true);
        return;
      }
    } catch { /* continue */ }

    setTodoContextStatus('fetching');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const today = new Date();

      const allSnap = await getDocs(query(
        collection(db, 'todos'),
        where('authorId', '==', user.uid)
      ));

      type RawTodo = {
        id: string;
        title: string;
        priority: string;
        progressPercent: number;
        status: string;
        startDate?: Timestamp | Date;
        createdAt?: Timestamp | Date;
        completedAt?: Timestamp | Date;
        dueDate?: Timestamp | Date;
        tags?: string[];
        isArchived?: boolean;
        rescheduleCounts?: number;
        steps?: {
          done: boolean;
          status: 'in_progress' | 'completed' | 'hold' | 'left-over';
        }[];
      };

      const allDocs: RawTodo[] = allSnap.docs.map((d) => ({ id: d.id, ...d.data() } as RawTodo));

      // Separate completed (last 30 days) vs active (last 30 days), excluding archived
      const recentDocs = allDocs.filter((d) => {
        if (d.isArchived === true) return false;
        const createdMs = getMs(d.createdAt);
        return createdMs >= thirtyDaysAgo.getTime();
      });

      const completedDocs = recentDocs.filter((d) => d.status === 'completed');
      const activeDocs = recentDocs.filter((d) => d.status === 'in_progress' || d.status === 'hold');

      const totalCompletedCount = completedDocs.length;
      const totalActiveCount = activeDocs.length;

      if (totalCompletedCount === 0 && totalActiveCount === 0) {
        console.log('📋 No todos found in last 30 days.');
        setTodoContextStatus('idle');
        return;
      }

      // Helper: days passed from a date to today
      const daysPassed = (val: Timestamp | Date | undefined | null): number => {
        if (!val) return 0;
        const d = val instanceof Date ? val : (val as Timestamp).toDate();
        return Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86400000));
      };

      // 5 most recent completed — sort by completedAt desc, fallback to updatedAt/createdAt
      const sampledCompleted = [...completedDocs]
        .sort((a, b) => {
          const da = a.completedAt ?? a.createdAt;
          const db2 = b.completedAt ?? b.createdAt;
          const ta = da instanceof Date ? da.getTime() : (da as Timestamp)?.toDate?.()?.getTime?.() ?? 0;
          const tb = db2 instanceof Date ? db2.getTime() : (db2 as Timestamp)?.toDate?.()?.getTime?.() ?? 0;
          return tb - ta;
        })
        .slice(0, 5)
        .map((t) => {
          const metrics = getTaskMetrics({
            createdAt: t.createdAt,
            dueDate: t.dueDate,
            rescheduleCounts: t.rescheduleCounts,
            status: t.status,
            progressPercent: t.progressPercent,
            steps: t.steps,
          });
          return {
            title: t.title,
            priority: t.priority,
            completedAt: toDateStr(t.completedAt as Timestamp | Date | null ?? t.createdAt as Timestamp | Date | null),
            progressPercent: metrics.progress,
            progressLabel: metrics.progressLabel,
            pace: metrics.pace,
            rescheduleStatus: metrics.rescheduleStatus,
            staleness: metrics.staleness,
          };
        });

      // 5 most latest active — sort by createdAt desc, include daysPassed and progress
      const sampledActive = [...activeDocs]
        .sort((a, b) => {
          const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as Timestamp)?.toDate?.()?.getTime?.() ?? 0;
          const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as Timestamp)?.toDate?.()?.getTime?.() ?? 0;
          return tb - ta;
        })
        .slice(0, 5)
        .map((t) => {
          const metrics = getTaskMetrics({
            createdAt: t.createdAt,
            dueDate: t.dueDate,
            rescheduleCounts: t.rescheduleCounts,
            status: t.status,
            progressPercent: t.progressPercent,
            steps: t.steps,
          });
          return {
            title: t.title,
            priority: t.priority,
            progressPercent: metrics.progress,
            progressLabel: metrics.progressLabel,
            pace: metrics.pace,
            rescheduleStatus: metrics.rescheduleStatus,
            staleness: metrics.staleness,
            status: t.status,
            daysPassed: daysPassed(t.startDate ?? t.createdAt),
            createdAt: toDateStr(t.createdAt as Timestamp | Date | null),
            dueDate: toDateStr(t.dueDate as Timestamp | Date | null),
          };
        });

      setTodoContextStatus('generating');
      const res = await fetch('/api/context/todo-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedTodos: sampledCompleted,
          activeTodos: sampledActive,
          totalCompletedCount,
          totalActiveCount,
        }),
      });
      if (!res.ok) throw new Error('Todo summary API failed');
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      const aggregateSummary = generateTodoAnalysisSummary(
        activeDocs.map((t) => ({
          createdAt: t.createdAt,
          dueDate: t.dueDate,
          rescheduleCounts: t.rescheduleCounts,
          status: t.status,
          progressPercent: t.progressPercent,
          steps: t.steps,
        })),
        totalCompletedCount
      );

      const contextData: TodoContextData = {
        summary: result.summary,
        totalCompletedCount,
        totalActiveCount,
        sampledCompletedCount: sampledCompleted.length,
        sampledActiveCount: sampledActive.length,
        generatedAt: new Date().toISOString(),
        locked: true,
        sampledCompleted,
        sampledActive,
        aggregateSummary,
      };

      await setDoc(doc(db, 'context', user.uid), { userId: user.uid, todoContext: contextData, updatedAt: new Date().toISOString() }, { merge: true });
      setLock(LS_TODO, true);
      setTodoContextData(contextData);
      setTodoContextLocked(true);
      setTodoContextStatus('saved');
      console.log('✅ Todo context generated and saved.');
    } catch (err) {
      console.error('❌ Error generating todo context:', err);
      setTodoContextStatus('error');
    }
  }, [user, isGuest]);

  // ── Toggle Todo Context Lock ───────────────────────────────────────────────
  const toggleTodoContextLock = useCallback(async (locked: boolean) => {
    if (!user || isGuest) return;
    setLock(LS_TODO, locked);
    setTodoContextLocked(locked);
    try {
      await setDoc(doc(db, 'context', user.uid),
        { todoContext: { ...(todoContextData || {}), locked }, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      if (todoContextData) setTodoContextData({ ...todoContextData, locked });
    } catch (err) { console.error('❌ Error updating todo lock:', err); }
  }, [user, isGuest, todoContextData]);

  // ── Generate Goal Context ──────────────────────────────────────────────────
  const generateGoalContext = useCallback(async () => {
    if (!user || isGuest) return;
    if (getLock(LS_GOAL)) {
      console.log('🔒 Goal context locked (localStorage). Skipping.');
      return;
    }

    // Firestore double-check
    try {
      const snap = await getDoc(doc(db, 'context', user.uid));
      if (snap.exists() && snap.data()?.goalContext?.locked) {
        setLock(LS_GOAL, true);
        setGoalContextLocked(true);
        return;
      }
    } catch { /* continue */ }

    setGoalContextStatus('fetching');
    try {
      const goalsSnap = await getDocs(query(
        collection(db, 'goals'),
        where('userId', '==', user.uid)
      ));

      const allGoals = goalsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
        } as Goal;
      });

      // Filter: completed vs active (excluding archived)
      const nonArchivedGoals = allGoals.filter((g) => g.isArchived !== true);
      const completedGoals = nonArchivedGoals.filter((g) => g.status === 'Completed');
      const activeGoals = nonArchivedGoals.filter((g) => g.status !== 'Completed');

      const totalCompletedCount = completedGoals.length;
      const totalActiveCount = activeGoals.length;

      if (totalCompletedCount === 0 && totalActiveCount === 0) {
        console.log('📋 No goals found.');
        setGoalContextStatus('idle');
        return;
      }

      // Check-ins in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoMs = thirtyDaysAgo.getTime();

      let checkInsLast30Days = 0;
      let totalConsistencySum = 0;
      let trackerGoalsCount = 0;

      activeGoals.forEach((g) => {
        if (g.trackerEnabled && g.tracker) {
          trackerGoalsCount++;
          // Consistency calculation
          const checkIns = g.tracker.checkIns || [];
          const todayStr = new Date().toISOString().split('T')[0];
          const pastCheckIns = checkIns.filter((c) => c.scheduledDate <= todayStr);
          const doneCheckIns = checkIns.filter((c) => c.completed);
          const consistency = pastCheckIns.length > 0
            ? Math.round((doneCheckIns.length / pastCheckIns.length) * 100)
            : 100;
          totalConsistencySum += consistency;

          // Count check-ins completed in the last 30 days
          checkIns.forEach((c) => {
            if (c.completed && c.completedAt) {
              const completedMs = getMs(new Date(c.completedAt));
              if (completedMs >= thirtyDaysAgoMs) {
                checkInsLast30Days++;
              }
            }
          });
        }
      });

      const overallConsistency = trackerGoalsCount > 0
        ? Math.round(totalConsistencySum / trackerGoalsCount)
        : 100;

      // Sample 5 completed goals (most recent, sorting by completedAt or createdAt)
      const sampledCompleted = [...completedGoals]
        .sort((a, b) => {
          const ta = getMs(a.completedAt || a.createdAt);
          const tb = getMs(b.completedAt || b.createdAt);
          return tb - ta;
        })
        .slice(0, 5)
        .map((g) => ({
          title: g.title,
          completedAt: toDateStr(g.completedAt || g.createdAt),
        }));

      // Sample 5 active goals (most recent, sorting by updatedAt or createdAt)
      const sampledActive = [...activeGoals]
        .sort((a, b) => {
          const ta = getMs(a.updatedAt || a.createdAt);
          const tb = getMs(b.updatedAt || b.createdAt);
          return tb - ta;
        })
        .slice(0, 5)
        .map((g) => ({
          title: g.title,
          progress: g.progress || 0,
          priority: g.priority || 'Medium',
          frequency: g.trackerEnabled && g.tracker ? g.tracker.frequency : undefined,
          consistency: g.trackerEnabled && g.tracker ? (() => {
            const checkIns = g.tracker.checkIns || [];
            const todayStr = new Date().toISOString().split('T')[0];
            const pastCheckIns = checkIns.filter((c) => c.scheduledDate <= todayStr);
            const doneCheckIns = checkIns.filter((c) => c.completed);
            return pastCheckIns.length > 0 ? Math.round((doneCheckIns.length / pastCheckIns.length) * 100) : 100;
          })() : undefined,
        }));

      setGoalContextStatus('generating');
      const res = await fetch('/api/context/goal-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedGoals: sampledCompleted,
          activeGoals: sampledActive,
          totalCompletedCount,
          totalActiveCount,
          checkInsLast30Days,
          overallConsistency,
        }),
      });
      if (!res.ok) throw new Error('Goal summary API failed');
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      const contextData: GoalContextData = {
        summary: result.summary,
        totalCompletedCount,
        totalActiveCount,
        sampledCompletedCount: sampledCompleted.length,
        sampledActiveCount: sampledActive.length,
        checkInsLast30Days,
        overallConsistency,
        generatedAt: new Date().toISOString(),
        locked: true,
      };

      await setDoc(doc(db, 'context', user.uid), { userId: user.uid, goalContext: contextData, updatedAt: new Date().toISOString() }, { merge: true });
      setLock(LS_GOAL, true);
      setGoalContextData(contextData);
      setGoalContextLocked(true);
      setGoalContextStatus('saved');
      console.log('✅ Goal context generated and saved.');
    } catch (err) {
      console.error('❌ Error generating goal context:', err);
      setGoalContextStatus('error');
    }
  }, [user, isGuest]);

  // ── Toggle Goal Context Lock ───────────────────────────────────────────────
  const toggleGoalContextLock = useCallback(async (locked: boolean) => {
    if (!user || isGuest) return;
    setLock(LS_GOAL, locked);
    setGoalContextLocked(locked);
    try {
      await setDoc(doc(db, 'context', user.uid),
        { goalContext: { ...(goalContextData || {}), locked }, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      if (goalContextData) setGoalContextData({ ...goalContextData, locked });
    } catch (err) { console.error('❌ Error updating goal lock:', err); }
  }, [user, isGuest, goalContextData]);

  // ── Generate Finance Context ───────────────────────────────────────────────
  const generateFinanceContext = useCallback(async () => {
    if (!user || isGuest) return;
    if (getLock(LS_FINANCE)) {
      console.log('🔒 Finance context locked (localStorage). Skipping.');
      return;
    }

    // Firestore double-check
    try {
      const snap = await getDoc(doc(db, 'context', user.uid));
      if (snap.exists() && snap.data()?.financeContext?.locked) {
        setLock(LS_FINANCE, true);
        setFinanceContextLocked(true);
        return;
      }
    } catch { /* continue */ }

    setFinanceContextStatus('fetching');
    try {
      // 1. Fetch total cash snapshot
      const cashRef = doc(db, 'totalCashSnapshots', user.uid);
      const cashSnap = await getDoc(cashRef);

      let availableAmount = 0;
      let freezeAmount = 0;
      let totalAmount = 0;
      let breakdown = 'none';

      if (cashSnap.exists()) {
        const cashData = cashSnap.data() as TotalCashSnapshot;
        totalAmount = cashData.totalAmount || 0;
        freezeAmount = cashData.freezeAmount || 0;
        availableAmount = totalAmount - freezeAmount;

        const src = cashData.sources;
        if (src) {
          const breakdownItems: string[] = [];
          if (src.in_hand) breakdownItems.push(`In Hand: PKR ${src.in_hand}`);
          if (src.easypaisa) breakdownItems.push(`Easypaisa: PKR ${src.easypaisa}`);
          if (src.jazzcash) breakdownItems.push(`Jazzcash: PKR ${src.jazzcash}`);
          if (src.other) breakdownItems.push(`Other: PKR ${src.other}`);
          if (src.bank) {
            Object.entries(src.bank).forEach(([bankName, val]) => {
              if (val) breakdownItems.push(`Bank (${bankName}): PKR ${val}`);
            });
          }
          if (src.custom) {
            Object.entries(src.custom).forEach(([headName, val]) => {
              if (val) breakdownItems.push(`${headName}: PKR ${val}`);
            });
          }
          if (breakdownItems.length > 0) breakdown = breakdownItems.join(', ');
        }
      }

      // 2. Fetch expenditures (upcoming/unpaid)
      const expSnap = await getDocs(query(
        collection(db, 'expenditures'),
        where('userId', '==', user.uid)
      ));
      const allExpenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() } as Expenditure));
      const upcomingExpenses = allExpenses.filter(e => !e.isPaid);
      const upcomingExpensesCount = upcomingExpenses.length;
      const upcomingExpensesTotal = upcomingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      const expensesDetail = upcomingExpenses
        .slice(0, 3)
        .map(e => `"${e.title}" (PKR ${e.amount})`)
        .join(', ');

      // 3. Fetch loans (outstanding/unsettled)
      const loansSnap = await getDocs(query(
        collection(db, 'loans'),
        where('userId', '==', user.uid)
      ));
      const allLoans = loansSnap.docs.map(d => ({ id: d.id, ...d.data() } as LoanRecord));
      const outstandingLoans = allLoans.filter(l => !l.isSettled);
      const borrowLoans = outstandingLoans.filter(l => l.type === 'borrow');
      const lendLoans = outstandingLoans.filter(l => l.type === 'lend');

      const outstandingBorrowTotal = borrowLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
      const outstandingLendTotal = lendLoans.reduce((sum, l) => sum + (l.amount || 0), 0);

      const borrowDetail = borrowLoans.map(l => `Owes ${l.counterparty} PKR ${l.amount}`).join(', ');
      const lendDetail = lendLoans.map(l => `${l.counterparty} owes User PKR ${l.amount}`).join(', ');
      const loansDetail = `Borrowings: [${borrowDetail || 'none'}], Lendings: [${lendDetail || 'none'}]`;

      setFinanceContextStatus('generating');
      const res = await fetch('/api/context/finance-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availableAmount,
          freezeAmount,
          totalAmount,
          upcomingExpensesCount,
          upcomingExpensesTotal,
          outstandingBorrowTotal,
          outstandingLendTotal,
          expensesDetail,
          loansDetail,
          breakdown,
        }),
      });

      if (!res.ok) throw new Error('Finance summary API failed');
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      const contextData: FinanceContextData = {
        summary: result.summary,
        availableAmount,
        freezeAmount,
        totalAmount,
        upcomingExpensesCount,
        upcomingExpensesTotal,
        outstandingBorrowTotal,
        outstandingLendTotal,
        generatedAt: new Date().toISOString(),
        locked: true,
      };

      await setDoc(doc(db, 'context', user.uid), { userId: user.uid, financeContext: contextData, updatedAt: new Date().toISOString() }, { merge: true });
      setLock(LS_FINANCE, true);
      setFinanceContextData(contextData);
      setFinanceContextLocked(true);
      setFinanceContextStatus('saved');
      console.log('✅ Finance context generated and saved.');
    } catch (err) {
      console.error('❌ Error generating finance context:', err);
      setFinanceContextStatus('error');
    }
  }, [user, isGuest]);

  // ── Toggle Finance Context Lock ────────────────────────────────────────────
  const toggleFinanceContextLock = useCallback(async (locked: boolean) => {
    if (!user || isGuest) return;
    setLock(LS_FINANCE, locked);
    setFinanceContextLocked(locked);
    try {
      await setDoc(doc(db, 'context', user.uid),
        { financeContext: { ...(financeContextData || {}), locked }, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      if (financeContextData) setFinanceContextData({ ...financeContextData, locked });
    } catch (err) { console.error('❌ Error updating finance lock:', err); }
  }, [user, isGuest, financeContextData]);

  // ── Generate Streak Context ───────────────────────────────────────────────
  const generateStreakContext = useCallback(async () => {
    if (!user || isGuest) return;
    if (getLock(LS_STREAK)) {
      console.log('🔒 Streak context locked (localStorage). Skipping.');
      return;
    }

    // Firestore double-check
    try {
      const snap = await getDoc(doc(db, 'context', user.uid));
      if (snap.exists() && snap.data()?.streakContext?.locked) {
        setLock(LS_STREAK, true);
        setStreakContextLocked(true);
        return;
      }
    } catch { /* continue */ }

    setStreakContextStatus('fetching');
    try {
      const streaksSnap = await getDocs(query(
        collection(db, 'streaks'),
        where('userId', '==', user.uid)
      ));

      const streaks = streaksSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
        } as StreakProps;
      });

      const totalCount = streaks.length;
      if (totalCount === 0) {
        console.log('🔥 No streaks found.');
        setStreakContextStatus('idle');
        return;
      }

      // Calculate average and longest streak
      const totalStreakSum = streaks.reduce((sum, s) => sum + (s.streaksCount || 0), 0);
      const averageStreak = parseFloat((totalStreakSum / totalCount).toFixed(1));
      const longestStreak = streaks.reduce((max, s) => Math.max(max, s.streaksCount || 0), 0);

      const sampledStreaks = streaks.map(s => ({
        title: s.title,
        category: s.category || 'General',
        habitType: s.habitType,
        currentStreak: s.streaksCount || 0,
        lastChecked: s.lastChecked ? toDateStr(s.lastChecked) : 'Never',
      }));

      setStreakContextStatus('generating');
      const res = await fetch('/api/context/streak-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streaks: sampledStreaks,
          totalCount,
          averageStreak,
          longestStreak,
        }),
      });

      if (!res.ok) throw new Error('Streak summary API failed');
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      const contextData: StreakContextData = {
        summary: result.summary,
        totalCount,
        averageStreak,
        longestStreak,
        generatedAt: new Date().toISOString(),
        locked: true,
      };

      await setDoc(doc(db, 'context', user.uid), { userId: user.uid, streakContext: contextData, updatedAt: new Date().toISOString() }, { merge: true });
      setLock(LS_STREAK, true);
      setStreakContextData(contextData);
      setStreakContextLocked(true);
      setStreakContextStatus('saved');
      console.log('✅ Streak context generated and saved.');
    } catch (err) {
      console.error('❌ Error generating streak context:', err);
      setStreakContextStatus('error');
    }
  }, [user, isGuest]);

  // ── Toggle Streak Context Lock ─────────────────────────────────────────────
  const toggleStreakContextLock = useCallback(async (locked: boolean) => {
    if (!user || isGuest) return;
    setLock(LS_STREAK, locked);
    setStreakContextLocked(locked);
    try {
      await setDoc(doc(db, 'context', user.uid),
        { streakContext: { ...(streakContextData || {}), locked }, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      if (streakContextData) setStreakContextData({ ...streakContextData, locked });
    } catch (err) { console.error('❌ Error updating streak lock:', err); }
  }, [user, isGuest, streakContextData]);

  // ── Generate Schedule Context ──────────────────────────────────────────────
  const generateScheduleContext = useCallback(async () => {
    if (!user || isGuest) return;
    if (getLock(LS_SCHEDULE)) {
      console.log('🔒 Schedule context locked (localStorage). Skipping.');
      return;
    }

    // Firestore double-check
    try {
      const snap = await getDoc(doc(db, 'context', user.uid));
      if (snap.exists() && snap.data()?.scheduleContext?.locked) {
        setLock(LS_SCHEDULE, true);
        setScheduleContextLocked(true);
        return;
      }
    } catch { /* continue */ }

    setScheduleContextStatus('fetching');
    try {
      const schedulesSnap = await getDocs(query(
        collection(db, 'schedules'),
        where('userId', '==', user.uid)
      ));

      const allSchedules = schedulesSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
        } as SchedulesProps;
      });

      const getYYYYMMDD = (d: Date): string => {
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${da}`;
      };

      // Define a 20-day window: [today - 19 days, today]
      const today = new Date();
      const days: string[] = [];
      for (let i = 19; i >= 0; i--) {
        const temp = new Date(today);
        temp.setDate(today.getDate() - i);
        days.push(getYYYYMMDD(temp));
      }

      let totalCountForWindow = 0;

      days.forEach((dayStr) => {
        const dailyItems = allSchedules.filter((s) => {
          if (s.status === 'cancelled') return false;
          if (s.isFlexible) {
            // Flexible/daily schedules created on or before dayStr
            const createdDateStr = s.createdAt ? toDateStr(s.createdAt) : '';
            return createdDateStr && createdDateStr <= dayStr;
          } else {
            // Specific date schedule
            return s.date === dayStr;
          }
        });
        totalCountForWindow += dailyItems.length;
      });

      const averageDailySchedules = parseFloat((totalCountForWindow / 20).toFixed(1));
      const totalCount = allSchedules.filter((s) => s.status !== 'cancelled').length;
      const flexibleCount = allSchedules.filter((s) => s.isFlexible && s.status !== 'cancelled').length;

      // Sample 5 active schedules (preferring flexible first, then sorted by date and startTime)
      const sampledSchedules = allSchedules
        .filter((s) => s.status !== 'cancelled')
        .sort((a, b) => {
          if (a.isFlexible && !b.isFlexible) return -1;
          if (!a.isFlexible && b.isFlexible) return 1;
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.startTime.localeCompare(b.startTime);
        })
        .slice(0, 5)
        .map((s) => ({
          title: s.title,
          isFlexible: s.isFlexible || false,
          startTime: s.startTime || '',
          endTime: s.endTime || '',
          duration: s.duration || 0,
          priority: s.priority || 'medium',
          objective: s.objective || '',
        }));

      setScheduleContextStatus('generating');
      const res = await fetch('/api/context/schedule-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedules: sampledSchedules,
          totalCount,
          averageDailySchedules,
          flexibleCount,
        }),
      });

      if (!res.ok) throw new Error('Schedule summary API failed');
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      const manualMetrics = getScheduleMetrics(allSchedules);

      const contextData: ScheduleContextData = {
        summary: result.summary,
        totalCount,
        averageDailySchedules,
        flexibleCount,
        generatedAt: new Date().toISOString(),
        locked: true,
        manualMetrics,
      };

      await setDoc(doc(db, 'context', user.uid), { userId: user.uid, scheduleContext: contextData, updatedAt: new Date().toISOString() }, { merge: true });
      setLock(LS_SCHEDULE, true);
      setScheduleContextData(contextData);
      setScheduleContextLocked(true);
      setScheduleContextStatus('saved');
      console.log('✅ Schedule context generated and saved.');
    } catch (err) {
      console.error('❌ Error generating schedule context:', err);
      setScheduleContextStatus('error');
    }
  }, [user, isGuest]);

  // ── Toggle Schedule Context Lock ───────────────────────────────────────────
  const toggleScheduleContextLock = useCallback(async (locked: boolean) => {
    if (!user || isGuest) return;
    setLock(LS_SCHEDULE, locked);
    setScheduleContextLocked(locked);
    try {
      await setDoc(doc(db, 'context', user.uid),
        { scheduleContext: { ...(scheduleContextData || {}), locked }, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      if (scheduleContextData) setScheduleContextData({ ...scheduleContextData, locked });
    } catch (err) { console.error('❌ Error updating schedule lock:', err); }
  }, [user, isGuest, scheduleContextData]);

  // ── Generate Consolidated Context ──────────────────────────────────────────
  const generateConsolidatedContext = useCallback(async () => {
    if (!user || isGuest) return;
    if (getLock(LS_CONSOLIDATED)) {
      console.log('🔒 Consolidated context locked (localStorage). Skipping.');
      return;
    }

    // Firestore double-check
    try {
      const snap = await getDoc(doc(db, 'context', user.uid));
      if (snap.exists() && snap.data()?.consolidatedContext?.locked) {
        setLock(LS_CONSOLIDATED, true);
        setConsolidatedContextLocked(true);
        return;
      }
    } catch { /* continue */ }

    setConsolidatedContextStatus('fetching');
    try {
      // 1. Get onboarding data
      const obRef = doc(db, 'initialOnboarding', user.uid);
      const obSnap = await getDoc(obRef);
      const obData = obSnap.exists() ? obSnap.data() : null;

      // 2. Get current contexts from Firestore
      const snap = await getDoc(doc(db, 'context', user.uid));
      const contextDoc = snap.exists() ? snap.data() : null;
      const journalContext = contextDoc?.journalContext || null;
      const todoContext = contextDoc?.todoContext || null;
      const goalContext = contextDoc?.goalContext || null;
      const financeContext = contextDoc?.financeContext || null;
      const streakContext = contextDoc?.streakContext || null;
      const scheduleContext = contextDoc?.scheduleContext || null;

      setConsolidatedContextStatus('generating');
      const res = await fetch('/api/context/consolidated-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboardingData: obData,
          journalContext,
          todoContext,
          goalContext,
          financeContext,
          streakContext,
          scheduleContext,
        }),
      });

      if (!res.ok) throw new Error('Consolidated summary API failed');
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      const contextData: ConsolidatedContextData = {
        summary: result.summary,
        generatedAt: new Date().toISOString(),
        locked: true,
      };

      await setDoc(doc(db, 'context', user.uid), { userId: user.uid, consolidatedContext: contextData, updatedAt: new Date().toISOString() }, { merge: true });
      setLock(LS_CONSOLIDATED, true);
      setConsolidatedContextData(contextData);
      setConsolidatedContextLocked(true);
      setConsolidatedContextStatus('saved');
      console.log('✅ Consolidated context generated and saved.');
    } catch (err) {
      console.error('❌ Error generating consolidated context:', err);
      setConsolidatedContextStatus('error');
    }
  }, [user, isGuest]);

  // ── Toggle Consolidated Context Lock ───────────────────────────────────────
  const toggleConsolidatedContextLock = useCallback(async (locked: boolean) => {
    if (!user || isGuest) return;
    setLock(LS_CONSOLIDATED, locked);
    setConsolidatedContextLocked(locked);
    try {
      await setDoc(doc(db, 'context', user.uid),
        { consolidatedContext: { ...(consolidatedContextData || {}), locked }, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      if (consolidatedContextData) setConsolidatedContextData({ ...consolidatedContextData, locked });
    } catch (err) { console.error('❌ Error updating consolidated lock:', err); }
  }, [user, isGuest, consolidatedContextData]);

  // ── updateOnboardingData ──────────────────────────────────────────────────
  const updateOnboardingData = async (data: Partial<OnboardingData>) => {
    if (!user || isGuest) return;
    try {
      await setDoc(doc(db, 'initialOnboarding', user.uid), data, { merge: true });
      if (data.firstName || data.lastName) {
        const nameUpdates: Record<string, string> = {};
        if (data.firstName !== undefined) nameUpdates.firstName = data.firstName;
        if (data.lastName !== undefined) nameUpdates.lastName = data.lastName;
        await setDoc(doc(db, 'users', user.uid), nameUpdates, { merge: true });
        setUser((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            firstName: data.firstName !== undefined ? data.firstName : prev.firstName,
            lastName: data.lastName !== undefined ? data.lastName : prev.lastName,
          };
        });
      }
    } catch (err) {
      console.error('❌ Error updating onboarding/profile data:', err);
      throw err;
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        isGuest,
        onboardingData,
        updateOnboardingData,
        journalContextData,
        journalContextStatus,
        journalContextLocked,
        generateJournalContext,
        toggleJournalContextLock,
        todoContextData,
        todoContextStatus,
        todoContextLocked,
        generateTodoContext,
        toggleTodoContextLock,
        goalContextData,
        goalContextStatus,
        goalContextLocked,
        generateGoalContext,
        toggleGoalContextLock,
        financeContextData,
        financeContextStatus,
        financeContextLocked,
        generateFinanceContext,
        toggleFinanceContextLock,
        consolidatedContextData,
        consolidatedContextStatus,
        consolidatedContextLocked,
        generateConsolidatedContext,
        toggleConsolidatedContextLock,
        streakContextData,
        streakContextStatus,
        streakContextLocked,
        generateStreakContext,
        toggleStreakContextLock,
        scheduleContextData,
        scheduleContextStatus,
        scheduleContextLocked,
        generateScheduleContext,
        toggleScheduleContextLock,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useAuth = () => useContext(UserContext);
