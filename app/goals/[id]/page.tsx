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
  CalendarToday as CalendarIcon,
  Checklist as TodoIcon,
  CheckCircle,
  RadioButtonUnchecked,
} from '@mui/icons-material';

import { useGoals, calculateGoalProgress } from '../../lib/context/GoalsContext';
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
import GoalFurnishingDialog from '../../components/goals/GoalFurnishingDialog';
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
  const { goals, deleteGoal, addGoalStep, updateGoal, saveGoalTracker, removeGoalTracker, addTrackerCheckIn, loading: goalsLoading } = useGoals();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addMilestoneDialogOpen, setAddMilestoneDialogOpen] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneTargetValue, setNewMilestoneTargetValue] = useState<
    number | ''
  >('');
  const [newMilestoneWeight, setNewMilestoneWeight] = useState<number>(1);
  const [newMilestoneEndDate, setNewMilestoneEndDate] = useState<Date | null>(
    new Date(),
  );
  const [newMilestoneNotes, setNewMilestoneNotes] = useState('');
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [firstView, setFirstView] = useState(false);
  const [aiSuggestOpen, setAiSuggestOpen] = useState(false);
  const [trackerModalOpen, setTrackerModalOpen] = useState(false);
  const [furnishingDialogOpen, setFurnishingDialogOpen] = useState(false);

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

  // Trigger furnishing dialog when goal is not furnished/dismissed
  useEffect(() => {
    if (goal && goal.id) {
      const dismissed = localStorage.getItem(`goal_furnish_dismissed_${goal.id}`) === 'true';
      if (goal.goalFurnished !== true && !dismissed && !goalsLoading) {
        setFurnishingDialogOpen(true);
      }
    }
  }, [goal, goalsLoading]);

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
  const milestoneDateSuggestions = useMemo(() => {
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
    setNewMilestoneTitle('');
    setNewMilestoneTargetValue('');
    setNewMilestoneWeight(1);
    setNewMilestoneEndDate(new Date());
    setNewMilestoneNotes('');
    setAddMilestoneDialogOpen(true);
  };

  const handleCreateMilestone = async () => {
    if (!goal?.id || !newMilestoneTitle.trim()) return;
    setSavingMilestone(true);
    try {
      await addGoalStep(goal.id, {
        title: newMilestoneTitle.trim(),
        targetValue:
          newMilestoneTargetValue === ''
            ? undefined
            : Number(newMilestoneTargetValue),
        weight: newMilestoneWeight || 1,
        endDate: newMilestoneEndDate || new Date(),
        description: newMilestoneNotes.trim() || undefined,
      });
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

  const deriveStatusFromProgress = (progress: number): Goal['status'] => {
    if (progress >= 100) return 'Completed';
    if (progress > 0) return 'In Progress';
    return 'Not Started';
  };

  const handleConfirmFurnishing = async (furnishedData: {
    progressMode: 'cumulative' | 'current_value';
    direction: 'up' | 'down' | null;
    startValue: number | null;
    trackingMethod: 'tracker' | 'milestones';
    overallTargetValue?: number;
    overallTargetUnit?: string;
    clarifyingAnswer?: string;
    dueDate?: Date;
    aiVerb?: string;
    aiActivityVerb?: string;
    aiSuggestedUnit?: string;
    title?: string;
  }) => {
    try {
      const updates: Partial<Goal> = {
        progressMode: furnishedData.progressMode,
        direction: furnishedData.direction,
        startValue: furnishedData.startValue,
        trackingMethod: furnishedData.trackingMethod,
        goalFurnished: true,
      };

      if (furnishedData.title !== undefined) {
        updates.title = furnishedData.title;
      }
      if (furnishedData.overallTargetValue !== undefined) {
        updates.overallTargetValue = furnishedData.overallTargetValue;
      }
      if (furnishedData.overallTargetUnit !== undefined) {
        updates.overallTargetUnit = furnishedData.overallTargetUnit;
      }
      if (furnishedData.dueDate !== undefined) {
        updates.dueDate = furnishedData.dueDate;
      }
      if (furnishedData.clarifyingAnswer !== undefined) {
        updates.clarifyingAnswer = furnishedData.clarifyingAnswer;
      }
      if (furnishedData.aiVerb !== undefined) {
        updates.aiVerb = furnishedData.aiVerb;
      }
      if (furnishedData.aiActivityVerb !== undefined) {
        updates.aiActivityVerb = furnishedData.aiActivityVerb;
      }
      if (furnishedData.aiSuggestedUnit !== undefined) {
        updates.aiSuggestedUnit = furnishedData.aiSuggestedUnit;
      }

      const tempGoal = {
        ...goal,
        ...updates,
      } as Goal;
      const newProgress = calculateGoalProgress(tempGoal);
      updates.progress = newProgress;
      updates.status = deriveStatusFromProgress(newProgress);

      await updateGoal(goal!.id!, updates);
      setFurnishingDialogOpen(false);

      if (furnishedData.trackingMethod === 'tracker' && !goal!.trackerEnabled) {
        setTrackerModalOpen(true);
      }
    } catch (e) {
      console.error('Failed to confirm furnishing:', e);
    }
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
              {!goal.trackerEnabled && (
                <Button
                  size="small"
                  onClick={openAddMilestoneDialog}
                  disabled={savingMilestone}
                  sx={{
                    textTransform: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    color: typeColor,
                  }}
                >
                  {savingMilestone ? 'Saving…' : 'Add milestone'}
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
          PaperProps={{ sx: { borderRadius: '22px', overflow: 'hidden' } }}
        >
          <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
            Add milestone
          </DialogTitle>
          <DialogContent sx={{ pt: 2, px: 3 }}>
            <TextField
              value={newMilestoneTitle}
              onChange={(event) => setNewMilestoneTitle(event.target.value)}
              label="Title"
              placeholder="E.g. Finish proposal"
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              value={newMilestoneTargetValue}
              onChange={(event) =>
                setNewMilestoneTargetValue(
                  event.target.value === '' ? '' : Number(event.target.value),
                )
              }
              label="Target value"
              placeholder="E.g. 10"
              type="number"
              fullWidth
              sx={{ mb: 2 }}
            />
            <TextField
              value={newMilestoneWeight}
              onChange={(event) => {
                const value = Number(event.target.value);
                setNewMilestoneWeight(
                  Number.isNaN(value) ? 1 : Math.max(1, Math.min(10, value)),
                );
              }}
              label="Weight (1-10, default 1)"
              placeholder="1"
              type="number"
              inputProps={{ min: 1, max: 10 }}
              fullWidth
              sx={{ mb: 2 }}
            />

            {/* Date picker with suggestions */}
            <Box sx={{ mb: 2 }}>
              <DatePicker
                label="Target date"
                value={newMilestoneEndDate}
                onChange={(newValue) =>
                  setNewMilestoneEndDate(newValue as Date | null)
                }
                slotProps={{
                  textField: {
                    fullWidth: true,
                    helperText:
                      newMilestoneEndDate &&
                      !Number.isNaN(newMilestoneEndDate.getTime())
                        ? fmtDate(newMilestoneEndDate)
                        : 'Choose a due date',
                  },
                }}
              />
            </Box>

            {/* Date suggestions */}
            {milestoneDateSuggestions.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  sx={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: isDark ? '#94a3b8' : '#6b7280',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    mb: 1,
                  }}
                >
                  Smart suggestions
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.75,
                    maxHeight: '120px',
                    overflowY: 'auto',
                    pb: 0.5,
                  }}
                >
                  {milestoneDateSuggestions.map((suggestion, idx) => {
                    const isActive =
                      newMilestoneEndDate &&
                      new Date(newMilestoneEndDate).toDateString() ===
                        suggestion.date.toDateString();
                    return (
                      <Button
                        key={idx}
                        size="small"
                        onClick={() => setNewMilestoneEndDate(suggestion.date)}
                        sx={{
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'none',
                          px: 1.5,
                          py: 0.75,
                          borderRadius: '8px',
                          border: `1.5px solid ${
                            isActive
                              ? typeColor
                              : isDark
                                ? '#475569'
                                : '#cbd5e1'
                          }`,
                          backgroundColor: isActive
                            ? isDark
                              ? `${typeColor}22`
                              : `${typeColor}12`
                            : isDark
                              ? '#1e293b'
                              : '#f1f5f9',
                          color: isActive
                            ? typeColor
                            : isDark
                              ? '#94a3b8'
                              : '#64748b',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            borderColor: typeColor,
                            backgroundColor: isDark
                              ? `${typeColor}22`
                              : `${typeColor}12`,
                            color: typeColor,
                          },
                        }}
                      >
                        {suggestion.label}
                      </Button>
                    );
                  })}
                </Box>
              </Box>
            )}

            <TextField
              value={newMilestoneNotes}
              onChange={(event) => setNewMilestoneNotes(event.target.value)}
              label="Notes (optional)"
              placeholder="Add helpful details or context"
              fullWidth
              multiline
              minRows={3}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
            <Button
              onClick={() => setAddMilestoneDialogOpen(false)}
              sx={{ textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateMilestone}
              disabled={!newMilestoneTitle.trim() || savingMilestone}
              variant="contained"
              sx={{
                textTransform: 'none',
                borderRadius: '10px',
              }}
            >
              {savingMilestone ? 'Creating…' : 'Create milestone'}
            </Button>
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

      <GoalFurnishingDialog
        open={furnishingDialogOpen}
        onClose={() => {
          setFurnishingDialogOpen(false);
          if (goal?.id) {
            localStorage.setItem(`goal_furnish_dismissed_${goal.id}`, 'true');
          }
        }}
        goal={goal}
        userName={
          user?.firstName || 
          (user?.email ? user.email.split('@')[0] : 'Kashif')
        }
        typeColor={typeColor}
        isDark={isDark}
        onConfirm={handleConfirmFurnishing}
      />
    </Box>
  );
};

// ─── Page export ──────────────────────────────────────────────────────────────

export default GoalDetailInner;
