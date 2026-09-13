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
  MenuBook as BookIcon,
  AccessTime as ClockIcon,
  CheckCircle,
  RadioButtonUnchecked,
  Add as AddIcon,
  Event as EventIcon,
  Checklist as TodoIcon,
  Flag as CheckpointIcon,
  Bookmark as BookmarkIcon,
  LockClock as LockClockIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface ReadingLog {
  id: string;
  date: string;
  pagesRead: number;
  chapterNote?: string;
}

export interface ReadingCheckpoint {
  id: string;
  label: string;
  done: boolean;
}

interface ReadingTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReadingTemplate({ goal, onUpdateGoal }: ReadingTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo } = useTodoContext();
  const { allSchedules, addSchedule } = useSchedules();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const answers = goal.questionnaireAnswers || {};

  const materialType = String(answers.material_type || answers.format || 'Book');
  const bookTitle = goal.title || String(answers.material_name || answers.reading_title || answers.book_title || 'Reading Item');
  const author = String(answers.author || answers.writer || '');

  // Progress Unit & Target extraction
  const trackByUnit = useMemo(() => {
    const rawTrack = String(answers.track_by || goal.overallTargetUnit || goal.unit || 'pages').toLowerCase();
    return rawTrack.includes('chapter') ? 'chapters' : 'pages';
  }, [answers.track_by, goal.overallTargetUnit, goal.unit]);

  const targetPages = Number(
    goal.overallTargetValue ||
    answers.total_pages ||
    answers.total_chapters ||
    answers.target_pages ||
    0
  );

  // Daily target pages/chapters user wants to read per session
  const dailyTargetNum = Number(
    answers.daily_target_qty ||
    answers.daily_pages ||
    answers.daily_chapters ||
    answers.daily_reading_target ||
    0
  );
  const dailyTargetText = dailyTargetNum > 0 ? String(dailyTargetNum) : 'some';

  const dailyReadingTime = String(answers.preferred_time || answers.reading_time || 'Flexible');

  const [currentPages, setCurrentPages] = useState<number>(goal.currentValue || 0);

  // Reset dummy data: strict fallback to goal.readingLogs || []
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>(() => {
    if (Array.isArray(goal.readingLogs) && goal.readingLogs.length > 0) {
      return goal.readingLogs.map((l, i) => ({
        id: l.id || String(i),
        date: l.date,
        pagesRead: l.pagesRead,
        chapterNote: l.chapterNote,
      }));
    }
    return [];
  });

  // Reset dummy data: strict fallback to goal.learningCheckpoints || []
  const [checkpoints, setCheckpoints] = useState<ReadingCheckpoint[]>(() => {
    if (Array.isArray(goal.learningCheckpoints) && goal.learningCheckpoints.length > 0) {
      return goal.learningCheckpoints.map((c, i) => ({
        id: c.id || String(i),
        label: c.label,
        done: !!c.done,
      }));
    }
    return [];
  });

  // Check if today's reading progress has already been logged
  const todayLog = useMemo(() => readingLogs.find((l) => l.date === todayStr), [readingLogs, todayStr]);
  const hasLoggedToday = Boolean(todayLog);

  // Modal States
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [pagesInput, setPagesInput] = useState<number | ''>('');
  const [noteInput, setNoteInput] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  const [addCpOpen, setAddCpOpen] = useState(false);
  const [cpLabelInput, setCpLabelInput] = useState('');
  const [savingCp, setSavingCp] = useState(false);

  // Schedule Routine Modal
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedKind, setSchedKind] = useState<'schedule' | 'todo'>('schedule');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedTime, setSchedTime] = useState('21:30');
  const [schedDate, setSchedDate] = useState(todayStr);
  const [savingSched, setSavingSched] = useState(false);

  // -------------------------------------------------------------
  // Progress Calculation Rule:
  // - If targetPages > 0: progress % = (currentPages / targetPages) * 100
  // - If NO targetPages (0/blank): accumulate progress by 3% for pages or 8.66% for chapters on every day log!
  // -------------------------------------------------------------
  const progressPercent = useMemo(() => {
    if (targetPages > 0) {
      return Math.max(0, Math.min(100, Math.round((currentPages / targetPages) * 100)));
    }
    // No target set -> return stored goal progress
    return Math.max(0, Math.min(100, Math.round(goal.progress || 0)));
  }, [currentPages, targetPages, goal.progress]);

  const checkpointsDoneCnt = useMemo(() => checkpoints.filter((c) => c.done).length, [checkpoints]);

  // Persist Goal Helpers
  const persistReadingData = async (updates: Partial<Goal>) => {
    if (!goal.id) return;
    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, updates);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), updates);
    }
  };

  // Quick Log Reading Progress
  const handleSaveLog = async (addPagesVal?: number) => {
    const val = typeof addPagesVal === 'number' ? addPagesVal : typeof pagesInput === 'number' ? pagesInput : (dailyTargetNum > 0 ? dailyTargetNum : 1);
    if (val <= 0 || !goal.id || hasLoggedToday) return;
    setSavingLog(true);
    try {
      const newTotal = currentPages + val;
      setCurrentPages(newTotal);

      const newLog: ReadingLog = {
        id: String(Date.now()),
        date: todayStr,
        pagesRead: val,
        chapterNote: noteInput.trim() || undefined,
      };
      const updatedLogs = [newLog, ...readingLogs.filter((l) => l.date !== todayStr)];
      setReadingLogs(updatedLogs);

      const updates: Partial<Goal> = {
        currentValue: newTotal,
        readingLogs: updatedLogs,
      };

      // Progress accumulation if no total target pages/chapters were provided
      if (!targetPages || targetPages <= 0) {
        const incrementPct = trackByUnit === 'chapters' ? 8.66 : 3.0;
        const newProgress = Math.min(100, Math.round(((goal.progress || 0) + incrementPct) * 100) / 100);
        updates.progress = newProgress;
      } else {
        updates.progress = Math.min(100, Math.round((newTotal / targetPages) * 100));
      }

      await persistReadingData(updates);
      setLogModalOpen(false);
      setPagesInput('');
      setNoteInput('');
    } catch (err) {
      console.error('Failed to log reading:', err);
    } finally {
      setSavingLog(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Are you sure you want to delete this reading log entry?')) return;
    const updated = readingLogs.filter((l) => l.id !== logId);
    setReadingLogs(updated);
    await persistReadingData({ readingLogs: updated });
  };

  // Toggle Checkpoint
  const toggleCheckpoint = async (id: string) => {
    const updated = checkpoints.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    setCheckpoints(updated);
    await persistReadingData({ learningCheckpoints: updated });
  };

  // Add Checkpoint
  const handleAddCheckpoint = async () => {
    if (!cpLabelInput.trim() || !goal.id) return;
    setSavingCp(true);
    try {
      const newCp: ReadingCheckpoint = {
        id: String(Date.now()),
        label: cpLabelInput.trim(),
        done: false,
      };
      const updated = [...checkpoints, newCp];
      setCheckpoints(updated);
      await persistReadingData({ learningCheckpoints: updated });
      setAddCpOpen(false);
      setCpLabelInput('');
    } catch (err) {
      console.error('Failed to add checkpoint:', err);
    } finally {
      setSavingCp(false);
    }
  };

  const handleDeleteCheckpoint = async (id: string) => {
    const updated = checkpoints.filter((c) => c.id !== id);
    setCheckpoints(updated);
    await persistReadingData({ learningCheckpoints: updated });
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
          startTime: schedTime || '21:30',
          endTime: '22:00',
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
      console.error('Failed to add reading schedule:', err);
    } finally {
      setSavingSched(false);
    }
  };

  // Linked items
  const linkedReadingSchedules = useMemo(() => {
    if (!goal.id) return [];
    return allSchedules.filter((s) => (s as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [allSchedules, goal.id]);

  const linkedReadingTodos = useMemo(() => {
    if (!goal.id) return [];
    return todos.filter((t) => (t as { linkedGoalId?: string }).linkedGoalId === goal.id);
  }, [todos, goal.id]);

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  return (
    <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
      {/* Book / Reading Hero Card */}
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
                bgcolor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Reading Tracker · {materialType}
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: textPrimary, mt: 0.2 }}>
                {bookTitle}
              </Typography>
              {author && (
                <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.2 }}>
                  by {author}
                </Typography>
              )}
            </Box>
          </Box>
          <Chip
            label={`${progressPercent}% Read`}
            size="small"
            sx={{ bgcolor: isDark ? '#1e3a8a' : '#dbeafe', color: '#3b82f6', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        {/* Reading Progress Gauge */}
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: textPrimary, fontFamily: 'monospace' }}>
              {currentPages.toLocaleString()}{' '}
              <span style={{ fontSize: 14, fontWeight: 600, color: textMuted }}>
                {targetPages > 0 ? `/ ${targetPages} ${trackByUnit}` : `${trackByUnit} read`}
              </span>
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>
              {targetPages > 0
                ? targetPages - currentPages > 0
                  ? `${targetPages - currentPages} ${trackByUnit} left`
                  : 'Completed!'
                : `+${trackByUnit === 'chapters' ? '8.66%' : '3%'} / log`}
            </Typography>
          </Box>

          <Box sx={{ height: 8, borderRadius: 99, bgcolor: isDark ? '#334155' : '#f1f5f9', overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${progressPercent}%`,
                bgcolor: '#3b82f6',
                borderRadius: 99,
                transition: 'width 0.5s ease',
              }}
            />
          </Box>
        </Box>

        {/* Preferred Routine Pill */}
        <Box sx={{ mt: 3, p: 1.5, borderRadius: '16px', bgcolor: isDark ? '#0c4a6e' : '#f0f9ff', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ClockIcon sx={{ color: '#0284c7', fontSize: 22 }} />
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
              Preferred Reading Time
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              {dailyReadingTime}
            </Typography>
          </Box>
        </Box>

        {/* ------------------------------------------------------------- */}
        {/* DAILY READING PROMPT & LOG CONTROL (REQ: Have U read [x] pages today?) */}
        {/* ------------------------------------------------------------- */}
        <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${cardBorder}` }}>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: textPrimary, mb: 1.5 }}>
            Have you read {dailyTargetText} {trackByUnit} today?
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Button
              variant="contained"
              size="small"
              disabled={hasLoggedToday}
              onClick={() => handleSaveLog(dailyTargetNum > 0 ? dailyTargetNum : 10)}
              startIcon={hasLoggedToday ? <LockClockIcon sx={{ fontSize: 16 }} /> : <AddIcon sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 800,
                fontSize: 12.5,
                bgcolor: '#3b82f6',
                '&:hover': { bgcolor: '#2563eb' },
                '&.Mui-disabled': {
                  bgcolor: isDark ? '#334155' : '#cbd5e1',
                  color: textMuted,
                },
              }}
            >
              {hasLoggedToday ? 'Logged for Today' : `Yes, I read ${dailyTargetText} ${trackByUnit} today`}
            </Button>

            <Button
              variant="outlined"
              size="small"
              disabled={hasLoggedToday}
              onClick={() => setLogModalOpen(true)}
              sx={{
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 12,
                borderColor: cardBorder,
                color: textPrimary,
              }}
            >
              Custom Amount / Note
            </Button>
          </Box>

          {hasLoggedToday ? (
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#10b981', mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              ✅ Today&apos;s reading logged ({todayLog?.pagesRead} {trackByUnit}) · Disabled until tomorrow
            </Typography>
          ) : (
            <Typography sx={{ fontSize: 11.5, color: textMuted, mt: 1 }}>
              {targetPages <= 0
                ? `Log once per day to increase progress (+${trackByUnit === 'chapters' ? '8.66%' : '3%'}).`
                : 'Log once per day. Option disables after logging until tomorrow.'}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Reading Log History */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BookmarkIcon sx={{ color: '#3b82f6', fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              Reading History & Notes ({readingLogs.length})
            </Typography>
          </Box>
        </Box>

        <Stack spacing={1.25}>
          {readingLogs.map((log) => (
            <Box
              key={log.id}
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
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                  Read <strong style={{ color: '#3b82f6' }}>{log.pagesRead} {trackByUnit}</strong>
                </Typography>

                {log.chapterNote && (
                  <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.3 }}>
                    💡 {log.chapterNote}
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: 11, color: textMuted }}>
                  {formatDate(log.date)}
                </Typography>
                <IconButton size="small" onClick={() => handleDeleteLog(log.id)} sx={{ color: textMuted, '&:hover': { color: '#ef4444' } }}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Box>
          ))}

          {readingLogs.length === 0 && (
            <Typography sx={{ fontSize: 12, color: textMuted, fontStyle: 'italic', textAlign: 'center', py: 2 }}>
              No reading logs recorded yet. Use the prompt above to record your reading sessions!
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Reading Milestones / Checkpoints */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckpointIcon sx={{ color: '#eab308', fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              Reading Checkpoints ({checkpointsDoneCnt}/{checkpoints.length})
            </Typography>
          </Box>
          <Button
            size="small"
            onClick={() => setAddCpOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#eab308' }}
          >
            + Add Checkpoint
          </Button>
        </Box>

        <Stack spacing={1.25}>
          {checkpoints.map((cp) => (
            <Box
              key={cp.id}
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
              <Box
                onClick={() => toggleCheckpoint(cp.id)}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', flex: 1 }}
              >
                <IconButton size="small" sx={{ p: 0, color: cp.done ? '#10b981' : textMuted }}>
                  {cp.done ? <CheckCircle sx={{ fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ fontSize: 20 }} />}
                </IconButton>
                <Typography
                  sx={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: cp.done ? textMuted : textPrimary,
                    textDecoration: cp.done ? 'line-through' : 'none',
                  }}
                >
                  {cp.label}
                </Typography>
              </Box>

              <IconButton size="small" onClick={() => handleDeleteCheckpoint(cp.id)} sx={{ color: textMuted, '&:hover': { color: '#ef4444' } }}>
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))}

          {checkpoints.length === 0 && (
            <Typography sx={{ fontSize: 12, color: textMuted, fontStyle: 'italic', textAlign: 'center', py: 2 }}>
              No checkpoints added yet. Click &quot;+ Add Checkpoint&quot; to add custom reading milestones.
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Synced Reading Schedules & Tasks */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Synced Reading Reminders ({linkedReadingSchedules.length + linkedReadingTodos.length})
          </Typography>
          <Button
            size="small"
            onClick={() => {
              setSchedTitle(`Daily Reading: ${bookTitle}`);
              setSchedModalOpen(true);
            }}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#3b82f6' }}
          >
            + Schedule Reminder
          </Button>
        </Box>

        <Stack spacing={1.25}>
          {linkedReadingSchedules.map((s) => (
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
                <EventIcon sx={{ color: '#3b82f6', fontSize: 20 }} />
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: textMuted }}>
                    Time: {s.startTime || '21:30'} · Daily Reading
                  </Typography>
                </Box>
              </Box>
              <Chip label="Scheduled" size="small" sx={{ bgcolor: isDark ? '#1e3a8a' : '#dbeafe', color: '#3b82f6', fontSize: 10, fontWeight: 700 }} />
            </Box>
          ))}

          {linkedReadingTodos.map((todo) => {
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

      {/* Dialog: Log Reading Progress */}
      <Dialog open={logModalOpen} onClose={() => setLogModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Log Reading Progress</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={`${trackByUnit === 'chapters' ? 'Chapters' : 'Pages'} Read Today`}
              type="number"
              placeholder={dailyTargetNum > 0 ? `e.g. ${dailyTargetNum}` : 'e.g. 15'}
              fullWidth
              size="small"
              value={pagesInput}
              onChange={(e) => setPagesInput(e.target.value ? Number(e.target.value) : '')}
            />
            <TextField
              label="Chapter Note / Takeaway (Optional)"
              placeholder="e.g. Learned about habit cues and rewards"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLogModalOpen(false)} sx={{ textTransform: 'none', color: textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingLog || typeof pagesInput !== 'number' || pagesInput <= 0}
            onClick={() => handleSaveLog()}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
          >
            {savingLog ? 'Saving...' : 'Save Reading Log'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Add Checkpoint */}
      <Dialog open={addCpOpen} onClose={() => setAddCpOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Add Reading Checkpoint</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Checkpoint Description"
              placeholder="e.g. Finish Chapter 5 or Complete Part 1"
              fullWidth
              size="small"
              value={cpLabelInput}
              onChange={(e) => setCpLabelInput(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddCpOpen(false)} sx={{ textTransform: 'none', color: textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingCp || !cpLabelInput.trim()}
            onClick={handleAddCheckpoint}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#eab308', '&:hover': { bgcolor: '#ca8a04' } }}
          >
            {savingCp ? 'Saving...' : 'Add Checkpoint'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Schedule Reading Session / Task */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Schedule Reading Reminder</DialogTitle>
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
              label="Reminder Title"
              placeholder="e.g. 30-min Evening Reading"
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
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
          >
            {savingSched ? 'Saving...' : 'Save Reminder'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
