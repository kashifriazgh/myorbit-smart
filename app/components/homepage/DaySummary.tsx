'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import moment from 'moment';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useGoals } from '@/app/lib/context/GoalsContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ---------- Test scenarios (optional for testing) ---------- */
const SCENARIOS = {
  empty: {
    label: 'Nothing planned',
    data: { schedulesCount: 0, schedulesDone: 0, todosCount: 0, todosDone: 0, goalsCount: 0, goalsDone: 0 },
  },
  start: {
    label: 'Not started',
    data: { schedulesCount: 3, schedulesDone: 0, todosCount: 5, todosDone: 0, goalsCount: 2, goalsDone: 0 },
  },
  some: {
    label: 'A few done',
    data: { schedulesCount: 4, schedulesDone: 1, todosCount: 6, todosDone: 1, goalsCount: 2, goalsDone: 0 },
  },
  half: {
    label: 'Half done',
    data: { schedulesCount: 4, schedulesDone: 2, todosCount: 6, todosDone: 3, goalsCount: 2, goalsDone: 1 },
  },
  almost: {
    label: 'Almost done',
    data: { schedulesCount: 4, schedulesDone: 4, todosCount: 6, todosDone: 5, goalsCount: 2, goalsDone: 1 },
  },
  all: {
    label: 'All done',
    data: { schedulesCount: 4, schedulesDone: 4, todosCount: 6, todosDone: 6, goalsCount: 2, goalsDone: 2 },
  },
};

/* ---------- Heading messages ---------- */
function getMessage({ total, done }: { total: number; done: number }) {
  const left = total - done;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  if (total === 0)
    return {
      mood: 'neutral',
      title: 'Nothing planned for today',
      text: 'Add a schedule, task or goal check-in to shape your day.',
    };
  if (done === total)
    return {
      mood: 'success',
      title: 'All done. Great work today!',
      text: 'Everything on your list is complete. Enjoy the rest of your day.',
    };
  if (pct >= 75)
    return {
      mood: 'good',
      title: 'Almost there!',
      text: `Just ${plural(left, 'thing')} left. Finish strong.`,
    };
  if (pct >= 50)
    return {
      mood: 'good',
      title: 'Halfway there. Keep going!',
      text: `${done} done, ${left} to go. You're making real progress.`,
    };
  if (done > 0)
    return {
      mood: 'progress',
      title: 'Good start!',
      text: `${plural(done, 'thing')} done. One step at a time.`,
    };
  return {
    mood: 'neutral',
    title: 'Your day is ready',
    text: `${plural(total, 'thing')} planned. Pick one and get started.`,
  };
}

/* ---------- Mood Styles (Dark / Light support) ---------- */
const getMoodStyles = (mood: string, isDark: boolean) => {
  switch (mood) {
    case 'progress':
      return isDark
        ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
        : 'bg-amber-50 border-amber-200 text-amber-900';
    case 'good':
      return isDark
        ? 'bg-sky-950/40 border-sky-800/60 text-sky-200'
        : 'bg-sky-50 border-sky-200 text-sky-900';
    case 'success':
      return isDark
        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
        : 'bg-emerald-50 border-emerald-200 text-emerald-900';
    case 'neutral':
    default:
      return isDark
        ? 'bg-slate-800/80 border-slate-700 text-slate-100'
        : 'bg-slate-50 border-slate-200 text-slate-900';
  }
};

/* ---------- Icons ---------- */
const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const icons = {
  schedules: (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </Icon>
  ),
  todos: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </Icon>
  ),
  goals: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </Icon>
  ),
};

/* ---------- Tile Theme Styles ---------- */
const getToneStyles = (type: 'schedules' | 'todos' | 'goals', isDark: boolean) => {
  switch (type) {
    case 'schedules':
      return {
        tile: isDark
          ? 'bg-sky-950/30 hover:bg-sky-900/40 border-sky-800/50'
          : 'bg-sky-50/80 hover:bg-sky-100/90 border-sky-200/80',
        icon: isDark ? 'bg-sky-900/60 text-sky-300' : 'bg-sky-100 text-sky-700',
        number: isDark ? 'text-sky-100' : 'text-sky-900',
        label: isDark ? 'text-slate-200' : 'text-slate-800',
        hint: isDark ? 'text-slate-400' : 'text-slate-500',
      };
    case 'todos':
      return {
        tile: isDark
          ? 'bg-emerald-950/30 hover:bg-emerald-900/40 border-emerald-800/50'
          : 'bg-emerald-50/80 hover:bg-emerald-100/90 border-emerald-200/80',
        icon: isDark ? 'bg-emerald-900/60 text-emerald-300' : 'bg-emerald-100 text-emerald-700',
        number: isDark ? 'text-emerald-100' : 'text-emerald-900',
        label: isDark ? 'text-slate-200' : 'text-slate-800',
        hint: isDark ? 'text-slate-400' : 'text-slate-500',
      };
    case 'goals':
      return {
        tile: isDark
          ? 'bg-violet-950/30 hover:bg-violet-900/40 border-violet-800/50'
          : 'bg-violet-50/80 hover:bg-violet-100/90 border-violet-200/80',
        icon: isDark ? 'bg-violet-900/60 text-violet-300' : 'bg-violet-100 text-violet-700',
        number: isDark ? 'text-violet-100' : 'text-violet-900',
        label: isDark ? 'text-slate-200' : 'text-slate-800',
        hint: isDark ? 'text-slate-400' : 'text-slate-500',
      };
  }
};

