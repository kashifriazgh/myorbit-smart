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

  const answers = goal.questionnaireAnswers || {};

  const bookTitle = goal.title || String(answers.book_title || answers.reading_title || 'Atomic Habits');
  const author = String(answers.author || answers.writer || 'James Clear');
  const readingFormat = String(answers.format || answers.reading_format || 'Book');

  const unitStr = String(goal.overallTargetUnit || answers.unit || 'pages');
  const targetPages = Number(goal.overallTargetValue || answers.target_pages || answers.target_amount || 320);
  const [currentPages, setCurrentPages] = useState<number>(goal.currentValue || Number(answers.current_page || 140));

  const dailyReadingTime = String(answers.reading_time || answers.daily_time || '09:30 PM');

  // Reading Logs State
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>(() => {
    if (Array.isArray(goal.readingLogs) && goal.readingLogs.length > 0) {
      return goal.readingLogs.map((l, i) => ({
        id: l.id || String(i),
        date: l.date,
        pagesRead: l.pagesRead,
        chapterNote: l.chapterNote,
      }));
    }
    return [
      { id: '1', date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], pagesRead: 30, chapterNote: 'Read Chapter 1 & 2 on Habit Loops' },
      { id: '2', date: new Date(Date.now() - 86400000).toISOString().split('T')[0], pagesRead: 25, chapterNote: 'Identity-based Habits insights' },
    ];
  });

  // Checkpoints / Key Milestones State
  const [checkpoints, setCheckpoints] = useState<ReadingCheckpoint[]>(() => {
    if (Array.isArray(goal.learningCheckpoints) && goal.learningCheckpoints.length > 0) {
      return goal.learningCheckpoints.map((c, i) => ({
        id: c.id || String(i),
        label: c.label,
        done: !!c.done,
      }));
    }
    return [
      { id: '1', label: 'Finish Part 1: The Fundamentals', done: true },
      { id: '2', label: 'Finish Part 2: The 1st Law (Make It Obvious)', done: true },
      { id: '3', label: 'Finish Part 3: The 2nd Law (Make It Attractive)', done: false },
      { id: '4', label: 'Finish Book & write summary notes', done: false },
    ];
  });

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
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingSched, setSavingSched] = useState(false);

  const progressPercent = useMemo(() => {
    if (!targetPages || targetPages <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((currentPages / targetPages) * 100)));
  }, [currentPages, targetPages]);

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

  // Quick Log Reading
  const handleSaveLog = async (addPagesVal?: number) => {
    const val = typeof addPagesVal === 'number' ? addPagesVal : typeof pagesInput === 'number' ? pagesInput : 0;
    if (val <= 0 || !goal.id) return;
    setSavingLog(true);
    try {
      const newTotal = currentPages + val;
      setCurrentPages(newTotal);

      const newLog: ReadingLog = {
        id: String(Date.now()),
        date: new Date().toISOString().split('T')[0],
        pagesRead: val,
        chapterNote: noteInput.trim() || undefined,
      };
      const updatedLogs = [newLog, ...readingLogs];
      setReadingLogs(updatedLogs);

      await persistReadingData({ currentValue: newTotal, readingLogs: updatedLogs });
      setLogModalOpen(false);
      setPagesInput('');
      setNoteInput('');
    } catch (err) {
      console.error('Failed to log reading:', err);
    } finally {
      setSavingLog(false);
    }
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

  // Schedule Routine or Task
  const handleScheduleRoutine = async () => {
    if (!schedTitle.trim() || !user || !goal.id) return;
    setSavingSched(true);
    try {
      if (schedKind === 'schedule') {
        await addSchedule({
          title: schedTitle.trim(),
          date: schedDate || new Date().toISOString().split('T')[0],
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
                Reading Tracker · {readingFormat}
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
              {currentPages.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 600, color: textMuted }}>/ {targetPages} {unitStr}</span>
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>
              {targetPages - currentPages > 0 ? `${targetPages - currentPages} ${unitStr} left` : 'Completed!'}
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

        {/* Daily Routine Pill */}
        <Box sx={{ mt: 3, p: 1.5, borderRadius: '16px', bgcolor: isDark ? '#0c4a6e' : '#f0f9ff', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ClockIcon sx={{ color: '#0284c7', fontSize: 22 }} />
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
              Daily Reading Routine
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              {dailyReadingTime}
            </Typography>
          </Box>
        </Box>

        {/* Quick Log Presets */}
        <Box sx={{ mt: 2.5 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: textMuted, textTransform: 'uppercase', mb: 1 }}>
            Quick Log Reading Pages Today
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[10, 20, 30, 50].map((num) => (
              <Button
                key={num}
                variant="outlined"
                size="small"
                onClick={() => handleSaveLog(num)}
                fullWidth
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 700,
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                  color: textPrimary,
                  '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.08)', borderColor: '#3b82f6' },
                }}
              >
                +{num} pgs
              </Button>
            ))}
            <Button
              variant="contained"
              size="small"
              onClick={() => setLogModalOpen(true)}
              sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
            >
              Custom
            </Button>
          </Box>
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
          <Button
            size="small"
            onClick={() => setLogModalOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 15 }} />}
            sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: '#3b82f6' }}
          >
            + Log Reading
          </Button>
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
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                  Read <strong style={{ color: '#3b82f6' }}>{log.pagesRead} {unitStr}</strong>
                </Typography>
                <Typography sx={{ fontSize: 11, color: textMuted }}>
                  {formatDate(log.date)}
                </Typography>
              </Box>
              {log.chapterNote && (
                <Typography sx={{ fontSize: 12, color: textMuted, mt: 0.5 }}>
                  💡 {log.chapterNote}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Reading Milestones / Checkpoints */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckpointIcon sx={{ color: '#eab308', fontSize: 20 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
              Book Parts & Checkpoints ({checkpointsDoneCnt}/{checkpoints.length})
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
              onClick={() => toggleCheckpoint(cp.id)}
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
          ))}
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
                    Time: {s.startTime || '09:30 PM'} · Daily Reading
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
      <Dialog open={logModalOpen} onClose={() => setLogModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Log Reading Progress</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={`Pages / ${unitStr} Read Today`}
              type="number"
              placeholder="e.g. 25"
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
          <Button onClick={() => setLogModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingLog || typeof pagesInput !== 'number' || pagesInput <= 0}
            onClick={() => handleSaveLog()}
            sx={{ textTransform: 'none', bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
          >
            Save Reading Log
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Add Checkpoint */}
      <Dialog open={addCpOpen} onClose={() => setAddCpOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Add Reading Checkpoint</DialogTitle>
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
          <Button onClick={() => setAddCpOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingCp || !cpLabelInput.trim()}
            onClick={handleAddCheckpoint}
            sx={{ textTransform: 'none', bgcolor: '#eab308', '&:hover': { bgcolor: '#ca8a04' } }}
          >
            Add Checkpoint
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Schedule Reading Session / Task */}
      <Dialog open={schedModalOpen} onClose={() => setSchedModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Schedule Reading Reminder</DialogTitle>
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
          <Button onClick={() => setSchedModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingSched || !schedTitle.trim()}
            onClick={handleScheduleRoutine}
            sx={{ textTransform: 'none', bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
          >
            Save Reminder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
