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
  DialogContent,
  DialogTitle,
  DialogActions,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  Divider,
} from '@mui/material';
import {
  FitnessCenter as WorkoutIcon,
  Add as AddIcon,
  Event as EventIcon,
  Check as CheckIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Repeat as RepeatIcon,
  Checklist as TodoIcon,
  TrendingUp as TrendingUpIcon,
  DirectionsRun as RunIcon,
  Timer as TimerIcon,
  EmojiEvents as PurposeIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface ExerciseItem {
  id: string;
  name: string;
  frequency: string; // e.g. 'Daily', '3 days/week', '4 days/week', '5 days/week', 'Weekly', 'Custom'
  durationMins: number; // Duration per session in minutes
  purpose: string; // e.g. 'Lose weight', 'Build muscle', 'Build consistency', 'Increase endurance', 'General health'
  targetValue: number;
  currentValue: number;
  unit: string; // e.g. 'steps' | 'minutes' | 'rounds' | 'hours' | 'sets' | 'sessions' | 'reps' | 'laps' | 'meters' | 'km' | 'kcal'
  scheduleTime?: string;
}

interface FitnessTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

const EXERCISE_PRESETS = [
  { name: 'Walk', icon: '🚶' },
  { name: 'Running', icon: '🏃' },
  { name: 'Cycling', icon: '🚴' },
  { name: 'Gym', icon: '🏋️' },
  { name: 'Push up', icon: '🤸' },
  { name: 'Squats', icon: '🦵' },
  { name: 'Yoga', icon: '🧘' },
  { name: 'Swimming', icon: '🏊' },
  { name: 'Custom Exercise', icon: '✍️' },
];

// Exercise tailored units mapping
const EXERCISE_UNITS_MAP: Record<string, Array<{ label: string; value: string; icon: string }>> = {
  'Walk': [
    { label: 'Steps', value: 'steps', icon: '👟' },
    { label: 'Minutes', value: 'minutes', icon: '⏱️' },
    { label: 'Rounds', value: 'rounds', icon: '🔄' },
    { label: 'Kilometers (km)', value: 'km', icon: '🗺️' },
  ],
  'Walking': [
    { label: 'Steps', value: 'steps', icon: '👟' },
    { label: 'Minutes', value: 'minutes', icon: '⏱️' },
    { label: 'Rounds', value: 'rounds', icon: '🔄' },
    { label: 'Kilometers (km)', value: 'km', icon: '🗺️' },
  ],
  'Running': [
    { label: 'Steps', value: 'steps', icon: '👟' },
    { label: 'Minutes', value: 'minutes', icon: '⏱️' },
    { label: 'Rounds', value: 'rounds', icon: '🔄' },
    { label: 'Kilometers (km)', value: 'km', icon: '🗺️' },
  ],
  'Cycling': [
    { label: 'Rounds', value: 'rounds', icon: '🔄' },
    { label: 'Minutes', value: 'minutes', icon: '⏱️' },
    { label: 'Hours', value: 'hours', icon: '⌛' },
    { label: 'Kilometers (km)', value: 'km', icon: '🚴' },
  ],
  'Gym': [
    { label: 'Sets', value: 'sets', icon: '🏋️' },
    { label: 'Sessions', value: 'sessions', icon: '📅' },
    { label: 'Minutes', value: 'minutes', icon: '⏱️' },
  ],
  'Gym Workout': [
    { label: 'Sets', value: 'sets', icon: '🏋️' },
    { label: 'Sessions', value: 'sessions', icon: '📅' },
    { label: 'Minutes', value: 'minutes', icon: '⏱️' },
  ],
  'Push up': [
    { label: 'Repetitions (reps)', value: 'reps', icon: '🔢' },
    { label: 'Sets', value: 'sets', icon: '🏋️' },
    { label: 'Sessions', value: 'sessions', icon: '📅' },
  ],
  'Pushups': [
    { label: 'Repetitions (reps)', value: 'reps', icon: '🔢' },
    { label: 'Sets', value: 'sets', icon: '🏋️' },
    { label: 'Sessions', value: 'sessions', icon: '📅' },
  ],
  'Squats': [
    { label: 'Repetitions (reps)', value: 'reps', icon: '🔢' },
    { label: 'Sets', value: 'sets', icon: '🏋️' },
    { label: 'Sessions', value: 'sessions', icon: '📅' },
  ],
  'Yoga': [
    { label: 'Minutes', value: 'minutes', icon: '⏱️' },
    { label: 'Sessions', value: 'sessions', icon: '🧘' },
    { label: 'Hours', value: 'hours', icon: '⌛' },
  ],
  'Yoga & Stretching': [
    { label: 'Minutes', value: 'minutes', icon: '⏱️' },
    { label: 'Sessions', value: 'sessions', icon: '🧘' },
    { label: 'Hours', value: 'hours', icon: '⌛' },
  ],
  'Swimming': [
    { label: 'Laps', value: 'laps', icon: '🏊' },
    { label: 'Rounds', value: 'rounds', icon: '🔄' },
    { label: 'Minutes', value: 'minutes', icon: '⏱️' },
    { label: 'Meters', value: 'meters', icon: '📏' },
  ],
};

const DEFAULT_UNITS = [
  { label: 'Steps', value: 'steps', icon: '👟' },
  { label: 'Minutes', value: 'minutes', icon: '⏱️' },
  { label: 'Rounds', value: 'rounds', icon: '🔄' },
  { label: 'Repetitions (reps)', value: 'reps', icon: '🔢' },
  { label: 'Sets', value: 'sets', icon: '🏋️' },
  { label: 'Sessions', value: 'sessions', icon: '📅' },
  { label: 'Laps', value: 'laps', icon: '🏊' },
  { label: 'Hours', value: 'hours', icon: '⌛' },
  { label: 'Kilometers (km)', value: 'km', icon: '🗺️' },
  { label: 'Meters', value: 'meters', icon: '📏' },
];

const FREQUENCY_OPTIONS = [
  { label: 'Daily (7 days/week)', value: 'Daily', icon: '📆' },
  { label: '3 days / week', value: '3 days/week', icon: '🗓️' },
  { label: '4 days / week', value: '4 days/week', icon: '🗓️' },
  { label: '5 days / week', value: '5 days/week', icon: '🗓️' },
  { label: 'Weekly (1 day/week)', value: 'Weekly', icon: '📅' },
  { label: 'Custom Frequency', value: 'Custom', icon: '⚙️' },
];

const _DURATION_OPTIONS = [
  { label: '15 Minutes', value: 15, icon: '⚡' },
  { label: '30 Minutes', value: 30, icon: '⏱️' },
  { label: '45 Minutes', value: 45, icon: '⌛' },
  { label: '60 Mins (1 Hour)', value: 60, icon: '🕒' },
  { label: '90 Mins (1.5 Hours)', value: 90, icon: '🏋️' },
];

const PURPOSE_OPTIONS = [
  { label: 'Build Muscle & Strength', value: 'Build Muscle', icon: '💥' },
  { label: 'Lose Weight & Burn Fat', value: 'Lose Weight', icon: '🔥' },
  { label: 'Build Consistency & Habit', value: 'Build Consistency', icon: '⚡' },
  { label: 'Increase Endurance & Stamina', value: 'Increase Endurance', icon: '🏃' },
  { label: 'General Health & Vitality', value: 'General Health', icon: '❤️' },
  { label: 'Flexibility & Active Recovery', value: 'Flexibility', icon: '🧘' },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: 'easeOut' as const },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 40 : -40,
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' as const },
  }),
};

