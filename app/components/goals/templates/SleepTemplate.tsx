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
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

interface SleepTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

export default function SleepTemplate({ goal, onUpdateGoal }: SleepTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};

  const targetHours = goal.overallTargetValue || Number(answers.target_hours || answers.hours || 8);
  const bedTime = String(answers.bedtime || answers.bed_time || '10:30 PM');
  const wakeTime = String(answers.wake_time || answers.wake_up_time || '06:30 AM');
  const consistencyCount = Number(answers.consistency_count || answers.streak || 12);
  const initialLastNightHours = Number(goal.currentValue || answers.last_night_hours || answers.logged_hours || 7);

  const [hours, setHours] = useState(initialLastNightHours);

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

  const handleLog = async (value: number) => {
    setHours(value);
    if (!goal.id) return;
    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, { currentValue: value });
    } else {
      await updateDoc(doc(db, 'goals', goal.id), { currentValue: value });
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

        {/* Streak Row */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, borderRadius: '16px', bgcolor: isDark ? 'rgba(51,65,85,0.3)' : '#f8fafc' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FlameIcon sx={{ color: '#f97316', fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, color: textPrimary }}>
              <strong style={{ color: '#f97316' }}>{consistencyCount} day</strong> consistency streak
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 12, color: textMuted }}>
            Last night: <strong>{hours}h</strong>
          </Typography>
        </Box>

        {/* Quick Log Presets */}
        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', mb: 1 }}>
            Log Last Night&apos;s Sleep Hours
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[5, 6, 7, 8, 9].map((h) => (
              <Button
                key={h}
                variant={hours === h ? 'contained' : 'outlined'}
                onClick={() => handleLog(h)}
                fullWidth
                size="small"
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: hours === h ? '#6366f1' : 'transparent',
                  '&:hover': { bgcolor: hours === h ? '#4f46e5' : 'rgba(99,102,241,0.08)' },
                }}
              >
                {h}h
              </Button>
            ))}
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

      {/* Schedule Sleep Routine Modal */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Schedule Sleep Routine</DialogTitle>
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
          <Button onClick={() => setSchedModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingSched || !schedTitle.trim()}
            onClick={handleScheduleRoutine}
            sx={{ textTransform: 'none', bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' } }}
          >
            Save Routine
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
