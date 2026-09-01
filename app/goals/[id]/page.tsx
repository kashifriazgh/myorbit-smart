'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Stack,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  ArrowBack,
  Edit,
  Delete,
  AutoAwesome,
  Add as AddIcon,
  CalendarMonth,
  CalendarToday as CalendarIcon,
  Checklist as TodoIcon,
  CheckCircle,
  AccountBalanceWallet,
  TrackChanges,
  ArrowForward,
  RadioButtonUnchecked,
} from '@mui/icons-material';

import { doc, getDoc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useGoals } from '../../lib/context/GoalsContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { useAuth } from '../../lib/context/userContext';
import { useTodoContext } from '../../lib/context/todoContext';
import { useSchedules } from '../../lib/context/SchedulesContext';
import { GoalType, GoalStep, GoalStepStatus, Goal } from '../../lib/interface';
import GoalModal from '../../components/goals/GoalModal';
import MilestoneList from '../../components/goals/MilestoneList';
import MilestoneDetailSheet from '../../components/goals/MilestoneDetailSheet';
import AISuggestMilestonesModal from '../../components/goals/AISuggestMilestonesModal';
import CreateTrackerModal from '../../components/goals/CreateTrackerModal';
import TrackerView from '../../components/goals/TrackerView';
// ─── Utilities ────────────────────────────────────────────────────────────────

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toPlainDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  )
    return (value as { toDate: () => Date }).toDate();
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    'nanoseconds' in value
  ) {
    const { seconds, nanoseconds } = value as {
      seconds: number;
      nanoseconds: number;
    };
    return new Date(seconds * 1000 + nanoseconds / 1_000_000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  try {
    const d = new Date(value as string | number | Date);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const fmtDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not set';

// ─── Type helpers ─────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  {
    label: string;
    emoji: string;
    color: string;
    light: string;
    dark: string;
    darkBg: string;
  }
> = {
  finance: {
    label: 'Finance',
    emoji: '💰',
    color: '#10B981',
    light: '#ecfdf5',
    dark: '#a7f3d0',
    darkBg: '#022c22',
  },
  health: {
    label: 'Health',
    emoji: '🏃',
    color: '#F59E0B',
    light: '#fffbeb',
    dark: '#fde68a',
    darkBg: '#1c1400',
  },
  learning: {
    label: 'Learning',
    emoji: '📚',
    color: '#3B82F6',
    light: '#eff6ff',
    dark: '#bfdbfe',
    darkBg: '#0a1930',
  },
  habit: {
    label: 'Habit',
    emoji: '🎯',
    color: '#8B5CF6',
    light: '#f5f3ff',
    dark: '#ddd6fe',
    darkBg: '#120d26',
  },
  work: {
    label: 'Work',
    emoji: '💼',
    color: '#0ea5e9',
    light: '#f0f9ff',
    dark: '#bae6fd',
    darkBg: '#071b2e',
  },
  lifestyle: {
    label: 'Lifestyle',
    emoji: '🌟',
    color: '#F472B6',
    light: '#fdf2f8',
    dark: '#fbcfe8',
    darkBg: '#1f0815',
  },
  custom: {
    label: 'Custom',
    emoji: '✨',
    color: '#6B7280',
    light: '#f9fafb',
    dark: '#e5e7eb',
    darkBg: '#111827',
  },
};

const getTypeMeta = (type: GoalType | string | undefined) =>
  TYPE_META[type as string] ?? TYPE_META['custom'];

const PRIORITY_META: Record<
  string,
  { label: string; color: string; bg: string; bgDark: string }
> = {
  high: {
    label: '🔴 High',
    color: '#DC2626',
    bg: '#fef2f2',
    bgDark: '#450a0a',
  },
  medium: {
    label: '🟡 Medium',
    color: '#D97706',
    bg: '#fffbeb',
    bgDark: '#1c1400',
  },
  low: { label: '🟢 Low', color: '#16A34A', bg: '#f0fdf4', bgDark: '#052e16' },
};

const getPriorityMeta = (p: string | undefined) =>
  PRIORITY_META[(p ?? '').toLowerCase()] ?? {
    label: p ?? '—',
    color: '#6B7280',
    bg: '#f9fafb',
    bgDark: '#111827',
  };

// ─── Circular Ring ────────────────────────────────────────────────────────────

function HeroRing({ pct }: { pct: number }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;
  const size = 100;

  return (
    <Box
      sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={50}
          cy={50}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={7}
        />
        <circle
          cx={50}
          cy={50}
          r={R}
          fill="none"
          stroke="#ffffff"
          strokeWidth={7}
          strokeDasharray={C}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          sx={{
            fontSize: 22,
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1,
            fontFamily: 'monospace',
          }}
        >
          {Math.round(pct)}
        </Typography>
        <Typography
          sx={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.75)',
            letterSpacing: '.04em',
          }}
        >
          %
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Stat Strip ───────────────────────────────────────────────────────────────

function StatStrip({
  steps,
  daysLeft,
  priority,
  isDark,
}: {
  steps: GoalStep[];
  daysLeft: number;
  priority: string | undefined;
  isDark: boolean;
}) {
  const done = steps.filter(
    (s) => s.status === GoalStepStatus.COMPLETED,
  ).length;
  const total = steps.length;
  const pri = getPriorityMeta(priority);

  const bg = isDark ? '#1e293b' : '#f8f7f4';
  const text = isDark ? '#f1f5f9' : '#1a1a1a';
  const muted = isDark ? '#64748b' : '#94a3b8';

  // Format days left display
  const formatDaysLeft = (days: number): string => {
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days <= 7) return `${days}d`;

    const weeks = Math.floor(days / 7);
    const remainder = days % 7;

    if (remainder === 0) {
      return `${weeks}w`;
    } else if (remainder <= 4) {
      return `${weeks}w + ${remainder}d`;
    } else {
      // Round up: show (weeks+1)w - (7-remainder)d
      return `${weeks + 1}w - ${7 - remainder}d`;
    }
  };

  const daysLeftDisplay = formatDaysLeft(daysLeft);

  const stats = [
    {
      val: total > 0 ? `${done}/${total}` : '—',
      lbl: 'Steps done',
      color: '#10B981',
    },
    {
      val: daysLeftDisplay,
      lbl: 'Days left',
      color: daysLeft < 0 ? '#EF4444' : daysLeft <= 7 ? '#F59E0B' : text,
    },
    { val: pri.label, lbl: 'Priority', color: pri.color },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        gap: '10px',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        pb: 0.5,
      }}
    >
      {/* Steps Done */}
      <Box
        sx={{
          minWidth: 0,
          flex: 2,
          background: bg,
          borderRadius: '12px',
          p: '12px 14px',
        }}
      >
        <Typography
          sx={{
            fontSize: 10,
            color: muted,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            mb: '6px',
          }}
        >
          Steps done
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <Typography
            sx={{
              fontSize: 18,
              fontWeight: 700,
              color: '#10B981',
              fontFamily: 'monospace',
              lineHeight: 1,
            }}
          >
            {total > 0 ? done : '—'}
          </Typography>
          {total > 0 && (
            <Typography
              sx={{ fontSize: 13, color: muted, fontFamily: 'monospace' }}
            >
              / {total}
            </Typography>
          )}
        </Box>

        {total > 0 && (
          <>
            <Box
              sx={{
                mt: '8px',
                height: '5px',
                borderRadius: '99px',
                background: 'rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  width: `${(done / total) * 100}%`,
                  borderRadius: '99px',
                  background: '#10B981',
                  transition: 'width .3s',
                }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                mt: '4px',
              }}
            >
              <Typography sx={{ fontSize: 10, color: muted }}>
                {Math.round((done / total) * 100)}%
              </Typography>
              <Typography sx={{ fontSize: 10, color: muted }}>
                {total - done} left
              </Typography>
            </Box>
          </>
        )}
      </Box>

      {/* Days Left */}
      {/* Days Left */}
      <Box
        sx={{
          flex: 1.2,
          background: bg,
          borderRadius: '12px',
          p: '12px 14px',
        }}
      >
        <Typography
          sx={{
            fontSize: 10,
            color: muted,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            mb: '6px',
          }}
        >
          Days left
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <Typography
            sx={{
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'monospace',
              lineHeight: 1,
              color:
                daysLeft < 0 ? '#EF4444' : daysLeft <= 7 ? '#F59E0B' : text,
            }}
          >
            {daysLeftDisplay}
          </Typography>
          {daysLeft > 0 && daysLeft <= 7 && (
            <Typography sx={{ fontSize: 11, color: muted }}>
              due soon
            </Typography>
          )}
        </Box>

        {/* ≤ 7d: 7 pip dots (daily breakdown) */}
        {daysLeft > 0 && daysLeft <= 7 && (
          <Box sx={{ display: 'flex', gap: '3px', mt: '8px' }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  height: '5px',
                  flex: 1,
                  borderRadius: '99px',
                  background:
                    i < 7 - daysLeft
                      ? '#10B981'
                      : i === 7 - daysLeft
                        ? '#F59E0B'
                        : 'rgba(0,0,0,0.08)',
                }}
              />
            ))}
          </Box>
        )}

        {/* 8–49d (8d to 7 weeks): weekly breakdown */}
        {daysLeft > 7 && daysLeft <= 49 && (
          <Box sx={{ display: 'flex', gap: '3px', mt: '8px' }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const weekStart = i * 7 + 1;
              const weekEnd = (i + 1) * 7;
              return (
                <Box
                  key={i}
                  sx={{
                    height: '5px',
                    flex: 1,
                    borderRadius: '99px',
                    background:
                      daysLeft < weekStart
                        ? 'rgba(0,0,0,0.08)'
                        : daysLeft >= weekEnd
                          ? '#10B981'
                          : '#F59E0B',
                  }}
                />
              );
            })}
          </Box>
        )}

        {/* >49d (>7 weeks): show in months, no visual breakdown */}
        {daysLeft > 49 && (
          <Typography sx={{ fontSize: 11, color: muted, mt: '8px' }}>
            {Math.round(daysLeft / 30.44)} months ahead
          </Typography>
        )}
      </Box>

      {/* Priority — unchanged */}
      <Box
        key={stats[2].lbl}
        sx={{
          minWidth: 0,
          flex: 1,
          background: bg,
          borderRadius: '12px',
          p: '12px',
          textAlign: 'center',
        }}
      >
        <Typography
          sx={{
            fontSize: 15,
            fontWeight: 700,
            color: stats[2].color,
            fontFamily: 'monospace',
            lineHeight: 1,
          }}
        >
          {stats[2].val}
        </Typography>
        <Typography
          sx={{
            fontSize: 10,
            color: muted,
            mt: '3px',
            letterSpacing: '.04em',
            textTransform: 'uppercase',
          }}
        >
          {stats[2].lbl}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── AI Banner ────────────────────────────────────────────────────────────────

