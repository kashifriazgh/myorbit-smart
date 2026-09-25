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
  Close as CloseIcon,
  Remove as RemoveIcon,
  Hotel as BedDoubleIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';

export interface SleepLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  objective?: 'sleepBetter' | 'sleepOnTime' | 'wakeUpOnTime' | 'overall' | string;
  actualSleepHours?: number;
  targetSleepHours?: number;
  differenceHours?: number;
  actualSleepTime?: string;
  targetSleepTime?: string;
  sleepDiffMinutes?: number;
  actualWakeTime?: string;
  targetWakeTime?: string;
  wakeDiffMinutes?: number;
  dailyProgress?: number; // 0 - 100
  differenceDirection?: 'early' | 'late' | 'less' | 'more' | 'on_target';
  sleepTimeProgress?: number;
  wakeTimeProgress?: number;
  actualValueStr?: string;
  targetValueStr?: string;
  differenceFormatted?: string;
  isUnlogged?: boolean;
  hours?: number; // legacy fallback
  note?: string;
  timestamp?: string;
}

export interface ComputedSleepMetrics {
  isLogged: boolean;
  objective: string;
  actualValueStr: string;
  targetValueStr: string;
  actualSleepHours?: number;
  targetSleepHours?: number;
  actualSleepTime?: string;
  targetSleepTime?: string;
  actualWakeTime?: string;
  targetWakeTime?: string;
  differenceVal: number;
  differenceDirection: 'early' | 'late' | 'less' | 'more' | 'on_target';
  differenceFormatted: string;
  dailyProgress: number;
  sleepTimeProgress?: number;
  wakeTimeProgress?: number;
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

// Time & Duration manipulation helpers
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim();
  const isPM = /pm/i.test(cleaned);
  const isAM = /am/i.test(cleaned);
  const parts = cleaned.replace(/(am|pm)/i, '').trim().split(':');
  let hours = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  return hours * 60 + mins;
}

