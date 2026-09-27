'use client';

import React, { useMemo, useState } from 'react';
import {
  Whatshot as FlameIcon,
  CalendarToday as CalendarIcon,
  EditCalendar as FreqIcon,
  AddCircleOutline as LogIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
} from '@mui/material';
import { Goal } from '@/app/lib/interface';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

/**
 * LagatarBadge — "لگاتار" (Lagatar / "consistently") as a horizontal
 * rectangular badge with gradient flame & Urdu wordmark.
 */
export function LagatarBadge({ width = 118, height = 46 }: { width?: number; height?: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 118 46"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Lagatar — consistently"
    >
      <defs>
        <linearGradient id="lagatarBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="lagatarFlame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="55%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <filter id="lagatarShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#0369a1" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* rectangular badge background */}
      <rect
        x="1"
        y="1"
        width="116"
        height="44"
        rx="11"
        fill="url(#lagatarBg)"
        filter="url(#lagatarShadow)"
      />

      {/* colored flame icon, left — tighter to the text now */}
      <g transform="translate(8, 8) scale(0.85)">
        <path
          d="M18 0
             c2.5 5 7 7 7 13.5
             c0 7 -5.5 12.5 -13 12.5
             c-7.5 0 -13 -5.5 -13 -12.5
             c0 -4 1.8 -6.8 4 -9.3
             c0.3 3 1.8 4.6 3.4 4.6
             c-0.6 -6 3 -8 3 -12.3
             c0 3 2.2 4.6 3.6 6.6
             c1 1.4 1.6 3 1.6 5
             c0 2 -1 3.3 -2.3 3.3
             c-1.6 0 -2.7 -1.4 -2.7 -3
             c0 -1.6 1.1 -2.6 1.1 -4.6
             c0 -2.6 -1.6 -3.6 -1.6 -3.6
             c1 3 -1.4 5.3 -1.4 8.4
             c0 2.4 1.9 4.4 4.3 4.4
             c2.6 0 4.7 -2.1 4.7 -5
             c0 -3.4 -1.7 -5.6 -3.2 -8
             c-1.2 -1.9 -2.5 -3.8 -2.5 -6.1z"
          fill="url(#lagatarFlame)"
        />
      </g>

      {/* the word — bolder, گ stretched via inserted kashida, gap tightened */}
      <text
        x="108"
        y="31"
        textAnchor="end"
        fontFamily="var(--font-lalezar), 'Lalezar', var(--font-baloo-bhaijaan), 'Baloo Bhaijaan 2', 'Noto Nastaliq Urdu', serif"
        fontSize="26"
        fontWeight="500"
        stroke="#ffffff"
        strokeWidth="0.2"
        paintOrder="stroke fill"
        fill="#ffffff"
      >
        لگـــاتار
      </text>
    </svg>
  );
}

export type FrequencyInterval = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface StreakLogItem {
  date: string; // YYYY-MM-DD
  completed?: boolean;
  value?: number;
  [key: string]: unknown;
}

export interface StreakCardProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
  logs?: StreakLogItem[];
  onQuickLog?: () => void;
  quickLogLabel?: string;
  metricLabel?: string;
}

const formatDateStr = (d: Date): string => {
  return d.toISOString().split('T')[0];
};