function AIBanner({
  typeColor,
  isDark,
  onAnalyze,
}: {
  typeColor: string;
  isDark: boolean;
  onAnalyze: () => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: '12px 14px',
        borderRadius: '14px',
        background: isDark ? `${typeColor}18` : `${typeColor}12`,
        border: `1px solid ${typeColor}35`,
        mb: 2.5,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          background: typeColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AutoAwesome sx={{ fontSize: 16, color: '#fff' }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: isDark ? '#f1f5f9' : '#111',
            lineHeight: 1.2,
          }}
        >
          Improve this goal with AI
        </Typography>
        <Typography
          sx={{
            fontSize: 11,
            color: isDark ? '#94a3b8' : '#6b7280',
            mt: '2px',
          }}
        >
          Get milestone suggestions & analysis
        </Typography>
      </Box>
      <Button
        onClick={onAnalyze}
        size="small"
        sx={{
          flexShrink: 0,
          background: typeColor,
          color: '#fff',
          fontWeight: 600,
          fontSize: 11,
          textTransform: 'none',
          borderRadius: '8px',
          px: 1.5,
          py: 0.75,
          whiteSpace: 'nowrap',
          '&:hover': { background: typeColor, opacity: 0.88 },
        }}
      >
        Analyze →
      </Button>
    </Box>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionTitle({
  children,
  action,
  isDark,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 1.5,
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: isDark ? '#475569' : '#94a3b8',
        }}
      >
        {children}
      </Typography>
      {action}
    </Box>
  );
}

// ─── Milestone date suggestions ───────────────────────────────────────────────

