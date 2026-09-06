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
  WbSunny as MorningIcon,
  WbTwilight as AfternoonIcon,
  NightsStay as EveningIcon,
  Bedtime as NightIcon,
  CheckCircle,
  RadioButtonUnchecked,
  Add as AddIcon,
  Event as EventIcon,
  Checklist as TodoIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface RoutineStep {
  id: string;
  title: string;
  time?: string;
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  completed: boolean;
}

interface DailyRoutineTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

export default function DailyRoutineTemplate({ goal, onUpdateGoal }: DailyRoutineTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};

  const routineTitle = goal.title || String(answers.routine_title || answers.routine_name || 'Ideal Daily Routine');

  // Routine Items State
  const [items, setItems] = useState<RoutineStep[]>(() => {
    if (Array.isArray(goal.routineItems) && goal.routineItems.length > 0) {
      return goal.routineItems.map((r, i) => ({
        id: r.id || String(i),
        title: r.title,
        time: r.time,
        period: r.period || 'morning',
        completed: !!r.completed,
      }));
    }
    return [
      { id: '1', title: '500ml Water & Morning Stretch', time: '07:00 AM', period: 'morning', completed: true },
      { id: '2', title: '15-min Meditation & Journaling', time: '07:20 AM', period: 'morning', completed: true },
      { id: '3', title: 'Healthy Lunch & 10-min Walk', time: '01:00 PM', period: 'afternoon', completed: false },
      { id: '4', title: '30-min Reading or Skill Practice', time: '08:00 PM', period: 'evening', completed: false },
      { id: '5', title: 'Screen-off & Sleep Preparation', time: '10:30 PM', period: 'night', completed: false },
    ];
  });

  // Modal States
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemTime, setItemTime] = useState('08:00 AM');
  const [itemPeriod, setItemPeriod] = useState<RoutineStep['period']>('morning');
  const [savingItem, setSavingItem] = useState(false);

  // Schedule Routine Modal State
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('07:00');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSched, setSavingSched] = useState(false);

  // Computations
  const doneCnt = useMemo(() => items.filter((i) => i.completed).length, [items]);
  const progressPct = useMemo(() => (items.length > 0 ? Math.round((doneCnt / items.length) * 100) : 0), [doneCnt, items]);

  // Persist Goal Helpers
  const persistRoutineData = async (updated: RoutineStep[]) => {
    if (!goal.id) return;
    const pct = updated.length > 0 ? Math.round((updated.filter((i) => i.completed).length / updated.length) * 100) : 0;
    const updates: Partial<Goal> = {
      routineItems: updated,
      currentValue: updated.filter((i) => i.completed).length,
      progress: pct,
    };
    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, updates);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), updates);
    }
  };

  // Toggle Item
  const toggleItem = async (id: string) => {
    const updated = items.map((i) => (i.id === id ? { ...i, completed: !i.completed } : i));
    setItems(updated);
    await persistRoutineData(updated);
  };

  // Add Item
  const handleAddItem = async () => {
    if (!itemTitle.trim() || !goal.id) return;
    setSavingItem(true);
    try {
      const newItem: RoutineStep = {
        id: String(Date.now()),
        title: itemTitle.trim(),
        time: itemTime,
        period: itemPeriod,
        completed: false,
      };

      const updated = [...items, newItem];
      setItems(updated);
      await persistRoutineData(updated);

      setAddItemOpen(false);
      setItemTitle('');
    } catch (err) {
      console.error('Failed to add routine item:', err);
    } finally {
      setSavingItem(false);
    }
  };

  // Schedule Routine or Task
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
      console.error('Failed to add routine schedule:', err);
    } finally {
      setSavingSched(false);
    }
  };

  // Group items by period
  const periods = [
    { key: 'morning', label: 'Morning Routine', icon: MorningIcon, color: '#0284c7', bg: isDark ? '#0c4a6e' : '#f0f9ff' },
    { key: 'afternoon', label: 'Afternoon Routine', icon: AfternoonIcon, color: '#f59e0b', bg: isDark ? '#451a03' : '#fff7ed' },
    { key: 'evening', label: 'Evening Routine', icon: EveningIcon, color: '#8b5cf6', bg: isDark ? '#2e1065' : '#f5f3ff' },
    { key: 'night', label: 'Bedtime Routine', icon: NightIcon, color: '#6366f1', bg: isDark ? '#1e1b4b' : '#eef2ff' },
  ];

  // Linked items
  const linkedRoutineSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const linkedRoutineTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
      {/* Hero Card */}
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
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Daily Routine
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: textPrimary, mt: 0.5 }}>
              {routineTitle}
            </Typography>
          </Box>
          <Chip
            label={`${progressPct}% Today`}
            size="small"
            sx={{ bgcolor: isDark ? '#0c4a6e' : '#e0f2fe', color: '#0284c7', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        {/* Progress Gauge */}
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: textPrimary, fontFamily: 'monospace' }}>
              {doneCnt} / {items.length} <span style={{ fontSize: 14, fontWeight: 600, color: textMuted }}>Steps Completed</span>
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0284c7' }}>
              {progressPct}% Done
            </Typography>
          </Box>
          <Box sx={{ height: 8, borderRadius: 99, bgcolor: isDark ? '#334155' : '#f1f5f9', overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${progressPct}%`,
                bgcolor: '#0284c7',
                borderRadius: 99,
                transition: 'width 0.5s ease',
              }}
            />
          </Box>
        </Box>

        {/* Action Button Row */}
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            onClick={() => setAddItemOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontSize: 12, fontWeight: 700, bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            + Add Routine Step
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSchedTitle(`Daily Routine Time-Block: ${routineTitle}`);
              setSchedModalOpen(true);
            }}
            startIcon={<EventIcon sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontSize: 12, fontWeight: 700 }}
          >
            + Schedule Time-Block
          </Button>
        </Box>
      </Box>

      {/* Routine Period Sections */}
      <Stack spacing={2.5} sx={{ mb: 3 }}>
        {periods.map((period) => {
          const Icon = period.icon;
          const periodItems = items.filter((i) => i.period === period.key);
          const donePeriodCnt = periodItems.filter((i) => i.completed).length;

          return (
            <Box key={period.key}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, px: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ p: 0.75, borderRadius: '10px', bgcolor: period.bg, color: period.color, display: 'flex', alignItems: 'center' }}>
                    <Icon sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {period.label} ({donePeriodCnt}/{periodItems.length})
                  </Typography>
                </Box>
                <Button
                  size="small"
                  onClick={() => {
                    setItemPeriod(period.key as RoutineStep['period']);
                    setItemTitle('');
                    setAddItemOpen(true);
                  }}
                  sx={{ textTransform: 'none', fontSize: 11, fontWeight: 700, color: period.color }}
                >
                  + Add Step
                </Button>
              </Box>

              <Stack spacing={1}>
                {periodItems.map((step) => (
                  <Box
                    key={step.id}
                    onClick={() => toggleItem(step.id)}
                    sx={{
                      p: 2,
                      borderRadius: '16px',
                      bgcolor: surfaceBg,
                      border: `1px solid ${cardBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <IconButton size="small" sx={{ p: 0, color: step.completed ? '#10b981' : textMuted }}>
                        {step.completed ? <CheckCircle sx={{ fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ fontSize: 20 }} />}
                      </IconButton>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: step.completed ? textMuted : textPrimary, textDecoration: step.completed ? 'line-through' : 'none' }}>
                        {step.title}
                      </Typography>
                    </Box>

                    {step.time && (
                      <Chip label={step.time} size="small" sx={{ bgcolor: isDark ? '#334155' : '#f1f5f9', color: textMuted, fontSize: 10, fontWeight: 700 }} />
                    )}
                  </Box>
                ))}

                {periodItems.length === 0 && (
                  <Typography sx={{ fontSize: 11, color: textMuted, fontStyle: 'italic', px: 1, py: 0.5 }}>
                    No steps added for {period.label.toLowerCase()} yet.
                  </Typography>
                )}
              </Stack>
            </Box>
          );
        })}
      </Stack>

      {/* Synced Routine Schedules & Tasks */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Synced Routine Reminders ({linkedRoutineSchedules.length + linkedRoutineTodos.length})
          </Typography>
        </Box>

        <Stack spacing={1.25}>
          {linkedRoutineSchedules.map((s) => (
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
                    Time: {s.startTime || '07:00 AM'} · Daily Routine
                  </Typography>
                </Box>
              </Box>
              <Chip label="Scheduled" size="small" sx={{ bgcolor: isDark ? '#0c4a6e' : '#e0f2fe', color: '#0284c7', fontSize: 10, fontWeight: 700 }} />
            </Box>
          ))}

          {linkedRoutineTodos.map((todo) => {
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
        </Stack>
      </Box>

      {/* Dialog: Add Routine Item */}
      <Dialog open={addItemOpen} onClose={() => setAddItemOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Add Routine Step</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Routine Block Period</InputLabel>
              <Select value={itemPeriod} label="Routine Block Period" onChange={(e) => setItemPeriod(e.target.value as RoutineStep['period'])}>
                <MenuItem value="morning">Morning Routine</MenuItem>
                <MenuItem value="afternoon">Afternoon Routine</MenuItem>
                <MenuItem value="evening">Evening Routine</MenuItem>
                <MenuItem value="night">Bedtime Routine</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Step Description"
              placeholder="e.g. 500ml Water, 15-min Stretch, Journaling"
              fullWidth
              size="small"
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
            />

            <TextField
              label="Anchor Time (Optional)"
              placeholder="e.g. 07:15 AM"
              fullWidth
              size="small"
              value={itemTime}
              onChange={(e) => setItemTime(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddItemOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingItem || !itemTitle.trim()}
            onClick={handleAddItem}
            sx={{ textTransform: 'none', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            Add Step
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Schedule Routine or Task */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Schedule Routine Reminder</DialogTitle>
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
              label="Routine Reminder Title"
              placeholder="e.g. Morning Time-Block Routine"
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
          <Button onClick={() => setSchedModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingSched || !schedTitle.trim()}
            onClick={handleScheduleRoutine}
            sx={{ textTransform: 'none', bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
          >
            Save Reminder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