export default function StreakCard({
  goal,
  onUpdateGoal,
  logs = [],
  onQuickLog,
  quickLogLabel = 'Quick Log Activity',
  metricLabel = 'activity',
}: StreakCardProps) {
  const [freqModalOpen, setFreqModalOpen] = useState(false);
  const [savingFreq, setSavingFreq] = useState(false);

  // Extract user-configured activity interval / frequency
  const currentFrequency: FrequencyInterval | null = useMemo(() => {
    const qAns = goal.questionnaireAnswers || {};
    const freqVal = (
      goal.savingsReminderFreq ||
      (qAns.frequency as string) ||
      (qAns.routine_frequency as string) ||
      (qAns.checkin_freq as string) ||
      (qAns.target_frequency as string) ||
      null
    )?.toLowerCase();

    if (freqVal?.includes('daily') || freqVal?.includes('7 days')) return 'daily';
    if (freqVal?.includes('weekly') || freqVal?.includes('1 day/week') || freqVal?.includes('per_week') || freqVal?.includes('biweekly')) return 'weekly';
    if (freqVal?.includes('monthly')) return 'monthly';
    if (freqVal?.includes('custom')) return 'custom';
    return null;
  }, [goal]);

  // Set of logged date strings (YYYY-MM-DD)
  const loggedDatesSet = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((item) => {
      if (item.date && (item.completed !== false)) {
        const cleanDate = typeof item.date === 'string' ? item.date.split('T')[0] : '';
        if (cleanDate) set.add(cleanDate);
      }
    });
    // Check goal actions / habit checkins
    if (Array.isArray(goal.habitCheckIns)) {
      goal.habitCheckIns.forEach((c) => {
        if (c.date && c.completed) set.add(c.date.split('T')[0]);
      });
    }
    if (Array.isArray(goal.routineLogs)) {
      goal.routineLogs.forEach((r) => {
        if (r.date && (r.checkedCount || 0) > 0) set.add(r.date.split('T')[0]);
      });
    }
    if (Array.isArray(goal.nutritionLogs)) {
      goal.nutritionLogs.forEach((n) => {
        if (n.date) set.add(n.date.split('T')[0]);
      });
    }
    if (Array.isArray(goal.readingLogs)) {
      goal.readingLogs.forEach((r) => {
        if (r.date) set.add(r.date.split('T')[0]);
      });
    }
    return set;
  }, [logs, goal.habitCheckIns, goal.routineLogs, goal.nutritionLogs, goal.readingLogs]);

  // Compute Streak Days & Missed Days
  const { streakDays, missedDays, last7Days } = useMemo(() => {
    const today = new Date();
    const todayStr = formatDateStr(today);

    // Compute 7-day tracker (oldest to newest: past 6 days + today)
    const dayLabelsArr: string[] = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const trackerDays: Array<{ label: string; status: 'done' | 'missed' | 'future'; dateStr: string }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dStr = formatDateStr(d);
      const label = dayLabelsArr[d.getDay()];

      let status: 'done' | 'missed' | 'future' = 'missed';
      if (dStr > todayStr) {
        status = 'future';
      } else if (loggedDatesSet.has(dStr)) {
        status = 'done';
      }

      trackerDays.push({ label, status, dateStr: dStr });
    }

    // Compute current consecutive streak count
    let streakCount = 0;
    let checkDate = new Date(today);

    // If today is not logged yet, start checking from yesterday to preserve streak
    if (!loggedDatesSet.has(formatDateStr(checkDate))) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (loggedDatesSet.has(formatDateStr(yesterday))) {
        checkDate = yesterday;
      }
    }

    while (loggedDatesSet.has(formatDateStr(checkDate))) {
      streakCount++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Compute missing days in past 30 days
    let missingCount = 0;
    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dStr = formatDateStr(d);
      if (!loggedDatesSet.has(dStr)) {
        missingCount++;
      }
    }
    // Limit missing count display for UI cleanliness
    const cappedMissing = Math.min(30, Math.max(0, missingCount));

    return {
      streakDays: streakCount,
      missedDays: cappedMissing,
      last7Days: trackerDays,
    };
  }, [loggedDatesSet]);

  const handleSaveFrequency = async (freq: FrequencyInterval) => {
    if (!goal.id) return;
    setSavingFreq(true);
    try {
      const payload = {
        savingsReminderFreq: freq,
        questionnaireAnswers: {
          ...(goal.questionnaireAnswers || {}),
          frequency: freq,
        },
      };
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, payload);
      } else {
        await updateDoc(doc(db, 'goals', goal.id), payload);
      }
      setFreqModalOpen(false);
    } catch (err) {
      console.error('Failed to update goal frequency:', err);
    } finally {
      setSavingFreq(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0b1626] dark:shadow-none mb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Streak Status
          </h2>
          <button
            type="button"
            onClick={() => setFreqModalOpen(true)}
            className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
          >
            <FreqIcon style={{ fontSize: 13 }} />
            <span className="capitalize">{currentFrequency || 'Set Frequency'}</span>
          </button>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500 shadow-sm shadow-orange-500/30">
          <FlameIcon style={{ fontSize: 18 }} className="text-white" />
        </div>
      </div>

      {/* Encouragement Banner if frequency is missing */}
      {!currentFrequency && (
        <div className="mt-3.5 flex items-center justify-between gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/80 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-center gap-2">
            <CalendarIcon style={{ fontSize: 18 }} className="text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              How often do you plan to do this {metricLabel}? (Daily, Weekly, etc.)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFreqModalOpen(true)}
            className="shrink-0 rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600 transition cursor-pointer"
          >
            Set Frequency
          </button>
        </div>
      )}

      {/* Streak + Missed Stats */}
      <div className="mt-4 flex items-stretch gap-3">
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-orange-100 bg-orange-50/80 py-4 dark:border-orange-400/10 dark:bg-orange-400/[0.06]">
          {/* Lagatar badge — sits right before the streak count */}
          <LagatarBadge width={118} height={46} />

          <span className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-orange-600 dark:text-orange-400">
              {streakDays}
            </span>
            <span className="text-sm font-semibold text-orange-600/80 dark:text-orange-400/80">
              {currentFrequency === 'weekly' ? 'weeks' : 'days'}
            </span>
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-orange-500/70 dark:text-orange-400/60">
            Current Streak
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50/80 py-4 dark:border-white/5 dark:bg-white/[0.03]">
          <span className="flex items-center gap-1.5">
            <CalendarIcon style={{ fontSize: 18 }} className="text-slate-400 dark:text-slate-500" />
            <span className="text-3xl font-extrabold text-slate-700 dark:text-slate-200">
              {String(missedDays).padStart(2, '0')}
            </span>
          </span>
          <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Missing Days
          </span>
        </div>
      </div>

      {/* 7-day dot tracker */}
      <div className="mt-4 flex justify-between px-2">
        {last7Days.map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {item.label}
            </span>
            <span
              title={`${item.dateStr}: ${item.status}`}
              className={
                'h-3 w-3 rounded-full transition-all ' +
                (item.status === 'done'
                  ? 'bg-gradient-to-br from-orange-400 to-rose-500 shadow-sm shadow-orange-500/40'
                  : item.status === 'missed'
                  ? 'bg-slate-200 dark:bg-white/10'
                  : 'border border-dashed border-slate-300 dark:border-white/15')
              }
            />
          </div>
        ))}
      </div>

      {/* Quick Log Button if provided */}
      {onQuickLog && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-end">
          <button
            type="button"
            onClick={onQuickLog}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-orange-600 hover:to-rose-600 active:scale-[0.98] transition cursor-pointer"
          >
            <LogIcon style={{ fontSize: 16 }} />
            {quickLogLabel}
          </button>
        </div>
      )}

      {/* Frequency Setting Dialog */}
      <Dialog
        open={freqModalOpen}
        onClose={() => setFreqModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Routine Activity Interval 🗓️</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            How often do you plan to log or perform this {metricLabel}? Setting a target frequency ensures accurate streak tracking.
          </Typography>
          <Stack spacing={1}>
            {[
              { val: 'daily', label: 'Daily (Every day)', desc: 'Track consecutive days' },
              { val: 'weekly', label: 'Weekly (Once a week)', desc: 'Track consecutive weeks' },
              { val: 'monthly', label: 'Monthly (Once a month)', desc: 'Track monthly milestones' },
              { val: 'custom', label: 'Custom Frequency', desc: 'Track custom intervals' },
            ].map((opt) => (
              <Button
                key={opt.val}
                variant={currentFrequency === opt.val ? 'contained' : 'outlined'}
                onClick={() => handleSaveFrequency(opt.val as FrequencyInterval)}
                disabled={savingFreq}
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  borderRadius: '14px',
                  py: 1.2,
                  px: 2,
                  textTransform: 'none',
                  bgcolor: currentFrequency === opt.val ? '#f97316' : 'transparent',
                  borderColor: currentFrequency === opt.val ? '#f97316' : undefined,
                  '&:hover': {
                    bgcolor: currentFrequency === opt.val ? '#ea580c' : undefined,
                  },
                }}
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight={800}>
                    {opt.label}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {opt.desc}
                  </Typography>
                </Box>
              </Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setFreqModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