function formatDate(dateVal: unknown): string {
  if (!dateVal) return new Date().toISOString().split('T')[0];
  if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];
  if (typeof dateVal === 'object' && 'seconds' in (dateVal as { seconds: number })) {
    return new Date((dateVal as { seconds: number }).seconds * 1000).toISOString().split('T')[0];
  }
  return String(dateVal).split('T')[0];
}

function calculateExerciseProgress(item: ExerciseItem): number {
  if (!item.targetValue || item.targetValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((item.currentValue || 0) / item.targetValue) * 100)));
}

export function getDefaultTargetForUnit(unit: string): number {
  const norm = (unit || '').toLowerCase().trim();
  if (norm === 'steps') return 5000;
  if (norm === 'km' || norm === 'kilometer' || norm === 'kilometers') return 5;
  if (norm === 'meters') return 1000;
  if (norm === 'minutes' || norm === 'mins') return 30;
  if (norm === 'hours') return 1;
  if (norm === 'rounds') return 3;
  if (norm === 'reps') return 20;
  if (norm === 'sets') return 3;
  if (norm === 'sessions') return 1;
  if (norm === 'laps') return 10;
  if (norm === 'kcal') return 300;
  return 10;
}

function formatUnitVal(val: number, unit: string) {
  if (unit === 'steps') return `${val.toLocaleString()} steps`;
  if (unit === 'minutes' || unit === 'mins') return `${val} minutes`;
  if (unit === 'rounds') return `${val} rounds`;
  if (unit === 'hours') return `${val} hours`;
  if (unit === 'sets') return `${val} sets`;
  if (unit === 'sessions') return `${val} sessions`;
  if (unit === 'reps') return `${val} reps`;
  if (unit === 'laps') return `${val} laps`;
  if (unit === 'meters') return `${val} meters`;
  if (unit === 'km') return `${val} km`;
  if (unit === 'kcal') return `${val} kcal`;
  return `${val} ${unit}`;
}