function minutesTo12HourComponents(totalMins: number) {
  const m = ((totalMins % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const minutes = m % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  let hours12 = h24 % 12;
  if (hours12 === 0) hours12 = 12;
  return {
    hours: hours12,
    minutes: minutes.toString().padStart(2, '0'),
    period,
    formattedStr: `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`,
  };
}

function formatDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return { h, m };
}

function calcTimeDiffMinutes(actualStr: string, targetStr: string): number {
  const act = timeToMinutes(actualStr);
  const tgt = timeToMinutes(targetStr);
  let diff = act - tgt;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

function formatDiffBadge(diffMins: number): string {
  if (diffMins === 0) return 'On time ✓';
  const abs = Math.abs(diffMins);
  const hrs = Math.floor(abs / 60);
  const mins = abs % 60;
  const formatted = hrs > 0 ? `${hrs}h ${mins > 0 ? `${mins}m` : ''}` : `${mins}m`;
  return diffMins > 0 ? `+${formatted} late` : `-${formatted} early`;
}

/**
 * Calculates sleep daily metrics & progress strictly based on objective
 */
export function computeSleepMetrics(
  log: SleepLogEntry | undefined | null,
  objective: string,
  targets: {
    targetSleepHours?: number | null;
    targetSleepTime?: string | null;
    targetWakeTime?: string | null;
  },
  acceptableDeviationMinutes = 60,
  toleranceMinutes = 15
): ComputedSleepMetrics {
  if (!log) {
    return {
      isLogged: false,
      objective,
      actualValueStr: '—',
      targetValueStr: '—',
      differenceVal: 0,
      differenceDirection: 'on_target',
      differenceFormatted: 'Unlogged',
      dailyProgress: 0,
    };
  }

  if (objective === 'sleep_better' || objective === 'sleepBetter') {
    const actHours = log.actualSleepHours ?? log.hours;
    if (actHours === undefined || actHours === null) {
      return {
        isLogged: false,
        objective,
        actualValueStr: '—',
        targetValueStr: '—',
        differenceVal: 0,
        differenceDirection: 'on_target',
        differenceFormatted: 'Unlogged',
        dailyProgress: 0,
      };
    }
    const tgtHours = log.targetSleepHours ?? targets.targetSleepHours ?? 7;
    const actMins = actHours * 60;
    const tgtMins = tgtHours * 60;
    const durationProgress = Math.min(100, Math.max(0, Math.round((actMins / tgtMins) * 100)));
    const diffMins = Math.round(actMins - tgtMins);
    const diffHours = Number((actHours - tgtHours).toFixed(2));
    const dir = diffHours > 0 ? 'more' : diffHours < 0 ? 'less' : 'on_target';
    const formatted =
      diffHours === 0
        ? 'On target ✓'
        : diffHours > 0
        ? `+${diffHours}h more than target`
        : `${diffHours}h less than target`;

    return {
      isLogged: true,
      objective,
      actualValueStr: `${actHours}h`,
      targetValueStr: `${tgtHours}h`,
      actualSleepHours: actHours,
      targetSleepHours: tgtHours,
      differenceVal: diffMins,
      differenceDirection: dir,
      differenceFormatted: formatted,
      dailyProgress: durationProgress,
    };
  }

  if (objective === 'sleep_on_time' || objective === 'sleepOnTime') {
    const actSleep = log.actualSleepTime;
    if (!actSleep) {
      return {
        isLogged: false,
        objective,
        actualValueStr: '—',
        targetValueStr: '—',
        differenceVal: 0,
        differenceDirection: 'on_target',
        differenceFormatted: 'Unlogged',
        dailyProgress: 0,
      };
    }
    const tgtSleep = log.targetSleepTime ?? targets.targetSleepTime ?? '10:00 PM';
    const diffMins = calcTimeDiffMinutes(actSleep, tgtSleep);
    const absDiff = Math.abs(diffMins);
    const dir = diffMins > 0 ? 'late' : diffMins < 0 ? 'early' : 'on_target';

    let progress = 100;
    if (absDiff > toleranceMinutes) {
      const devRange = Math.max(1, acceptableDeviationMinutes - toleranceMinutes);
      progress = Math.max(0, Math.min(100, Math.round(100 - ((absDiff - toleranceMinutes) / devRange) * 100)));
    }

    const formatted =
      diffMins === 0
        ? 'On time ✓'
        : diffMins > 0
        ? `+${Math.floor(absDiff / 60) > 0 ? `${Math.floor(absDiff / 60)}h ` : ''}${absDiff % 60}m late`
        : `-${Math.floor(absDiff / 60) > 0 ? `${Math.floor(absDiff / 60)}h ` : ''}${absDiff % 60}m early`;

    return {
      isLogged: true,
      objective,
      actualValueStr: actSleep,
      targetValueStr: tgtSleep,
      actualSleepTime: actSleep,
      targetSleepTime: tgtSleep,
      differenceVal: diffMins,
      differenceDirection: dir,
      differenceFormatted: formatted,
      dailyProgress: progress,
    };
  }

  if (objective === 'wake_up_on_time' || objective === 'wakeUpOnTime') {
    const actWake = log.actualWakeTime;
    if (!actWake) {
      return {
        isLogged: false,
        objective,
        actualValueStr: '—',
        targetValueStr: '—',
        differenceVal: 0,
        differenceDirection: 'on_target',
        differenceFormatted: 'Unlogged',
        dailyProgress: 0,
      };
    }
    const tgtWake = log.targetWakeTime ?? targets.targetWakeTime ?? '06:00 AM';
    const diffMins = calcTimeDiffMinutes(actWake, tgtWake);
    const absDiff = Math.abs(diffMins);
    const dir = diffMins > 0 ? 'late' : diffMins < 0 ? 'early' : 'on_target';

    let progress = 100;
    if (absDiff > toleranceMinutes) {
      const devRange = Math.max(1, acceptableDeviationMinutes - toleranceMinutes);
      progress = Math.max(0, Math.min(100, Math.round(100 - ((absDiff - toleranceMinutes) / devRange) * 100)));
    }

    const formatted =
      diffMins === 0
        ? 'On time ✓'
        : diffMins > 0
        ? `+${Math.floor(absDiff / 60) > 0 ? `${Math.floor(absDiff / 60)}h ` : ''}${absDiff % 60}m late`
        : `-${Math.floor(absDiff / 60) > 0 ? `${Math.floor(absDiff / 60)}h ` : ''}${absDiff % 60}m early`;

    return {
      isLogged: true,
      objective,
      actualValueStr: actWake,
      targetValueStr: tgtWake,
      actualWakeTime: actWake,
      targetWakeTime: tgtWake,
      differenceVal: diffMins,
      differenceDirection: dir,
      differenceFormatted: formatted,
      dailyProgress: progress,
    };
  }

  // sleep_and_wake_on_time or overall (Sleep & Wake Up on Time)
  const actSleep = log.actualSleepTime;
  const actWake = log.actualWakeTime;
  if (!actSleep || !actWake) {
    return {
      isLogged: false,
      objective,
      actualValueStr: '—',
      targetValueStr: '—',
      differenceVal: 0,
      differenceDirection: 'on_target',
      differenceFormatted: 'Unlogged',
      dailyProgress: 0,
    };
  }
  const tgtSleep = log.targetSleepTime ?? targets.targetSleepTime ?? '10:00 PM';
  const tgtWake = log.targetWakeTime ?? targets.targetWakeTime ?? '06:00 AM';

  const sleepDiff = calcTimeDiffMinutes(actSleep, tgtSleep);
  const wakeDiff = calcTimeDiffMinutes(actWake, tgtWake);
  const absSleep = Math.abs(sleepDiff);
  const absWake = Math.abs(wakeDiff);

  let sleepProg = 100;
  if (absSleep > toleranceMinutes) {
    const devRange = Math.max(1, acceptableDeviationMinutes - toleranceMinutes);
    sleepProg = Math.max(0, Math.min(100, Math.round(100 - ((absSleep - toleranceMinutes) / devRange) * 100)));
  }

  let wakeProg = 100;
  if (absWake > toleranceMinutes) {
    const devRange = Math.max(1, acceptableDeviationMinutes - toleranceMinutes);
    wakeProg = Math.max(0, Math.min(100, Math.round(100 - ((absWake - toleranceMinutes) / devRange) * 100)));
  }

  const dailyProgress = Math.round((sleepProg + wakeProg) / 2);

  // Elapsed sleep duration calculation crossing midnight
  const sleepMins = timeToMinutes(actSleep);
  const wakeMins = timeToMinutes(actWake);
  const elapsedMins = ((wakeMins - sleepMins + 1440) % 1440);
  const actualSleepHours = Number((elapsedMins / 60).toFixed(1));

  return {
    isLogged: true,
    objective,
    actualValueStr: `${actSleep} - ${actWake}`,
    targetValueStr: `${tgtSleep} - ${tgtWake}`,
    actualSleepTime: actSleep,
    targetSleepTime: tgtSleep,
    actualWakeTime: actWake,
    targetWakeTime: tgtWake,
    actualSleepHours,
    differenceVal: sleepDiff,
    differenceDirection: sleepDiff > 0 ? 'late' : sleepDiff < 0 ? 'early' : 'on_target',
    differenceFormatted: `Bed: ${formatDiffBadge(sleepDiff)} | Wake: ${formatDiffBadge(wakeDiff)}`,
    dailyProgress,
    sleepTimeProgress: sleepProg,
    wakeTimeProgress: wakeProg,
  };
}

const DURATION_PRESETS = [6, 6.5, 7, 7.5, 8];

export default function SleepTemplate({ goal, onUpdateGoal }: SleepTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo, deleteTodo } = useTodoContext();
  const { allSchedules, addSchedule, editSchedule, removeSchedule } = useSchedules();

  const answers = (goal.questionnaireAnswers as Record<string, unknown>) || {};

  // Determine sleep objective
  const rawObj = String(answers.sleepObjective || answers.objective || answers.sleep_objective || (goal as unknown as Record<string, unknown>).sleepObjective || '').trim();
  const sleepObjective = useMemo(() => {
    if (rawObj === 'sleep_better' || rawObj === 'sleepBetter') return 'sleep_better';
    if (rawObj === 'sleep_on_time' || rawObj === 'sleepOnTime') return 'sleep_on_time';
    if (rawObj === 'wake_up_on_time' || rawObj === 'wakeUpOnTime') return 'wake_up_on_time';
    if (rawObj === 'sleep_and_wake_on_time' || rawObj === 'overall') return 'sleep_and_wake_on_time';

    if (rawObj.toLowerCase().includes('wake')) return 'wake_up_on_time';
    if (rawObj.toLowerCase().includes('sleep time') || rawObj.toLowerCase().includes('bed') || rawObj.toLowerCase().includes('on_time')) return 'sleep_on_time';
    if (rawObj.toLowerCase().includes('overall') || rawObj.toLowerCase().includes('consistency') || rawObj.toLowerCase().includes('routine') || rawObj.toLowerCase().includes('and_wake')) return 'sleep_and_wake_on_time';
    return 'sleep_better';
  }, [rawObj]);

  // Target Preferences State
  const goalRecord = goal as unknown as Record<string, unknown>;
  const [targetSleepHours, setTargetSleepHours] = useState<number | null>(() => {
    if (typeof goalRecord.targetSleepHours === 'number') return goalRecord.targetSleepHours;
    if (answers.target_hours) return Number(answers.target_hours);
    return null;
  });

  const [targetSleepTime, setTargetSleepTime] = useState<string | null>(() => {
    if (typeof goalRecord.targetSleepTime === 'string' && goalRecord.targetSleepTime) return goalRecord.targetSleepTime;
    if (answers.sleep_time) return String(answers.sleep_time);
    return null;
  });

  const [targetWakeTime, setTargetWakeTime] = useState<string | null>(() => {
    if (typeof goalRecord.targetWakeTime === 'string' && goalRecord.targetWakeTime) return goalRecord.targetWakeTime;
    if (answers.wake_time) return String(answers.wake_time);
    return null;
  });

  // Check if preferences setup is complete
  const isPreferencesConfigured = useMemo(() => {
    if (sleepObjective === 'sleep_better') return targetSleepHours !== null && targetSleepHours > 0;
    if (sleepObjective === 'sleep_on_time') return Boolean(targetSleepTime);
    if (sleepObjective === 'wake_up_on_time') return Boolean(targetWakeTime);
    if (sleepObjective === 'sleep_and_wake_on_time') return Boolean(targetSleepTime) && Boolean(targetWakeTime);
    return true;
  }, [sleepObjective, targetSleepHours, targetSleepTime, targetWakeTime]);

  // Preference Setup Form Temp States
  const [setupDurationMins, setSetupDurationMins] = useState<number>(Math.round((targetSleepHours || 7) * 60));
  const [setupSleepTimeMins, setSetupSleepTimeMins] = useState<number>(() => timeToMinutes(targetSleepTime || '10:00 PM'));
  const [setupWakeTimeMins, setSetupWakeTimeMins] = useState<number>(() => timeToMinutes(targetWakeTime || '05:00 AM'));
  const [savingSetup, setSavingSetup] = useState(false);

  // Daily Check-In States
  const [durationMins, setDurationMins] = useState<number>(Math.round(7 * 60));
  const [sleepTimeMins, setSleepTimeMins] = useState<number>(() => timeToMinutes(targetSleepTime || '10:00 PM'));
  const [wakeTimeMins, setWakeTimeMins] = useState<number>(() => timeToMinutes(targetWakeTime || '06:00 AM'));

  // Pulse animation states for time/duration pickers
  const [durationPulse, setDurationPulse] = useState(false);
  const [sleepPulse, setSleepPulse] = useState(false);
  const [wakePulse, setWakePulse] = useState(false);

  // Setup pulse animation states
  const [setupDurationPulse, setSetupDurationPulse] = useState(false);
  const [setupSleepPulse, setSetupSleepPulse] = useState(false);
  const [setupWakePulse, setSetupWakePulse] = useState(false);

  const stepDuration = (delta: number) => {
    setDurationMins((prev) => Math.min(24 * 60, Math.max(0, prev + delta)));
    setDurationPulse(true);
    setTimeout(() => setDurationPulse(false), 150);
  };

  const stepSetupDuration = (delta: number) => {
    setSetupDurationMins((prev) => Math.min(24 * 60, Math.max(0, prev + delta)));
    setSetupDurationPulse(true);
    setTimeout(() => setSetupDurationPulse(false), 150);
  };

  const stepSleepTime = (delta: number) => {
    setSleepTimeMins((prev) => (((prev + delta) % 1440) + 1440) % 1440);
    setSleepPulse(true);
    setTimeout(() => setSleepPulse(false), 150);
  };

  const stepSetupSleepTime = (delta: number) => {
    setSetupSleepTimeMins((prev) => (((prev + delta) % 1440) + 1440) % 1440);
    setSetupSleepPulse(true);
    setTimeout(() => setSetupSleepPulse(false), 150);
  };

  const stepWakeTime = (delta: number) => {
    setWakeTimeMins((prev) => (((prev + delta) % 1440) + 1440) % 1440);
    setWakePulse(true);
    setTimeout(() => setWakePulse(false), 150);
  };

  const stepSetupWakeTime = (delta: number) => {
    setSetupWakeTimeMins((prev) => (((prev + delta) % 1440) + 1440) % 1440);
    setSetupWakePulse(true);
    setTimeout(() => setSetupWakePulse(false), 150);
  };

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
  const [_showConvertOptions, setShowConvertOptions] = useState(false);
  const [taskEditDate, setTaskEditDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskEditStartTime, setTaskEditStartTime] = useState('22:30');
  const [taskEditEndTime, setTaskEditEndTime] = useState('23:00');
  const [taskEditTodoTime, setTaskEditTodoTime] = useState('');
  const [taskEditAssignee, setTaskEditAssignee] = useState('');
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);

  // Animated step-by-step states for overall objective
  const [overallSetupStep, setOverallSetupStep] = useState<1 | 2>(1);
  const [overallDailyStep, setOverallDailyStep] = useState<1 | 2>(1);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Sleep logs stored on goal.sleepLogs
  const [logs, setLogs] = useState<SleepLogEntry[]>(() => {
    if (Array.isArray(goal.sleepLogs) && goal.sleepLogs.length > 0) {
      return goal.sleepLogs as unknown as SleepLogEntry[];
    }
    return [];
  });

  // Check if today's sleep has been logged
  const todayLog = useMemo(() => logs.find((l) => l.date === todayStr), [logs, todayStr]);
  const hasLoggedToday = Boolean(todayLog);

  const targetHours = targetSleepHours || goal.overallTargetValue || Number(answers.target_hours || 8);
  const bedTime = targetSleepTime || String(answers.bedtime || answers.bed_time || '10:30 PM');
  const wakeTime = targetWakeTime || String(answers.wake_time || answers.wake_up_time || '06:30 AM');

  // Compute exact today metrics
  const todayMetrics = useMemo(() => {
    return computeSleepMetrics(todayLog, sleepObjective, {
      targetSleepHours: targetHours,
      targetSleepTime: bedTime,
      targetWakeTime: wakeTime,
    });
  }, [todayLog, sleepObjective, targetHours, bedTime, wakeTime]);

  const [savingLog, setSavingLog] = useState(false);

  const progress = todayMetrics.isLogged ? todayMetrics.dailyProgress : 0;

  // Arc geometry
  const radius = 80;
  const circumference = Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  // Real-time schedule / todo completion status helper
  const getIsStepDone = (step: SleepActionItem): boolean => {
    if (step.scheduleId) {
      const sched = allSchedules.find((s) => s.id === step.scheduleId);
      if (sched) return sched.status === 'completed';
    }
    if (step.todoId) {
      const td = todos.find((t) => t.id === step.todoId);
      if (td) return td.status === 'completed';
    }
    return step.done;
  };

  // Compute real consistency streak
  const streakCount = useMemo(() => {
    if (logs.length === 0) return 0;
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
  }, [logs]);

  // Schedule modal states
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('Bedtime Wind-down Routine');
  const [schedTime, setSchedTime] = useState('22:30');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSched, setSavingSched] = useState(false);

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

    const todayDateStr = new Date().toISOString().split('T')[0];
    setTaskEditDate(step.dueDate || todayDateStr);
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

  // Save One-Time Preferences
  const handleSaveSetupPreferences = async () => {
    if (!goal.id) return;
    setSavingSetup(true);
    try {
      const updates: Record<string, unknown> = {};
      if (sleepObjective === 'sleep_better') {
        const hrs = setupDurationMins / 60;
        updates.targetSleepHours = hrs;
        setTargetSleepHours(hrs);
      } else if (sleepObjective === 'sleep_on_time') {
        const str = minutesTo12HourComponents(setupSleepTimeMins).formattedStr;
        updates.targetSleepTime = str;
        setTargetSleepTime(str);
      } else if (sleepObjective === 'wake_up_on_time') {
        const str = minutesTo12HourComponents(setupWakeTimeMins).formattedStr;
        updates.targetWakeTime = str;
        setTargetWakeTime(str);
      } else {
        const sleepStr = minutesTo12HourComponents(setupSleepTimeMins).formattedStr;
        const wakeStr = minutesTo12HourComponents(setupWakeTimeMins).formattedStr;
        updates.targetSleepTime = sleepStr;
        updates.targetWakeTime = wakeStr;
        setTargetSleepTime(sleepStr);
        setTargetWakeTime(wakeStr);
      }

      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, updates);
      } else {
        await updateDoc(doc(db, 'goals', goal.id), updates);
      }
    } catch (err) {
      console.error('Failed to save target preferences:', err);
    } finally {
      setSavingSetup(false);
    }
  };

  // Log Daily Check-In Entry
  const handleSaveDailyCheckIn = async () => {
    if (!goal.id) return;
    setSavingLog(true);
    try {
      let newEntry: SleepLogEntry;

      const formattedSleepTime = minutesTo12HourComponents(sleepTimeMins).formattedStr;
      const formattedWakeTime = minutesTo12HourComponents(wakeTimeMins).formattedStr;
      const actualHoursVal = Number((durationMins / 60).toFixed(1));

      if (sleepObjective === 'sleep_better') {
        const tgt = targetSleepHours || 7;
        const actMins = actualHoursVal * 60;
        const tgtMins = tgt * 60;
        const prog = Math.min(100, Math.max(0, Math.round((actMins / tgtMins) * 100)));
        const diffHours = Number((actualHoursVal - tgt).toFixed(2));
        const diffMins = Math.round(actMins - tgtMins);
        const dir = diffHours > 0 ? 'more' : diffHours < 0 ? 'less' : 'on_target';

        newEntry = {
          id: String(Date.now()),
          date: todayStr,
          objective: 'sleep_better',
          actualSleepHours: actualHoursVal,
          targetSleepHours: tgt,
          differenceHours: diffHours,
          sleepDiffMinutes: diffMins,
          differenceDirection: dir,
          dailyProgress: prog,
          actualValueStr: `${actualHoursVal}h`,
          targetValueStr: `${tgt}h`,
          differenceFormatted: diffHours === 0 ? 'On target ✓' : diffHours > 0 ? `+${diffHours}h more than target` : `${diffHours}h less than target`,
          hours: actualHoursVal,
          timestamp: new Date().toISOString(),
        };
      } else if (sleepObjective === 'sleep_on_time') {
        const tgt = targetSleepTime || '10:00 PM';
        const diff = calcTimeDiffMinutes(formattedSleepTime, tgt);
        const absDiff = Math.abs(diff);
        const dir = diff > 0 ? 'late' : diff < 0 ? 'early' : 'on_target';
        let prog = 100;
        if (absDiff > 15) {
          prog = Math.max(0, Math.min(100, Math.round(100 - ((absDiff - 15) / 45) * 100)));
        }

        newEntry = {
          id: String(Date.now()),
          date: todayStr,
          objective: 'sleep_on_time',
          actualSleepTime: formattedSleepTime,
          targetSleepTime: tgt,
          sleepDiffMinutes: diff,
          differenceDirection: dir,
          dailyProgress: prog,
          actualValueStr: formattedSleepTime,
          targetValueStr: tgt,
          differenceFormatted: formatDiffBadge(diff),
          timestamp: new Date().toISOString(),
        };
      } else if (sleepObjective === 'wake_up_on_time') {
        const tgt = targetWakeTime || '05:00 AM';
        const diff = calcTimeDiffMinutes(formattedWakeTime, tgt);
        const absDiff = Math.abs(diff);
        const dir = diff > 0 ? 'late' : diff < 0 ? 'early' : 'on_target';
        let prog = 100;
        if (absDiff > 15) {
          prog = Math.max(0, Math.min(100, Math.round(100 - ((absDiff - 15) / 45) * 100)));
        }

        newEntry = {
          id: String(Date.now()),
          date: todayStr,
          objective: 'wake_up_on_time',
          actualWakeTime: formattedWakeTime,
          targetWakeTime: tgt,
          wakeDiffMinutes: diff,
          differenceDirection: dir,
          dailyProgress: prog,
          actualValueStr: formattedWakeTime,
          targetValueStr: tgt,
          differenceFormatted: formatDiffBadge(diff),
          timestamp: new Date().toISOString(),
        };
      } else {
        // sleep_and_wake_on_time or overall
        const tgtSleep = targetSleepTime || '10:00 PM';
        const tgtWake = targetWakeTime || '05:00 AM';
        const sleepDiff = calcTimeDiffMinutes(formattedSleepTime, tgtSleep);
        const wakeDiff = calcTimeDiffMinutes(formattedWakeTime, tgtWake);
        const absSleep = Math.abs(sleepDiff);
        const absWake = Math.abs(wakeDiff);

        let sleepProg = 100;
        if (absSleep > 15) {
          sleepProg = Math.max(0, Math.min(100, Math.round(100 - ((absSleep - 15) / 45) * 100)));
        }

        let wakeProg = 100;
        if (absWake > 15) {
          wakeProg = Math.max(0, Math.min(100, Math.round(100 - ((absWake - 15) / 45) * 100)));
        }

        const overallProg = Math.round((sleepProg + wakeProg) / 2);

        // Calculate actual sleep duration elapsed between actual sleep time and actual wake time crossing midnight
        const sleepMins = timeToMinutes(formattedSleepTime);
        const wakeMins = timeToMinutes(formattedWakeTime);
        const elapsedMins = ((wakeMins - sleepMins + 1440) % 1440);
        const calcActualHours = Number((elapsedMins / 60).toFixed(1));

        newEntry = {
          id: String(Date.now()),
          date: todayStr,
          objective: 'sleep_and_wake_on_time',
          actualSleepTime: formattedSleepTime,
          targetSleepTime: tgtSleep,
          sleepDiffMinutes: sleepDiff,
          actualWakeTime: formattedWakeTime,
          targetWakeTime: tgtWake,
          wakeDiffMinutes: wakeDiff,
          actualSleepHours: calcActualHours,
          dailyProgress: overallProg,
          sleepTimeProgress: sleepProg,
          wakeTimeProgress: wakeProg,
          actualValueStr: `${formattedSleepTime} - ${formattedWakeTime}`,
          targetValueStr: `${tgtSleep} - ${tgtWake}`,
          differenceFormatted: `Bed: ${formatDiffBadge(sleepDiff)} | Wake: ${formatDiffBadge(wakeDiff)}`,
          timestamp: new Date().toISOString(),
        };
      }

      const updatedLogs = [newEntry, ...logs.filter((l) => l.date !== todayStr)];
      setLogs(updatedLogs);

      const updates: Record<string, unknown> = {
        sleepLogs: updatedLogs,
        currentValue: newEntry.actualSleepHours || actualHoursVal,
      };

      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, updates);
      } else {
        await updateDoc(doc(db, 'goals', goal.id), updates);
      }
    } catch (err) {
      console.error('Failed to log daily sleep:', err);
    } finally {
      setSavingLog(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Are you sure you want to delete this sleep log?')) return;
    const updatedLogs = logs.filter((l) => l.id !== logId);
    setLogs(updatedLogs);

    if (goal.id) {
      const updates = { sleepLogs: updatedLogs };
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

  const linkedSleepSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const linkedSleepTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  const sleepTimeObj = minutesTo12HourComponents(sleepTimeMins);
  const wakeTimeObj = minutesTo12HourComponents(wakeTimeMins);
  const setupSleepTimeObj = minutesTo12HourComponents(setupSleepTimeMins);
  const setupWakeTimeObj = minutesTo12HourComponents(setupWakeTimeMins);

  const durationObj = formatDuration(durationMins);
  const setupDurationObj = formatDuration(setupDurationMins);
  const setupActivePreset = DURATION_PRESETS.find((p) => Math.round(p * 60) === setupDurationMins);
  const activeDurationPreset = DURATION_PRESETS.find((p) => Math.round(p * 60) === durationMins);

  const objectiveLabel =
    sleepObjective === 'sleep_better'
      ? 'Sleep Better'
      : sleepObjective === 'sleep_on_time'
      ? 'Sleep On Time'
      : sleepObjective === 'wake_up_on_time'
      ? 'Wake Up On Time'
      : 'Sleep and wakeup on time (overall)';

  return (
    <Box sx={{ width: '100%' }}>
      {/* 🌟 1. DUSK-TO-DAWN ARC GRAPHIC & SCHEDULE PILLS CARD (KEPT AS REQUESTED) */}
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
            label={objectiveLabel}
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

          <Box sx={{ position: 'absolute', top: 48, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2, textAlign: 'center' }}>
            <Typography sx={{ fontSize: hasLoggedToday ? 28 : 22, fontWeight: 800, color: textPrimary, fontFamily: 'monospace', lineHeight: 1 }}>
              {hasLoggedToday ? todayMetrics.dailyProgress + '%' : 'Unlogged'}
            </Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: textMuted, mt: 0.75, maxWidth: 220 }}>
              {hasLoggedToday
                ? `${todayMetrics.actualValueStr} vs ${todayMetrics.targetValueStr} (${todayMetrics.differenceFormatted})`
                : 'No check-in today · Log below'}
            </Typography>
          </Box>
        </Box>

        {/* 🌟 Bedtime & Wake-Up Schedule Pills (KEPT AS REQUESTED) */}
        <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: isDark ? '#312e81' : '#e0e7ff' }}>
            <MoonIcon sx={{ color: '#6366f1', fontSize: 22 }} />
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
                Bedtime Target
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
                Wake Up Target
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                {wakeTime}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Consistency Streak Row */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: '16px', bgcolor: isDark ? 'rgba(51,65,85,0.3)' : '#f8fafc' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlameIcon sx={{ color: '#f97316', fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, color: textPrimary }}>
              <strong style={{ color: '#f97316' }}>{streakCount} day</strong> consistency streak
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 12, color: textMuted }}>
            Logged for today: <strong>{hasLoggedToday ? todayMetrics.actualValueStr : 'No log yet'}</strong>
          </Typography>
        </Box>
      </Box>

      {/* ── STEP A: ONE-TIME TARGET PREFERENCES SETUP CARD ── */}
      {!isPreferencesConfigured ? (
        <Box sx={{ mb: 3 }}>
          {/* Target Setup for sleep_better / sleepBetter */}
          {sleepObjective === 'sleep_better' && (
            <div className="w-full rounded-3xl p-6 transition-colors duration-200 border border-slate-200 bg-white shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-xl">
              <div className="flex items-center justify-center gap-2 mb-6">
                <BedDoubleIcon className="w-5 h-5 text-teal-600/70 dark:text-teal-300/70" />
                <span className="text-xs tracking-wide text-slate-500 dark:text-slate-400">
                  How much sleep do you want each night?
                </span>
              </div>

              {/* Time readout */}
              <div className="flex items-center justify-between gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => stepSetupDuration(-15)}
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                >
                  <RemoveIcon className="w-6 h-6" />
                </button>

                <div className={`flex-1 text-center transition-transform duration-150 ${setupDurationPulse ? 'scale-105' : 'scale-100'}`}>
                  <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
                    <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                      {setupDurationObj.h}
                    </span>
                    <span className="text-lg font-medium text-emerald-600 dark:text-emerald-300/80">
                      hr
                    </span>
                    {setupDurationObj.m > 0 && (
                      <>
                        <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                          {setupDurationObj.m}
                        </span>
                        <span className="text-lg font-medium text-emerald-600 dark:text-emerald-300/80">
                          min
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => stepSetupDuration(15)}
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                >
                  <AddIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Presets */}
              <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                {DURATION_PRESETS.map((p) => {
                  const active = setupActivePreset === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSetupDurationMins(Math.round(p * 60))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border ${
                        active
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-transparent shadow-sm'
                          : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-300'
                      }`}
                    >
                      {p} hrs
                    </button>
                  );
                })}
              </div>

              <p className="text-center text-[11px] mt-4 mb-4 text-slate-400 dark:text-slate-500">
                Tap a preset, or use − / + to fine-tune in 15 minute steps
              </p>

              <button
                type="button"
                disabled={savingSetup}
                onClick={handleSaveSetupPreferences}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm tracking-wide text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-[0.98] transition-all duration-150 dark:text-[#040d1a]"
              >
                {savingSetup ? 'Saving Preference...' : 'Save Target Sleep Duration'}
              </button>
            </div>
          )}

          {/* Target Setup for sleep_on_time / sleepOnTime */}
          {sleepObjective === 'sleep_on_time' && (
            <div className="w-full rounded-3xl p-6 transition-colors duration-200 border border-slate-200 bg-white shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-xl">
              <div className="flex items-center justify-center gap-2 mb-6">
                <MoonIcon className="w-4 h-4 text-teal-600/70 dark:text-teal-300/70" />
                <span className="text-xs tracking-wide text-slate-500 dark:text-slate-400">
                  What time do you want to sleep daily?
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => stepSetupSleepTime(-15)}
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all active:scale-90 bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                >
                  <RemoveIcon className="w-6 h-6" />
                </button>

                <div className={`flex-1 text-center transition-transform duration-150 ${setupSleepPulse ? 'scale-105' : 'scale-100'}`}>
                  <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
                    <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                      {setupSleepTimeObj.hours}:{setupSleepTimeObj.minutes}
                    </span>
                    <span className="text-lg font-medium text-emerald-600 dark:text-emerald-300/80">
                      {setupSleepTimeObj.period}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => stepSetupSleepTime(15)}
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all active:scale-90 bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                >
                  <AddIcon className="w-6 h-6" />
                </button>
              </div>

              <p className="text-center text-[11px] mt-4 mb-4 text-slate-400 dark:text-slate-500">
                Tap − / + to adjust in 15 minute steps
              </p>

              <button
                type="button"
                disabled={savingSetup}
                onClick={handleSaveSetupPreferences}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm tracking-wide text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-[0.98] transition-all duration-150 dark:text-[#040d1a]"
              >
                {savingSetup ? 'Saving Preference...' : 'Save Target Sleep Time'}
              </button>
            </div>
          )}

          {/* Target Setup for wake_up_on_time / wakeUpOnTime */}
          {sleepObjective === 'wake_up_on_time' && (
            <div className="w-full rounded-3xl p-6 transition-colors duration-200 border border-slate-200 bg-white shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-xl">
              <div className="flex items-center justify-center gap-2 mb-6">
                <SunIcon className="w-4 h-4 text-amber-600/70 dark:text-amber-300/70" />
                <span className="text-xs tracking-wide text-slate-500 dark:text-slate-400">
                  What time do you want to wake up?
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => stepSetupWakeTime(-15)}
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all active:scale-90 bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                >
                  <RemoveIcon className="w-6 h-6" />
                </button>

                <div className={`flex-1 text-center transition-transform duration-150 ${setupWakePulse ? 'scale-105' : 'scale-100'}`}>
                  <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
                    <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                      {setupWakeTimeObj.hours}:{setupWakeTimeObj.minutes}
                    </span>
                    <span className="text-lg font-medium text-amber-600 dark:text-amber-300/80">
                      {setupWakeTimeObj.period}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => stepSetupWakeTime(15)}
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all active:scale-90 bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                >
                  <AddIcon className="w-6 h-6" />
                </button>
              </div>

              <p className="text-center text-[11px] mt-4 mb-4 text-slate-400 dark:text-slate-500">
                Tap − / + to adjust in 15 minute steps
              </p>

              <button
                type="button"
                disabled={savingSetup}
                onClick={handleSaveSetupPreferences}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm tracking-wide text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] transition-all duration-150 dark:text-[#040d1a]"
              >
                {savingSetup ? 'Saving Preference...' : 'Save Target Wake Time'}
              </button>
            </div>
          )}

          {/* Target Setup for overall */}
          {sleepObjective === 'sleep_and_wake_on_time' && (
            <AnimatePresence mode="wait">
              {overallSetupStep === 1 ? (
                <motion.div
                  key="setup-step-1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="w-full rounded-3xl p-6 transition-colors duration-200 border border-slate-200 bg-white shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-xl"
                >
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <MoonIcon className="w-5 h-5 text-teal-600/70 dark:text-teal-300/70" />
                    <span className="text-xs tracking-wide text-slate-500 dark:text-slate-400">
                      Step 1 of 2: What time do you want to sleep daily?
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 mb-6">
                    <button
                      type="button"
                      onClick={() => stepSetupSleepTime(-15)}
                      className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                    >
                      <RemoveIcon className="w-6 h-6" />
                    </button>

                    <div className={`flex-1 text-center transition-transform duration-150 ${setupSleepPulse ? 'scale-105' : 'scale-100'}`}>
                      <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
                        <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                          {setupSleepTimeObj.hours}:{setupSleepTimeObj.minutes}
                        </span>
                        <span className="text-lg font-medium text-emerald-600 dark:text-emerald-300/80">
                          {setupSleepTimeObj.period}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => stepSetupSleepTime(15)}
                      className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                    >
                      <AddIcon className="w-6 h-6" />
                    </button>
                  </div>

                  <p className="text-center text-[11px] mb-6 text-slate-400 dark:text-slate-500">
                    Tap − / + to adjust target bedtime in 15 minute steps
                  </p>

                  <button
                    type="button"
                    onClick={() => setOverallSetupStep(2)}
                    className="w-full py-3.5 rounded-2xl font-semibold text-sm tracking-wide text-white bg-gradient-to-r from-teal-500 via-indigo-500 to-emerald-500 hover:opacity-95 active:scale-[0.98] transition-all duration-150 shadow-md"
                  >
                    Next: Set Wake Up Time →
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="setup-step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="w-full rounded-3xl p-6 transition-colors duration-200 border border-slate-200 bg-white shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-xl"
                >
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <SunIcon className="w-5 h-5 text-amber-600/70 dark:text-amber-300/70" />
                    <span className="text-xs tracking-wide text-slate-500 dark:text-slate-400">
                      Step 2 of 2: What time do you want to wake up?
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 mb-6">
                    <button
                      type="button"
                      onClick={() => stepSetupWakeTime(-15)}
                      className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                    >
                      <RemoveIcon className="w-6 h-6" />
                    </button>

                    <div className={`flex-1 text-center transition-transform duration-150 ${setupWakePulse ? 'scale-105' : 'scale-100'}`}>
                      <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
                        <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                          {setupWakeTimeObj.hours}:{setupWakeTimeObj.minutes}
                        </span>
                        <span className="text-lg font-medium text-amber-600 dark:text-amber-300/80">
                          {setupWakeTimeObj.period}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => stepSetupWakeTime(15)}
                      className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                    >
                      <AddIcon className="w-6 h-6" />
                    </button>
                  </div>

                  <p className="text-center text-[11px] mb-6 text-slate-400 dark:text-slate-500">
                    Tap − / + to adjust target wake time in 15 minute steps
                  </p>

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setOverallSetupStep(1)}
                      className="px-4 py-3.5 rounded-2xl font-semibold text-sm border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 transition-all"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      disabled={savingSetup}
                      onClick={handleSaveSetupPreferences}
                      className="flex-1 py-3.5 rounded-2xl font-semibold text-sm tracking-wide text-white bg-gradient-to-r from-teal-500 via-indigo-500 to-amber-500 hover:opacity-95 active:scale-[0.98] transition-all duration-150 shadow-md"
                    >
                      {savingSetup ? 'Saving Preference...' : 'Save Target Preferences ✓'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </Box>
      ) : (
        /* ── STEP B: ELEGANT DAILY CHECK-IN CARDS (SAMPLE SLEEP DURATION & TIME PICKER DESIGN) ── */
        <Box sx={{ mb: 3 }}>
          {/* 1. sleep_better / sleepBetter Daily Check-In */}
          {sleepObjective === 'sleep_better' && (
            <div className="w-full rounded-3xl p-6 transition-colors duration-200 border border-slate-200 bg-white shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-xl dark:shadow-[0_0_60px_-15px_rgba(45,212,191,0.25)]">
              {/* Header */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <BedDoubleIcon className="w-5 h-5 text-teal-600/70 dark:text-teal-300/70" />
                <span className="text-xs tracking-wide text-slate-500 dark:text-slate-400">
                  How many hours did you sleep last night? (Target: {targetSleepHours} hrs)
                </span>
              </div>

              {/* Time display + controls */}
              <div className="flex items-center justify-between gap-3 mb-6">
                <button
                  type="button"
                  disabled={hasLoggedToday}
                  onClick={() => stepDuration(-15)}
                  aria-label="Decrease by 15 minutes"
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-150 active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900 hover:border-teal-400/60 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-teal-400/40 disabled:opacity-40"
                >
                  <RemoveIcon className="w-6 h-6" />
                </button>

                <div className={`flex-1 text-center transition-transform duration-150 ${durationPulse ? 'scale-105' : 'scale-100'}`}>
                  <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
                    <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                      {durationObj.h}
                    </span>
                    <span className="text-lg font-medium text-emerald-600 dark:text-emerald-300/80">
                      hr
                    </span>
                    {durationObj.m > 0 && (
                      <>
                        <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                          {durationObj.m}
                        </span>
                        <span className="text-lg font-medium text-emerald-600 dark:text-emerald-300/80">
                          min
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={hasLoggedToday}
                  onClick={() => stepDuration(15)}
                  aria-label="Increase by 15 minutes"
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-150 active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900 hover:border-emerald-400/60 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-emerald-400/40 disabled:opacity-40"
                >
                  <AddIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Preset chips */}
              <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                {DURATION_PRESETS.map((p) => {
                  const active = activeDurationPreset === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={hasLoggedToday}
                      onClick={() => setDurationMins(Math.round(p * 60))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border ${
                        active
                          ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-transparent shadow-sm'
                          : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                      } disabled:opacity-40`}
                    >
                      {p} hrs
                    </button>
                  );
                })}
              </div>

              {/* Helper hint */}
              <p className="text-center text-[11px] mt-4 text-slate-400 dark:text-slate-500">
                Tap a preset, or use − / + to fine-tune in 15 minute steps · Diff: <strong className="text-teal-600 dark:text-teal-400">{durationMins / 60 - (targetSleepHours || 7) >= 0 ? `+${durationMins / 60 - (targetSleepHours || 7)}h` : `${durationMins / 60 - (targetSleepHours || 7)}h`}</strong>
              </p>

              {/* Confirm button */}
              <button
                type="button"
                disabled={hasLoggedToday || savingLog}
                onClick={handleSaveDailyCheckIn}
                className="mt-6 w-full py-3.5 rounded-2xl font-semibold text-sm tracking-wide text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-[0.98] transition-all duration-150 dark:text-[#040d1a] disabled:opacity-40"
              >
                {hasLoggedToday ? 'Already Logged Today' : savingLog ? 'Saving Log...' : 'Confirm sleep duration'}
              </button>
            </div>
          )}

          {/* 2. sleep_on_time / sleepOnTime Daily Check-In */}
          {sleepObjective === 'sleep_on_time' && (
            <div className="w-full rounded-3xl p-6 transition-colors duration-200 border border-slate-200 bg-white shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-xl dark:shadow-[0_0_60px_-15px_rgba(45,212,191,0.25)]">
              {/* Header */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <MoonIcon className="w-4 h-4 text-teal-600/70 dark:text-teal-300/70" />
                <span className="text-xs tracking-wide text-slate-500 dark:text-slate-400">
                  When did you fall asleep last night? (Target: {targetSleepTime})
                </span>
              </div>

              {/* Time display + controls */}
              <div className="flex items-center justify-between gap-3">
                {/* Minus button */}
                <button
                  type="button"
                  disabled={hasLoggedToday}
                  onClick={() => stepSleepTime(-15)}
                  aria-label="Decrease by 15 minutes"
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-150 active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900 hover:border-teal-400/60 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-teal-400/40 disabled:opacity-40"
                >
                  <RemoveIcon className="w-6 h-6" />
                </button>

                {/* Time readout */}
                <div className={`flex-1 text-center transition-transform duration-150 ${sleepPulse ? 'scale-105' : 'scale-100'}`}>
                  <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
                    <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                      {sleepTimeObj.hours}:{sleepTimeObj.minutes}
                    </span>
                    <span className="text-lg font-medium mb-1 text-emerald-600 dark:text-emerald-300/80">
                      {sleepTimeObj.period}
                    </span>
                  </div>
                </div>

                {/* Plus button */}
                <button
                  type="button"
                  disabled={hasLoggedToday}
                  onClick={() => stepSleepTime(15)}
                  aria-label="Increase by 15 minutes"
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-150 active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900 hover:border-emerald-400/60 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-emerald-400/40 disabled:opacity-40"
                >
                  <AddIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Helper hint */}
              <p className="text-center text-[11px] mt-4 text-slate-400 dark:text-slate-500">
                Tap − / + to adjust in 15 minute steps · Diff vs Target: <strong className="text-teal-600 dark:text-teal-400">{formatDiffBadge(calcTimeDiffMinutes(sleepTimeObj.formattedStr, targetSleepTime || '10:00 PM'))}</strong>
              </p>

              {/* Confirm button */}
              <button
                type="button"
                disabled={hasLoggedToday || savingLog}
                onClick={handleSaveDailyCheckIn}
                className="mt-6 w-full py-3.5 rounded-2xl font-semibold text-sm tracking-wide text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-[0.98] transition-all duration-150 dark:text-[#040d1a] disabled:opacity-40"
              >
                {hasLoggedToday ? 'Already Logged Today' : savingLog ? 'Saving...' : 'Confirm sleep time'}
              </button>
            </div>
          )}

          {/* 3. wake_up_on_time / wakeUpOnTime Daily Check-In */}
          {sleepObjective === 'wake_up_on_time' && (
            <div className="w-full rounded-3xl p-6 transition-colors duration-200 border border-slate-200 bg-white shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-xl dark:shadow-[0_0_60px_-15px_rgba(245,158,11,0.25)]">
              {/* Header */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <SunIcon className="w-4 h-4 text-amber-600/70 dark:text-amber-300/70" />
                <span className="text-xs tracking-wide text-slate-500 dark:text-slate-400">
                  When did you wake up today? (Target: {targetWakeTime})
                </span>
              </div>

              {/* Time display + controls */}
              <div className="flex items-center justify-between gap-3">
                {/* Minus button */}
                <button
                  type="button"
                  disabled={hasLoggedToday}
                  onClick={() => stepWakeTime(-15)}
                  aria-label="Decrease by 15 minutes"
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-150 active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900 hover:border-amber-400/60 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-amber-400/40 disabled:opacity-40"
                >
                  <RemoveIcon className="w-6 h-6" />
                </button>

                {/* Time readout */}
                <div className={`flex-1 text-center transition-transform duration-150 ${wakePulse ? 'scale-105' : 'scale-100'}`}>
                  <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
                    <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                      {wakeTimeObj.hours}:{wakeTimeObj.minutes}
                    </span>
                    <span className="text-lg font-medium mb-1 text-amber-600 dark:text-amber-300/80">
                      {wakeTimeObj.period}
                    </span>
                  </div>
                </div>

                {/* Plus button */}
                <button
                  type="button"
                  disabled={hasLoggedToday}
                  onClick={() => stepWakeTime(15)}
                  aria-label="Increase by 15 minutes"
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-150 active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900 hover:border-amber-400/60 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-amber-400/40 disabled:opacity-40"
                >
                  <AddIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Helper hint */}
              <p className="text-center text-[11px] mt-4 text-slate-400 dark:text-slate-500">
                Tap − / + to adjust in 15 minute steps · Diff vs Target: <strong className="text-amber-600 dark:text-amber-400">{formatDiffBadge(calcTimeDiffMinutes(wakeTimeObj.formattedStr, targetWakeTime || '05:00 AM'))}</strong>
              </p>

              {/* Confirm button */}
              <button
                type="button"
                disabled={hasLoggedToday || savingLog}
                onClick={handleSaveDailyCheckIn}
                className="mt-6 w-full py-3.5 rounded-2xl font-semibold text-sm tracking-wide text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] transition-all duration-150 dark:text-[#040d1a] disabled:opacity-40"
              >
                {hasLoggedToday ? 'Already Logged Today' : savingLog ? 'Saving...' : 'Confirm wake-up time'}
              </button>
            </div>
          )}

          {/* 4. overall Step-by-Step Daily Check-In */}
          {sleepObjective === 'sleep_and_wake_on_time' && (
            <AnimatePresence mode="wait">
              {overallDailyStep === 1 ? (
                <motion.div
                  key="daily-step-1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="w-full rounded-3xl p-6 transition-colors duration-200 border border-slate-200 bg-white shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-xl dark:shadow-[0_0_60px_-15px_rgba(45,212,191,0.25)]"
                >
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <MoonIcon className="w-5 h-5 text-teal-600/70 dark:text-teal-300/70" />
                    <span className="text-xs tracking-wide text-slate-500 dark:text-slate-400">
                      Step 1 of 2: When did you fall asleep last night? (Target: {targetSleepTime})
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 mb-6">
                    <button
                      type="button"
                      disabled={hasLoggedToday}
                      onClick={() => stepSleepTime(-15)}
                      aria-label="Decrease by 15 minutes"
                      className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-150 active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900 hover:border-teal-400/60 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-teal-400/40 disabled:opacity-40"
                    >
                      <RemoveIcon className="w-6 h-6" />
                    </button>

                    <div className={`flex-1 text-center transition-transform duration-150 ${sleepPulse ? 'scale-105' : 'scale-100'}`}>
                      <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
                        <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                          {sleepTimeObj.hours}:{sleepTimeObj.minutes}
                        </span>
                        <span className="text-lg font-medium text-emerald-600 dark:text-emerald-300/80">
                          {sleepTimeObj.period}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={hasLoggedToday}
                      onClick={() => stepSleepTime(15)}
                      aria-label="Increase by 15 minutes"
                      className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-150 active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900 hover:border-emerald-400/60 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-emerald-400/40 disabled:opacity-40"
                    >
                      <AddIcon className="w-6 h-6" />
                    </button>
                  </div>

                  <p className="text-center text-[11px] mb-6 text-slate-400 dark:text-slate-500">
                    Tap − / + to adjust in 15 minute steps · Diff: <strong className="text-teal-600 dark:text-teal-400">{formatDiffBadge(calcTimeDiffMinutes(sleepTimeObj.formattedStr, targetSleepTime || '10:00 PM'))}</strong>
                  </p>

                  <button
                    type="button"
                    disabled={hasLoggedToday}
                    onClick={() => setOverallDailyStep(2)}
                    className="w-full py-3.5 rounded-2xl font-semibold text-sm tracking-wide text-white bg-gradient-to-r from-teal-500 via-indigo-500 to-emerald-500 hover:opacity-95 active:scale-[0.98] transition-all duration-150 shadow-md disabled:opacity-40"
                  >
                    Next: Log Wake Up Time →
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="daily-step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="w-full rounded-3xl p-6 transition-colors duration-200 border border-slate-200 bg-white shadow-[0_10px_40px_-15px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-xl dark:shadow-[0_0_60px_-15px_rgba(245,158,11,0.25)]"
                >
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <SunIcon className="w-5 h-5 text-amber-600/70 dark:text-amber-300/70" />
                    <span className="text-xs tracking-wide text-slate-500 dark:text-slate-400">
                      Step 2 of 2: When did you wake up today? (Target: {targetWakeTime})
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 mb-6">
                    <button
                      type="button"
                      disabled={hasLoggedToday}
                      onClick={() => stepWakeTime(-15)}
                      aria-label="Decrease by 15 minutes"
                      className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-150 active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900 hover:border-amber-400/60 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-amber-400/40 disabled:opacity-40"
                    >
                      <RemoveIcon className="w-6 h-6" />
                    </button>

                    <div className={`flex-1 text-center transition-transform duration-150 ${wakePulse ? 'scale-105' : 'scale-100'}`}>
                      <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
                        <span className="font-semibold leading-none text-slate-900 dark:text-white" style={{ fontSize: '3.25rem' }}>
                          {wakeTimeObj.hours}:{wakeTimeObj.minutes}
                        </span>
                        <span className="text-lg font-medium text-amber-600 dark:text-amber-300/80">
                          {wakeTimeObj.period}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={hasLoggedToday}
                      onClick={() => stepWakeTime(15)}
                      aria-label="Increase by 15 minutes"
                      className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-150 active:scale-90 bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-900 hover:border-amber-400/60 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:border-amber-400/40 disabled:opacity-40"
                    >
                      <AddIcon className="w-6 h-6" />
                    </button>
                  </div>

                  <p className="text-center text-[11px] mb-6 text-slate-400 dark:text-slate-500">
                    Tap − / + to adjust in 15 minute steps · Diff: <strong className="text-amber-600 dark:text-amber-400">{formatDiffBadge(calcTimeDiffMinutes(wakeTimeObj.formattedStr, targetWakeTime || '05:00 AM'))}</strong>
                  </p>

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setOverallDailyStep(1)}
                      className="px-4 py-3.5 rounded-2xl font-semibold text-sm border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 transition-all"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      disabled={hasLoggedToday || savingLog}
                      onClick={handleSaveDailyCheckIn}
                      className="flex-1 py-3.5 rounded-2xl font-semibold text-sm tracking-wide text-white bg-gradient-to-r from-teal-500 via-indigo-500 to-amber-500 hover:opacity-95 active:scale-[0.98] transition-all duration-150 shadow-md disabled:opacity-40"
                    >
                      {hasLoggedToday ? 'Already Logged Today' : savingLog ? 'Saving Routine Log...' : 'Confirm Sleep & Wake Log ✓'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </Box>
      )}

      {/* ── RECORDED SLEEP HISTORY LOGS ── */}
      {logs.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em', mb: 1.5, px: 0.5 }}>
            Recorded Sleep Logs ({logs.length})
          </Typography>

          <Stack spacing={1.25}>
            {logs.map((entry) => {
              const m = computeSleepMetrics(entry, entry.objective || sleepObjective, {
                targetSleepHours: targetHours,
                targetSleepTime: bedTime,
                targetWakeTime: wakeTime,
              });

              return (
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
                    <MoonIcon sx={{ color: '#6366f1', fontSize: 22 }} />
                    <Box>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: textPrimary }}>
                        Actual: <span className="font-mono text-indigo-600 dark:text-indigo-400">{m.actualValueStr}</span> <span className="text-xs text-slate-500">(Target: {m.targetValueStr})</span>
                      </Typography>

                      <Typography sx={{ fontSize: 11, color: textMuted, mt: 0.2 }}>
                        Date: {formatDate(entry.date)} · Diff: <strong className="text-teal-600 dark:text-teal-400">{m.differenceFormatted}</strong>
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={`${m.dailyProgress}% progress`}
                      size="small"
                      sx={{
                        bgcolor: m.dailyProgress >= 90 ? (isDark ? '#042f2e' : '#ccfbf1') : (isDark ? '#312e81' : '#e0e7ff'),
                        color: m.dailyProgress >= 90 ? '#0d9488' : '#6366f1',
                        fontWeight: 700,
                        fontSize: 10,
                      }}
                    />

                    <IconButton size="small" onClick={() => handleDeleteLog(entry.id)} sx={{ color: '#ef4444' }}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* ── STRATEGY TASKS SECTION FOR SLEEP GOAL ── */}
      <Box sx={{ mt: 3, pt: 3, mb: 4, borderTop: `1px solid ${cardBorder}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: textPrimary, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              🎯 Strategy Tasks ({actions.length})
            </Typography>
            <Typography sx={{ fontSize: 11, color: textMuted, mt: 0.2 }}>
              Action steps, bedtime routines, and sleep hygiene tasks to fulfill your goal
            </Typography>
          </Box>
        </Box>

        {/* Strategic Tasks List */}
        <div className="space-y-2 mb-3">
          {actions.map((step) => {
            const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
            const hasLink = kind === 'schedule' || kind === 'todo';
            const isDone = getIsStepDone(step);

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
                      isDone
                        ? 'bg-indigo-500 border-indigo-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                    }`}
                  >
                    {isDone && (
                      <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 stroke-current stroke-[3]">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <span
                    className={`text-xs font-bold truncate ${
                      isDone
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {step.task} {step.sourceName ? `(${step.sourceName})` : ''}
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

      {/* Scheduled Routines */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Scheduled Routines ({linkedSleepSchedules.length + linkedSleepTodos.length})
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
                justify: 'space-between',
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

      {/* Schedule Modal */}
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
                Schedule Visit
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
              label="Reminder Title"
              placeholder="e.g. Bedtime Wind-down Routine"
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
              label="Date"
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

      {/* ── STRATEGY TASK DETAIL MODAL ── */}
      <Modal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        closeAfterTransition
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}
      >
        <Fade in={taskModalOpen}>
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden outline-none">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  🎯
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    Edit Strategy Task
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Customize task details, schedule, or link to Schedule/Todo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <CloseIcon sx={{ fontSize: 20 }} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={taskEditText}
                  onChange={(e) => setTaskEditText(e.target.value)}
                  className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Conversion selector */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowConvertOptions((prev) => !prev)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {taskEditKind !== 'none' ? 'Change Schedule/Todo Link ▾' : '+ Convert to Schedule or Todo ▾'}
                </button>

                {(taskEditKind !== 'none' || true) && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('none')}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                          taskEditKind === 'none'
                            ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent shadow-sm'
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