const calculateMilestoneDateSuggestions = (
  goalCreatedDate: Date | null,
  goalDueDate: Date | null,
  existingSteps: GoalStep[],
): Array<{ label: string; date: Date }> => {
  const suggestions: Array<{ label: string; date: Date }> = [];

  if (!goalDueDate) return suggestions;

  const now = new Date();
  const goalStartDate =
    goalCreatedDate || new Date(Date.now() - 30 * DAY_IN_MS);

  // Calculate goal timeline

  const remainingGoalDays = Math.ceil(
    (goalDueDate.getTime() - now.getTime()) / DAY_IN_MS,
  );

  // Calculate average step duration from existing steps
  let avgStepDuration =
    remainingGoalDays / Math.max(1, existingSteps.length + 1);

  if (existingSteps.length > 0) {
    const sortedSteps = existingSteps
      .map((s) => ({
        ...s,
        endDateObj: toPlainDate(s.endDate) || now,
      }))
      .sort((a, b) => a.endDateObj.getTime() - b.endDateObj.getTime());

    const stepDurations: number[] = [];
    let prevDate = goalStartDate;

    for (const step of sortedSteps) {
      const duration = Math.ceil(
        (step.endDateObj.getTime() - prevDate.getTime()) / DAY_IN_MS,
      );
      stepDurations.push(Math.max(1, duration));
      prevDate = step.endDateObj;
    }

    if (stepDurations.length > 0) {
      avgStepDuration =
        stepDurations.reduce((a, b) => a + b, 0) / stepDurations.length;
    }
  }

  // Get the date after the last milestone (or goal start if no milestones)
  const lastStepDate =
    existingSteps.length > 0
      ? toPlainDate(existingSteps[existingSteps.length - 1].endDate) || now
      : goalStartDate;

  // Suggestion 1: Next evenly-spaced milestone
  const nextMilestoneDate = new Date(
    lastStepDate.getTime() + avgStepDuration * DAY_IN_MS,
  );
  if (nextMilestoneDate < goalDueDate) {
    const daysAhead = Math.round(
      (nextMilestoneDate.getTime() - now.getTime()) / DAY_IN_MS,
    );
    const nextLabel =
      daysAhead < 7
        ? `In ${daysAhead} day${daysAhead === 1 ? '' : 's'}`
        : daysAhead === 7
          ? 'In 1 week'
          : daysAhead % 7 === 0
            ? `In ${daysAhead / 7} weeks`
            : `In ${daysAhead} days`;
    suggestions.push({
      label: nextLabel,
      date: nextMilestoneDate,
    });
  }

  const weekLengths = [7, 14, 21];
  const seenDates = new Set<number>();
  if (nextMilestoneDate < goalDueDate) {
    seenDates.add(Math.floor(nextMilestoneDate.getTime() / 1000));
  }

  for (const days of weekLengths) {
    const candidate = new Date(now.getTime() + days * DAY_IN_MS);
    const timestamp = Math.floor(candidate.getTime() / 1000);
    if (
      candidate < goalDueDate &&
      !seenDates.has(timestamp) &&
      candidate.getTime() > now.getTime()
    ) {
      suggestions.push({
        label: days === 7 ? 'In 1 week' : `In ${days / 7} weeks`,
        date: candidate,
      });
      seenDates.add(timestamp);
    }
  }

  // Suggestion 5: Goal due date if it is not too far out
  const dueDateTimestamp = Math.floor(goalDueDate.getTime() / 1000);
  const dueDays = Math.ceil(
    (goalDueDate.getTime() - now.getTime()) / DAY_IN_MS,
  );
  if (!seenDates.has(dueDateTimestamp) && dueDays <= 42) {
    suggestions.push({
      label: 'Goal due date',
      date: goalDueDate,
    });
  } else if (suggestions.length === 0) {
    suggestions.push({
      label: 'Goal due date',
      date: goalDueDate,
    });
  }

  return suggestions;
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const GoalDetailInner: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();
  const { goals, deleteGoal, addGoalStep, updateGoal: _updateGoal, saveGoalTracker, removeGoalTracker, addTrackerCheckIn, loading: _goalsLoading } = useGoals();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addMilestoneDialogOpen, setAddMilestoneDialogOpen] = useState(false);
  const [milestoneFormStep, setMilestoneFormStep] = useState<1 | 2 | 3>(1);
  const [milestoneType, setMilestoneType] = useState<'schedule' | 'todo' | 'finance_source' | 'manual'>('schedule');

  // Form Fields per type
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('09:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('10:00');
  const [todoTime, setTodoTime] = useState('');
  
  // Frequency Options ("Show me")
  const [frequencyMode, setFrequencyMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([1, 3, 5]);
  const [selectedDaysOfMonth, setSelectedDaysOfMonth] = useState<number[]>([1, 15]);

  const [dateMode, setDateMode] = useState<'single' | 'multiple' | 'range'>('single');
  const [selectedSingleDate, setSelectedSingleDate] = useState<Date | null>(new Date());
  const [_selectedMultipleDates, setSelectedMultipleDates] = useState<string[]>([new Date().toISOString().split('T')[0]]);
  const [selectedRangeStartDate, setSelectedRangeStartDate] = useState<Date | null>(new Date());
  const [selectedRangeEndDate, setSelectedRangeEndDate] = useState<Date | null>(new Date(Date.now() + 7 * 86400000));
  const [financeSourceName, setFinanceSourceName] = useState('');
  const [manualTargetVal, setManualTargetVal] = useState<number | ''>('');

  // Step 3 evaluation states
  const [milestoneRole, setMilestoneRole] = useState<'contributive' | 'supportive'>('contributive');
  const [milestoneContributionAmt, setMilestoneContributionAmt] = useState<number | ''>('');
  const [aiEvaluating, setAiEvaluating] = useState(false);
  const [aiReason, setAiReason] = useState<string | null>(null);

  const [savingMilestone, setSavingMilestone] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [firstView, setFirstView] = useState(false);
  const [aiSuggestOpen, setAiSuggestOpen] = useState(false);
  const [trackerModalOpen, setTrackerModalOpen] = useState(false);

  // States for adding linked Task
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDueDate, setNewTodoDueDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [addingTodo, setAddingTodo] = useState(false);

  // States for adding linked Schedule
  const [addEventDialogOpen, setAddEventDialogOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [newEventStartTime, setNewEventStartTime] = useState('09:00');
  const [newEventEndTime, setNewEventEndTime] = useState('10:00');
  const [addingEvent, setAddingEvent] = useState(false);

  const goal = goals.find((g) => g.id === params.id);

  useEffect(() => {
    if (goal?.id) {
      const key = `goal_viewed_${goal.id}`;
      if (!localStorage.getItem(key)) {
        setFirstView(true);
        localStorage.setItem(key, '1');
      }
    }
  }, [goal]);

  const meta = useMemo(() => getTypeMeta(goal?.type), [goal]);
  const typeColor = meta.color;

  const dueDateDate = useMemo(
    () => (goal ? toPlainDate(goal.dueDate) : null),
    [goal],
  );
  const createdDate = useMemo(
    () => (goal?.createdAt ? toPlainDate(goal.createdAt) : null),
    [goal],
  );

  const timeSpentDisplay = useMemo(() => {
    if (!createdDate) return 'N/A';
    const diffMs = Date.now() - createdDate.getTime();
    const diffDays = Math.floor(diffMs / DAY_IN_MS);
    if (diffDays <= 0) {
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      if (diffHours <= 0) {
        const diffMins = Math.floor(diffMs / (60 * 1000));
        if (diffMins <= 0) return 'Just now';
        return `${diffMins}m`;
      }
      return `${diffHours}h`;
    }
    return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
  }, [createdDate]);

  const linkedTodos = useMemo(() => {
    if (!goal?.id) return [];
    return todos.filter(
      (t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id,
    );
  }, [todos, goal?.id]);

  const linkedSchedules = useMemo(() => {
    if (!goal?.id) return [];
    return allSchedules.filter(
      (s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id,
    );
  }, [allSchedules, goal?.id]);

  const daysLeft = useMemo(() => {
    if (!dueDateDate) return 0;
    return Math.ceil((dueDateDate.getTime() - Date.now()) / DAY_IN_MS);
  }, [dueDateDate]);

  useEffect(() => {
    if (!goal && goals.length > 0) router.push('/goals');
  }, [goal, goals, router]);

  const steps: GoalStep[] = useMemo(() => goal?.steps || [], [goal?.steps]);
  const selectedStep = useMemo(
    () =>
      selectedStepId
        ? (steps.find((step) => step.id === selectedStepId) ?? null)
        : null,
    [steps, selectedStepId],
  );
  const doneCnt = steps.filter(
    (s) => s.status === GoalStepStatus.COMPLETED,
  ).length;
  const totalCnt = steps.length;

  // Calculate milestone date suggestions
  const _milestoneDateSuggestions = useMemo(() => {
    return calculateMilestoneDateSuggestions(
      goal?.createdAt ? toPlainDate(goal.createdAt) : null,
      dueDateDate,
      steps,
    );
  }, [goal?.createdAt, dueDateDate, steps]);

  if (!goal) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{ background: isDark ? '#0f172a' : '#f8fafc' }}
      >
        <Typography>Goal not found</Typography>
      </Box>
    );
  }

  const handleDeleteGoal = async () => {
    setLoading(true);
    try {
      await deleteGoal(goal.id!);
      router.push('/goals');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const openAddMilestoneDialog = () => {
    setMilestoneFormStep(1);
    setMilestoneType('schedule');
    setNewMilestoneTitle('');
    setScheduleStartTime('09:00');
    setScheduleEndTime('10:00');
    setTodoTime('');
    setFrequencyMode('daily');
    setSelectedDaysOfWeek([1, 3, 5]);
    setSelectedDaysOfMonth([1, 15]);
    setDateMode('single');
    setSelectedSingleDate(new Date());
    setSelectedMultipleDates([new Date().toISOString().split('T')[0]]);
    setSelectedRangeStartDate(new Date());
    setSelectedRangeEndDate(new Date(Date.now() + 7 * 86400000));
    setFinanceSourceName('');
    setManualTargetVal('');
    setMilestoneRole('contributive');
    setMilestoneContributionAmt('');
    setAiEvaluating(false);
    setAiReason(null);
    setAddMilestoneDialogOpen(true);
  };

  const handleStep2Next = async () => {
    if (milestoneType === 'finance_source') {
      handleCreateMilestone();
      return;
    }

    setAiEvaluating(true);
    setAiReason(null);
    setMilestoneFormStep(3); // Transition immediately to Step 3 so the UI feels responsive!

    const unitStr = goal.unit || goal.overallTargetUnit || 'units';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch('/api/goals/smart-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          action: 'evaluate-milestone-contribution',
          goalTitle: goal.title,
          goalTarget: goal.overallTargetValue || 0,
          goalUnit: unitStr,
          milestoneTitle: newMilestoneTitle,
          milestoneType,
        }),
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));
      if (data.role === 'contributive' || data.role === 'supportive') {
        setMilestoneRole(data.role);
      } else {
        setMilestoneRole('contributive');
      }

      if (typeof data.contributionAmount === 'number') {
        setMilestoneContributionAmt(data.contributionAmount);
      } else if (typeof manualTargetVal === 'number') {
        setMilestoneContributionAmt(manualTargetVal);
      } else {
        setMilestoneContributionAmt(10);
      }

      if (data.reason) {
        setAiReason(data.reason);
      }
    } catch (err) {
      console.warn('AI evaluation warning or timeout, proceeding to step 3 manually:', err);
      setMilestoneRole('contributive');
      setMilestoneContributionAmt(typeof manualTargetVal === 'number' ? manualTargetVal : 10);
    } finally {
      clearTimeout(timeoutId);
      setAiEvaluating(false);
    }
  };

  const handleCreateMilestone = async () => {
    if (!goal?.id) return;
    if (milestoneType !== 'finance_source' && !newMilestoneTitle.trim()) return;
    if (milestoneType === 'finance_source' && !financeSourceName.trim()) return;

    setSavingMilestone(true);
    try {
      const contribAmt = milestoneRole === 'contributive' ? (typeof milestoneContributionAmt === 'number' ? milestoneContributionAmt : (typeof manualTargetVal === 'number' ? manualTargetVal : 0)) : 0;
      const unitStr = goal.unit || goal.overallTargetUnit || 'units';

      let effectiveDueDate = selectedSingleDate;
      if (dateMode === 'range' && selectedRangeEndDate) {
        effectiveDueDate = selectedRangeEndDate;
      }

      if (milestoneType === 'todo' && user) {
        const freqDesc = frequencyMode === 'daily' ? 'Daily' : frequencyMode === 'weekly' ? `Weekly (${selectedDaysOfWeek.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')})` : `Monthly (${selectedDaysOfMonth.join(', ')}th)`;

        const todoId = await addTodo({
          title: newMilestoneTitle.trim(),
          status: 'in_progress',
          priority: 'routine',
          projectId: goal.projectId || '',
          authorId: user.uid,
          dueDate: effectiveDueDate || new Date(),
          steps: [],
          tags: [],
          progressPercent: 0,
          assignedUsers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          linkedGoalId: goal.id,
          goalTitle: goal.title,
          goalRole: milestoneRole,
          contributionAmount: contribAmt,
          contributionUnit: unitStr,
        });

        await addGoalStep(goal.id, {
          title: newMilestoneTitle.trim(),
          targetValue: contribAmt,
          role: milestoneRole,
          contributionAmount: contribAmt,
          contributionUnit: unitStr,
          linkedType: 'todo',
          linkedItemId: todoId,
          endDate: effectiveDueDate || null,
          description: `${freqDesc}${todoTime ? ` at ${todoTime}` : ''}`,
        });
      } else if (milestoneType === 'schedule' && user) {
        const dateStr = effectiveDueDate ? effectiveDueDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const freqDesc = frequencyMode === 'daily' ? 'Daily' : frequencyMode === 'weekly' ? `Weekly (${selectedDaysOfWeek.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')})` : `Monthly (${selectedDaysOfMonth.join(', ')}th)`;

        const schedId = await addSchedule({
          title: newMilestoneTitle.trim(),
          date: dateStr,
          startTime: scheduleStartTime || '09:00',
          endTime: scheduleEndTime || '10:00',
          projectId: goal.projectId || '',
          userId: user.uid,
          status: 'pending',
          priority: 'medium',
          linkedGoalId: goal.id,
          goalTitle: goal.title,
          goalRole: milestoneRole,
          contributionAmount: contribAmt,
          contributionUnit: unitStr,
          frequencyMode,
          selectedDaysOfWeek,
          selectedDaysOfMonth,
        });

        await addGoalStep(goal.id, {
          title: newMilestoneTitle.trim(),
          targetValue: contribAmt,
          role: milestoneRole,
          contributionAmount: contribAmt,
          contributionUnit: unitStr,
          linkedType: 'schedule',
          linkedItemId: schedId,
          endDate: effectiveDueDate || null,
          description: `${freqDesc} (${scheduleStartTime} - ${scheduleEndTime})`,
        });
      } else if (milestoneType === 'finance_source' && user) {
        const srcName = financeSourceName.trim();

        // 1. Add to customPaymentHeads collection so it appears in AddMoney modal
        const headDoc = await addDoc(collection(db, 'customPaymentHeads'), {
          userId: user.uid,
          name: srcName,
          goalId: goal.id,
          goalTitle: goal.title,
          createdAt: Timestamp.now(),
        });

        // 2. Initialize 0 balance entry in totalCashSnapshots
        const snapshotRef = doc(db, 'totalCashSnapshots', user.uid);
        const snap = await getDoc(snapshotRef);

        if (snap.exists()) {
          const data = snap.data();
          const customSources = typeof data?.sources?.custom === 'object' ? { ...data.sources.custom } : {};
          if (customSources[srcName] === undefined) {
            customSources[srcName] = 0;
            await updateDoc(snapshotRef, { 'sources.custom': customSources, updatedAt: new Date() });
          }
        }

        await _updateGoal(goal.id, { linkedSourceId: srcName });

        await addGoalStep(goal.id, {
          title: `Source of Fund: ${srcName}`,
          role: 'contributive',
          contributionAmount: 0,
          contributionUnit: 'PKR',
          linkedType: 'finance_source',
          linkedItemId: headDoc.id,
          endDate: null,
          description: `Linked Finance Source Wallet "${srcName}" (0 PKR initial balance)`,
        });
      } else {
        // Manual step
        await addGoalStep(goal.id, {
          title: newMilestoneTitle.trim(),
          targetValue: contribAmt,
          role: milestoneRole,
          contributionAmount: contribAmt,
          contributionUnit: unitStr,
          linkedType: 'manual',
          weight: 1,
          startDate: selectedRangeStartDate || null,
          endDate: selectedRangeEndDate || selectedSingleDate || null,
        });
      }

      setAddMilestoneDialogOpen(false);
    } catch (e) {
      console.error('Failed to add milestone:', e);
    } finally {
      setSavingMilestone(false);
    }
  };

  const handleCreateLinkedTodo = async () => {
    if (!newTodoTitle.trim() || !user || !goal?.id) return;
    setAddingTodo(true);
    try {
      await addTodo({
        title: newTodoTitle.trim(),
        status: 'in_progress',
        priority: 'routine',
        projectId: goal.projectId || '',
        authorId: user.uid,
        dueDate: newTodoDueDate ? new Date(newTodoDueDate) : new Date(),
        steps: [],
        tags: [],
        progressPercent: 0,
        assignedUsers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        linkedGoalId: goal.id!,
      });
      setNewTodoTitle('');
      setAddTaskDialogOpen(false);
    } catch (e) {
      console.error('Failed to create linked todo:', e);
    } finally {
      setAddingTodo(false);
    }
  };

  const handleCreateLinkedSchedule = async () => {
    if (!newEventTitle.trim() || !user || !goal?.id) return;
    setAddingEvent(true);
    try {
      await addSchedule({
        title: newEventTitle.trim(),
        date: newEventDate,
        startTime: newEventStartTime,
        endTime: newEventEndTime,
        projectId: goal.projectId || '',
        userId: user.uid,
        status: 'pending',
        priority: 'medium',
        linkedGoalId: goal.id,
      });
      setNewEventTitle('');
      setAddEventDialogOpen(false);
    } catch (e) {
      console.error('Failed to create linked schedule:', e);
    } finally {
      setAddingEvent(false);
    }
  };

  const _deriveStatusFromProgress = (progress: number): Goal['status'] => {
    if (progress >= 100) return 'Completed';
    if (progress > 0) return 'In Progress';
    return 'Not Started';
  };

  // colours
  const pageBg = isDark ? '#0f172a' : '#f5f4f0';
  const contentBg = isDark ? '#1e293b' : '#ffffff';
  const mutedText = isDark ? '#64748b' : '#94a3b8';
  const bodyText = isDark ? '#f1f5f9' : '#1a1a1a';
  const surfaceBg = isDark ? '#1e293b' : '#f8f7f4';

  return (
    <Box sx={{ minHeight: '100vh', background: pageBg, pb: 6 }}>
      {/* ── Hero ── */}
      <Box
        sx={{
          position: 'relative',
          background: `linear-gradient(150deg, ${typeColor} 0%, ${typeColor}cc 100%)`,
          px: { xs: 2.5, sm: 3 },
          pt: 2.5,
          pb: 9,
          overflow: 'hidden',
        }}
      >
        {/* Decorative rings */}
        {[220, 150].map((sz, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: sz,
              height: sz,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              top: -sz * 0.4,
              right: -sz * 0.3,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Top bar */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <IconButton
            onClick={() => router.push('/goals')}
            size="small"
            sx={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: '10px',
              '&:hover': { background: 'rgba(255,255,255,0.25)' },
            }}
          >
            <ArrowBack sx={{ fontSize: 18 }} />
          </IconButton>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Edit goal">
              <IconButton
                size="small"
                onClick={() => setEditModalOpen(true)}
                sx={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  borderRadius: '9px',
                  '&:hover': { background: 'rgba(255,255,255,0.25)' },
                }}
              >
                <Edit sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete goal">
              <IconButton
                size="small"
                onClick={() => setDeleteDialogOpen(true)}
                sx={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fca5a5',
                  borderRadius: '9px',
                  '&:hover': { background: 'rgba(255,255,255,0.25)' },
                }}
              >
                <Delete sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Hero body */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            {/* Badge */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                fontFamily: 'monospace',
                px: 1.25,
                py: '4px',
                borderRadius: '999px',
                mb: 1.25,
              }}
            >
              <span>{meta.emoji}</span>
              {meta.label}
            </Box>

            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1.25,
                letterSpacing: '-.02em',
                mb: 0.75,
                fontSize: { xs: 20, sm: 23 },
              }}
            >
              {goal.title}
            </Typography>

            {goal.description && (
              <Typography
                sx={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.72)',
                  lineHeight: 1.5,
                }}
              >
                {goal.description.length > 90
                  ? `${goal.description.slice(0, 90)}…`
                  : goal.description}
              </Typography>
            )}
          </Box>

          <HeroRing pct={goal.progress ?? 0} />
        </Box>
      </Box>

      {/* ── White content card ── */}
      <Box
        sx={{
          background: contentBg,
          borderRadius: { xs: '22px 22px 0 0', sm: '24px 24px 0 0' },
          mt: '-24px',
          position: 'relative',
          zIndex: 2,
          px: { xs: 2, sm: 3 },
          pt: 3,
          pb: 4,
          maxWidth: 680,
          mx: 'auto',
        }}
      >
        {/* Stat strip */}
        <StatStrip
          steps={steps}
          daysLeft={daysLeft}
          priority={goal.priority}
          isDark={isDark}
        />

        {/* AI banner — first view or always show */}
        {firstView && (
          <AIBanner
            typeColor={typeColor}
            isDark={isDark}
            onAnalyze={() => alert('AI suggestion feature coming soon!')}
          />
        )}

        {/* Description (full) */}
        {goal.description && (
          <>
            <SectionTitle isDark={isDark}>About</SectionTitle>
            <Box
              sx={{
                background: surfaceBg,
                borderRadius: '12px',
                p: '13px 14px',
                mb: 2.5,
                fontSize: 13,
                color: isDark ? '#94a3b8' : '#555',
                lineHeight: 1.65,
              }}
            >
              {goal.description}
            </Box>
          </>
        )}

        {/* Milestones / Steps — timeline style */}
        <SectionTitle
          isDark={isDark}
          action={
            <Stack direction="row" spacing={1.5} alignItems="center">
              {!goal.trackerEnabled && steps.length === 0 && (
                <Button
                  size="small"
                  onClick={() => setTrackerModalOpen(true)}
                  sx={{
                    textTransform: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    color: typeColor,
                  }}
                >
                  Create Tracker
                </Button>
              )}
            </Stack>
          }
        >
          {goal.trackerEnabled ? 'Tracker Setup' : `Steps & milestones (${doneCnt}/${totalCnt})`}
        </SectionTitle>
        {goal.trackerEnabled && goal.tracker ? (
          <TrackerView
            goalId={goal.id!}
            goalTitle={goal.title}
            tracker={goal.tracker}
            activityVerb={goal.aiActivityVerb}
            verb={goal.aiVerb}
            progressMode={goal.progressMode}
            direction={goal.direction}
            startValue={goal.startValue}
            typeColor={typeColor}
            isDark={isDark}
            onCheckIn={async (updatedCheckIn) => {
              await addTrackerCheckIn(goal.id!, updatedCheckIn);
            }}
            onRemove={async () => {
              if (confirm('Are you sure you want to remove the tracker? All check-in history will be deleted.')) {
                await removeGoalTracker(goal.id!);
              }
            }}
          />
        ) : (
          <MilestoneList
            goalId={goal.id!}
            steps={steps}
            onStepsChange={() => {
              /* Firestore snapshot updates automatically */
            }}
            onSelectStep={(step) => {
              setSelectedStepId(step.id);
              setSheetOpen(true);
            }}
            onAddStep={openAddMilestoneDialog}
            onTriggerAISuggest={() => setAiSuggestOpen(true)}
            onCreateTracker={() => setTrackerModalOpen(true)}
            typeColor={typeColor}
          />
        )}

        {/* Details grid */}
        <Box sx={{ mt: 1.5, mb: 2.5 }}>
          <SectionTitle isDark={isDark}>Details</SectionTitle>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
            }}
          >
            {[
              {
                label: 'Due date',
                value: fmtDate(dueDateDate),
                sub: dueDateDate
                  ? daysLeft < 0
                    ? `${Math.abs(daysLeft)} days overdue`
                    : `${daysLeft} days left`
                  : null,
                subColor:
                  daysLeft < 0
                    ? '#EF4444'
                    : daysLeft <= 7
                      ? '#F59E0B'
                      : typeColor,
              },
              {
                label: 'Time spent',
                value: timeSpentDisplay,
                sub: createdDate ? `Created ${fmtDate(createdDate)}` : null,
                subColor: typeColor,
              },
              {
                label: 'Status',
                value: goal.status ?? 'In Progress',
                sub: null,
                subColor: typeColor,
              },
              {
                label: 'Progress',
                value: `${goal.progress ?? 0}%`,
                sub: null,
                subColor: typeColor,
              },
            ].map((cell) => (
              <Box
                key={cell.label}
                sx={{
                  background: surfaceBg,
                  borderRadius: '12px',
                  p: '12px 14px',
                }}
              >
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: mutedText,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    mb: '4px',
                  }}
                >
                  {cell.label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: bodyText,
                    fontFamily: 'monospace',
                  }}
                >
                  {cell.value}
                </Typography>
                {cell.sub && (
                  <Typography
                    sx={{ fontSize: 11, color: cell.subColor, mt: '2px' }}
                  >
                    {cell.sub}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Tags */}
        {goal.tags && goal.tags.length > 0 && (
          <>
            <SectionTitle isDark={isDark}>Tags</SectionTitle>
            <Box
              sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px', mb: 2.5 }}
            >
              {goal.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    background: `${typeColor}14`,
                    color: typeColor,
                    fontWeight: 500,
                    fontSize: 11,
                    border: `1px solid ${typeColor}30`,
                  }}
                />
              ))}
            </Box>
          </>
        )}

        {/* Notes */}
        {goal.notes && (
          <>
            <SectionTitle isDark={isDark}>Notes</SectionTitle>
            <Box
              sx={{
                borderLeft: `3px solid ${typeColor}`,
                background: isDark ? `${typeColor}12` : `${typeColor}0a`,
                borderRadius: '0 10px 10px 0',
                p: '12px 14px',
                fontSize: 13,
                color: isDark ? '#94a3b8' : '#555',
                lineHeight: 1.65,
              }}
            >
              {goal.notes}
            </Box>
          </>
        )}
        {/* Tasks & Schedules section */}
        <Box sx={{ mt: 3.5 }}>
          <SectionTitle isDark={isDark}>Linked Tasks & Schedules</SectionTitle>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2.5,
              mt: 1.5,
            }}
          >
            {/* Tasks Block */}
            <Box
              sx={{
                background: surfaceBg,
                borderRadius: '16px',
                p: 2,
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1.5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: bodyText,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                  }}
                >
                  <TodoIcon sx={{ fontSize: 16, color: typeColor }} /> Tasks (
                  {linkedTodos.filter((t) => t.status === 'completed').length}/
                  {linkedTodos.length})
                </Typography>
                <Button
                  size="small"
                  onClick={() => {
                    setNewTodoTitle('');
                    setNewTodoDueDate(new Date().toISOString().split('T')[0]);
                    setAddTaskDialogOpen(true);
                  }}
                  startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    textTransform: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: '8px',
                  }}
                >
                  Add Task
                </Button>
              </Box>

              {linkedTodos.length === 0 ? (
                <Typography
                  sx={{
                    fontSize: 12,
                    color: mutedText,
                    textAlign: 'center',
                    py: 3,
                    fontStyle: 'italic',
                  }}
                >
                  No tasks linked to this goal yet.
                </Typography>
              ) : (
                <Stack
                  spacing={1}
                  sx={{ maxHeight: 240, overflowY: 'auto', pr: 0.5 }}
                >
                  {linkedTodos.map((todo) => {
                    const isTodoCompleted = todo.status === 'completed';
                    const dueDate = todo.dueDate
                      ? toPlainDate(todo.dueDate)
                      : null;
                    return (
                      <Box
                        key={todo.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1.25,
                          borderRadius: '10px',
                          bgcolor: isDark
                            ? 'rgba(255,255,255,0.02)'
                            : '#ffffff',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}`,
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (todo.id) {
                              updateTodo(todo.id, {
                                status: isTodoCompleted
                                  ? 'in_progress'
                                  : 'completed',
                              });
                            }
                          }}
                          sx={{
                            p: 0.25,
                            color: isTodoCompleted ? '#10b981' : mutedText,
                          }}
                        >
                          {isTodoCompleted ? (
                            <CheckCircle sx={{ fontSize: 18 }} />
                          ) : (
                            <RadioButtonUnchecked sx={{ fontSize: 18 }} />
                          )}
                        </IconButton>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: isTodoCompleted ? mutedText : bodyText,
                              textDecoration: isTodoCompleted
                                ? 'line-through'
                                : 'none',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {todo.title}
                          </Typography>
                          {dueDate && (
                            <Typography
                              sx={{
                                fontSize: 10,
                                color: '#ef4444',
                                fontWeight: 500,
                              }}
                            >
                              Due:{' '}
                              {dueDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>

            {/* Schedules Block */}
            <Box
              sx={{
                background: surfaceBg,
                borderRadius: '16px',
                p: 2,
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1.5,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: bodyText,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                  }}
                >
                  <CalendarIcon sx={{ fontSize: 16, color: typeColor }} />{' '}
                  Schedules ({linkedSchedules.length})
                </Typography>
                <Button
                  size="small"
                  onClick={() => {
                    setNewEventTitle('');
                    setNewEventDate(new Date().toISOString().split('T')[0]);
                    setNewEventStartTime('09:00');
                    setNewEventEndTime('10:00');
                    setAddEventDialogOpen(true);
                  }}
                  startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    textTransform: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: '8px',
                  }}
                >
                  Add Event
                </Button>
              </Box>

              {linkedSchedules.length === 0 ? (
                <Typography
                  sx={{
                    fontSize: 12,
                    color: mutedText,
                    textAlign: 'center',
                    py: 3,
                    fontStyle: 'italic',
                  }}
                >
                  No events scheduled for this goal yet.
                </Typography>
              ) : (
                <Stack
                  spacing={1}
                  sx={{ maxHeight: 240, overflowY: 'auto', pr: 0.5 }}
                >
                  {linkedSchedules.map((event) => (
                    <Box
                      key={event.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.25,
                        borderRadius: '10px',
                        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}`,
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: bodyText,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {event.title}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: 10,
                            color: mutedText,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mt: 0.25,
                          }}
                        >
                          📅{' '}
                          {new Date(event.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          ({event.startTime} - {event.endTime})
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      <MilestoneDetailSheet
        open={sheetOpen}
        step={selectedStep}
        goalId={goal.id!}
        onClose={() => {
          setSheetOpen(false);
          setSelectedStepId(null);
        }}
        onUpdate={() => {
          setSheetOpen(false);
          setSelectedStepId(null);
        }}
      />

      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Dialog
          open={addMilestoneDialogOpen}
          onClose={() => setAddMilestoneDialogOpen(false)}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            sx: {
              borderRadius: '24px',
              overflow: 'hidden',
              bgcolor: isDark ? '#0f172a' : '#ffffff',
              color: isDark ? '#f1f5f9' : '#0f172a',
            },
          }}
        >
          {/* Header */}
          <DialogTitle sx={{ fontWeight: 800, pb: 1, pt: 3, px: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 850, fontSize: '1.2rem', color: isDark ? '#f8fafc' : '#0f172a' }}>
              {milestoneFormStep === 1 && 'Choose Milestone Type'}
              {milestoneFormStep === 2 && `Configure ${milestoneType === 'finance_source' ? 'Source of Fund' : milestoneType.charAt(0).toUpperCase() + milestoneType.slice(1)}`}
              {milestoneFormStep === 3 && 'Evaluate Goal Contribution'}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 800, px: 1.5, py: 0.5, borderRadius: '999px', bgcolor: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? '#cbd5e1' : '#475569' }}>
              Step {milestoneFormStep} of {milestoneType === 'finance_source' ? 2 : 3}
            </Typography>
          </DialogTitle>

          {(savingMilestone || aiEvaluating) && (
            <LinearProgress color="primary" sx={{ height: 4, bgcolor: 'rgba(99, 102, 241, 0.15)' }} />
          )}

          <DialogContent sx={{ pt: 1, px: 3, pb: 3 }}>
            {/* ── STEP 1: Vertical List of 4 Options ── */}
            {milestoneFormStep === 1 && (
              <Stack spacing={2} sx={{ pt: 1 }}>
                {[
                  {
                    type: 'schedule',
                    label: 'Schedule',
                    desc: 'Time-based session, single date, multiple dates or range',
                    icon: <CalendarMonth sx={{ fontSize: 26, color: '#fff' }} />,
                    iconBg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    badgeCol: '#8b5cf6',
                  },
                  {
                    type: 'todo',
                    label: 'Todo',
                    desc: 'Actionable checklist item with dates and optional time',
                    icon: <CheckCircle sx={{ fontSize: 26, color: '#fff' }} />,
                    iconBg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                    badgeCol: '#10b981',
                  },
                  {
                    type: 'finance_source',
                    label: 'Source of Fund',
                    desc: 'Dedicated finance account/wallet with 0 balance',
                    icon: <AccountBalanceWallet sx={{ fontSize: 26, color: '#fff' }} />,
                    iconBg: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                    badgeCol: '#f59e0b',
                  },
                  {
                    type: 'manual',
                    label: 'Manual',
                    desc: 'Direct checkpoint with start/end dates & target value',
                    icon: <TrackChanges sx={{ fontSize: 26, color: '#fff' }} />,
                    iconBg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    badgeCol: '#3b82f6',
                  },
                ].map((item) => (
                  <Box
                    key={item.type}
                    onClick={() => {
                      setMilestoneType(item.type as 'schedule' | 'todo' | 'finance_source' | 'manual');
                      setMilestoneFormStep(2);
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2.5,
                      p: 2.25,
                      borderRadius: '18px',
                      cursor: 'pointer',
                      border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#ffffff',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        borderColor: item.badgeCol,
                        boxShadow: isDark
                          ? '0 8px 24px -6px rgba(0,0,0,0.4)'
                          : '0 8px 24px -6px rgba(99, 102, 241, 0.12)',
                        bgcolor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f8fafc',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '16px',
                        background: item.iconBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 6px 16px ${item.badgeCol}35`,
                      }}
                    >
                      {item.icon}
                    </Box>

                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: isDark ? '#f1f5f9' : '#0f172a', mb: 0.25 }}>
                        {item.label}
                      </Typography>
                      <Typography sx={{ fontSize: '0.82rem', color: mutedText, lineHeight: 1.4 }}>
                        {item.desc}
                      </Typography>
                    </Box>

                    <ArrowForward sx={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                  </Box>
                ))}
              </Stack>
            )}

            {/* ── STEP 2: Input Details per Type ── */}
            {milestoneFormStep === 2 && (
              <Stack spacing={2.5} sx={{ pt: 1 }}>
                {/* 1. Schedule Form */}
                {milestoneType === 'schedule' && (
                  <>
                    <TextField
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      label="Schedule Title"
                      placeholder="e.g. Read 10 pages at 10 PM daily"
                      fullWidth
                      autoFocus
                      required
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <TextField
                        type="time"
                        label="Start Time (Optional)"
                        value={scheduleStartTime}
                        onChange={(e) => setScheduleStartTime(e.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        type="time"
                        label="End Time (Optional)"
                        value={scheduleEndTime}
                        onChange={(e) => setScheduleEndTime(e.target.value)}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                      />
                    </Box>

                    {/* ── Frequency Selection Section ("Show me") ── */}
                    <Box sx={{ p: 2.5, borderRadius: '18px', border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`, bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a', mb: 0.5 }}>
                        Show me
                      </Typography>
                      
                      {/* 3 options in one line */}
                      <Stack direction="row" spacing={1} sx={{ mb: frequencyMode === 'daily' ? 0 : 2, mt: 1 }}>
                        {[
                          { id: 'daily', label: 'Daily' },
                          { id: 'weekly', label: 'Day of week' },
                          { id: 'monthly', label: 'Day of month' },
                        ].map((opt) => (
                          <Button
                            key={opt.id}
                            size="small"
                            onClick={() => setFrequencyMode(opt.id as 'daily' | 'weekly' | 'monthly')}
                            variant={frequencyMode === opt.id ? 'contained' : 'outlined'}
                            sx={{
                              flex: 1,
                              borderRadius: '12px',
                              textTransform: 'none',
                              fontWeight: 800,
                              fontSize: 11,
                              py: 1,
                              px: 0.75,
                              lineHeight: 1.2,
                              bgcolor: frequencyMode === opt.id ? '#8b5cf6' : 'transparent',
                              borderColor: frequencyMode === opt.id ? '#8b5cf6' : isDark ? '#334155' : '#cbd5e1',
                              color: frequencyMode === opt.id ? '#ffffff' : isDark ? '#cbd5e1' : '#475569',
                              boxShadow: frequencyMode === opt.id ? '0 4px 12px rgba(139, 92, 246, 0.25)' : 'none',
                              '&:hover': {
                                borderColor: '#8b5cf6',
                              },
                            }}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </Stack>

                      {/* Days of Week selector (Sun - Sat) */}
                      {frequencyMode === 'weekly' && (
                        <Box sx={{ pt: 0.5 }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 750, color: mutedText, mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Select Days of Week:
                          </Typography>
                          <Stack direction="row" spacing={0.5} justifyContent="space-between">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, idx) => {
                              const isSelected = selectedDaysOfWeek.includes(idx);
                              return (
                                <Chip
                                  key={dayName}
                                  label={dayName}
                                  onClick={() => {
                                    if (isSelected) {
                                      if (selectedDaysOfWeek.length > 1) {
                                        setSelectedDaysOfWeek(selectedDaysOfWeek.filter((d) => d !== idx));
                                      }
                                    } else {
                                      setSelectedDaysOfWeek([...selectedDaysOfWeek, idx].sort());
                                    }
                                  }}
                                  variant={isSelected ? 'filled' : 'outlined'}
                                  sx={{
                                    flex: 1,
                                    fontWeight: 800,
                                    fontSize: 11,
                                    borderRadius: '8px',
                                    bgcolor: isSelected ? '#8b5cf6' : 'transparent',
                                    borderColor: isSelected ? '#8b5cf6' : isDark ? '#334155' : '#cbd5e1',
                                    color: isSelected ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
                                    cursor: 'pointer',
                                  }}
                                />
                              );
                            })}
                          </Stack>
                        </Box>
                      )}

                      {/* Days of Month selector (1 - 31) */}
                      {frequencyMode === 'monthly' && (
                        <Box sx={{ pt: 0.5 }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 750, color: mutedText, mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Select Days of Month:
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75, maxHeight: 150, overflowY: 'auto', p: 0.5 }}>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => {
                              const isSelected = selectedDaysOfMonth.includes(dayNum);
                              return (
                                <Chip
                                  key={dayNum}
                                  label={dayNum}
                                  onClick={() => {
                                    if (isSelected) {
                                      if (selectedDaysOfMonth.length > 1) {
                                        setSelectedDaysOfMonth(selectedDaysOfMonth.filter((d) => d !== dayNum));
                                      }
                                    } else {
                                      setSelectedDaysOfMonth([...selectedDaysOfMonth, dayNum].sort((a, b) => a - b));
                                    }
                                  }}
                                  variant={isSelected ? 'filled' : 'outlined'}
                                  sx={{
                                    fontWeight: 800,
                                    fontSize: 11,
                                    borderRadius: '8px',
                                    bgcolor: isSelected ? '#8b5cf6' : 'transparent',
                                    borderColor: isSelected ? '#8b5cf6' : isDark ? '#334155' : '#cbd5e1',
                                    color: isSelected ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
                                    cursor: 'pointer',
                                  }}
                                />
                              );
                            })}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </>
                )}

                {/* 2. Todo Form */}
                {milestoneType === 'todo' && (
                  <>
                    <TextField
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      label="Task Title"
                      placeholder="e.g. Research laptop specs and brands"
                      fullWidth
                      autoFocus
                      required
                    />

                    {/* ── Frequency Selection Section ("Show me") ── */}
                    <Box sx={{ p: 2.5, borderRadius: '18px', border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`, bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a', mb: 0.5 }}>
                        Show me
                      </Typography>
                      
                      {/* 3 options in one line */}
                      <Stack direction="row" spacing={1} sx={{ mb: frequencyMode === 'daily' ? 0 : 2, mt: 1 }}>
                        {[
                          { id: 'daily', label: 'Daily' },
                          { id: 'weekly', label: 'Day of week' },
                          { id: 'monthly', label: 'Day of month' },
                        ].map((opt) => (
                          <Button
                            key={opt.id}
                            size="small"
                            onClick={() => setFrequencyMode(opt.id as 'daily' | 'weekly' | 'monthly')}
                            variant={frequencyMode === opt.id ? 'contained' : 'outlined'}
                            sx={{
                              flex: 1,
                              borderRadius: '12px',
                              textTransform: 'none',
                              fontWeight: 800,
                              fontSize: 11,
                              py: 1,
                              px: 0.75,
                              lineHeight: 1.2,
                              bgcolor: frequencyMode === opt.id ? '#10b981' : 'transparent',
                              borderColor: frequencyMode === opt.id ? '#10b981' : isDark ? '#334155' : '#cbd5e1',
                              color: frequencyMode === opt.id ? '#ffffff' : isDark ? '#cbd5e1' : '#475569',
                              boxShadow: frequencyMode === opt.id ? '0 4px 12px rgba(16, 185, 129, 0.25)' : 'none',
                              '&:hover': {
                                borderColor: '#10b981',
                              },
                            }}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </Stack>

                      {/* Days of Week selector (Sun - Sat) */}
                      {frequencyMode === 'weekly' && (
                        <Box sx={{ pt: 0.5 }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 750, color: mutedText, mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Select Days of Week:
                          </Typography>
                          <Stack direction="row" spacing={0.5} justifyContent="space-between">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, idx) => {
                              const isSelected = selectedDaysOfWeek.includes(idx);
                              return (
                                <Chip
                                  key={dayName}
                                  label={dayName}
                                  onClick={() => {
                                    if (isSelected) {
                                      if (selectedDaysOfWeek.length > 1) {
                                        setSelectedDaysOfWeek(selectedDaysOfWeek.filter((d) => d !== idx));
                                      }
                                    } else {
                                      setSelectedDaysOfWeek([...selectedDaysOfWeek, idx].sort());
                                    }
                                  }}
                                  variant={isSelected ? 'filled' : 'outlined'}
                                  sx={{
                                    flex: 1,
                                    fontWeight: 800,
                                    fontSize: 11,
                                    borderRadius: '8px',
                                    bgcolor: isSelected ? '#10b981' : 'transparent',
                                    borderColor: isSelected ? '#10b981' : isDark ? '#334155' : '#cbd5e1',
                                    color: isSelected ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
                                    cursor: 'pointer',
                                  }}
                                />
                              );
                            })}
                          </Stack>
                        </Box>
                      )}

                      {/* Days of Month selector (1 - 31) */}
                      {frequencyMode === 'monthly' && (
                        <Box sx={{ pt: 0.5 }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 750, color: mutedText, mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Select Days of Month:
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75, maxHeight: 150, overflowY: 'auto', p: 0.5 }}>
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => {
                              const isSelected = selectedDaysOfMonth.includes(dayNum);
                              return (
                                <Chip
                                  key={dayNum}
                                  label={dayNum}
                                  onClick={() => {
                                    if (isSelected) {
                                      if (selectedDaysOfMonth.length > 1) {
                                        setSelectedDaysOfMonth(selectedDaysOfMonth.filter((d) => d !== dayNum));
                                      }
                                    } else {
                                      setSelectedDaysOfMonth([...selectedDaysOfMonth, dayNum].sort((a, b) => a - b));
                                    }
                                  }}
                                  variant={isSelected ? 'filled' : 'outlined'}
                                  sx={{
                                    fontWeight: 800,
                                    fontSize: 11,
                                    borderRadius: '8px',
                                    bgcolor: isSelected ? '#10b981' : 'transparent',
                                    borderColor: isSelected ? '#10b981' : isDark ? '#334155' : '#cbd5e1',
                                    color: isSelected ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
                                    cursor: 'pointer',
                                  }}
                                />
                              );
                            })}
                          </Box>
                        </Box>
                      )}
                    </Box>

                    <TextField
                      type="time"
                      label="Exact Time (Optional)"
                      value={todoTime}
                      onChange={(e) => setTodoTime(e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </>
                )}

                {/* 3. Source of Fund Form */}
                {milestoneType === 'finance_source' && (
                  <>
                    <TextField
                      value={financeSourceName}
                      onChange={(e) => setFinanceSourceName(e.target.value)}
                      label="Fund Wallet Name"
                      placeholder="e.g. Laptop Savings Fund"
                      fullWidth
                      autoFocus
                      required
                    />

                    <Box sx={{ p: 2.5, borderRadius: '16px', bgcolor: 'rgba(245, 158, 11, 0.12)', border: '1px dashed #f59e0b' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: isDark ? '#fbbf24' : '#b45309', mb: 0.5 }}>
                        💰 Initialized with 0 PKR Balance
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.5 }}>
                        This fund will be created in your Finance section. Adding savings to this source will automatically update this Goal&apos;s progress towards target!
                      </Typography>
                    </Box>
                  </>
                )}

                {/* 4. Manual Form */}
                {milestoneType === 'manual' && (
                  <>
                    <TextField
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      label="Milestone Title"
                      placeholder="e.g. Complete literature review"
                      fullWidth
                      autoFocus
                      required
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <DatePicker
                        label="Start Date"
                        value={selectedRangeStartDate}
                        onChange={(val) => setSelectedRangeStartDate(val)}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                      <DatePicker
                        label="End Date"
                        value={selectedRangeEndDate}
                        onChange={(val) => setSelectedRangeEndDate(val)}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    </Box>

                    <TextField
                      type="number"
                      label={`Target Value (${goal.unit || goal.overallTargetUnit || 'units'})`}
                      value={manualTargetVal}
                      onChange={(e) => setManualTargetVal(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 50"
                      fullWidth
                    />
                  </>
                )}
              </Stack>
            )}

            {/* ── STEP 3: AI Evaluation / Contributive vs Supportive ── */}
            {milestoneFormStep === 3 && (
              <Stack spacing={2.5} sx={{ pt: 1 }}>
                {aiEvaluating ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: typeColor, mb: 1 }}>
                      ✨ AI is evaluating contribution...
                    </Typography>
                    <Typography variant="caption" sx={{ color: mutedText }}>
                      Analyzing whether &quot;{newMilestoneTitle}&quot; directly alters numerical progress towards {goal.unit || goal.overallTargetUnit || 'units'}.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {aiReason && (
                      <Box sx={{ p: 2, borderRadius: '14px', bgcolor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#6366f1' }}>
                          💡 AI Analysis: {aiReason}
                        </Typography>
                      </Box>
                    )}

                    <Typography sx={{ fontSize: '11px', fontWeight: 800, color: mutedText, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Progress Role
                    </Typography>
                    <Stack direction="row" gap={1}>
                      <Chip
                        label="⚡ Contributive (Adds numerical progress)"
                        onClick={() => setMilestoneRole('contributive')}
                        variant={milestoneRole === 'contributive' ? 'filled' : 'outlined'}
                        sx={{
                          borderRadius: '10px',
                          fontWeight: 800,
                          fontSize: '11.5px',
                          py: 2.2,
                          borderColor: milestoneRole === 'contributive' ? '#10b981' : isDark ? '#334155' : '#e2e8f0',
                          bgcolor: milestoneRole === 'contributive' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                          color: milestoneRole === 'contributive' ? '#10b981' : mutedText,
                        }}
                      />
                      <Chip
                        label="🤝 Supportive (Enabling)"
                        onClick={() => setMilestoneRole('supportive')}
                        variant={milestoneRole === 'supportive' ? 'filled' : 'outlined'}
                        sx={{
                          borderRadius: '10px',
                          fontWeight: 800,
                          fontSize: '11.5px',
                          py: 2.2,
                          borderColor: milestoneRole === 'supportive' ? '#3b82f6' : isDark ? '#334155' : '#e2e8f0',
                          bgcolor: milestoneRole === 'supportive' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          color: milestoneRole === 'supportive' ? '#3b82f6' : mutedText,
                        }}
                      />
                    </Stack>

                    {milestoneRole === 'contributive' && (
                      <Box sx={{ p: 2.5, borderRadius: '16px', bgcolor: isDark ? '#1e293b' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                        <TextField
                          label={`Contribution Amount (${goal.unit || goal.overallTargetUnit || 'units'})`}
                          type="number"
                          value={milestoneContributionAmt}
                          onChange={(e) => setMilestoneContributionAmt(e.target.value === '' ? '' : Number(e.target.value))}
                          fullWidth
                          size="small"
                          sx={{ mb: 1.5 }}
                        />
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>
                          💡 By marking this done, goal progress will increase by {milestoneContributionAmt || 0} {goal.unit || goal.overallTargetUnit || 'units'}.
                        </Typography>
                      </Box>
                    )}

                    {milestoneRole === 'supportive' && (
                      <Box sx={{ p: 2.5, borderRadius: '16px', bgcolor: isDark ? '#1e293b' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                        <Typography sx={{ fontSize: 12.5, color: mutedText, fontStyle: 'italic' }}>
                          🤝 Supportive item: Helps you complete the goal but will not alter numerical progress directly.
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Stack>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3, pt: 0, gap: 1 }}>
            {milestoneFormStep > 1 && (
              <Button
                onClick={() => setMilestoneFormStep((prev) => (prev - 1) as 1 | 2)}
                sx={{ textTransform: 'none', color: mutedText, fontWeight: 700 }}
              >
                Back
              </Button>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button
              onClick={() => setAddMilestoneDialogOpen(false)}
              sx={{ textTransform: 'none', color: mutedText }}
            >
              Cancel
            </Button>

            {milestoneFormStep === 2 && (
              <Button
                onClick={handleStep2Next}
                disabled={
                  (milestoneType !== 'finance_source' && !newMilestoneTitle.trim()) ||
                  (milestoneType === 'finance_source' && !financeSourceName.trim())
                }
                variant="contained"
                sx={{
                  textTransform: 'none',
                  borderRadius: '12px',
                  bgcolor: typeColor,
                  fontWeight: 800,
                  px: 4,
                  '&:hover': { bgcolor: typeColor, opacity: 0.9 },
                }}
              >
                {milestoneType === 'finance_source' ? 'Create Fund' : 'Next'}
              </Button>
            )}

            {milestoneFormStep === 3 && (
              <Button
                onClick={handleCreateMilestone}
                disabled={savingMilestone || aiEvaluating}
                variant="contained"
                sx={{
                  textTransform: 'none',
                  borderRadius: '12px',
                  bgcolor: '#10b981',
                  color: '#fff',
                  fontWeight: 800,
                  px: 4,
                  '&:hover': { bgcolor: '#059669' },
                }}
              >
                {savingMilestone ? (
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CircularProgress size={18} color="inherit" />
                    <span>Creating Milestone...</span>
                  </Stack>
                ) : (
                  'Create Milestone'
                )}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </LocalizationProvider>

      {/* ── Edit Modal ── */}
      <GoalModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        goal={goal}
      />

      {/* ── Delete Dialog ── */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '18px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 0 }}>Delete goal?</DialogTitle>
        <DialogContent>
          <Typography
            sx={{ fontSize: 13, color: isDark ? '#94a3b8' : '#6b7280', mt: 1 }}
          >
            This action cannot be undone. All milestones and progress will be
            permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteGoal}
            disabled={loading}
            sx={{
              background: '#EF4444',
              color: '#fff',
              textTransform: 'none',
              borderRadius: '8px',
              '&:hover': { background: '#DC2626' },
            }}
            variant="contained"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add Task Dialog ── */}
      <Dialog
        open={addTaskDialogOpen}
        onClose={() => !addingTodo && setAddTaskDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '22px',
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#0f172a',
          },
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
          Add Task to Goal
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
              label="Task Title"
              placeholder="e.g. Finish literature review"
              fullWidth
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTodoTitle.trim() && !addingTodo) {
                  handleCreateLinkedTodo();
                }
              }}
            />
            <TextField
              value={newTodoDueDate}
              onChange={(e) => setNewTodoDueDate(e.target.value)}
              label="Due Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
          <Button
            onClick={() => setAddTaskDialogOpen(false)}
            disabled={addingTodo}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateLinkedTodo}
            disabled={!newTodoTitle.trim() || addingTodo}
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: '10px' }}
          >
            {addingTodo ? 'Adding...' : 'Add Task'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add Event Dialog ── */}
      <Dialog
        open={addEventDialogOpen}
        onClose={() => !addingEvent && setAddEventDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '22px',
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#0f172a',
          },
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
          Schedule Event for Goal
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: 3 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              label="Event Title"
              placeholder="e.g. Sync with mentor"
              fullWidth
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newEventTitle.trim() && !addingEvent) {
                  handleCreateLinkedSchedule();
                }
              }}
            />
            <TextField
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              label="Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                value={newEventStartTime}
                onChange={(e) => setNewEventStartTime(e.target.value)}
                label="Start Time"
                type="time"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                value={newEventEndTime}
                onChange={(e) => setNewEventEndTime(e.target.value)}
                label="End Time"
                type="time"
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
          <Button
            onClick={() => setAddEventDialogOpen(false)}
            disabled={addingEvent}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateLinkedSchedule}
            disabled={!newEventTitle.trim() || addingEvent}
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: '10px' }}
          >
            {addingEvent ? 'Scheduling...' : 'Schedule Event'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── AI Suggest Milestones Modal ── */}
      <AISuggestMilestonesModal
        open={aiSuggestOpen}
        onClose={() => setAiSuggestOpen(false)}
        goal={goal}
        typeColor={typeColor}
        isDark={isDark}
        onAcceptMilestone={async ({ title, description, endDate }) => {
          await addGoalStep(goal.id!, { title, description: description || undefined, weight: 1, endDate });
        }}
      />

      {/* ── Create Tracker Modal ── */}
      <CreateTrackerModal
        open={trackerModalOpen}
        onClose={() => setTrackerModalOpen(false)}
        goal={{
          title: goal.title,
          dueDate: dueDateDate ? dueDateDate.toISOString().split('T')[0] : undefined,
          overallTargetValue: goal.overallTargetValue,
          overallTargetUnit: goal.overallTargetUnit || goal.aiSuggestedUnit,
        }}
        activityVerb={goal.aiActivityVerb}
        verb={goal.aiVerb}
        suggestedUnit={goal.aiSuggestedUnit}
        typeColor={typeColor}
        isDark={isDark}
        onConfirm={(tracker) => saveGoalTracker(goal.id!, tracker)}
      />
    </Box>
  );
};

// ─── Page export ──────────────────────────────────────────────────────────────

export default GoalDetailInner;
