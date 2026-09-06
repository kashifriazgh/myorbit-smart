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
  Shield as ShieldIcon,
  CheckCircle,
  WarningAmber as WarningIcon,
  Event as EventIcon,
  Checklist as TodoIcon,
  LocalAtm as SavingsIcon,
  SelfImprovement as CopingIcon,
  EmojiEvents as BadgeIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface RelapseLog {
  id?: string;
  date: string;
  trigger?: string;
  note?: string;
}

interface QuitHabitTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function QuitHabitTemplate({ goal, onUpdateGoal }: QuitHabitTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const answers = goal.questionnaireAnswers || {};

  const quitHabitName = goal.title || String(answers.quit_habit || answers.habit_to_quit || 'Quit Smoking / Junk Food');
  const targetDaysClean = Number(goal.overallTargetValue || answers.target_clean_days || 90);

  const [startDateStr, setStartDateStr] = useState<string>(
    () => goal.quitStartDate || String(answers.quit_start_date || new Date(Date.now() - 86400000 * 14).toISOString().split('T')[0])
  );

  const dailyCost = Number(answers.daily_cost || answers.money_saved_per_day || 300); // PKR/currency
  const costUnit = String(answers.currency || goal.overallTargetUnit || 'PKR');

  // Relapse Logs State
  const [relapses, setRelapses] = useState<RelapseLog[]>(() => {
    if (Array.isArray(goal.relapseLogs) && goal.relapseLogs.length > 0) {
      return goal.relapseLogs.map((r, i) => ({
        id: r.id || String(i),
        date: r.date,
        trigger: r.trigger,
        note: r.note,
      }));
    }
    return [
      { id: '1', date: new Date(Date.now() - 86400000 * 15).toISOString().split('T')[0], trigger: 'Stress after work', note: 'Resetted quit counter' },
    ];
  });

  // Coping Strategies Checklist State
  const [copingStrategies, setCopingStrategies] = useState([
    { id: '1', text: 'Drink a cold glass of water', done: false },
    { id: '2', text: 'Take 10 deep diaphragmatic breaths', done: false },
    { id: '3', text: 'Go for a 5-minute walk outside', done: false },
    { id: '4', text: 'Call or text a supportive friend', done: false },
  ]);

  // Compute Days Clean & Savings
  const { daysClean, totalSavedMoney, progressPct } = useMemo(() => {
    const start = new Date(startDateStr);
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - start.getTime());
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const saved = days * dailyCost;
    const pct = Math.min(100, Math.round((days / targetDaysClean) * 100));
    return { daysClean: days, totalSavedMoney: saved, progressPct: pct };
  }, [startDateStr, dailyCost, targetDaysClean]);

  // Modal States
  const [relapseModalOpen, setRelapseModalOpen] = useState(false);
  const [relapseTrigger, setRelapseTrigger] = useState('');
  const [relapseNote, setRelapseNote] = useState('');
  const [resetCounter] = useState(true);
  const [savingRelapse, setSavingRelapse] = useState(false);

  // Schedule Routine Modal State
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('21:00');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSched, setSavingSched] = useState(false);

  // Persist Goal Helpers
  const persistQuitData = async (updates: Partial<Goal>) => {
    if (!goal.id) return;
    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, updates);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), updates);
    }
  };

  // Toggle Coping Strategy
  const toggleCoping = (id: string) => {
    setCopingStrategies((prev) => prev.map((c) => (c.id === id ? { ...c, done: !c.done } : c)));
  };

  // Log Relapse / Urge Event
  const handleSaveRelapse = async () => {
    if (!goal.id) return;
    setSavingRelapse(true);
    try {
      const todayIso = new Date().toISOString().split('T')[0];
      const newLog: RelapseLog = {
        id: String(Date.now()),
        date: todayIso,
        trigger: relapseTrigger.trim() || 'Urge experienced',
        note: relapseNote.trim() || undefined,
      };

      const updatedRelapses = [newLog, ...relapses];
      setRelapses(updatedRelapses);

      let updatedStartDate = startDateStr;
      if (resetCounter) {
        updatedStartDate = todayIso;
        setStartDateStr(todayIso);
      }

      await persistQuitData({
        relapseLogs: updatedRelapses,
        quitStartDate: updatedStartDate,
        currentValue: resetCounter ? 0 : daysClean,
      });

      setRelapseModalOpen(false);
      setRelapseTrigger('');
      setRelapseNote('');
    } catch (err) {
      console.error('Failed to log relapse:', err);
    } finally {
      setSavingRelapse(false);
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
          startTime: schedTime || '21:00',
          endTime: '21:30',
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
      console.error('Failed to add quit habit schedule:', err);
    } finally {
      setSavingSched(false);
    }
  };

  // Linked items
  const linkedQuitSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const linkedQuitTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
      {/* Quit Habit Hero Card */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '14px',
                bgcolor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Quit Habit Tracker
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: textPrimary, mt: 0.2 }}>
                {quitHabitName}
              </Typography>
              <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.2 }}>
                Clean since {formatDate(startDateStr)}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={`${progressPct}% Clean`}
            size="small"
            sx={{ bgcolor: isDark ? '#064e3b' : '#ecfdf5', color: '#10b981', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        {/* Big Days Clean Display */}
        <Box sx={{ mt: 3, p: 2.5, borderRadius: '20px', bgcolor: isDark ? '#064e3b' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: 36, fontWeight: 800, color: '#10b981', fontFamily: 'monospace', lineHeight: 1 }}>
              {daysClean} <span style={{ fontSize: 16, fontWeight: 600, color: textMuted }}>/ {targetDaysClean} Days Clean</span>
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: textMuted, mt: 0.5 }}>
              🛡️ Everyday without relapse builds strong mental freedom!
            </Typography>
          </Box>
          <BadgeIcon sx={{ color: '#10b981', fontSize: 44, opacity: 0.8 }} />
        </Box>

        {/* Benefits & Savings Snapshot */}
        {dailyCost > 0 && (
          <Box sx={{ mt: 2.5, p: 1.5, borderRadius: '16px', bgcolor: isDark ? '#451a03' : '#fff7ed', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <SavingsIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>
                Estimated Savings Gain
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                {totalSavedMoney.toLocaleString()} {costUnit} saved so far ({dailyCost} {costUnit}/day)
              </Typography>
            </Box>
          </Box>
        )}

        {/* Quick Action Button Row */}
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            onClick={() => setRelapseModalOpen(true)}
            startIcon={<WarningIcon sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontSize: 12, fontWeight: 700, bgcolor: '#f43f5e', '&:hover': { bgcolor: '#e11d48' } }}
          >
            Log Urge / Reset Counter
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSchedTitle(`Daily Clean Check-in: ${quitHabitName}`);
              setSchedModalOpen(true);
            }}
            startIcon={<EventIcon sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: '12px', textTransform: 'none', fontSize: 12, fontWeight: 700 }}
          >
            + Schedule Daily Check-in
          </Button>
        </Box>
      </Box>

      {/* Emergency Urge Coping Strategies */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 0.5 }}>
          <CopingIcon sx={{ color: '#10b981', fontSize: 20 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
            Emergency Urge Coping Steps (Instant Actions)
          </Typography>
        </Box>

        <Stack spacing={1.25}>
          {copingStrategies.map((c) => (
            <Box
              key={c.id}
              onClick={() => toggleCoping(c.id)}
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
              <IconButton size="small" sx={{ p: 0, color: c.done ? '#10b981' : textMuted }}>
                {c.done ? <CheckCircle sx={{ fontSize: 20 }} /> : <ShieldIcon sx={{ fontSize: 20 }} />}
              </IconButton>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: c.done ? textMuted : textPrimary, textDecoration: c.done ? 'line-through' : 'none' }}>
                {c.text}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Relapse / Urge History */}
      {relapses.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', mb: 1.5, px: 0.5 }}>
            Urge & Relapse Log History ({relapses.length})
          </Typography>
          <Stack spacing={1.25}>
            {relapses.map((r) => (
              <Box
                key={r.id}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: surfaceBg,
                  border: `1px solid ${cardBorder}`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#f43f5e' }}>
                    Trigger: {r.trigger}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    {formatDate(r.date)}
                  </Typography>
                </Box>
                {r.note && (
                  <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.5 }}>
                    Note: {r.note}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Synced Schedules & Tasks */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Synced Clean Reminders ({linkedQuitSchedules.length + linkedQuitTodos.length})
          </Typography>
        </Box>

        <Stack spacing={1.25}>
          {linkedQuitSchedules.map((s) => (
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
                <EventIcon sx={{ color: '#10b981', fontSize: 20 }} />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    Time: {s.startTime || '21:00'} · Daily Check-in
                  </Typography>
                </Box>
              </Box>
              <Chip label="Scheduled" size="small" sx={{ bgcolor: isDark ? '#064e3b' : '#ecfdf5', color: '#10b981', fontSize: 10, fontWeight: 700 }} />
            </Box>
          ))}

          {linkedQuitTodos.map((todo) => {
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
                  {isDone ? <CheckCircle sx={{ fontSize: 20 }} /> : <ShieldIcon sx={{ fontSize: 20 }} />}
                </IconButton>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: isDone ? textMuted : textPrimary, textDecoration: isDone ? 'line-through' : 'none' }}>
                  {todo.title}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Dialog: Log Relapse or Urge */}
      <Dialog open={relapseModalOpen} onClose={() => setRelapseModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Log Urge or Relapse</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Trigger / Cue (What caused the urge?)"
              placeholder="e.g. Stress after work, Social party, Boredom"
              fullWidth
              size="small"
              value={relapseTrigger}
              onChange={(e) => setRelapseTrigger(e.target.value)}
            />
            <TextField
              label="Reflection Note / Learning"
              placeholder="e.g. Next time I will go for a walk immediately"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={relapseNote}
              onChange={(e) => setRelapseNote(e.target.value)}
            />
            <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: isDark ? '#451a03' : '#fff7ed', display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon sx={{ color: '#f43f5e', fontSize: 20 }} />
              <Typography sx={{ fontSize: 12, color: textPrimary }}>
                Did you relapse? Counter will reset to 0 Days Clean.
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRelapseModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingRelapse}
            onClick={handleSaveRelapse}
            sx={{ textTransform: 'none', bgcolor: '#f43f5e', '&:hover': { bgcolor: '#e11d48' } }}
          >
            Log & Reset Counter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Schedule Routine or Task */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Schedule Clean Check-in</DialogTitle>
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
                Schedule Check-in
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
              placeholder="e.g. Daily Evening Reflection & Clean Check-in"
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
            sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            Save Reminder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
