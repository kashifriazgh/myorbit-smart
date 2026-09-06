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
  MonitorWeight as WeightIcon,
  FitnessCenter as ExerciseIcon,
  Restaurant as DietIcon,
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

export interface WeightLogEntry {
  id?: string;
  date: string;
  weight: number;
  note?: string;
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

export default function WeightTemplate({ goal, onUpdateGoal }: WeightTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};
  const unit = String(goal.overallTargetUnit || answers.unit || 'kg');

  const initialWeight = Number(answers.initial_weight || answers.current_weight || 80);
  const targetWeight = Number(goal.overallTargetValue || answers.target_weight || 70);

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
    if (typeof logWeight !== 'number' || logWeight <= 0 || !goal.id) return;
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
              Weight Goal ({isWeightLoss ? 'Weight Loss' : 'Weight Gain'})
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

        <Button
          variant="contained"
          onClick={() => setAddLogOpen(true)}
          startIcon={<AddIcon />}
          sx={{ mt: 2.5, borderRadius: '12px', textTransform: 'none', fontWeight: 700, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
        >
          + Log Current Weight
        </Button>
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
              <Typography sx={{ fontSize: 11, color: textMuted }}>
                {formatDate(entry.date)}
              </Typography>
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
              onChange={(e) => setLogWeight(e.target.value ? Number(e.target.value) : '')}
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
            disabled={savingLog || typeof logWeight !== 'number' || logWeight <= 0}
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
    </Box>
  );
}
