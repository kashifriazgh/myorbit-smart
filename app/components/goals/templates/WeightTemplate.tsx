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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  Modal,
  Fade,
} from '@mui/material';
import {
  MonitorWeight as WeightIcon,
  FitnessCenter as ExerciseIcon,
  Restaurant as DietIcon,
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

export interface WeightLogEntry {
  id?: string;
  date: string;
  weight: number;
  note?: string;
}

export interface WeightActionItem {
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

interface WeightTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

function formatDate(dateStr: string | Date | null | undefined) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseDateVal(dateVal: unknown): Date {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'object' && 'toDate' in (dateVal as { toDate: () => Date })) {
    return (dateVal as { toDate: () => Date }).toDate();
  }
  if (typeof dateVal === 'object' && 'seconds' in (dateVal as { seconds: number })) {
    return new Date((dateVal as { seconds: number }).seconds * 1000);
  }
  return new Date(String(dateVal));
}

export default function WeightTemplate({ goal, onUpdateGoal }: WeightTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo, deleteTodo } = useTodoContext();
  const { allSchedules, addSchedule, editSchedule, removeSchedule } = useSchedules();

  // Strategic Action Tasks State
  const [actions, setActions] = useState<WeightActionItem[]>(() => {
    if (Array.isArray(goal.actions) && goal.actions.length > 0) {
      return goal.actions as unknown as WeightActionItem[];
    }
    return [];
  });
  const [newGeneralStepInput, setNewGeneralStepInput] = useState('');

  // Task Details Modal States
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<WeightActionItem | null>(null);
  const [taskEditText, setTaskEditText] = useState('');
  const [taskEditAssumedVal, setTaskEditAssumedVal] = useState<number | ''>('');
  const [taskEditKind, setTaskEditKind] = useState<'none' | 'schedule' | 'todo'>('none');
  const [showConvertOptions, setShowConvertOptions] = useState(false);
  const [taskEditDate, setTaskEditDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskEditStartTime, setTaskEditStartTime] = useState('07:00');
  const [taskEditEndTime, setTaskEditEndTime] = useState('08:00');
  const [taskEditTodoTime, setTaskEditTodoTime] = useState('');
  const [taskEditAssignee, setTaskEditAssignee] = useState('');
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);

  // Helper: Persist Actions list to Goal
  const saveActionsList = async (updated: WeightActionItem[]) => {
    setActions(updated);
    if (goal.id) {
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, { actions: updated as unknown as Goal['actions'] });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), { actions: updated });
      }
    }
  };

  const handleToggleStepCompletion = async (step: WeightActionItem) => {
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

    const newStep: WeightActionItem = {
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

  const handleOpenTaskDetailModal = (step: WeightActionItem) => {
    setActiveStep(step);
    setTaskEditText(step.task);
    setTaskEditAssumedVal(step.assumedContributionValue || '');
    const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
    setTaskEditKind(kind as 'none' | 'schedule' | 'todo');
    setShowConvertOptions(kind === 'schedule' || kind === 'todo');

    const todayStr = new Date().toISOString().split('T')[0];
    setTaskEditDate(step.dueDate || todayStr);
    setTaskEditStartTime(step.time || '07:00');
    setTaskEditEndTime('08:00');
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
              startTime: taskEditStartTime || '07:00',
              endTime: taskEditEndTime || '08:00',
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
            startTime: taskEditStartTime || '07:00',
            endTime: taskEditEndTime || '08:00',
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
  const unit = String(goal.overallTargetUnit || answers.unit || 'kg');

  const initialWeight = Number(answers.initial_weight || answers.current_weight || 80);
  const targetWeight = Number(goal.overallTargetValue || answers.target_weight || 70);

  // Frequency of logging from questionnaire (e.g. 'weekly', 'biweekly', 'monthly')
  const loggingFreq = String(answers.logging_frequency || 'weekly').toLowerCase();

  // Weight logs stored on goal.weightLogs
  const [logs, setLogs] = useState<WeightLogEntry[]>(() => {
    if (Array.isArray(goal.weightLogs) && goal.weightLogs.length > 0) {
      return goal.weightLogs as unknown as WeightLogEntry[];
    }
    return [
      { id: '1', date: new Date().toISOString().split('T')[0], weight: Number(goal.currentValue || answers.current_weight || initialWeight) },
    ];
  });

  const [addLogOpen, setAddLogOpen] = useState(false);
  const [logWeight, setLogWeight] = useState<number | ''>('');
  const [logNote, setLogNote] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  // Affect Weight Action Modal (Exercise or Diet schedule)
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionCategory, setActionCategory] = useState<'exercise' | 'diet'>('exercise');
  const [actionKind, setActionKind] = useState<'schedule' | 'todo'>('schedule');
  const [actionTitle, setActionTitle] = useState('');
  const [actionTime, setActionTime] = useState('07:00');
  const [actionDate, setActionDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingAction, setSavingAction] = useState(false);

  const currentWeight = logs.length > 0 ? logs[0].weight : (goal.currentValue || initialWeight);

  const isWeightLoss = initialWeight >= targetWeight;
  const totalChangeNeeded = Math.abs(initialWeight - targetWeight);
  const changeAchieved = isWeightLoss ? (initialWeight - currentWeight) : (currentWeight - initialWeight);

  const progress = totalChangeNeeded > 0
    ? Math.max(0, Math.min(100, Math.round((changeAchieved / totalChangeNeeded) * 100)))
    : 100;

  // Calculate next allowed weigh-in date based on frequency restriction
  const nextLogInfo = useMemo(() => {
    // Get last log date
    const lastDate = logs.length > 0 && logs[0].date
      ? parseDateVal(logs[0].date)
      : (goal.createdAt ? parseDateVal(goal.createdAt) : new Date());

    let daysRequired = 7; // default weekly
    if (loggingFreq.includes('biweekly')) {
      daysRequired = 14;
    } else if (loggingFreq.includes('monthly')) {
      daysRequired = 30;
    } else if (loggingFreq.includes('daily')) {
      daysRequired = 1;
    } else if (loggingFreq.includes('weekly')) {
      daysRequired = 7;
    }

    const nextAllowedDate = new Date(lastDate.getTime() + daysRequired * 24 * 60 * 60 * 1000);
    const now = new Date();

    // If no logs recorded yet, allow immediately
    if (logs.length === 0) {
      return { canLog: true, daysRemaining: 0, nextAllowedDate, daysRequired };
    }

    const diffTime = nextAllowedDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const canLog = diffTime <= 0;

    return { canLog, daysRemaining: Math.max(0, daysRemaining), nextAllowedDate, daysRequired };
  }, [logs, loggingFreq, goal.createdAt]);

  // Filter linked schedules and todos
  const linkedWeightSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const linkedWeightTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  const handleAddWeightLog = async () => {
    // Note: 0 weight is allowed (e.g. 0 kg gain/loss or 0 weight change)
    if (typeof logWeight !== 'number' || logWeight < 0 || !goal.id) return;
    setSavingLog(true);
    try {
      const newEntry: WeightLogEntry = {
        id: String(Date.now()),
        date: new Date().toISOString().split('T')[0],
        weight: logWeight,
        note: logNote.trim() || undefined,
      };
      const updatedLogs = [newEntry, ...logs];
      setLogs(updatedLogs);

      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, {
          weightLogs: updatedLogs,
          currentValue: logWeight,
        });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), {
          weightLogs: updatedLogs,
          currentValue: logWeight,
        });
      }

      setLogWeight('');
      setLogNote('');
      setAddLogOpen(false);
    } catch (err) {
      console.error('Failed to log weight:', err);
    } finally {
      setSavingLog(false);
    }
  };

  const handleDeleteWeightLog = async (entryIdx: number) => {
    if (!confirm('Are you sure you want to delete this weight log entry?')) return;
    const updatedLogs = logs.filter((_, idx) => idx !== entryIdx);
    setLogs(updatedLogs);

    const newCurrent = updatedLogs.length > 0 ? updatedLogs[0].weight : initialWeight;
    if (goal.id) {
      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, {
          weightLogs: updatedLogs,
          currentValue: newCurrent,
        });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), {
          weightLogs: updatedLogs,
          currentValue: newCurrent,
        });
      }
    }
  };

  const handleAddAffectAction = async () => {
    if (!actionTitle.trim() || !user || !goal.id) return;
    setSavingAction(true);
    try {
      const prefix = actionCategory === 'exercise' ? '[Exercise]' : '[Diet]';
      const fullTitle = `${prefix} ${actionTitle.trim()}`;

      if (actionKind === 'schedule') {
        await addSchedule({
          title: fullTitle,
          date: actionDate || new Date().toISOString().split('T')[0],
          startTime: actionTime || '07:00',
          endTime: '08:00',
          projectId: goal.projectId || '',
          userId: user.uid,
          status: 'pending',
          priority: 'high',
          linkedGoalId: goal.id,
          goalTitle: goal.title,
          frequencyMode: 'daily',
        });
      } else {
        await addTodo({
          title: fullTitle,
          status: 'in_progress',
          priority: 'urgent',
          projectId: goal.projectId || '',
          authorId: user.uid,
          dueDate: actionDate ? new Date(actionDate) : new Date(),
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

      setActionTitle('');
      setActionModalOpen(false);
    } catch (err) {
      console.error('Failed to add weight action:', err);
    } finally {
      setSavingAction(false);
    }
  };

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header Card */}
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
              Weight Goal ({isWeightLoss ? 'Weight Loss' : 'Weight Gain'}) · {loggingFreq.toUpperCase()} Schedule
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: textPrimary, mt: 0.5 }}>
              {goal.title}
            </Typography>
          </Box>
          <Chip
            label={`${progress}% Achieved`}
            size="small"
            sx={{ bgcolor: isDark ? '#064e3b' : '#ecfdf5', color: '#10b981', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        {/* Big Weight Numbers */}
        <Box sx={{ mt: 3, display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 32, fontWeight: 800, color: textPrimary, fontFamily: 'monospace' }}>
            {currentWeight} {unit}
          </Typography>
          <Typography sx={{ fontSize: 13, color: textMuted }}>
            Initial: {initialWeight} {unit} · Target: {targetWeight} {unit}
          </Typography>
        </Box>

        {/* Scale Progress Bar */}
        <Box sx={{ mt: 2, height: 8, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: '#10b981', borderRadius: 99, transition: 'width 0.5s ease' }} />
        </Box>

        <Typography sx={{ mt: 1.5, fontSize: 12, color: textMuted }}>
          {isWeightLoss
            ? `${Math.abs(changeAchieved).toFixed(1)} ${unit} lost out of ${totalChangeNeeded} ${unit} target`
            : `${Math.abs(changeAchieved).toFixed(1)} ${unit} gained out of ${totalChangeNeeded} ${unit} target`}
        </Typography>

        {/* Log Weight Button & Frequency Lock Enforcement */}
        <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
          <Tooltip
            title={
              !nextLogInfo.canLog
                ? `Next weigh-in available in ${nextLogInfo.daysRemaining} days (${loggingFreq} schedule)`
                : ''
            }
          >
            <span>
              <Button
                variant="contained"
                disabled={!nextLogInfo.canLog}
                onClick={() => setAddLogOpen(true)}
                startIcon={!nextLogInfo.canLog ? <LockClockIcon /> : <AddIcon />}
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: '#10b981',
                  '&:hover': { bgcolor: '#059669' },
                  '&.Mui-disabled': {
                    bgcolor: isDark ? '#334155' : '#e2e8f0',
                    color: textMuted,
                  },
                }}
              >
                + Log Current Weight
              </Button>
            </span>
          </Tooltip>

          {!nextLogInfo.canLog && (
            <Typography sx={{ fontSize: 12, color: textMuted, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              🔒 Next weigh-in available in <strong>{nextLogInfo.daysRemaining} {nextLogInfo.daysRemaining === 1 ? 'day' : 'days'}</strong> ({loggingFreq} schedule)
            </Typography>
          )}
        </Box>
      </Box>

      {/* Affect Weight Actions Section (Exercise or Nutrition schedules) */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Exercise & Diet Schedules to Affect Weight ({linkedWeightSchedules.length + linkedWeightTodos.length})
          </Typography>
          <Button
            size="small"
            onClick={() => setActionModalOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#0284c7' }}
          >
            + Create Exercise/Diet Schedule
          </Button>
        </Box>

        <Stack spacing={1.25}>
          {linkedWeightSchedules.map((s) => (
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
                {s.title.includes('[Diet]') ? (
                  <DietIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
                ) : (
                  <ExerciseIcon sx={{ color: '#0284c7', fontSize: 20 }} />
                )}
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    Scheduled: {s.startTime || '07:00 AM'} · Daily Routine
                  </Typography>
                </Box>
              </Box>
              <Chip label="Schedule" size="small" sx={{ bgcolor: isDark ? '#0c4a6e' : '#e0f2fe', color: '#0284c7', fontSize: 10, fontWeight: 700 }} />
            </Box>
          ))}

          {linkedWeightTodos.map((todo) => {
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

          {linkedWeightSchedules.length === 0 && linkedWeightTodos.length === 0 && (
            <Typography sx={{ fontSize: 12, color: textMuted, fontStyle: 'italic', textAlign: 'center', py: 2 }}>
              No exercise or diet routines scheduled yet. Click &quot;+ Create Exercise/Diet Schedule&quot; to add workouts or meal plans affecting your weight.
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Weight History Logs */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em', mb: 1.5, px: 0.5 }}>
          Weight History Log ({logs.length})
        </Typography>

        <Stack spacing={1.25}>
          {logs.map((entry, idx) => (
            <Box
              key={entry.id || idx}
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
                <WeightIcon sx={{ color: '#10b981', fontSize: 20 }} />
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary, fontFamily: 'monospace' }}>
                    {entry.weight} {unit}
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
                <IconButton size="small" onClick={() => handleDeleteWeightLog(idx)} sx={{ color: '#ef4444' }}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Log Weight Dialog */}
      <Dialog open={addLogOpen} onClose={() => setAddLogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Log Current Weight</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={`Current Weight (${unit})`}
              type="number"
              fullWidth
              size="small"
              value={logWeight}
              onChange={(e) => setLogWeight(e.target.value !== '' ? Number(e.target.value) : '')}
              helperText="Note: 0 value is allowed if zero weight was gained/lost."
            />

            <TextField
              label="Note (Optional)"
              placeholder="e.g. Morning weigh-in before breakfast"
              fullWidth
              size="small"
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddLogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingLog || typeof logWeight !== 'number' || logWeight < 0}
            onClick={handleAddWeightLog}
            sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Save Weight Log
          </Button>
        </DialogActions>
      </Dialog>

      {/* Affect Weight Action Modal */}
      <Dialog open={actionModalOpen} onClose={() => setActionModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Create Exercise or Diet Schedule</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select value={actionCategory} label="Category" onChange={(e) => setActionCategory(e.target.value as 'exercise' | 'diet')}>
                <MenuItem value="exercise">Exercise / Workout Routine</MenuItem>
                <MenuItem value="diet">Nutrition / Diet Plan</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                fullWidth
                variant={actionKind === 'schedule' ? 'contained' : 'outlined'}
                onClick={() => setActionKind('schedule')}
                startIcon={<EventIcon />}
                size="small"
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                Schedule Event
              </Button>
              <Button
                fullWidth
                variant={actionKind === 'todo' ? 'contained' : 'outlined'}
                onClick={() => setActionKind('todo')}
                startIcon={<TodoIcon />}
                size="small"
                sx={{ textTransform: 'none', borderRadius: '10px' }}
              >
                Task Reminder
              </Button>
            </Box>

            <TextField
              label="Schedule Title"
              placeholder={actionCategory === 'exercise' ? 'e.g. 45-min Cardio or Fat Burn Workout' : 'e.g. Low Carb Dinner or Protein Smoothie'}
              fullWidth
              size="small"
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
            />

            <TextField
              label="Time"
              type="time"
              fullWidth
              size="small"
              value={actionTime}
              onChange={(e) => setActionTime(e.target.value)}
            />

            <TextField
              label="Start Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={actionDate}
              onChange={(e) => setActionDate(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActionModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingAction || !actionTitle.trim()}
            onClick={handleAddAffectAction}
            sx={{ textTransform: 'none', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            Save Schedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── 4. STRATEGIC TASKS SECTION FOR WEIGHT GOAL ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: textPrimary, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              🎯 Strategy Tasks ({actions.length})
            </Typography>
            <Typography sx={{ fontSize: 11, color: textMuted, mt: 0.2 }}>
              Action steps, diet controls, and exercise routines to achieve your weight target
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
                className="group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 shadow-sm"
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
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-emerald-400'
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
            placeholder="+ Quickly add a strategy task for your weight goal…"
            value={newGeneralStepInput}
            onChange={(e) => setNewGeneralStepInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newGeneralStepInput.trim()) {
                handleAddStep(newGeneralStepInput);
                setNewGeneralStepInput('');
              }
            }}
            className="flex-1 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => {
              handleAddStep(newGeneralStepInput);
              setNewGeneralStepInput('');
            }}
            disabled={!newGeneralStepInput.trim()}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold transition-colors shadow-sm"
          >
            Add Task
          </button>
        </div>
      </Box>

      {/* ── Dialog 4: STRATEGY TASK DETAIL MODAL ── */}
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
                  placeholder="e.g. 45-min morning cardio session"
                  className="w-full text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Toggle Convert Options Button */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowConvertOptions(!showConvertOptions)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-emerald-400 text-left transition-colors"
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
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
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
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
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
                  placeholder="e.g. Self, Nutritionist"
                  className="w-full text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
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
                    bgcolor: '#10b981',
                    color: '#fff',
                    '&:hover': { bgcolor: '#059669' },
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
