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
  Paper,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Add as AddIcon,
  Schedule as TimeIcon,
  LocalFireDepartment as StreakIcon,
  Checklist as ChecklistIcon,
  DeleteOutline as DeleteIcon,
  DoneAll as DoneAllIcon,
  ErrorOutline as WarningIcon,
} from '@mui/icons-material';
import { Goal } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

export interface RoutineItem {
  id: string;
  name: string;
  time: string; // e.g. "4:30 AM" or "6:00 AM - 6:30 AM"
  checked: boolean;
}

export interface RoutineDailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  checkedCount: number;
  totalItems: number;
  fullStreak: boolean;
}

interface DailyRoutineTemplateProps {
  goal: Goal;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => Promise<void>;
}

export default function DailyRoutineTemplate({ goal, onUpdateGoal }: DailyRoutineTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Questionnaire Answers
  const answers = goal.questionnaireAnswers || {};
  const routineTitle = goal.title || String(answers.routine_type || answers.custom_routine_type || 'Daily Routine');

  // Routine Items State (NO DUMMY DATA — starts clean)
  const [items, setItems] = useState<RoutineItem[]>(() => {
    if (Array.isArray(goal.routineItems) && goal.routineItems.length > 0) {
      return (goal.routineItems as Array<{ id?: string; title?: string; name?: string; time?: string; checked?: boolean; completed?: boolean }>).map((r, i) => ({
        id: r.id || String(i + 1),
        name: r.name || r.title || `Routine Step ${i + 1}`,
        time: r.time || 'Flexible',
        checked: !!(r.checked || r.completed),
      }));
    }
    return [];
  });

  // Daily Routine Logs History
  const [logs, setLogs] = useState<RoutineDailyLog[]>(() => {
    const raw = (goal as unknown as Record<string, unknown>).routineLogs;
    if (Array.isArray(raw)) {
      return raw as RoutineDailyLog[];
    }
    return [];
  });

  // Check if user already logged routine for today
  const todayLog = useMemo(() => {
    return logs.find((l) => l.date === todayStr);
  }, [logs, todayStr]);

  const isTodayLogged = !!todayLog;

  // Modals & Forms
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [savingLog, setSavingLog] = useState(false);

  // Computations
  const checkedCount = useMemo(() => items.filter((i) => i.checked).length, [items]);
  const totalItems = items.length;

  // Streak Count
  const currentStreak = useMemo(() => {
    let streak = 0;
    const sorted = [...logs].sort((a, b) => (b.date > a.date ? 1 : -1));
    for (const log of sorted) {
      if (log.fullStreak) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [logs]);

  // Total 100% full streak days achieved
  const totalFullStreakDays = useMemo(() => logs.filter((l) => l.fullStreak).length, [logs]);

  // Persist Goal Updates
  const persistRoutineData = async (updatedItems: RoutineItem[], updatedLogs: RoutineDailyLog[]) => {
    if (!goal.id) return;
    const fullStreakDays = updatedLogs.filter((l) => l.fullStreak).length;
    const targetDays = typeof goal.overallTargetValue === 'number' && goal.overallTargetValue > 0 ? goal.overallTargetValue : 30;
    const computedProgress = Math.min(100, Math.round((fullStreakDays / targetDays) * 100));

    const updates: Partial<Goal> = {
      routineItems: updatedItems.map((item) => ({
        id: item.id,
        title: item.name,
        time: item.time,
        completed: item.checked,
      })),
      routineLogs: updatedLogs,
      currentValue: fullStreakDays,
      progress: computedProgress,
      updatedAt: new Date(),
    } as unknown as Partial<Goal>;

    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, updates);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), updates);
    }
  };

  // Toggle single item checkbox
  const toggleItemCheckbox = async (id: string) => {
    if (isTodayLogged) return; // Locked after today's log is submitted
    const updated = items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item));
    setItems(updated);
    await persistRoutineData(updated, logs);
  };

  // Add Routine Item
  const handleAddRoutineItem = async () => {
    if (!routineName.trim() || !goal.id) return;
    setSavingItem(true);
    try {
      let formattedTime = startTime.trim();
      if (startTime.trim() && endTime.trim()) {
        formattedTime = `${startTime.trim()} - ${endTime.trim()}`;
      } else if (!formattedTime) {
        formattedTime = 'Anytime';
      }

      const newItem: RoutineItem = {
        id: String(Date.now()),
        name: routineName.trim(),
        time: formattedTime,
        checked: false,
      };

      const updatedItems = [...items, newItem];
      setItems(updatedItems);
      await persistRoutineData(updatedItems, logs);

      setAddItemOpen(false);
      setRoutineName('');
      setStartTime('');
      setEndTime('');
    } catch (err) {
      console.error('Failed to add routine item:', err);
    } finally {
      setSavingItem(false);
    }
  };

  // Delete Routine Item
  const handleDeleteItem = async (id: string) => {
    const updatedItems = items.filter((i) => i.id !== id);
    setItems(updatedItems);
    await persistRoutineData(updatedItems, logs);
  };

  // Log Daily Routine Progress
  const handleLogDailyRoutine = async () => {
    if (!goal.id || isTodayLogged) return;
    setSavingLog(true);
    try {
      const isFull = checkedCount === totalItems && totalItems > 0;
      const newLog: RoutineDailyLog = {
        id: String(Date.now()),
        date: todayStr,
        checkedCount,
        totalItems,
        fullStreak: isFull,
      };

      const updatedLogs = [newLog, ...logs.filter((l) => l.date !== todayStr)];
      setLogs(updatedLogs);
      await persistRoutineData(items, updatedLogs);
    } catch (err) {
      console.error('Failed to record daily routine log:', err);
    } finally {
      setSavingLog(false);
    }
  };

  // UI Theme Token Colors
  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const activeColor = '#8B5CF6';

  return (
    <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', p: { xs: 1, sm: 2 } }}>
      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '24px',
          border: `1.5px solid ${activeColor}40`,
          bgcolor: isDark ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.04)',
          p: { xs: 2.5, sm: 3 },
          mb: 3,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
              <Chip
                label="Daily Routine"
                size="small"
                sx={{
                  bgcolor: `${activeColor}20`,
                  color: activeColor,
                  fontWeight: 800,
                  fontSize: 11,
                  textTransform: 'uppercase',
                }}
              />
              {currentStreak > 0 && (
                <Chip
                  icon={<StreakIcon sx={{ color: '#f59e0b !important', fontSize: '16px !important' }} />}
                  label={`${currentStreak} Day Streak 🔥`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    fontWeight: 800,
                    fontSize: 11,
                  }}
                />
              )}
            </Stack>
            <Typography variant="h5" sx={{ fontWeight: 900, color: textPrimary, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
              {routineTitle}
            </Typography>
            <Typography sx={{ fontSize: 13, color: textMuted, mt: 0.5 }}>
              Track &amp; complete your daily routine items to maintain a 100% daily streak!
            </Typography>
          </Box>

          <Button
            variant="contained"
            onClick={() => setAddItemOpen(true)}
            startIcon={<AddIcon />}
            sx={{
              borderRadius: '16px',
              bgcolor: activeColor,
              color: '#fff',
              fontWeight: 800,
              px: 2.5,
              py: 1,
              textTransform: 'none',
              boxShadow: `0 4px 14px ${activeColor}40`,
              '&:hover': { bgcolor: '#7c3aed' },
              flexShrink: 0,
            }}
          >
            + Add Routine Step
          </Button>
        </Stack>
      </Paper>

      {/* SOLO CARD CONTAINING ALL ROUTINE ITEMS WITH CHECKBOXES */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '24px',
          border: `1.5px solid ${cardBorder}`,
          bgcolor: surfaceBg,
          p: { xs: 2.5, sm: 3 },
          boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(15,23,42,0.05)',
          mb: 3,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ChecklistIcon sx={{ color: activeColor, fontSize: 24 }} />
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>
              Routine Checklist ({checkedCount} / {totalItems} Done Today)
            </Typography>
          </Stack>
          {totalItems > 0 && (
            <Chip
              label={`${Math.round((checkedCount / totalItems) * 100)}% Completed`}
              size="small"
              sx={{
                bgcolor: checkedCount === totalItems ? '#10b98120' : `${activeColor}15`,
                color: checkedCount === totalItems ? '#10b981' : activeColor,
                fontWeight: 800,
                fontSize: 11,
              }}
            />
          )}
        </Stack>

        {/* List of Routine Items */}
        {items.length > 0 ? (
          <Stack spacing={1.5} mb={3}>
            {items.map((item) => {
              const isDone = item.checked;
              return (
                <Paper
                  key={item.id}
                  elevation={0}
                  onClick={() => toggleItemCheckbox(item.id)}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    border: `1.5px solid ${isDone ? '#10b98150' : cardBorder}`,
                    bgcolor: isDone
                      ? isDark
                        ? 'rgba(16, 185, 129, 0.08)'
                        : 'rgba(16, 185, 129, 0.04)'
                      : isDark
                      ? '#0f172a'
                      : '#f8fafc',
                    cursor: isTodayLogged ? 'default' : 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    '&:hover': isTodayLogged
                      ? {}
                      : {
                          borderColor: isDone ? '#10b981' : activeColor,
                          transform: 'translateY(-2px)',
                        },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={2} sx={{ minWidth: 0, flex: 1 }}>
                    <IconButton
                      size="small"
                      disabled={isTodayLogged}
                      sx={{ p: 0, color: isDone ? '#10b981' : textMuted }}
                    >
                      {isDone ? <CheckCircle sx={{ fontSize: 24 }} /> : <RadioButtonUnchecked sx={{ fontSize: 24 }} />}
                    </IconButton>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        sx={{
                          fontSize: 14.5,
                          fontWeight: 700,
                          color: isDone ? textMuted : textPrimary,
                          textDecoration: isDone ? 'line-through' : 'none',
                        }}
                      >
                        {item.name}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Chip
                      icon={<TimeIcon sx={{ fontSize: '14px !important', color: `${textMuted} !important` }} />}
                      label={item.time}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: 11,
                        bgcolor: isDark ? '#334155' : '#e2e8f0',
                        color: textMuted,
                      }}
                    />
                    {!isTodayLogged && (
                      <Tooltip title="Delete Step">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id);
                          }}
                          sx={{ color: textMuted, '&:hover': { color: '#ef4444' } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: '16px',
              border: `2px dashed ${cardBorder}`,
              mb: 3,
            }}
          >
            <ChecklistIcon sx={{ fontSize: 40, color: textMuted, opacity: 0.5, mb: 1 }} />
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: textPrimary, mb: 0.5 }}>
              No routine steps added yet!
            </Typography>
            <Typography sx={{ fontSize: 12, color: textMuted, mb: 2 }}>
              Add items like &quot;Wake Up - 4:30 AM&quot;, &quot;Fajr - 5:00 AM&quot;, or &quot;Morning Exercise - 5:30 AM&quot;.
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setAddItemOpen(true)}
              startIcon={<AddIcon />}
              sx={{
                borderRadius: '12px',
                borderColor: activeColor,
                color: activeColor,
                fontWeight: 800,
                textTransform: 'none',
              }}
            >
              + Create First Step
            </Button>
          </Box>
        )}

        {/* LOG DAILY ROUTINE PROGRESS BUTTON */}
        <Box sx={{ pt: 1 }}>
          {isTodayLogged ? (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: todayLog?.fullStreak ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: `1.5px solid ${todayLog?.fullStreak ? '#10b981' : '#f59e0b'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
              }}
            >
              {todayLog?.fullStreak ? (
                <DoneAllIcon sx={{ color: '#10b981', fontSize: 24 }} />
              ) : (
                <WarningIcon sx={{ color: '#f59e0b', fontSize: 24 }} />
              )}
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: todayLog?.fullStreak ? '#10b981' : '#f59e0b' }}>
                {todayLog?.fullStreak
                  ? `Today's routine recorded (${todayLog.checkedCount}/${todayLog.totalItems} done - 100% Daily Streak Achieved! 🔥)`
                  : `Today's routine recorded (${todayLog?.checkedCount}/${todayLog?.totalItems} done - Missed 100% streak for today)`}
              </Typography>
            </Paper>
          ) : (
            <Button
              fullWidth
              variant="contained"
              disabled={savingLog || items.length === 0}
              onClick={handleLogDailyRoutine}
              startIcon={<DoneAllIcon />}
              sx={{
                py: 1.5,
                borderRadius: '16px',
                fontWeight: 900,
                fontSize: 14.5,
                textTransform: 'none',
                bgcolor: checkedCount === totalItems && totalItems > 0 ? '#10b981' : activeColor,
                color: '#fff',
                boxShadow: checkedCount === totalItems && totalItems > 0 ? '0 4px 14px rgba(16, 185, 129, 0.4)' : `0 4px 14px ${activeColor}40`,
                '&:hover': {
                  bgcolor: checkedCount === totalItems && totalItems > 0 ? '#059669' : '#7c3aed',
                },
              }}
            >
              Have U followed all routine for today? ({checkedCount}/{totalItems} Done)
            </Button>
          )}
        </Box>
      </Paper>

      {/* RECENT ROUTINE LOGS HISTORY */}
      {logs.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            borderRadius: '24px',
            border: `1.5px solid ${cardBorder}`,
            bgcolor: surfaceBg,
            p: { xs: 2.5, sm: 3 },
          }}
        >
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary, mb: 2 }}>
            Daily Routine History ({totalFullStreakDays} Streak Days Recorded)
          </Typography>
          <Stack spacing={1}>
            {logs.map((log) => (
              <Box
                key={log.id}
                sx={{
                  p: 1.75,
                  borderRadius: '14px',
                  bgcolor: isDark ? '#0f172a' : '#f8fafc',
                  border: `1px solid ${cardBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  {log.fullStreak ? (
                    <StreakIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
                  ) : (
                    <CheckCircle sx={{ color: textMuted, fontSize: 20 }} />
                  )}
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                    {log.date}
                  </Typography>
                </Stack>
                <Chip
                  label={log.fullStreak ? `100% Done (${log.checkedCount}/${log.totalItems})` : `Partial (${log.checkedCount}/${log.totalItems})`}
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: 11,
                    bgcolor: log.fullStreak ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: log.fullStreak ? '#10b981' : '#f59e0b',
                  }}
                />
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {/* DIALOG: ADD ROUTINE ITEM */}
      <Dialog open={addItemOpen} onClose={() => setAddItemOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 18 }}>Add Routine Step</DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, mb: 0.5, textTransform: 'uppercase' }}>
                Routine Step Name *
              </Typography>
              <TextField
                fullWidth
                placeholder="e.g. Wake Up, Fajr, Morning Exercise, Learning"
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
            </Box>

            <Stack direction="row" spacing={1.5}>
              <Box flex={1}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, mb: 0.5, textTransform: 'uppercase' }}>
                  Start Time
                </Typography>
                <TextField
                  fullWidth
                  placeholder="e.g. 4:30 AM"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Box>
              <Box flex={1}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: textMuted, mb: 0.5, textTransform: 'uppercase' }}>
                  End Time (Optional)
                </Typography>
                <TextField
                  fullWidth
                  placeholder="e.g. 5:00 AM"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddItemOpen(false)} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingItem || !routineName.trim()}
            onClick={handleAddRoutineItem}
            sx={{
              borderRadius: '12px',
              bgcolor: activeColor,
              fontWeight: 800,
              textTransform: 'none',
              px: 3,
              '&:hover': { bgcolor: '#7c3aed' },
            }}
          >
            Add Step
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