interface StatTileProps {
  type: 'schedules' | 'todos' | 'goals';
  label: string;
  hint: string;
  count: number;
  done: number;
  href: string;
  loading: boolean;
  isDark: boolean;
}

function StatTile({ type, label, hint, count, done, href, loading, isDark }: StatTileProps) {
  const tone = getToneStyles(type, isDark);
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 rounded-xl p-3 border transition-all duration-200 sm:p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${tone.tile}`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${tone.icon}`}>
        {icons[type]}
      </span>
      <div>
        {loading ? (
          <div className="h-8 w-8 animate-pulse rounded bg-slate-200/60 dark:bg-slate-700/60" />
        ) : (
          <p className={`text-3xl font-semibold tabular-nums ${tone.number}`}>{count}</p>
        )}
        <p className={`mt-1 text-sm font-medium ${tone.label}`}>{label}</p>
        <p className={`text-xs ${tone.hint}`}>
          {count > 0 && !loading ? `${done} of ${count} done` : hint}
        </p>
      </div>
    </Link>
  );
}

export interface DaySummaryProps {
  schedulesCount?: number;
  schedulesDone?: number;
  todosCount?: number;
  todosDone?: number;
  goalsCount?: number;
  goalsDone?: number;
  loading?: boolean;
  testMode?: boolean;
}

// Helper to test if a date/timestamp/string is today
const isToday = (d: unknown): boolean => {
  if (!d) return false;
  let dateObj: Date | null = null;
  if (d instanceof Date) {
    dateObj = d;
  } else if (typeof d === 'object' && d !== null && 'toDate' in d && typeof (d as { toDate: () => Date }).toDate === 'function') {
    dateObj = (d as { toDate: () => Date }).toDate();
  } else if (typeof d === 'string' || typeof d === 'number') {
    dateObj = new Date(d);
  }
  if (!dateObj || isNaN(dateObj.getTime())) return false;
  return moment(dateObj).isSame(moment(), 'day');
};

