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
} from '@mui/material';
import {
  FitnessCenter as WorkoutIcon,
  WbSunny as SunriseIcon,
  NightsStay as SunsetIcon,
  LocalFireDepartment as FlameIcon,
  Add as AddIcon,
  Event as EventIcon,
  CheckCircle,
  RadioButtonUnchecked,
  Checklist as TodoIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface ExerciseItem {
  id?: string;
  name: string;
  targetValue: number;
  currentValue: number;
  unit: 'steps' | 'km' | 'mins' | 'reps' | 'sets' | 'kcal';
  scheduleTime?: string;
}

interface FitnessTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

const trailPath = 'M15,68 C60,15 90,110 130,55 C155,22 170,45 185,32';

function formatUnitVal(val: number, unit: string) {
  if (unit === 'steps') return `${val.toLocaleString()} steps`;
  if (unit === 'km') return `${val} km`;
  if (unit === 'mins') return `${val} mins`;
  if (unit === 'reps') return `${val} reps`;
  if (unit === 'sets') return `${val} sets`;
  return `${val} ${unit}`;
}

export default function FitnessTemplate({ goal, onUpdateGoal }: FitnessTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};

  const targetSteps = goal.overallTargetValue || Number(answers.target_steps || answers.target_amount || answers.steps || 8000);
  const morningWalkTime = String(answers.morning_walk_time || answers.morning_time || '07:00 AM');
  const eveningWalkTime = String(answers.evening_walk_time || answers.evening_time || '06:30 PM');
  const mainUnit = String(goal.overallTargetUnit || answers.unit || 'steps');

  // Exercise items state
  const [exercises, setExercises] = useState<ExerciseItem[]>(() => {
    if (Array.isArray(goal.exerciseItems) && goal.exerciseItems.length > 0) {
      return goal.exerciseItems;
    }
    return [
      {
        id: '1',
        name: goal.title || 'Daily Walking / Steps',
        targetValue: targetSteps,
        currentValue: goal.currentValue || Number(answers.today_steps || 6000),
        unit: (mainUnit as ExerciseItem['unit']) || 'steps',
        scheduleTime: morningWalkTime,
      },
    ];
  });

  const [currentProgressSteps, setCurrentProgressSteps] = useState(goal.currentValue || Number(answers.today_steps || 6000));
  const streakCount = Number(answers.streak_count || answers.consistency_count || 9);

  // Dialog states for exercises
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [exName, setExName] = useState('');
  const [exTarget, setExTarget] = useState<number | ''>('');
  const [exCurrent, setExCurrent] = useState<number | ''>('');
  const [exUnit, setExUnit] = useState<ExerciseItem['unit']>('steps');
  const [exTime, setExTime] = useState('07:00 AM');
  const [savingEx, setSavingEx] = useState(false);

  // Schedule Workout Modal
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('07:00');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSched, setSavingSched] = useState(false);

  const mainProgress = useMemo(() => {
    if (!targetSteps || targetSteps <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((currentProgressSteps / targetSteps) * 100)));
  }, [currentProgressSteps, targetSteps]);

  const km = useMemo(() => {
    return +(currentProgressSteps * 0.0008).toFixed(1);
  }, [currentProgressSteps]);

  // Filter linked schedules and todos
  const linkedFitnessSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const linkedFitnessTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  const handleQuickLog = async (val: number) => {
    setCurrentProgressSteps(val);
    if (!goal.id) return;
    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, { currentValue: val });
    } else {
      await updateDoc(doc(db, 'goals', goal.id), { currentValue: val });
    }
  };

  const handleSaveExercise = async () => {
    if (!exName.trim() || typeof exTarget !== 'number' || exTarget <= 0 || !goal.id) return;
    setSavingEx(true);
    try {
      const newItem: ExerciseItem = {
        id: editingIdx !== null ? exercises[editingIdx].id : String(Date.now()),
        name: exName.trim(),
        targetValue: exTarget,
        currentValue: typeof exCurrent === 'number' ? exCurrent : 0,
        unit: exUnit,
        scheduleTime: exTime,
      };

      let updated: ExerciseItem[];
      if (editingIdx !== null) {
        updated = exercises.map((e, idx) => (idx === editingIdx ? newItem : e));
      } else {
        updated = [...exercises, newItem];
      }
      setExercises(updated);

      if (onUpdateGoal) {
        await onUpdateGoal(goal.id, { exerciseItems: updated });
      } else {
        await updateDoc(doc(db, 'goals', goal.id), { exerciseItems: updated });
      }

      setExerciseModalOpen(false);
    } catch (err) {
      console.error('Failed to save exercise:', err);
    } finally {
      setSavingEx(false);
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

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  const round500 = (n: number) => Math.round(n / 500) * 500;
  const presets = [
    round500(targetSteps * 0.75),
    targetSteps,
    round500(targetSteps * 1.25),
  ];

  return (
    <Box sx={{ width: '100%' }}>
      {/* Trail Progress Card */}
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
              Fitness & Exercise Progress
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: textPrimary, mt: 0.5 }}>
              {goal.title}
            </Typography>
          </Box>
          <Chip
            label={`Goal: ${targetSteps.toLocaleString()} ${mainUnit}`}
            size="small"
            sx={{ bgcolor: isDark ? '#064e3b' : '#ecfdf5', color: '#10b981', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        {/* Trail SVG Graphic */}
        <Box sx={{ position: 'relative', mt: 3, display: 'flex', justifyContent: 'center' }}>
          <svg viewBox="0 0 200 110" style={{ width: '100%', maxWidth: 260 }}>
            <defs>
              <linearGradient id="fitnessTrailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#166534" />
                <stop offset="60%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#a3e635" />
              </linearGradient>
            </defs>

            <path
              d={trailPath}
              fill="none"
              stroke={isDark ? '#334155' : '#f1f5f9'}
              strokeWidth="8"
              strokeLinecap="round"
              pathLength="100"
            />
            <path
              d={trailPath}
              fill="none"
              stroke="url(#fitnessTrailGrad)"
              strokeWidth="8"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - mainProgress}
              style={{ transition: 'stroke-dashoffset 500ms ease' }}
            />

            <g transform="translate(15,68)">
              <circle r="9" fill="#166534" />
            </g>
            <g transform="translate(185,32)">
              <circle r="9" fill={mainProgress >= 100 ? '#65a30d' : '#cbd5e1'} />
            </g>
          </svg>

          <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 32, fontWeight: 800, color: textPrimary, fontFamily: 'monospace', lineHeight: 1 }}>
              {currentProgressSteps.toLocaleString()}
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: textMuted, mt: 0.5 }}>
              {mainUnit} · {km} km · {mainProgress}% of target
            </Typography>
          </Box>
        </Box>

        {/* Schedule Pills */}
        <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: isDark ? '#0c4a6e' : '#f0f9ff' }}>
            <SunriseIcon sx={{ color: '#0284c7', fontSize: 22 }} />
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                Morning Routine
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                {morningWalkTime}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: isDark ? '#451a03' : '#fff7ed' }}>
            <SunsetIcon sx={{ color: '#f97316', fontSize: 22 }} />
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#f97316', textTransform: 'uppercase' }}>
                Evening Routine
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                {eveningWalkTime}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Streak Row */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: '16px', bgcolor: isDark ? 'rgba(51,65,85,0.3)' : '#f8fafc' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlameIcon sx={{ color: '#f97316', fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, color: textPrimary }}>
              <strong style={{ color: '#f97316' }}>{streakCount} day</strong> consistency streak
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 12, color: textMuted }}>
            Distance: <strong>{km} km</strong>
          </Typography>
        </Box>

        {/* Quick Log Presets */}
        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', mb: 1 }}>
            Quick Log Today&apos;s Steps / Progress
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {presets.map((s) => (
              <Button
                key={s}
                variant={currentProgressSteps === s ? 'contained' : 'outlined'}
                onClick={() => handleQuickLog(s)}
                fullWidth
                size="small"
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: currentProgressSteps === s ? '#10b981' : 'transparent',
                  '&:hover': { bgcolor: currentProgressSteps === s ? '#059669' : 'rgba(16,185,129,0.08)' },
                }}
              >
                {s >= 1000 ? `${(s / 1000).toFixed(s % 1000 === 0 ? 0 : 1)}k` : s}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Selected Exercises List */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Tracked Exercises ({exercises.length})
          </Typography>
          <Button
            size="small"
            onClick={() => {
              setEditingIdx(null);
              setExName('');
              setExTarget('');
              setExCurrent('');
              setExUnit('steps');
              setExTime('07:00 AM');
              setExerciseModalOpen(true);
            }}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#10b981' }}
          >
            + Add Exercise
          </Button>
        </Box>

        <Stack spacing={1.5}>
          {exercises.map((e, idx) => {
            const exProgress = e.targetValue > 0 ? Math.max(0, Math.min(100, Math.round((e.currentValue / e.targetValue) * 100))) : 0;
            return (
              <Box
                key={e.id || idx}
                sx={{
                  p: 2,
                  borderRadius: '18px',
                  bgcolor: surfaceBg,
                  border: `1px solid ${cardBorder}`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <WorkoutIcon sx={{ color: '#10b981', fontSize: 22 }} />
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary }}>
                        {e.name}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: textMuted }}>
                        Target: {formatUnitVal(e.targetValue, e.unit)} {e.scheduleTime && `· at ${e.scheduleTime}`}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip label={`${exProgress}%`} size="small" sx={{ bgcolor: isDark ? '#064e3b' : '#ecfdf5', color: '#10b981', fontWeight: 700, fontSize: 11 }} />
                </Box>

                <Box sx={{ mt: 1.5, height: 6, borderRadius: 99, bgcolor: isDark ? '#334155' : '#f1f5f9', overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${exProgress}%`, bgcolor: '#10b981', borderRadius: 99, transition: 'width 0.4s ease' }} />
                </Box>
                <Typography sx={{ mt: 1, fontSize: 11, color: textMuted, textAlign: 'right' }}>
                  Logged: {formatUnitVal(e.currentValue, e.unit)}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Exercise Routines & Scheduled Workout Tasks */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Scheduled Workouts & Routines ({linkedFitnessSchedules.length + linkedFitnessTodos.length})
          </Typography>
          <Button
            size="small"
            onClick={() => setSchedModalOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#0284c7' }}
          >
            + Schedule Workout
          </Button>
        </Box>

        <Stack spacing={1.25}>
          {linkedFitnessSchedules.map((s) => (
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
                <EventIcon sx={{ color: '#0284c7', fontSize: 20 }} />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    Time: {s.startTime || '07:00 AM'} · Daily Workout
                  </Typography>
                </Box>
              </Box>
              <Chip label="Scheduled" size="small" sx={{ bgcolor: isDark ? '#0c4a6e' : '#e0f2fe', color: '#0284c7', fontSize: 10, fontWeight: 700 }} />
            </Box>
          ))}

          {linkedFitnessTodos.map((todo) => {
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

          {linkedFitnessSchedules.length === 0 && linkedFitnessTodos.length === 0 && (
            <Typography sx={{ fontSize: 12, color: textMuted, fontStyle: 'italic', textAlign: 'center', py: 2 }}>
              No workout schedules added yet. Click &quot;+ Schedule Workout&quot; to set morning or evening reminders.
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Add / Edit Exercise Modal */}
      <Dialog open={exerciseModalOpen} onClose={() => setExerciseModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
          {editingIdx !== null ? 'Edit Exercise' : 'Add Exercise Item'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Exercise Name"
              placeholder="e.g. Pushups, Walking, Cycling, Running"
              fullWidth
              size="small"
              value={exName}
              onChange={(e) => setExName(e.target.value)}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Measurement Unit</InputLabel>
              <Select value={exUnit} label="Measurement Unit" onChange={(e) => setExUnit(e.target.value as ExerciseItem['unit'])}>
                <MenuItem value="steps">Steps</MenuItem>
                <MenuItem value="km">Kilometers (km)</MenuItem>
                <MenuItem value="mins">Minutes (mins)</MenuItem>
                <MenuItem value="reps">Repetitions (reps)</MenuItem>
                <MenuItem value="sets">Sets</MenuItem>
                <MenuItem value="kcal">Calories (kcal)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Target Goal Value"
              type="number"
              fullWidth
              size="small"
              value={exTarget}
              onChange={(e) => setExTarget(e.target.value ? Number(e.target.value) : '')}
            />

            <TextField
              label="Current Logged Value"
              type="number"
              fullWidth
              size="small"
              value={exCurrent}
              onChange={(e) => setExCurrent(e.target.value ? Number(e.target.value) : '')}
            />

            <TextField
              label="Routine Time (Optional)"
              placeholder="e.g. 07:00 AM"
              fullWidth
              size="small"
              value={exTime}
              onChange={(e) => setExTime(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setExerciseModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingEx || !exName.trim() || typeof exTarget !== 'number' || exTarget <= 0}
            onClick={handleSaveExercise}
            sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Save Exercise
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Routine Modal */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Schedule Workout Routine</DialogTitle>
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
          <Button onClick={() => setSchedModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingSched || !schedTitle.trim()}
            onClick={handleScheduleRoutine}
            sx={{ textTransform: 'none', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            Save Routine
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
