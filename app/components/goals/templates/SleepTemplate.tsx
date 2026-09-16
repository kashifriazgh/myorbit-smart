'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  InputAdornment,
  Modal,
  Fade,
} from '@mui/material';
import {
  NightsStay as MoonIcon,
  WbSunny as SunIcon,
  LocalFireDepartment as FlameIcon,
  Add as AddIcon,
  Event as EventIcon,
  CheckCircle,
  RadioButtonUnchecked,
  Checklist as TodoIcon,
  Delete as DeleteIcon,
  LockClock as LockClockIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface SleepLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  hours: number;
  note?: string;
}

export interface SleepActionItem {
  id: string;
  task: string;
  done: boolean;
  sourceId?: string;
  sourceName?: string;
  assumedContributionValue?: number;
  kind?: 'schedule' | 'todo';
  dueDate?: string;
  time?: string;
  assignee?: string;
  scheduleId?: string;
  todoId?: string;
}

interface SleepTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

function formatDate(dateStr: string | Date | null | undefined) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const SLEEP_HOURS_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export default function SleepTemplate({ goal, onUpdateGoal }: SleepTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo, deleteTodo } = useTodoContext();
  const { allSchedules, addSchedule, editSchedule, removeSchedule } = useSchedules();

  // Strategic Action Tasks State
  const [actions, setActions] = useState<SleepActionItem[]>(() => {
    if (Array.isArray(goal.actions) && goal.actions.length > 0) {
      return goal.actions as unknown as SleepActionItem[];
    }
    return [];
  });
  const [newGeneralStepInput, setNewGeneralStepInput] = useState('');

  // Task Details Modal States
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<SleepActionItem | null>(null);
  const [taskEditText, setTaskEditText] = useState('');
  const [taskEditAssumedVal, setTaskEditAssumedVal] = useState<number | ''>('');
  const [taskEditKind, setTaskEditKind] = useState<'none' | 'schedule' | 'todo'>('none');
  const [showConvertOptions, setShowConvertOptions] = useState(false);
  const [taskEditDate, setTaskEditDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskEditStartTime, setTaskEditStartTime] = useState('22:30');
  const [taskEditEndTime, setTaskEditEndTime] = useState('23:00');
  const [taskEditTodoTime, setTaskEditTodoTime] = useState('');
  const [taskEditAssignee, setTaskEditAssignee] = useState('');
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);

  // Helper: Persist Actions list to Goal
  const saveActionsList = async (updated: SleepActionItem[]) => {
    setActions(updated);
    if (goal.id) {
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, { actions: updated as unknown as Goal['actions'] });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), { actions: updated });
      }
    }
  };

  const handleToggleStepCompletion = async (step: SleepActionItem) => {
    const nextDone = !step.done;
    const updated = actions.map((s) => (s.id === step.id ? { ...s, done: nextDone } : s));
    await saveActionsList(updated);

    if (step.scheduleId && editSchedule) {
      await editSchedule(step.scheduleId, { status: nextDone ? 'completed' : 'pending' }).catch((e) => console.warn(e));
    }
    if (step.todoId && updateTodo) {
      await updateTodo(step.todoId, { status: nextDone ? 'completed' : 'in_progress' }).catch((e) => console.warn(e));
    }
  };

  const handleAddStep = async (taskText: string, sourceId?: string, sourceName?: string) => {
    const text = taskText.trim();
    if (!text) return;

    const newStep: SleepActionItem = {
      id: 'step_' + Date.now(),
      task: text,
      done: false,
      sourceId: sourceId || undefined,
      sourceName: sourceName || undefined,
    };
    const updated = [...actions, newStep];
    await saveActionsList(updated);
  };

  const handleDeleteStep = async (stepId: string) => {
    const step = actions.find((s) => s.id === stepId);
    if (step?.scheduleId && removeSchedule) {
      await removeSchedule(step.scheduleId, true).catch((err) => console.error(err));
    }
    if (step?.todoId && deleteTodo) {
      await deleteTodo(step.todoId, true).catch((err) => console.error(err));
    }
    const updated = actions.filter((s) => s.id !== stepId);
    await saveActionsList(updated);
  };

  const handleOpenTaskDetailModal = (step: SleepActionItem) => {
    setActiveStep(step);
    setTaskEditText(step.task);
    setTaskEditAssumedVal(step.assumedContributionValue || '');
    const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
    setTaskEditKind(kind as 'none' | 'schedule' | 'todo');
    setShowConvertOptions(kind === 'schedule' || kind === 'todo');

    const todayStr = new Date().toISOString().split('T')[0];
    setTaskEditDate(step.dueDate || todayStr);
    setTaskEditStartTime(step.time || '22:30');
    setTaskEditEndTime('23:00');
    setTaskEditTodoTime(step.time || '');
    setTaskEditAssignee(step.assignee || '');
    setTaskModalOpen(true);
  };

  const handleSaveTaskDetail = async () => {
    if (!activeStep || !taskEditText.trim()) return;
    setSavingTaskEdit(true);
    try {
      let updatedScheduleId = activeStep.scheduleId;
      let updatedTodoId = activeStep.todoId;
      const rawDate = taskEditDate || new Date().toISOString().split('T')[0];
      const targetDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;

      if (taskEditKind === 'schedule') {
        if (updatedTodoId && deleteTodo) {
          await deleteTodo(updatedTodoId, true).catch((err) => console.error(err));
          updatedTodoId = undefined;
        }
        if (!updatedScheduleId) {
          if (addSchedule) {
            const created = await addSchedule({
              userId: user?.uid || '',
              title: taskEditText.trim(),
              date: targetDate,
              startTime: taskEditStartTime || '22:30',
              endTime: taskEditEndTime || '23:00',
              status: activeStep.done ? 'completed' : 'pending',
              linkedGoalId: goal.id,
              goalTitle: goal.title,
            });
            if (typeof created === 'string') updatedScheduleId = created;
            else if (created && typeof (created as { id?: string }).id === 'string') updatedScheduleId = (created as { id: string }).id;
          }
        } else if (editSchedule) {
          await editSchedule(updatedScheduleId, {
            title: taskEditText.trim(),
            date: targetDate,
            startTime: taskEditStartTime || '22:30',
            endTime: taskEditEndTime || '23:00',
          });
        }
      } else if (taskEditKind === 'todo') {
        if (updatedScheduleId && removeSchedule) {
          await removeSchedule(updatedScheduleId, true).catch((err) => console.error(err));
          updatedScheduleId = undefined;
        }
        if (!updatedTodoId) {
          if (addTodo) {
            const created = await addTodo({
              title: taskEditText.trim(),
              status: activeStep.done ? 'completed' : 'in_progress',
              priority: 'urgent',
              projectId: goal.projectId || '',
              authorId: user?.uid || '',
              dueDate: new Date(targetDate),
              steps: [],
              tags: [],
              progressPercent: 0,
              assignedUsers: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              linkedGoalId: goal.id,
              goalTitle: goal.title,
            });
            if (typeof created === 'string') updatedTodoId = created;
            else if (created && typeof (created as { id?: string }).id === 'string') updatedTodoId = (created as { id: string }).id;
          }
        } else if (updateTodo) {
          await updateTodo(updatedTodoId, {
            title: taskEditText.trim(),
            dueDate: new Date(targetDate),
          });
        }
      } else {
        if (updatedScheduleId && removeSchedule) {
          await removeSchedule(updatedScheduleId, true).catch((err) => console.error(err));
          updatedScheduleId = undefined;
        }
        if (updatedTodoId && deleteTodo) {
          await deleteTodo(updatedTodoId, true).catch((err) => console.error(err));
          updatedTodoId = undefined;
        }
      }

      const updatedActions = actions.map((s) => {
        if (s.id === activeStep.id) {
          return {
            ...s,
            task: taskEditText.trim(),
            assumedContributionValue: typeof taskEditAssumedVal === 'number' ? taskEditAssumedVal : undefined,
            kind: taskEditKind === 'none' ? undefined : taskEditKind,
            dueDate: targetDate,
            time: taskEditKind === 'schedule' ? taskEditStartTime : taskEditKind === 'todo' ? taskEditTodoTime : undefined,
            assignee: taskEditAssignee.trim() || undefined,
            scheduleId: updatedScheduleId,
            todoId: updatedTodoId,
          };
        }
        return s;
      });

      await saveActionsList(updatedActions);
      setTaskModalOpen(false);
    } catch (err) {
      console.error('Failed to save task detail:', err);
    } finally {
      setSavingTaskEdit(false);
    }
  };

  const answers = goal.questionnaireAnswers || {};

  const targetHours = goal.overallTargetValue || Number(answers.target_hours || answers.hours || 8);
  const bedTime = String(answers.bedtime || answers.bed_time || '10:30 PM');
  const wakeTime = String(answers.wake_time || answers.wake_up_time || '06:30 AM');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Sleep logs stored on goal.sleepLogs (reset dummy data: no fake 12 day streak or default 7.5h)
  const [logs, setLogs] = useState<SleepLogEntry[]>(() => {
    if (Array.isArray(goal.sleepLogs) && goal.sleepLogs.length > 0) {
      return goal.sleepLogs as unknown as SleepLogEntry[];
    }
    return [];
  });

  // Check if today's sleep duration has already been logged
  const todayLog = useMemo(() => logs.find((l) => l.date === todayStr), [logs, todayStr]);
  const hasLoggedToday = Boolean(todayLog);
  const hours = todayLog ? todayLog.hours : (goal.currentValue || 0);

  // Compute real consistency streak (0 initially when no logs exist)
  const streakCount = useMemo(() => {
    if (logs.length === 0) return Number(answers.streak_count || 0);
    const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    const latestDate = new Date(sorted[0].date);
    const diffDays = Math.floor((new Date().getTime() - latestDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays > 1) return 0; // Streak broken

    let prevDateStr = sorted[0].date;
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const p = new Date(prevDateStr);
      const curr = new Date(sorted[i].date);
      const dayDiff = Math.round((p.getTime() - curr.getTime()) / (1000 * 3600 * 24));
      if (dayDiff === 1) {
        streak++;
        prevDateStr = sorted[i].date;
      } else if (dayDiff === 0) {
        continue;
      } else {
        break;
      }
    }
    return streak;
  }, [logs, answers.streak_count]);

  // Dialog state for Custom Sleep Log
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [customHours, setCustomHours] = useState<number | ''>('');
  const [customNote, setCustomNote] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  // Schedule modal states
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('Bedtime Wind-down Routine');
  const [schedTime, setSchedTime] = useState('22:30');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSched, setSavingSched] = useState(false);

  const progress = useMemo(() => {
    if (!targetHours || targetHours <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((hours / targetHours) * 100)));
  }, [hours, targetHours]);

  // Arc geometry
  const radius = 80;
  const circumference = Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  // Filter linked schedules and todos
  const linkedSleepSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const linkedSleepTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  const handleLogSleep = async (value: number, noteTxt?: string) => {
    if (typeof value !== 'number' || value <= 0 || !goal.id) return;
    setSavingLog(true);
    try {
      const newEntry: SleepLogEntry = {
        id: String(Date.now()),
        date: todayStr,
        hours: value,
        note: noteTxt ? noteTxt.trim() : undefined,
      };

      const updatedLogs = [newEntry, ...logs.filter((l) => l.date !== todayStr)];
      setLogs(updatedLogs);

      const updates = {
        sleepLogs: updatedLogs,
        currentValue: value,
      };

      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, updates);
      } else {
        await updateDoc(doc(db, 'goals', goal.id), updates);
      }

      setCustomHours('');
      setCustomNote('');
      setLogModalOpen(false);
    } catch (err) {
      console.error('Failed to log sleep:', err);
    } finally {
      setSavingLog(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Are you sure you want to delete this sleep log?')) return;
    const updatedLogs = logs.filter((l) => l.id !== logId);
    setLogs(updatedLogs);

    const newTodayLog = updatedLogs.find((l) => l.date === todayStr);
    const newCurrent = newTodayLog ? newTodayLog.hours : (updatedLogs[0]?.hours || 0);

    if (goal.id) {
      const updates = { sleepLogs: updatedLogs, currentValue: newCurrent };
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, updates);
      } else {
        await updateDoc(doc(db, 'goals', goal.id), updates);
      }
    }
  };

  const handleScheduleRoutine = async () => {
    if (!schedTitle.trim() || !user || !goal.id) return;
    setSavingSched(true);
    try {
      if (schedKind === 'schedule') {
        await addSchedule({
          title: schedTitle.trim(),
          date: schedDate || new Date().toISOString().split('T')[0],
          startTime: schedTime || '22:30',
          endTime: '23:00',
          projectId: goal.projectId || '',
          userId: user.uid,
          status: 'pending',
          priority: 'medium',
          linkedGoalId: goal.id,
          goalTitle: goal.title,
          frequencyMode: 'daily',
        });
      } else {
        await addTodo({
          title: schedTitle.trim(),
          status: 'in_progress',
          priority: 'routine',
          projectId: goal.projectId || '',
          authorId: user.uid,
          dueDate: schedDate ? new Date(schedDate) : new Date(),
          steps: [],
          tags: [],
          progressPercent: 0,
          assignedUsers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          linkedGoalId: goal.id,
          goalTitle: goal.title,
        });
      }

      setSchedTitle('');
      setSchedModalOpen(false);
    } catch (err) {
      console.error('Failed to schedule sleep routine:', err);
    } finally {
      setSavingSched(false);
    }
  };

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%' }}>
      {/* Dusk-to-Dawn Arc Card */}
      <Box
        sx={{
          borderRadius: '24px',
          border: `1px solid ${cardBorder}`,
          bgcolor: surfaceBg,
          p: 3,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(15,23,42,0.06)',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Sleep Milestone
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: textPrimary, mt: 0.5 }}>
              {goal.title}
            </Typography>
          </Box>
          <Chip
            label={`Goal: ${targetHours}h / night`}
            size="small"
            sx={{ bgcolor: isDark ? '#312e81' : '#e0e7ff', color: '#6366f1', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        {/* Dusk-to-Dawn Arc graphic */}
        <Box sx={{ position: 'relative', mt: 3, display: 'flex', justifyContent: 'center' }}>
          <svg viewBox="0 0 200 110" style={{ width: '100%', maxWidth: 260 }}>
            <defs>
              <linearGradient id="sleepArcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4338ca" />
                <stop offset="55%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>

            <path
              d="M20,100 A80,80 0 0 1 180,100"
              fill="none"
              stroke={isDark ? '#334155' : '#eef2ff'}
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M20,100 A80,80 0 0 1 180,100"
              fill="none"
              stroke="url(#sleepArcGradient)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 500ms ease' }}
            />

            <g transform="translate(20,100)">
              <circle r="10" fill="#4338ca" />
            </g>
            <g transform="translate(180,100)">
              <circle r="10" fill="#f59e0b" />
            </g>
          </svg>

          <Box sx={{ position: 'absolute', top: 52, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 32, fontWeight: 800, color: textPrimary, fontFamily: 'monospace', lineHeight: 1 }}>
              {hours}<span style={{ fontSize: 18, color: textMuted }}>h</span>
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: textMuted, mt: 0.5 }}>
              {progress}% of goal
            </Typography>
          </Box>
        </Box>

        {/* Schedule Pills */}
        <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: isDark ? '#312e81' : '#e0e7ff' }}>
            <MoonIcon sx={{ color: '#6366f1', fontSize: 22 }} />
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
                Bedtime
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                {bedTime}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: isDark ? '#451a03' : '#fffbeb' }}>
            <SunIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>
                Wake Up
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                {wakeTime}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Streak Row (Derived strictly from logs - 0 initially) */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: '16px', bgcolor: isDark ? 'rgba(51,65,85,0.3)' : '#f8fafc' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlameIcon sx={{ color: '#f97316', fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, color: textPrimary }}>
              <strong style={{ color: '#f97316' }}>{streakCount} day</strong> consistency streak
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 12, color: textMuted }}>
            Logged for today: <strong>{hours > 0 ? `${hours}h` : 'No log yet'}</strong>
          </Typography>
        </Box>

        {/* Expanded Sleep Duration Options */}
        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', mb: 1, letterSpacing: '.05em' }}>
            Mark Tonight&apos;s Sleep Duration ({targetHours}h Goal)
          </Typography>

          {/* Quick Preset Buttons (5h to 10h) */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            {SLEEP_HOURS_OPTIONS.map((h) => {
              const isSelected = hours === h;
              return (
                <Button
                  key={h}
                  variant={isSelected ? 'contained' : 'outlined'}
                  disabled={hasLoggedToday}
                  onClick={() => handleLogSleep(h)}
                  size="small"
                  sx={{
                    borderRadius: '12px',
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    minWidth: 48,
                    bgcolor: isSelected ? '#6366f1' : 'transparent',
                    borderColor: isSelected ? '#6366f1' : cardBorder,
                    color: isSelected ? '#ffffff' : textPrimary,
                    '&:hover': { bgcolor: isSelected ? '#4f46e5' : 'rgba(99,102,241,0.08)' },
                    '&.Mui-disabled': {
                      bgcolor: isSelected ? 'rgba(99,102,241,0.5)' : 'transparent',
                      color: isSelected ? '#ffffff' : textMuted,
                      borderColor: cardBorder,
                    },
                  }}
                >
                  {h}h
                </Button>
              );
            })}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
            <Button
              size="small"
              disabled={hasLoggedToday}
              onClick={() => {
                setCustomHours(hours > 0 ? hours : '');
                setCustomNote('');
                setLogModalOpen(true);
              }}
              startIcon={hasLoggedToday ? <LockClockIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 12,
                color: hasLoggedToday ? textMuted : '#6366f1',
                bgcolor: hasLoggedToday ? (isDark ? '#334155' : '#e2e8f0') : isDark ? 'rgba(99,102,241,0.15)' : '#e0e7ff',
                '&:hover': { bgcolor: isDark ? 'rgba(99,102,241,0.25)' : '#c7d2fe' },
              }}
            >
              {hasLoggedToday ? 'Logged for Today' : '+ Custom Hours / Note'}
            </Button>

            {hasLoggedToday ? (
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                ✅ Tonight&apos;s sleep logged: {hours}h · Disabled until tomorrow
              </Typography>
            ) : (
              <Typography sx={{ fontSize: 11.5, color: textMuted }}>
                Log once per day. Option disables after logging until tomorrow.
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Bedtime / Wake-up Schedules */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Scheduled Sleep Routines ({linkedSleepSchedules.length + linkedSleepTodos.length})
          </Typography>
          <Button
            size="small"
            onClick={() => setSchedModalOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#6366f1' }}
          >
            + Schedule Routine
          </Button>
        </Box>

        <Stack spacing={1.25}>
          {linkedSleepSchedules.map((s) => (
            <Box
              key={s.id}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: surfaceBg,
                border: `1px solid ${cardBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <MoonIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    Time: {s.startTime || '10:30 PM'} · Daily Sleep Routine
                  </Typography>
                </Box>
              </Box>
              <Chip label="Routine" size="small" sx={{ bgcolor: isDark ? '#312e81' : '#e0e7ff', color: '#6366f1', fontSize: 10, fontWeight: 700 }} />
            </Box>
          ))}

          {linkedSleepTodos.map((todo) => {
            const isDone = todo.status === 'completed';
            return (
              <Box
                key={todo.id}
                onClick={() => todo.id && updateTodo(todo.id, { status: isDone ? 'in_progress' : 'completed' })}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: surfaceBg,
                  border: `1px solid ${cardBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  cursor: 'pointer',
                }}
              >
                <IconButton size="small" sx={{ p: 0, color: isDone ? '#10b981' : textMuted }}>
                  {isDone ? <CheckCircle sx={{ fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ fontSize: 20 }} />}
                </IconButton>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: isDone ? textMuted : textPrimary, textDecoration: isDone ? 'line-through' : 'none' }}>
                  {todo.title}
                </Typography>
              </Box>
            );
          })}

          {linkedSleepSchedules.length === 0 && linkedSleepTodos.length === 0 && (
            <Typography sx={{ fontSize: 12, color: textMuted, fontStyle: 'italic', textAlign: 'center', py: 2 }}>
              No sleep routines scheduled yet. Click &quot;+ Schedule Routine&quot; to set bedtime or wind-down alarms.
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Sleep History Logs */}
      {logs.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em', mb: 1.5, px: 0.5 }}>
            Recorded Sleep History ({logs.length})
          </Typography>

          <Stack spacing={1.25}>
            {logs.map((entry) => (
              <Box
                key={entry.id}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: surfaceBg,
                  border: `1px solid ${cardBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <MoonIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary, fontFamily: 'monospace' }}>
                      {entry.hours} hours
                    </Typography>
                    {entry.note && (
                      <Typography sx={{ fontSize: 11, color: textMuted }}>
                        {entry.note}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    {formatDate(entry.date)}
                  </Typography>
                  <IconButton size="small" onClick={() => handleDeleteLog(entry.id)} sx={{ color: '#ef4444' }}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Custom Sleep Duration Modal */}
      <Dialog open={logModalOpen} onClose={() => setLogModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Log Today&apos;s Sleep Duration</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Sleep Duration (Hours)"
              type="number"
              fullWidth
              size="small"
              value={customHours}
              onChange={(e) => setCustomHours(e.target.value !== '' ? Number(e.target.value) : '')}
              InputProps={{
                endAdornment: <InputAdornment position="end">hours</InputAdornment>,
              }}
              placeholder="e.g. 7.5"
            />

            <TextField
              label="Notes (Optional)"
              placeholder="e.g. Slept deeply, woke up refreshed"
              fullWidth
              size="small"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLogModalOpen(false)} sx={{ textTransform: 'none', color: textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingLog || typeof customHours !== 'number' || customHours <= 0}
            onClick={() => typeof customHours === 'number' && handleLogSleep(customHours, customNote)}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
          >
            {savingLog ? 'Saving...' : 'Save Log'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Sleep Routine Modal */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Schedule Sleep Routine</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                variant={schedKind === 'schedule' ? 'contained' : 'outlined'}
                onClick={() => setSchedKind('schedule')}
                startIcon={<EventIcon />}
                size="small"
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                Schedule Alarm / Event
              </Button>
              <Button
                fullWidth
                variant={schedKind === 'todo' ? 'contained' : 'outlined'}
                onClick={() => setSchedKind('todo')}
                startIcon={<TodoIcon />}
                size="small"
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                Task Reminder
              </Button>
            </Box>

            <TextField
              label="Routine Title"
              placeholder="e.g. Bedtime Wind-down or Turn off screens"
              fullWidth
              size="small"
              value={schedTitle}
              onChange={(e) => setSchedTitle(e.target.value)}
            />

            <TextField
              label="Time"
              type="time"
              fullWidth
              size="small"
              value={schedTime}
              onChange={(e) => setSchedTime(e.target.value)}
            />

            <TextField
              label="Start Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={schedDate}
              onChange={(e) => setSchedDate(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSchedModalOpen(false)} sx={{ textTransform: 'none', color: textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingSched || !schedTitle.trim()}
            onClick={handleScheduleRoutine}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
          >
            {savingSched ? 'Saving...' : 'Save Routine'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── STRATEGIC TASKS SECTION FOR SLEEP GOAL ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: textPrimary, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              🎯 Strategy Tasks ({actions.length})
            </Typography>
            <Typography sx={{ fontSize: 11, color: textMuted, mt: 0.2 }}>
              Action steps, bedtime habits, and wind-down routines to achieve your sleep target
            </Typography>
          </Box>
        </Box>

        {/* Strategic Tasks List */}
        <div className="space-y-2 mb-3">
          {actions.map((step) => {
            const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
            const hasLink = kind === 'schedule' || kind === 'todo';

            return (
              <div
                key={step.id}
                onClick={() => handleOpenTaskDetailModal(step)}
                className="group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStepCompletion(step);
                    }}
                    className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0 ${
                      step.done
                        ? 'bg-indigo-500 border-indigo-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    {step.done && (
                      <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 stroke-current stroke-[3]">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <span
                    className={`text-xs font-bold truncate ${
                      step.done
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {step.task}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                      hasLink
                        ? kind === 'schedule'
                          ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                          : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {kind === 'schedule'
                      ? '🗓 Schedule'
                      : kind === 'todo'
                      ? '✅ Todo'
                      : '+ Schedule/Todo'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStep(step.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete step"
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Task Creation Box */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="+ Quickly add a strategy task for your sleep goal…"
            value={newGeneralStepInput}
            onChange={(e) => setNewGeneralStepInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newGeneralStepInput.trim()) {
                handleAddStep(newGeneralStepInput);
                setNewGeneralStepInput('');
              }
            }}
            className="flex-1 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => {
              handleAddStep(newGeneralStepInput);
              setNewGeneralStepInput('');
            }}
            disabled={!newGeneralStepInput.trim()}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-xs font-bold transition-colors shadow-sm"
          >
            Add Task
          </button>
        </div>
      </Box>

      {/* ── Dialog: STRATEGY TASK DETAIL MODAL ── */}
      <Modal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        closeAfterTransition
      >
        <Fade in={taskModalOpen}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[28px] w-[90%] sm:w-[440px] shadow-2xl overflow-hidden border outline-none bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[1.05rem] font-extrabold text-slate-800 dark:text-slate-100">
                Task Details
              </p>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Task Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  Task Title / Strategy Step
                </label>
                <input
                  type="text"
                  value={taskEditText}
                  onChange={(e) => setTaskEditText(e.target.value)}
                  placeholder="e.g. Turn off screens by 10 PM"
                  className="w-full text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Toggle Convert Options Button */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowConvertOptions(!showConvertOptions)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-indigo-400 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🗓️</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {taskEditKind === 'schedule'
                          ? 'Converted to Schedule'
                          : taskEditKind === 'todo'
                          ? 'Converted to Todo'
                          : 'Convert to Schedule or Todo'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {taskEditKind === 'none'
                          ? 'Appears in Schedules or Todo lists across app'
                          : `Currently synced as ${taskEditKind}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {showConvertOptions ? 'Hide' : 'Configure'}
                  </span>
                </button>

                {showConvertOptions && (
                  <div className="mt-2.5 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 space-y-3">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('none')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                          taskEditKind === 'none'
                            ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Plain Step
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('schedule')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                          taskEditKind === 'schedule'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        🗓 Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('todo')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                          taskEditKind === 'todo'
                            ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        ✅ Todo
                      </button>
                    </div>

                    {taskEditKind !== 'none' && (
                      <div className="space-y-2.5 pt-1">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                            {taskEditKind === 'schedule' ? 'Schedule Date' : 'Due Date'}
                          </label>
                          <input
                            type="date"
                            value={taskEditDate}
                            onChange={(e) => setTaskEditDate(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        {taskEditKind === 'schedule' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={taskEditStartTime}
                                onChange={(e) => setTaskEditStartTime(e.target.value)}
                                className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={taskEditEndTime}
                                onChange={(e) => setTaskEditEndTime(e.target.value)}
                                className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Assignee Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  Assignee (Optional)
                </label>
                <input
                  type="text"
                  value={taskEditAssignee}
                  onChange={(e) => setTaskEditAssignee(e.target.value)}
                  placeholder="e.g. Self"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (activeStep) {
                    handleDeleteStep(activeStep.id);
                    setTaskModalOpen(false);
                  }
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              >
                Delete Task
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  Cancel
                </button>
                <Button
                  variant="contained"
                  disabled={savingTaskEdit || !taskEditText.trim()}
                  onClick={handleSaveTaskDetail}
                  sx={{
                    borderRadius: '12px',
                    px: 3,
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: '#6366f1',
                    color: '#fff',
                    '&:hover': { bgcolor: '#4f46e5' },
                  }}
                >
                  {savingTaskEdit ? 'Saving...' : 'Save Task'}
                </Button>
              </div>
            </div>
          </div>
        </Fade>
      </Modal>
    </Box>
  );
}