export default function DaySummary({
  schedulesCount: propSchedulesCount,
  schedulesDone: propSchedulesDone,
  todosCount: propTodosCount,
  todosDone: propTodosDone,
  goalsCount: propGoalsCount,
  goalsDone: propGoalsDone,
  loading: propLoading,
  testMode = false,
}: DaySummaryProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  // Real-time Context Hooks for automatic zero-DB, zero-latency sync
  const { schedules: ctxSchedules, loading: schedulesLoading } = useSchedules();
  const { todos: ctxTodos, loading: todosLoading } = useTodoContext();
  const { goals: ctxGoals, loading: goalsLoading } = useGoals();

  const [scenario, setScenario] = useState<keyof typeof SCENARIOS>('half');

  // Derive counts dynamically from Context if not explicitly passed as props
  const derivedCounts = useMemo(() => {
    const todayStr = moment().format('YYYY-MM-DD');

    // 1. Schedules today:
    // Only count schedules for today. Only count done if status === 'completed' AND completed today!
    const schedToday = ctxSchedules || [];
    let sDone = 0;
    schedToday.forEach((s) => {
      if (s.status === 'completed' && isToday(s.updatedAt)) {
        sDone++;
      }
    });
    const sCount = schedToday.length;

    // 2. Tasks (todos) due today only (or flexible):
    // Count tasks remaining whose due date is today only or flexible.
    // Count done only if marked completed today!
    const todosToday = (ctxTodos || []).filter((t) => {
      if (t.isFlexible) return true;
      if (!t.dueDate) return false;
      return isToday(t.dueDate);
    });

    let tDone = 0;
    let tCount = 0;
    todosToday.forEach((t) => {
      const completedToday = t.status === 'completed' && (isToday(t.updatedAt) || isToday(t.completedAt));
      if (completedToday) {
        tDone++;
        tCount++;
      } else if (t.status !== 'completed') {
        tCount++;
      }
    });

    // 3. Goals needing check-in today (only goals with recurring/frequency check-ins):
    let gCount = 0;
    let gDone = 0;

    (ctxGoals || []).forEach((g) => {
      if (g.status === 'Completed') return;

      let isDueToday = false;
      let isCompletedToday = false;

      // a. Check Goal Tracker check-ins
      if (g.trackerEnabled && g.tracker && g.tracker.frequency) {
        const todayCheckIn = g.tracker.checkIns?.find(
          (c) => c.scheduledDate === todayStr || isToday(c.scheduledDate)
        );
        if (todayCheckIn) {
          isDueToday = true;
          if (todayCheckIn.completed || (todayCheckIn.completedAt && isToday(todayCheckIn.completedAt))) {
            isCompletedToday = true;
          }
        } else if (g.tracker.frequency === 'daily') {
          isDueToday = true;
        }
      }

      // b. Check Goal Steps with frequency / recurrence / due today
      if (!isDueToday && g.steps && g.steps.length > 0) {
        const stepDueToday = g.steps.find((s) => {
          if (s.recurrence && s.recurrence.type && s.recurrence.type !== 'none') return true;
          if (s.endDate && isToday(s.endDate)) return true;
          if (s.checkIns && s.checkIns.some((ci) => isToday(ci.date))) return true;
          return false;
        });

        if (stepDueToday) {
          isDueToday = true;
          if (
            stepDueToday.status === 'completed' ||
            (stepDueToday.completionRecord && isToday(stepDueToday.completionRecord.completedAt))
          ) {
            isCompletedToday = true;
          }
        }
      }

      // c. Check savings / habit / routine frequency settings
      if (!isDueToday) {
        if (g.savingsReminderFreq && ['daily', 'weekly', 'monthly', 'custom'].includes(g.savingsReminderFreq)) {
          isDueToday = true;
          if (g.lastSavingsCheckInDate && isToday(g.lastSavingsCheckInDate)) {
            isCompletedToday = true;
          }
        } else if (g.habitCheckIns && g.habitCheckIns.some((h) => h.date === todayStr || isToday(h.date))) {
          isDueToday = true;
          if (g.habitCheckIns.some((h) => (h.date === todayStr || isToday(h.date)) && h.completed)) {
            isCompletedToday = true;
          }
        }
      }

      if (isDueToday) {
        gCount++;
        if (isCompletedToday) gDone++;
      }
    });

    return {
      schedulesCount: sCount,
      schedulesDone: sDone,
      todosCount: tCount,
      todosDone: tDone,
      goalsCount: gCount,
      goalsDone: gDone,
    };
  }, [ctxSchedules, ctxTodos, ctxGoals]);

  const isLoading = propLoading !== undefined ? propLoading : (schedulesLoading || todosLoading || goalsLoading);

  // If props provided, use props. Otherwise use dynamic context calculations.
  const d =
    testMode && SCENARIOS[scenario]
      ? SCENARIOS[scenario].data
      : {
          schedulesCount: propSchedulesCount ?? derivedCounts.schedulesCount,
          schedulesDone: propSchedulesDone ?? derivedCounts.schedulesDone,
          todosCount: propTodosCount ?? derivedCounts.todosCount,
          todosDone: propTodosDone ?? derivedCounts.todosDone,
          goalsCount: propGoalsCount ?? derivedCounts.goalsCount,
          goalsDone: propGoalsDone ?? derivedCounts.goalsDone,
        };

  const total = d.schedulesCount + d.todosCount + d.goalsCount;
  const done = d.schedulesDone + d.todosDone + d.goalsDone;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const msg = getMessage({ total, done });

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <section
      aria-label="Today's summary"
      className={`rounded-2xl border p-4 shadow-sm transition-colors sm:p-5 ${
        isDark ? 'border-slate-800 bg-slate-900/60 text-slate-100' : 'border-slate-200 bg-white text-slate-900'
      }`}
    >
      <header className={`mb-4 rounded-xl border p-3 transition-colors sm:p-4 ${getMoodStyles(msg.mood, isDark)}`}>
        <p className="text-xs opacity-75">{today}</p>
        <h2 className="mt-0.5 text-lg font-semibold tracking-tight">
          {isLoading ? 'Loading your day summary…' : msg.title}
        </h2>
        {!isLoading && <p className="mt-0.5 text-sm opacity-85 leading-relaxed">{msg.text}</p>}
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile
          type="schedules"
          label="Schedules"
          hint="Today"
          count={d.schedulesCount}
          done={d.schedulesDone}
          href="/to-do"
          loading={isLoading}
          isDark={isDark}
        />
        <StatTile
          type="todos"
          label="Tasks"
          hint="Due today"
          count={d.todosCount}
          done={d.todosDone}
          href="/to-do"
          loading={isLoading}
          isDark={isDark}
        />
        <StatTile
          type="goals"
          label="Goals"
          hint="Need check-in"
          count={d.goalsCount}
          done={d.goalsDone}
          href="/goals"
          loading={isLoading}
          isDark={isDark}
        />
      </div>

      {!isLoading && total > 0 && (
        <div className="mt-4">
          <div className={`mb-1.5 flex items-center justify-between text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span>
              {done} of {total} done today
            </span>
            <span className="tabular-nums font-semibold">{progress}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className={`h-2 overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {testMode && (
        <div className={`mt-5 border-t border-dashed pt-4 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <p className={`mb-2 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Test scenario (temporary)
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SCENARIOS).map(([key, s]) => (
              <button
                key={key}
                type="button"
                onClick={() => setScenario(key as keyof typeof SCENARIOS)}
                aria-pressed={scenario === key}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                  scenario === key
                    ? isDark
                      ? 'border-slate-100 bg-slate-100 text-slate-900'
                      : 'border-slate-900 bg-slate-900 text-white'
                    : isDark
                      ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
