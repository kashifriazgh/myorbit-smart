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
  LocalFireDepartment as FlameIcon,
  CheckCircle,
  RadioButtonUnchecked,
  Add as AddIcon,
  Event as EventIcon,
  Checklist as TodoIcon,
  Psychology as CueIcon,
  CardGiftcard as RewardIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface HabitCheckIn {
  id?: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  note?: string;
}

interface BuildHabitTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

export default function BuildHabitTemplate({ goal, onUpdateGoal }: BuildHabitTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};

  const habitTitle = goal.title || String(answers.habit_title || answers.habit_name || 'Daily Meditation & Journaling');
  const targetStreak = Number(goal.overallTargetValue || answers.target_streak || answers.target_days || 30);

  const cue = String(answers.cue || answers.trigger || goal.habitCue || 'After morning coffee');
  const reward = String(answers.reward || goal.habitReward || '10 mins of favorite podcast');
  const preferredTime = String(answers.habit_time || answers.routine_time || '07:30 AM');

  // Check-ins State
  const [checkIns, setCheckIns] = useState<HabitCheckIn[]>(() => {
    if (Array.isArray(goal.habitCheckIns) && goal.habitCheckIns.length > 0) {
      return goal.habitCheckIns.map((c, i) => ({
        id: c.id || String(i),
        date: c.date,
        completed: !!c.completed,
        note: c.note,
      }));
    }
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const day2 = new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0];
    const day3 = new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0];
    return [
      { id: '1', date: today, completed: true, note: 'Completed morning routine' },
      { id: '2', date: yesterday, completed: true },
      { id: '3', date: day2, completed: true },
      { id: '4', date: day3, completed: false, note: 'Travel day' },
    ];
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Computed Streak Stats
  const { currentStreak, longestStreak, todayDone, consistencyScore } = useMemo(() => {
    const todayCheck = checkIns.find((c) => c.date === todayStr);
    const todayCompleted = !!(todayCheck && todayCheck.completed);

    // Calculate current streak backward from today/yesterday
    let curr = 0;
    const sorted = [...checkIns].sort((a, b) => (b.date > a.date ? 1 : -1));
    for (const item of sorted) {
      if (item.completed) {
        curr++;
      } else {
        break;
      }
    }

    const doneCount = checkIns.filter((c) => c.completed).length;
    const score = checkIns.length > 0 ? Math.round((doneCount / checkIns.length) * 100) : 100;

    return {
      currentStreak: curr,
      longestStreak: Math.max(curr, Number(answers.longest_streak || 14)),
      todayDone: todayCompleted,
      consistencyScore: score,
    };
  }, [checkIns, todayStr, answers.longest_streak]);

  // Modal States
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logDate, setLogDate] = useState(todayStr);
  const [logNote, setLogNote] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  // Schedule Routine Modal
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('07:30');
  const [schedDate, setSchedDate] = useState(todayStr);
  const [savingSched, setSavingSched] = useState(false);

  // Persist Goal
  const persistHabitData = async (updatedCheckIns: HabitCheckIn[], streakVal: number) => {
    if (!goal.id) return;
    const updates: Partial<Goal> = {
      habitCheckIns: updatedCheckIns,
      currentValue: streakVal,
      progress: Math.min(100, Math.round((streakVal / targetStreak) * 100)),
    };
    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, updates);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), updates);
    }
  };

  // Toggle Today's Check-in
  const toggleTodayCheckIn = async () => {
    const existingIdx = checkIns.findIndex((c) => c.date === todayStr);
    let updated: HabitCheckIn[];
    if (existingIdx >= 0) {
      updated = checkIns.map((c, idx) =>
        idx === existingIdx ? { ...c, completed: !c.completed } : c
      );
    } else {
      updated = [{ id: String(Date.now()), date: todayStr, completed: true }, ...checkIns];
    }

    setCheckIns(updated);
    const newStreak = updated.filter((c) => c.completed).length;
    await persistHabitData(updated, newStreak);
  };

  // Custom Log Entry
  const handleSaveLog = async () => {
    if (!logDate || !goal.id) return;
    setSavingLog(true);
    try {
      const existingIdx = checkIns.findIndex((c) => c.date === logDate);
      let updated: HabitCheckIn[];
      if (existingIdx >= 0) {
        updated = checkIns.map((c, idx) =>
          idx === existingIdx ? { ...c, completed: true, note: logNote.trim() || c.note } : c
        );
      } else {
        updated = [{ id: String(Date.now()), date: logDate, completed: true, note: logNote.trim() }, ...checkIns];
      }

      setCheckIns(updated);
      const newStreak = updated.filter((c) => c.completed).length;
      await persistHabitData(updated, newStreak);

      setLogModalOpen(false);
      setLogNote('');
    } catch (err) {
      console.error('Failed to log habit:', err);
    } finally {
      setSavingLog(false);
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
          date: schedDate || todayStr,
          startTime: schedTime || '07:30',
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
      console.error('Failed to add habit schedule:', err);
    } finally {
      setSavingSched(false);
    }
  };

  // Linked items
  const linkedHabitSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const linkedHabitTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
      {/* Streak Hero Card */}
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
              Build Habit
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: textPrimary, mt: 0.5 }}>
              {habitTitle}
            </Typography>
          </Box>
          <Chip
            label={`${consistencyScore}% Consistency`}
            size="small"
            sx={{ bgcolor: isDark ? '#3b0764' : '#f3e8ff', color: '#a855f7', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        {/* Big Flame & Streak Display */}
        <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2.5, borderRadius: '20px', bgcolor: isDark ? '#451a03' : '#fff7ed' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '16px',
                bgcolor: '#f97316',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(249,115,22,0.35)',
              }}
            >
              <FlameIcon sx={{ fontSize: 32 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 30, fontWeight: 800, color: textPrimary, fontFamily: 'monospace', lineHeight: 1 }}>
                {currentStreak} <span style={{ fontSize: 16, fontWeight: 600, color: textMuted }}>/ {targetStreak} Days</span>
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#f97316', mt: 0.5 }}>
                Current Streak · Longest: {longestStreak} days
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            onClick={toggleTodayCheckIn}
            startIcon={todayDone ? <CheckCircle /> : <RadioButtonUnchecked />}
            sx={{
              borderRadius: '14px',
              textTransform: 'none',
              fontWeight: 800,
              px: 2.5,
              py: 1.2,
              bgcolor: todayDone ? '#10b981' : '#f97316',
              '&:hover': { bgcolor: todayDone ? '#059669' : '#ea580c' },
            }}
          >
            {todayDone ? 'Done Today ✓' : 'Mark Done Today'}
          </Button>
        </Box>

        {/* 7-Day Recent Heatmap */}
        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', mb: 1 }}>
            Recent 7-Day Check-in History
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date(Date.now() - (6 - i) * 86400000);
              const dateIso = d.toISOString().split('T')[0];
              const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
              const check = checkIns.find((c) => c.date === dateIso);
              const isComp = !!(check && check.completed);

              return (
                <Box
                  key={dateIso}
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 1,
                    borderRadius: '12px',
                    bgcolor: isComp ? '#10b981' : isDark ? '#334155' : '#f1f5f9',
                    color: isComp ? '#ffffff' : textMuted,
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: 10, fontWeight: 700 }}>
                    {dayName}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, mt: 0.2 }}>
                    {d.getDate()}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Quick Action Button Row */}
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setLogModalOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontSize: 12, fontWeight: 700 }}
          >
            + Log Custom Date Check-in
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSchedTitle(`Habit Reminder: ${habitTitle}`);
              setSchedModalOpen(true);
            }}
            startIcon={<EventIcon sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontSize: 12, fontWeight: 700 }}
          >
            + Schedule Reminder
          </Button>
        </Box>
      </Box>

      {/* Habit Loop: Cue & Reward Card */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', mb: 1.5, px: 0.5 }}>
          Atomic Habit Loop (Cue & Reward)
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box sx={{ p: 2, borderRadius: '18px', bgcolor: surfaceBg, border: `1px solid ${cardBorder}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <CueIcon sx={{ color: '#0284c7', fontSize: 20 }} />
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                Anchor Cue / Trigger
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
              {cue}
            </Typography>
            <Typography sx={{ fontSize: 11, color: textMuted, mt: 0.5 }}>
              Preferred Time: {preferredTime}
            </Typography>
          </Box>

          <Box sx={{ p: 2, borderRadius: '18px', bgcolor: surfaceBg, border: `1px solid ${cardBorder}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <RewardIcon sx={{ color: '#eab308', fontSize: 20 }} />
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#eab308', textTransform: 'uppercase' }}>
                Habit Reward
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
              {reward}
            </Typography>
            <Typography sx={{ fontSize: 11, color: textMuted, mt: 0.5 }}>
              Immediate positive reinforcement
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Synced Habit Schedules & Tasks */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Synced Habit Reminders ({linkedHabitSchedules.length + linkedHabitTodos.length})
          </Typography>
        </Box>

        <Stack spacing={1.25}>
          {linkedHabitSchedules.map((s) => (
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
                <EventIcon sx={{ color: '#f97316', fontSize: 20 }} />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    Time: {s.startTime || preferredTime} · Daily Habit
                  </Typography>
                </Box>
              </Box>
              <Chip label="Scheduled" size="small" sx={{ bgcolor: isDark ? '#451a03' : '#fff7ed', color: '#f97316', fontSize: 10, fontWeight: 700 }} />
            </Box>
          ))}

          {linkedHabitTodos.map((todo) => {
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

      {/* Dialog: Custom Check-in Log */}
      <Dialog open={logModalOpen} onClose={() => setLogModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Log Custom Habit Check-in</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
            />
            <TextField
              label="Reflection / Note (Optional)"
              placeholder="e.g. Completed 15 mins morning meditation"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLogModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingLog || !logDate}
            onClick={handleSaveLog}
            sx={{ textTransform: 'none', bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' } }}
          >
            Save Check-in
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Schedule Routine or Task */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Schedule Habit Routine</DialogTitle>
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
              label="Habit Reminder Title"
              placeholder="e.g. Daily Morning Meditation"
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
            sx={{ textTransform: 'none', bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' } }}
          >
            Save Reminder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