export default function FitnessTemplate({ goal, onUpdateGoal }: FitnessTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, deleteTodo } = useTodoContext();
  const { allSchedules, addSchedule, removeSchedule } = useSchedules();

  // Exercise items state
  const [exercises, setExercises] = useState<ExerciseItem[]>(() => {
    if (Array.isArray(goal.exerciseItems) && goal.exerciseItems.length > 0) {
      return goal.exerciseItems as unknown as ExerciseItem[];
    }
    return [];
  });

  // Step-by-step Wizard States for Exercise Add/Edit
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exStep, setExStep] = useState<number>(1);
  const [slideDir, setSlideDir] = useState<number>(1);

  // Exercise Form Answers
  const [exName, setExName] = useState('Walk');
  const [customExName, setCustomExName] = useState('');
  const [exUnit, setExUnit] = useState<string>('steps');
  const [exFrequency, setExFrequency] = useState('Daily');
  const [exDuration, setExDuration] = useState<number>(30);
  const [exPurpose, setExPurpose] = useState('General Health');
  const [exTarget, setExTarget] = useState<number | ''>(5000);
  const [exCurrent, setExCurrent] = useState<number | ''>(0);
  const [exTime, setExTime] = useState('07:00');
  const [savingEx, setSavingEx] = useState(false);

  // Quick Log Modal State
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [targetExerciseForLog, setTargetExerciseForLog] = useState<ExerciseItem | null>(null);
  const [logValueInput, setLogValueInput] = useState<number | ''>('');

  // Schedule Routine Modal
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('07:00');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSched, setSavingSched] = useState(false);

  // Overall Mean Progress
  const meanProgress = useMemo(() => {
    if (exercises.length === 0) return 0;
    let sum = 0;
    for (const ex of exercises) {
      sum += calculateExerciseProgress(ex);
    }
    return Math.max(0, Math.min(100, Math.round(sum / exercises.length)));
  }, [exercises]);

  // Linked Timeline Actions (Schedules & Todos)
  const actionItems = useMemo(() => {
    if (!goal.id) return [];
    const schedList = allSchedules
      .filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id)
      .map((s) => ({
        id: s.id || '',
        title: s.title,
        kind: 'schedule' as const,
        date: s.date,
        time: s.startTime || '07:00',
        status: s.status,
      }));

    const todoList = todos
      .filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id)
      .map((t) => ({
        id: t.id || '',
        title: t.title,
        kind: 'todo' as const,
        date: formatDate(t.dueDate),
        time: 'Task',
        status: t.status,
      }));

    return [...schedList, ...todoList];
  }, [allSchedules, todos, goal.id]);

  // Derived available units for current exercise selection
  const activeExerciseName = exName === 'Custom Exercise' || !exName ? customExName || 'Exercise' : exName;
  const currentAvailableUnits = useMemo(() => {
    return EXERCISE_UNITS_MAP[activeExerciseName] || EXERCISE_UNITS_MAP[exName] || DEFAULT_UNITS;
  }, [activeExerciseName, exName]);

  // Unit change handler with intelligent default target values per metric unit
  const handleUnitChange = (newUnit: string) => {
    setExUnit((prevUnit) => {
      setExTarget((prevTarget) => {
        const oldDefault = getDefaultTargetForUnit(prevUnit);
        if (prevTarget === '' || prevTarget === 5000 || prevTarget === oldDefault) {
          return getDefaultTargetForUnit(newUnit);
        }
        return prevTarget;
      });
      return newUnit;
    });
  };

  // Select Exercise Preset and auto-assign 1st relevant unit
  const handleSelectExercise = (name: string) => {
    setExName(name);
    const units = EXERCISE_UNITS_MAP[name] || DEFAULT_UNITS;
    if (units.length > 0) {
      handleUnitChange(units[0].value);
    }
  };

  // Persist exercises list and sync mean progress
  const saveExercisesList = async (newList: ExerciseItem[]) => {
    setExercises(newList);
    if (!goal.id) return;

    let sum = 0;
    for (const ex of newList) {
      sum += calculateExerciseProgress(ex);
    }
    const newMean = newList.length > 0 ? Math.max(0, Math.min(100, Math.round(sum / newList.length))) : 0;

    const payload = {
      exerciseItems: newList,
      progress: newMean,
    };

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, payload);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), payload);
    }
  };

  // Open Step-by-step Modal to Add / Edit Exercise
  const handleOpenExerciseModal = (item?: ExerciseItem) => {
    setExStep(1);
    setSlideDir(1);
    if (item) {
      setEditingId(item.id);
      setExName(item.name);
      setCustomExName(EXERCISE_PRESETS.some((p) => p.name === item.name) ? '' : item.name);
      setExUnit(item.unit || 'steps');
      setExFrequency(item.frequency || 'Daily');
      setExDuration(item.durationMins || 30);
      setExPurpose(item.purpose || 'General Health');
      setExTarget(item.targetValue);
      setExCurrent(item.currentValue || 0);
      setExTime(item.scheduleTime || '07:00');
    } else {
      setEditingId(null);
      setExName('Walk');
      setCustomExName('');
      setExUnit('steps');
      setExFrequency('Daily');
      setExDuration(30);
      setExPurpose('General Health');
      setExTarget(5000);
      setExCurrent(0);
      setExTime('07:00');
    }
    setExerciseModalOpen(true);
  };

  const handleNextStep = () => {
    const finalName = exName === 'Custom Exercise' || !exName ? customExName : exName;
    if (exStep === 1 && !finalName.trim()) return;
    if (exStep < 5) {
      setSlideDir(1);
      setExStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (exStep > 1) {
      setSlideDir(-1);
      setExStep((prev) => prev - 1);
    }
  };

  const handleSaveExercise = async () => {
    const finalName = exName === 'Custom Exercise' || !exName.trim() ? customExName.trim() : exName.trim();
    if (!finalName || typeof exTarget !== 'number' || exTarget <= 0) return;
    setSavingEx(true);
    try {
      const newItem: ExerciseItem = {
        id: editingId || 'ex_' + Date.now(),
        name: finalName,
        frequency: exFrequency,
        durationMins: typeof exDuration === 'number' ? exDuration : 30,
        purpose: exPurpose,
        targetValue: exTarget,
        currentValue: typeof exCurrent === 'number' ? exCurrent : 0,
        unit: exUnit,
        scheduleTime: exTime,
      };

      let updatedList: ExerciseItem[];
      if (editingId) {
        updatedList = exercises.map((e) => (e.id === editingId ? newItem : e));
      } else {
        updatedList = [...exercises, newItem];
      }

      await saveExercisesList(updatedList);
      setExerciseModalOpen(false);
    } catch (err) {
      console.error('Failed to save exercise:', err);
    } finally {
      setSavingEx(false);
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!confirm('Are you sure you want to delete this exercise milestone?')) return;
    const filtered = exercises.filter((e) => e.id !== exerciseId);
    await saveExercisesList(filtered);
  };

  // Open Quick Log Progress Modal
  const handleOpenQuickLog = (item: ExerciseItem) => {
    setTargetExerciseForLog(item);
    setLogValueInput(item.currentValue);
    setLogModalOpen(true);
  };

  const handleConfirmQuickLog = async () => {
    if (!targetExerciseForLog || typeof logValueInput !== 'number') return;
    const updated = exercises.map((e) => {
      if (e.id === targetExerciseForLog.id) {
        return { ...e, currentValue: logValueInput };
      }
      return e;
    });
    await saveExercisesList(updated);
    setLogModalOpen(false);
  };

  // Open Schedule Modal for a specific Exercise
  const handleOpenScheduleForExercise = (exerciseName: string) => {
    setSchedTitle(`${exerciseName} Session`);
    setSchedTime('07:00');
    setSchedDate(new Date().toISOString().split('T')[0]);
    setSchedKind('schedule');
    setSchedModalOpen(true);
  };

  // Add Schedule or Todo Routine
  const handleAddScheduleRoutine = async () => {
    if (!schedTitle.trim() || !user || !goal.id) return;
    setSavingSched(true);
    try {
      if (schedKind === 'schedule') {
        await addSchedule({
          title: schedTitle.trim(),
          date: schedDate || new Date().toISOString().split('T')[0],
          startTime: schedTime || '07:00',
          endTime: '08:00',
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
          priority: 'urgent',
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
      console.error('Failed to add exercise schedule:', err);
    } finally {
      setSavingSched(false);
    }
  };

  // Delete Schedule or Todo item from within Goal
  const handleDeleteActionItem = async (id: string, kind: 'schedule' | 'todo') => {
    if (!confirm(`Are you sure you want to delete this ${kind}?`)) return;
    try {
      if (kind === 'schedule') {
        await removeSchedule(id, true);
      } else {
        await deleteTodo(id, true);
      }
    } catch (err) {
      console.error(`Failed to delete ${kind}:`, err);
    }
  };

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const cardOptionBg = isDark ? '#0f172a' : '#f8fafc';

  return (
    <Box sx={{ width: '100%' }}>
      {/* ── 1. Top Fitness Summary Banner Card ── */}
      <Box
        sx={{
          borderRadius: '28px',
          border: `1.5px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#a7f3d0'}`,
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
          p: 3.5,
          boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 8px 30px rgba(16,185,129,0.06)',
          mb: 3.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Health & Fitness Tracker
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: textPrimary, mt: 0.5 }}>
              {goal.title}
            </Typography>
          </Box>

          <Chip
            label={`${meanProgress}% Target Progress`}
            size="small"
            sx={{
              bgcolor: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              fontWeight: 800,
              fontSize: 12,
              px: 0.5,
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          />
        </Box>

        <Box sx={{ mt: 3, display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 32, fontWeight: 900, color: textPrimary, fontFamily: 'monospace' }}>
            {exercises.length} Active {exercises.length === 1 ? 'Exercise' : 'Exercises'}
          </Typography>
          <Typography sx={{ fontSize: 13, color: textMuted, fontWeight: 500 }}>
            configured for fitness routine
          </Typography>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ mt: 2, height: 8, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              width: `${meanProgress}%`,
              bgcolor: '#10b981',
              borderRadius: 99,
              transition: 'width 0.4s ease',
            }}
          />
        </Box>
      </Box>

      {/* ── 2. Tracked Exercises / Milestones Section ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Tracked Exercises ({exercises.length})
          </Typography>

          <Button
            variant="contained"
            size="small"
            onClick={() => handleOpenExerciseModal()}
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontSize: 12.5,
              fontWeight: 800,
              borderRadius: '12px',
              bgcolor: '#10b981',
              color: '#ffffff',
              px: 2,
              py: 0.75,
              boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
              '&:hover': { bgcolor: '#059669' },
            }}
          >
            + Add Exercise
          </Button>
        </Box>

        {/* Initial Prompt State if no exercises added yet */}
        {exercises.length === 0 ? (
          <Box
            sx={{
              p: 4,
              borderRadius: '24px',
              border: `2px dashed ${isDark ? '#334155' : '#cbd5e1'}`,
              bgcolor: surfaceBg,
              textAlign: 'center',
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(15,23,42,0.03)',
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '18px',
                bgcolor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <RunIcon sx={{ fontSize: 30 }} />
            </Box>

            <Typography sx={{ fontSize: 18, fontWeight: 800, color: textPrimary, mb: 1 }}>
              Choose an exercise you want to do for fitness
            </Typography>
            <Typography sx={{ fontSize: 13, color: textMuted, maxWidth: 460, mx: 'auto', mb: 3 }}>
              Set up your workout routines (Walk, Running, Cycling, Gym, Push up, Squats, Yoga, Swimming) with relevant units, frequency, and session targets.
            </Typography>

            <Button
              variant="contained"
              onClick={() => handleOpenExerciseModal()}
              startIcon={<AddIcon />}
              sx={{
                textTransform: 'none',
                fontSize: 13.5,
                fontWeight: 800,
                borderRadius: '14px',
                bgcolor: '#10b981',
                color: '#ffffff',
                px: 3,
                py: 1,
                boxShadow: '0 6px 20px rgba(16,185,129,0.35)',
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              + Add Exercise
            </Button>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {exercises.map((ex) => {
              const exProg = calculateExerciseProgress(ex);
              return (
                <Box
                  key={ex.id}
                  sx={{
                    borderRadius: '22px',
                    border: `1.5px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    bgcolor: surfaceBg,
                    p: 3,
                    boxShadow: isDark ? '0 4px 18px rgba(0,0,0,0.25)' : '0 4px 18px rgba(15,23,42,0.04)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '14px',
                          bgcolor: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <WorkoutIcon sx={{ fontSize: 24 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 17, fontWeight: 800, color: textPrimary }}>
                          {ex.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                          <Chip
                            label={ex.frequency}
                            size="small"
                            sx={{ fontSize: 10.5, fontWeight: 800, bgcolor: isDark ? '#1e293b' : '#f1f5f9', color: textMuted }}
                          />
                          <Chip
                            icon={<TimerIcon sx={{ fontSize: '13px !important' }} />}
                            label={`${ex.durationMins || 30} mins/session`}
                            size="small"
                            sx={{ fontSize: 10.5, fontWeight: 700, bgcolor: isDark ? '#1e293b' : '#f1f5f9', color: textMuted }}
                          />
                          <Chip
                            icon={<PurposeIcon sx={{ fontSize: '13px !important' }} />}
                            label={ex.purpose}
                            size="small"
                            sx={{ fontSize: 10.5, fontWeight: 800, bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label={`${exProg}%`}
                        size="small"
                        sx={{
                          fontSize: 11,
                          fontWeight: 800,
                          bgcolor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          mr: 0.5,
                        }}
                      />
                      <IconButton size="small" onClick={() => handleOpenExerciseModal(ex)}>
                        <EditIcon sx={{ fontSize: 17, color: textMuted }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteExercise(ex.id)} sx={{ color: '#ef4444' }}>
                        <DeleteIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Target & Current Values */}
                  <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography sx={{ fontSize: 24, fontWeight: 900, color: textPrimary, fontFamily: 'monospace' }}>
                        {formatUnitVal(ex.currentValue || 0, ex.unit)}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: textMuted }}>
                        / Target: {formatUnitVal(ex.targetValue, ex.unit)} per session
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Button
                        size="small"
                        onClick={() => handleOpenScheduleForExercise(ex.name)}
                        startIcon={<EventIcon sx={{ fontSize: 15 }} />}
                        sx={{
                          textTransform: 'none',
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: '#0284c7',
                          bgcolor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe',
                          borderRadius: '8px',
                          px: 1.2,
                          py: 0.4,
                          '&:hover': { bgcolor: isDark ? 'rgba(2, 132, 199, 0.25)' : '#bae6fd' },
                        }}
                      >
                        + Add Schedule
                      </Button>

                      <Button
                        size="small"
                        onClick={() => handleOpenQuickLog(ex)}
                        startIcon={<TrendingUpIcon sx={{ fontSize: 15 }} />}
                        sx={{
                          textTransform: 'none',
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: '#10b981',
                          bgcolor: 'rgba(16, 185, 129, 0.1)',
                          borderRadius: '8px',
                          px: 1.2,
                          py: 0.4,
                          '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.2)' },
                        }}
                      >
                        Log Workout
                      </Button>
                    </Box>
                  </Box>

                  {/* Progress Bar */}
                  <Box sx={{ mt: 1.5, height: 7, borderRadius: 99, bgcolor: isDark ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${exProg}%`,
                        bgcolor: '#10b981',
                        borderRadius: 99,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* ── 3. SCHEDULES & TODOS VERTICAL TIMELINE SECTION ── */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Scheduled Workouts & Routines ({actionItems.length})
          </Typography>
          <Button
            size="small"
            onClick={() => {
              setSchedTitle('');
              setSchedTime('07:00');
              setSchedModalOpen(true);
            }}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#10b981' }}
          >
            + Schedule Workout
          </Button>
        </Box>

        {actionItems.length === 0 ? (
          <Box
            sx={{
              p: 3.5,
              borderRadius: '20px',
              border: `1px dashed ${cardBorder}`,
              bgcolor: surfaceBg,
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: 13, color: textMuted }}>
              No workout schedules linked to this fitness goal yet. Click <strong>+ Schedule Workout</strong> or use <strong>+ Add Schedule</strong> within any exercise card above!
            </Typography>
          </Box>
        ) : (
          /* Dotted vertical timeline node structure */
          <Box sx={{ position: 'relative', pl: 3.5, pt: 1 }}>
            {actionItems.map((item, index) => {
              const isDone = item.status === 'completed';
              const isLast = index === actionItems.length - 1;

              return (
                <Box key={item.id} sx={{ position: 'relative', pb: isLast ? 0 : 3 }}>
                  {/* Connecting dotted line */}
                  {!isLast && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: -20,
                        top: 24,
                        bottom: -8,
                        width: '2px',
                        borderLeft: `2px dotted ${isDark ? '#334155' : '#cbd5e1'}`,
                      }}
                    />
                  )}

                  {/* Node marker circle */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -28,
                      top: 14,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      bgcolor: isDone ? '#10b981' : surfaceBg,
                      border: isDone ? 'none' : `2px solid ${isDark ? '#64748b' : '#94a3b8'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                  >
                    {isDone && <CheckIcon sx={{ fontSize: 12, color: '#ffffff' }} />}
                  </Box>

                  {/* Task Timeline Card */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 2.25,
                      borderRadius: '20px',
                      bgcolor: surfaceBg,
                      border: `1px solid ${cardBorder}`,
                      opacity: isDone ? 0.65 : 1,
                      transition: 'all 0.2s ease',
                      boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(15,23,42,0.04)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 46,
                          height: 46,
                          borderRadius: '14px',
                          bgcolor: item.kind === 'schedule' ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#1e3a8a' : '#e0f2fe'),
                          color: item.kind === 'schedule' ? '#10b981' : '#0284c7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {item.kind === 'schedule' ? <RepeatIcon sx={{ fontSize: 24 }} /> : <TodoIcon sx={{ fontSize: 24 }} />}
                      </Box>

                      <Box>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: textPrimary, textDecoration: isDone ? 'line-through' : 'none' }}>
                          {item.title}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: textMuted, mt: 0.3 }}>
                          {item.kind === 'schedule' ? `Workout Schedule · ${item.time || '07:00 AM'}` : `Fitness Task · Due ${item.date}`}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={isDone ? 'Completed' : item.kind === 'schedule' ? 'Scheduled' : 'Task'}
                        size="small"
                        sx={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          bgcolor: isDone
                            ? (isDark ? '#064e3b' : '#ecfdf5')
                            : item.kind === 'schedule'
                              ? (isDark ? '#064e3b' : '#ecfdf5')
                              : (isDark ? '#0c4a6e' : '#f0f9ff'),
                          color: isDone ? '#10b981' : item.kind === 'schedule' ? '#10b981' : '#0284c7',
                        }}
                      />

                      {/* Delete Option for Linked Schedule/Task from within Goal */}
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteActionItem(item.id, item.kind)}
                        sx={{ color: '#ef4444', ml: 0.5 }}
                      >
                        <DeleteIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ── 4. STEP-BY-STEP EXERCISE QUESTIONNAIRE DIALOG (With Tailored Unit Selection) ── */}
      <Dialog
        open={exerciseModalOpen}
        onClose={() => setExerciseModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '28px',
            bgcolor: surfaceBg,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            overflow: 'hidden',
          },
        }}
      >
        {/* Wizard Header with Progress Dots */}
        <Box sx={{ p: 3, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <WorkoutIcon sx={{ color: '#10b981', fontSize: 22 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#10b981', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {editingId ? 'Edit Exercise' : 'Exercise Setup'} ({exStep}/5)
            </Typography>
          </Stack>

          {/* Step Indicator Dots */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            {[1, 2, 3, 4, 5].map((stepNum) => (
              <Box
                key={stepNum}
                sx={{
                  width: stepNum === exStep ? 22 : 8,
                  height: 8,
                  borderRadius: '4px',
                  bgcolor: stepNum === exStep ? '#10b981' : stepNum < exStep ? 'rgba(16, 185, 129, 0.4)' : cardBorder,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            ))}
            <IconButton size="small" onClick={() => setExerciseModalOpen(false)} sx={{ color: textMuted, ml: 1 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <Divider sx={{ mx: 3, borderColor: cardBorder }} />

        {/* Wizard Step Body */}
        <DialogContent sx={{ p: 3.5, pt: 3, minHeight: 340, overflowY: 'auto' }}>
          <AnimatePresence mode="wait" custom={slideDir}>
            <motion.div
              key={exStep}
              custom={slideDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ width: '100%' }}
            >
              {/* ── STEP 1: Exercise Selection ── */}
              {exStep === 1 && (
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5, color: textPrimary, fontSize: '1.25rem' }}>
                    What exercise do you want to perform? 🏃
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: textMuted, mb: 2.5 }}>
                    Select an activity or type a custom exercise name below:
                  </Typography>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25, mb: 2.5 }}>
                    {EXERCISE_PRESETS.map((p) => {
                      const isSelected = exName === p.name;
                      return (
                        <Box
                          key={p.name}
                          onClick={() => handleSelectExercise(p.name)}
                          sx={{
                            p: 1.75,
                            borderRadius: '16px',
                            cursor: 'pointer',
                            border: `2px solid ${isSelected ? '#10b981' : cardBorder}`,
                            bgcolor: isSelected ? 'rgba(16, 185, 129, 0.1)' : cardOptionBg,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                            transition: 'all 0.2s ease',
                            '&:hover': { borderColor: '#10b981', transform: 'translateY(-1px)' },
                          }}
                        >
                          <Typography sx={{ fontSize: '1.3rem' }}>{p.icon}</Typography>
                          <Typography sx={{ fontSize: 13.5, fontWeight: isSelected ? 800 : 600, color: isSelected ? textPrimary : textMuted }}>
                            {p.name}
                          </Typography>
                          {isSelected && <CheckCircle sx={{ fontSize: 18, color: '#10b981', ml: 'auto' }} />}
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Custom exercise text field if selected or specified */}
                  {(exName === 'Custom Exercise' || !EXERCISE_PRESETS.some((p) => p.name === exName)) && (
                    <TextField
                      label="Custom Exercise Name"
                      placeholder="e.g. Bench Press, Kettlebell Swings, Morning Jog"
                      fullWidth
                      size="small"
                      value={customExName}
                      onChange={(e) => setCustomExName(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                    />
                  )}
                </Box>
              )}

              {/* ── STEP 2: Tailored Unit / Metric Selection ── */}
              {exStep === 2 && (
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5, color: textPrimary, fontSize: '1.25rem' }}>
                    Select Unit / Metric for {activeExerciseName} 📏
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: textMuted, mb: 2.5 }}>
                    Choose the metric unit that best suits your {activeExerciseName} target:
                  </Typography>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25 }}>
                    {currentAvailableUnits.map((u) => {
                      const isSelected = exUnit === u.value;
                      return (
                        <Box
                          key={u.value}
                          onClick={() => handleUnitChange(u.value)}
                          sx={{
                            p: 2,
                            borderRadius: '16px',
                            cursor: 'pointer',
                            border: `2px solid ${isSelected ? '#10b981' : cardBorder}`,
                            bgcolor: isSelected ? 'rgba(16, 185, 129, 0.1)' : cardOptionBg,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            transition: 'all 0.2s ease',
                            '&:hover': { borderColor: '#10b981', transform: 'translateY(-1px)' },
                          }}
                        >
                          <Typography sx={{ fontSize: '1.4rem' }}>{u.icon}</Typography>
                          <Typography sx={{ fontSize: 14, fontWeight: isSelected ? 800 : 600, color: isSelected ? textPrimary : textMuted }}>
                            {u.label}
                          </Typography>
                          {isSelected && <CheckCircle sx={{ fontSize: 18, color: '#10b981', ml: 'auto' }} />}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {/* ── STEP 3: Frequency Selection ── */}
              {exStep === 3 && (
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5, color: textPrimary, fontSize: '1.25rem' }}>
                    How often do you want to do it? 📅
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: textMuted, mb: 2.5 }}>
                    Select your commitment frequency for {activeExerciseName}:
                  </Typography>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25 }}>
                    {FREQUENCY_OPTIONS.map((f) => {
                      const isSelected = exFrequency === f.value;
                      return (
                        <Box
                          key={f.value}
                          onClick={() => setExFrequency(f.value)}
                          sx={{
                            p: 1.75,
                            borderRadius: '16px',
                            cursor: 'pointer',
                            border: `2px solid ${isSelected ? '#10b981' : cardBorder}`,
                            bgcolor: isSelected ? 'rgba(16, 185, 129, 0.1)' : cardOptionBg,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                            transition: 'all 0.2s ease',
                            '&:hover': { borderColor: '#10b981', transform: 'translateY(-1px)' },
                          }}
                        >
                          <Typography sx={{ fontSize: '1.2rem' }}>{f.icon}</Typography>
                          <Typography sx={{ fontSize: 13, fontWeight: isSelected ? 800 : 600, color: isSelected ? textPrimary : textMuted }}>
                            {f.label}
                          </Typography>
                          {isSelected && <CheckCircle sx={{ fontSize: 18, color: '#10b981', ml: 'auto' }} />}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {/* ── STEP 4: Purpose Selection ── */}
              {exStep === 4 && (
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5, color: textPrimary, fontSize: '1.25rem' }}>
                    What is your main purpose for this exercise? 🎯
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: textMuted, mb: 2.5 }}>
                    Selecting a goal purpose keeps your training focused:
                  </Typography>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25 }}>
                    {PURPOSE_OPTIONS.map((p) => {
                      const isSelected = exPurpose === p.value;
                      return (
                        <Box
                          key={p.value}
                          onClick={() => setExPurpose(p.value)}
                          sx={{
                            p: 1.75,
                            borderRadius: '16px',
                            cursor: 'pointer',
                            border: `2px solid ${isSelected ? '#10b981' : cardBorder}`,
                            bgcolor: isSelected ? 'rgba(16, 185, 129, 0.1)' : cardOptionBg,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                            transition: 'all 0.2s ease',
                            '&:hover': { borderColor: '#10b981', transform: 'translateY(-1px)' },
                          }}
                        >
                          <Typography sx={{ fontSize: '1.2rem' }}>{p.icon}</Typography>
                          <Typography sx={{ fontSize: 12.5, fontWeight: isSelected ? 800 : 600, color: isSelected ? textPrimary : textMuted }}>
                            {p.label}
                          </Typography>
                          {isSelected && <CheckCircle sx={{ fontSize: 18, color: '#10b981', ml: 'auto' }} />}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {/* ── STEP 5: Target Metric & Logged Amount ── */}
              {exStep === 5 && (
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5, color: textPrimary, fontSize: '1.25rem' }}>
                    What is your target per session? 📊
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: textMuted, mb: 2.5 }}>
                    Specify target count for {activeExerciseName} measured in <strong>{exUnit}</strong>:
                  </Typography>

                  <Stack spacing={2.5}>
                    {/* Target Quantity & Selected Unit chip info */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 1.5 }}>
                      <TextField
                        label={`Target ${exUnit} per session`}
                        type="number"
                        fullWidth
                        size="small"
                        value={exTarget}
                        onChange={(e) => setExTarget(e.target.value ? Number(e.target.value) : '')}
                        InputProps={{ endAdornment: <InputAdornment position="end">{exUnit}</InputAdornment> }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', fontWeight: 700 } }}
                      />

                      <FormControl fullWidth size="small">
                        <InputLabel>Selected Unit</InputLabel>
                        <Select
                          value={exUnit}
                          label="Selected Unit"
                          onChange={(e) => handleUnitChange(e.target.value)}
                          sx={{ borderRadius: '14px' }}
                        >
                          {currentAvailableUnits.map((u) => (
                            <MenuItem key={u.value} value={u.value}>
                              {u.icon} {u.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>

                    {/* Unit Selector Chips for Quick Toggle */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {currentAvailableUnits.map((u) => (
                        <Chip
                          key={u.value}
                          label={`${u.icon} ${u.label}`}
                          onClick={() => handleUnitChange(u.value)}
                          size="small"
                          sx={{
                            fontSize: 11,
                            fontWeight: 800,
                            bgcolor: exUnit === u.value ? '#10b981' : isDark ? '#334155' : '#f1f5f9',
                            color: exUnit === u.value ? '#ffffff' : textMuted,
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </Box>

                    {/* Current Logged Value & Preferred Time */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                      <TextField
                        label={`Initial Logged ${exUnit} (Optional)`}
                        type="number"
                        fullWidth
                        size="small"
                        value={exCurrent}
                        onChange={(e) => setExCurrent(e.target.value ? Number(e.target.value) : '')}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                      />
                      <TextField
                        label="Preferred Routine Time"
                        type="time"
                        fullWidth
                        size="small"
                        value={exTime}
                        onChange={(e) => setExTime(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }}
                      />
                    </Box>
                  </Stack>
                </Box>
              )}
            </motion.div>
          </AnimatePresence>
        </DialogContent>

        <Divider sx={{ mx: 3, borderColor: cardBorder }} />

        {/* Wizard Footer Navigation */}
        <Box sx={{ p: 3, pt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button
            disabled={exStep === 1}
            onClick={handlePrevStep}
            startIcon={<ArrowBackIcon />}
            sx={{ textTransform: 'none', fontWeight: 700, color: textMuted }}
          >
            Back
          </Button>

          {exStep < 5 ? (
            <Button
              variant="contained"
              onClick={handleNextStep}
              disabled={exStep === 1 && exName === 'Custom Exercise' && !customExName.trim()}
              endIcon={<ArrowForwardIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 800,
                borderRadius: '12px',
                bgcolor: '#10b981',
                px: 3,
                py: 0.8,
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={savingEx || typeof exTarget !== 'number' || exTarget <= 0}
              onClick={handleSaveExercise}
              sx={{
                textTransform: 'none',
                fontWeight: 800,
                borderRadius: '12px',
                bgcolor: '#10b981',
                px: 3.5,
                py: 0.8,
                boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              {savingEx ? 'Saving...' : 'Save Exercise ✓'}
            </Button>
          )}
        </Box>
      </Dialog>

      {/* ── Quick Log Workout Progress Modal ── */}
      <Dialog
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>
          Log Workout: {targetExerciseForLog?.name}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ py: 1 }}>
            <Typography sx={{ fontSize: 12.5, color: textMuted, mb: 2 }}>
              Update your completed amount for this session (Target: {targetExerciseForLog ? formatUnitVal(targetExerciseForLog.targetValue, targetExerciseForLog.unit) : ''}).
            </Typography>
            <TextField
              label="Logged Amount"
              type="number"
              fullWidth
              autoFocus
              value={logValueInput}
              onChange={(e) => setLogValueInput(e.target.value ? Number(e.target.value) : '')}
              InputProps={{
                endAdornment: <InputAdornment position="end">{targetExerciseForLog?.unit}</InputAdornment>,
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLogModalOpen(false)} sx={{ textTransform: 'none', color: textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={typeof logValueInput !== 'number'}
            onClick={handleConfirmQuickLog}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Update Log
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Schedule Routine Modal ── */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Schedule Workout Routine</DialogTitle>
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
                Schedule Routine
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
              label="Workout Title"
              placeholder="e.g. Morning 30-min Walk or Leg Day Routine"
              fullWidth
              size="small"
              value={schedTitle}
              onChange={(e) => setSchedTitle(e.target.value)}
            />

            <TextField
              label="Preferred Time"
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
            onClick={handleAddScheduleRoutine}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            {savingSched ? 'Saving...' : 'Save Routine'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
