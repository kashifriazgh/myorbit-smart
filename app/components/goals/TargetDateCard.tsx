'use client';

import React, { useMemo } from 'react';
import { Edit as PencilIcon, AccessTime as ClockIcon, CalendarMonth as CalendarIcon, Add as AddIcon } from '@mui/icons-material';

export interface TargetDateCardProps {
  goalTitle?: string;
  targetDate?: string | Date | { toDate?: () => Date; seconds?: number } | null;
  startDate?: string | Date | { toDate?: () => Date; seconds?: number } | null;
  onUpdateProgress?: () => void;
  onSetTargetDate?: () => void;
  category?: string;
  /** When true, hides the "Update Progress" button entirely */
  hideUpdateProgress?: boolean;
}

const toPlainDate = (val: unknown): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && val !== null) {
    if ('toDate' in val && typeof (val as { toDate: unknown }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate();
    }
    if ('seconds' in val && typeof (val as { seconds: number }).seconds === 'number') {
      return new Date((val as { seconds: number }).seconds * 1000);
    }
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

export default function TargetDateCard({
  goalTitle = 'Goal',
  targetDate = null,
  startDate = null,
  onUpdateProgress = () => {},
  onSetTargetDate = () => {},
  hideUpdateProgress = false,
}: TargetDateCardProps) {
  const target = useMemo(() => toPlainDate(targetDate), [targetDate]);
  const start = useMemo(() => toPlainDate(startDate), [startDate]);
  const now = useMemo(() => new Date(), []);

  const daysRemaining = useMemo(() => {
    if (!target) return null;
    const diffMs = target.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }, [target, now]);

  const dateDetails = useMemo(() => {
    if (!target) return null;
    const day = target.getDate();
    const month = target.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = target.getFullYear();
    const weekday = target.toLocaleString('en-US', { weekday: 'long' });
    return { day, month, year, weekday };
  }, [target]);

  const urgency = useMemo(() => {
    if (daysRemaining === null) return 'emerald';
    if (daysRemaining <= 7) return 'red';
    if (daysRemaining <= 30) return 'amber';
    return 'emerald';
  }, [daysRemaining]);

  const theme = {
    emerald: {
      ring: 'from-emerald-400 to-teal-500',
      text: 'text-emerald-700 dark:text-emerald-400',
      pillBg: 'bg-emerald-100 dark:bg-emerald-400/15',
      bar: 'bg-emerald-500',
    },
    amber: {
      ring: 'from-amber-400 to-orange-500',
      text: 'text-amber-700 dark:text-amber-400',
      pillBg: 'bg-amber-100 dark:bg-amber-400/15',
      bar: 'bg-amber-500',
    },
    red: {
      ring: 'from-rose-400 to-red-500',
      text: 'text-rose-700 dark:text-rose-400',
      pillBg: 'bg-rose-100 dark:bg-rose-400/15',
      bar: 'bg-rose-500',
    },
  }[urgency];

  const progressPct = useMemo(() => {
    if (!start || !target) return null;
    const total = target.getTime() - start.getTime();
    if (total <= 0) return null;
    const elapsed = now.getTime() - start.getTime();
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [start, target, now]);

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0b1626] dark:shadow-none mb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">
          {goalTitle}
        </h2>

        {!hideUpdateProgress && (
          <button
            type="button"
            onClick={onUpdateProgress}
            className="flex items-center gap-1.5 shrink-0 rounded-full border border-emerald-500/40 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100 active:scale-[0.98] dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-400 dark:hover:bg-emerald-400/20 cursor-pointer"
          >
            <PencilIcon style={{ fontSize: 14 }} />
            Update Progress
          </button>
        )}
      </div>

      {/* Target date block */}
      {target && dateDetails ? (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-white/5 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-4 min-w-0">
              {/* Calendar tear-off */}
              <div className="flex w-16 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-white/10">
                <div
                  className={`bg-gradient-to-r ${theme.ring} py-1 text-center text-[11px] font-bold tracking-wide text-white`}
                >
                  {dateDetails.month}
                </div>
                <div className="bg-white py-1.5 text-center text-2xl font-extrabold text-slate-900 dark:bg-slate-900 dark:text-white">
                  {dateDetails.day}
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Target Date
                </span>
                <span className="truncate text-base font-bold text-slate-900 dark:text-white">
                  {dateDetails.weekday}, {dateDetails.month} {dateDetails.day}, {dateDetails.year}
                </span>
                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full ${theme.pillBg} px-2.5 py-0.5 text-xs font-semibold ${theme.text}`}
                >
                  <ClockIcon style={{ fontSize: 12 }} />
                  {daysRemaining !== null && daysRemaining < 0
                    ? `${Math.abs(daysRemaining)} days overdue`
                    : daysRemaining === 0
                    ? 'Due Today'
                    : `${daysRemaining} days remaining`}
                </span>
              </div>
            </div>

            {/* Edit Target Date Button */}
            {onSetTargetDate && (
              <button
                type="button"
                onClick={onSetTargetDate}
                className="text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition cursor-pointer underline underline-offset-2"
              >
                Change Date
              </button>
            )}
          </div>

          {/* Elapsed-time progress bar (only if startDate provided) */}
          {progressPct !== null && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] font-medium text-slate-400 dark:text-slate-500">
                <span>Time elapsed</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className={`h-full rounded-full ${theme.bar} transition-all duration-500`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Encouragement UI when no target date is set */
        <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <CalendarIcon style={{ fontSize: 22 }} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  No Target Date Set 📅
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Financial goals with a clear target date are 3x more likely to be achieved on time!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onSetTargetDate}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600 active:scale-[0.98] cursor-pointer"
            >
              <AddIcon style={{ fontSize: 16 }} />
              Set Target Date
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
