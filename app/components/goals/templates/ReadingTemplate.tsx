'use client';

import React, { useMemo, useState, useEffect } from 'react';
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
  Modal,
  Fade,
  Collapse,
} from '@mui/material';
import {
  MenuBook as BookIcon,
  AccessTime as ClockIcon,
  CheckCircle,
  RadioButtonUnchecked,
  Add as AddIcon,
  Flag as CheckpointIcon,
  Bookmark as BookmarkIcon,
  LockClock as LockClockIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  WbSunny as SunIcon,
  WbSunny as SunriseIcon,
  WbTwilight as SunsetIcon,
  NightlightRound as MoonIcon,
  Check as CheckIcon,
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

export interface ReadingActionItem {
  id: string;
  task: string;
  done: boolean;
  sourceId?: string;
  sourceName?: string;
  assumedContributionValue?: number;
  kind?: 'schedule' | 'todo';
  dueDate?: string;
  time?: string;
  assignee?: string;
  scheduleId?: string;
  todoId?: string;
}

export interface ReadingPreferences {
  timeSlot: string;
  timeSlotLabel: string;
  duration: number;
  durationLabel: string;
  pages: number;
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

// Preference Card Config Constants
const TIME_SLOTS = [
  { id: 'morning', label: 'Morning', sub: '6–11 AM', icon: SunriseIcon },
  { id: 'afternoon', label: 'Afternoon', sub: '12–4 PM', icon: SunIcon },
  { id: 'evening', label: 'Evening', sub: '5–8 PM', icon: SunsetIcon },
  { id: 'night', label: 'Night', sub: '9PM–12AM', icon: MoonIcon },
];

const DURATIONS = [
  { label: '15m', value: 15, note: '~10 pg', pages: 10 },
  { label: '30m', value: 30, note: '~20 pg', pages: 20 },
  { label: '45m', value: 45, note: '~30 pg', pages: 30 },
  { label: '1h', value: 60, note: '~40 pg', pages: 40 },
  { label: '1.5h', value: 90, note: '~60 pg', pages: 60 },
  { label: '2h', value: 120, note: '~80 pg', pages: 80 },
];

const TYPE_EMOJIS: Record<string, string> = {
  Book: '📘',
  Article: '📰',
  Novel: '📖',
  'Research Paper': '📄',
};

export default function ReadingTemplate({ goal, onUpdateGoal }: ReadingTemplateProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user } = useAuth();
  const { todos, addTodo, updateTodo, deleteTodo } = useTodoContext();
  const { allSchedules, addSchedule, editSchedule, removeSchedule } = useSchedules();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const answers = goal.questionnaireAnswers || {};

  const materialType = String(answers.material_type || answers.format || 'Book');
  const bookTitle = goal.title || String(answers.material_name || answers.reading_title || answers.book_title || 'Reading Item');
  const author = String(answers.author || answers.writer || '');

  // Track by unit ('pages' | 'chapters')
  const trackByUnit = useMemo(() => {
    const rawTrack = String(answers.track_by || goal.overallTargetUnit || goal.unit || 'pages').toLowerCase();
    return rawTrack.includes('chapter') ? 'chapters' : 'pages';
  }, [answers.track_by, goal.overallTargetUnit, goal.unit]);

  // Overall total pages or chapters of book
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
    (trackByUnit === 'chapters' ? 1 : 10)
  );
  const dailyTargetText = dailyTargetNum > 0 ? String(dailyTargetNum) : 'some';

  const dailyReadingTime = String(answers.preferred_time || answers.reading_time || 'Flexible');

  const [currentPages, setCurrentPages] = useState<number>(goal.currentValue || 0);

  // Reading Logs History
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

  // Reading Checkpoints
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

  // Strategic Action Tasks State
  const [actions, setActions] = useState<ReadingActionItem[]>(() => {
    if (Array.isArray(goal.actions) && goal.actions.length > 0) {
      return goal.actions as unknown as ReadingActionItem[];
    }
    return [];
  });
  const [newGeneralStepInput, setNewGeneralStepInput] = useState('');

  // Synchronize strategy tasks status in real time with allSchedules and todos
  useEffect(() => {
    const rawGoalActions = Array.isArray(goal.actions) ? (goal.actions as unknown as ReadingActionItem[]) : [];
    const baseActions = rawGoalActions.length > 0 ? rawGoalActions : actions;

    let hasMismatch = false;
    const synced = baseActions.map((act) => {
      let isDone = act.done;
      if (act.scheduleId) {
        const foundSched = allSchedules.find((s) => s.id === act.scheduleId);
        if (foundSched) {
          const schedDone = foundSched.status === 'completed';
          if (schedDone !== isDone) {
            isDone = schedDone;
            hasMismatch = true;
          }
        }
      } else if (act.todoId) {
        const foundTodo = todos.find((t) => t.id === act.todoId);
        if (foundTodo) {
          const todoDone = foundTodo.status === 'completed';
          if (todoDone !== isDone) {
            isDone = todoDone;
            hasMismatch = true;
          }
        }
      }
      if (isDone !== act.done) {
        return { ...act, done: isDone };
      }
      return act;
    });

    if (hasMismatch || (synced.length !== actions.length && rawGoalActions.length > 0)) {
      setActions(synced);
    }
  }, [goal.actions, allSchedules, todos, actions]);

  // Preference Card Configuration State
  const initialPref = goal.readingPreferences as ReadingPreferences | undefined;
  const [selectedSlot, setSelectedSlot] = useState<string>(initialPref?.timeSlot || 'evening');
  const [selectedDuration, setSelectedDuration] = useState<number>(initialPref?.duration || 30);
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [savingPref, setSavingPref] = useState(false);

  // Quick Target Editing Modal State
  const [editTargetsOpen, setEditTargetsOpen] = useState(false);
  const [editTotalPagesVal, setEditTotalPagesVal] = useState<number | ''>(targetPages > 0 ? targetPages : '');
  const [editDailyTargetVal, setEditDailyTargetVal] = useState<number | ''>(dailyTargetNum > 0 ? dailyTargetNum : 10);
  const [editTrackBy, setEditTrackBy] = useState<'pages' | 'chapters'>(trackByUnit);
  const [savingTargets, setSavingTargets] = useState(false);

  // Daily Logging & Checkpoint Modals State
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [pagesInput, setPagesInput] = useState<number | ''>('');
  const [noteInput, setNoteInput] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  const [addCpOpen, setAddCpOpen] = useState(false);
  const [cpLabelInput, setCpLabelInput] = useState('');
  const [savingCp, setSavingCp] = useState(false);

  // Strategy Task Details Modal State
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<ReadingActionItem | null>(null);
  const [taskEditText, setTaskEditText] = useState('');
  const [taskEditAssumedVal, setTaskEditAssumedVal] = useState<number | ''>('');
  const [taskEditKind, setTaskEditKind] = useState<'none' | 'schedule' | 'todo'>('none');
  const [showConvertOptions, setShowConvertOptions] = useState(false);
  const [taskEditDate, setTaskEditDate] = useState(todayStr);
  const [taskEditStartTime, setTaskEditStartTime] = useState('21:00');
  const [taskEditEndTime, setTaskEditEndTime] = useState('21:30');
  const [taskEditTodoTime, setTaskEditTodoTime] = useState('');
  const [taskEditAssignee, setTaskEditAssignee] = useState('');
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);

  // Check if today's reading progress has already been logged
  const todayLog = useMemo(() => readingLogs.find((l) => l.date === todayStr), [readingLogs, todayStr]);
  const hasLoggedToday = Boolean(todayLog);

  // Progress % Calculation Rule
  const progressPercent = useMemo(() => {
    if (targetPages > 0) {
      return Math.max(0, Math.min(100, Math.round((currentPages / targetPages) * 100)));
    }
    return Math.max(0, Math.min(100, Math.round(goal.progress || 0)));
  }, [currentPages, targetPages, goal.progress]);

  const checkpointsDoneCnt = useMemo(() => checkpoints.filter((c) => c.done).length, [checkpoints]);

  // Persist Goal Helper
  const persistReadingData = async (updates: Partial<Goal>) => {
    if (!goal.id) return;
    if (onUpdateGoal) {
      await onUpdateGoal(goal.id, updates);
    } else {
      await updateDoc(doc(db, 'goals', goal.id), updates);
    }
  };

  // Helper: Persist Strategy Actions List to Goal
  const saveActionsList = async (updated: ReadingActionItem[]) => {
    setActions(updated);
    if (goal.id) {
      await persistReadingData({ actions: updated as unknown as Goal['actions'] });
    }
  };

  // Toggle Strategy Task completion
  const handleToggleStepCompletion = async (step: ReadingActionItem) => {
    const nextDone = !step.done;
    const updated = actions.map((s) => (s.id === step.id ? { ...s, done: nextDone } : s));
    await saveActionsList(updated);

    if (step.scheduleId && editSchedule) {
      await editSchedule(step.scheduleId, { status: nextDone ? 'completed' : 'pending' }).catch((e) => console.warn(e));
    }
    if (step.todoId && updateTodo) {
      await updateTodo(step.todoId, { status: nextDone ? 'completed' : 'in_progress' }).catch((e) => console.warn(e));
    }
  };

  const handleAddStep = async (taskText: string) => {
    const text = taskText.trim();
    if (!text) return;

    const newStep: ReadingActionItem = {
      id: 'step_' + Date.now(),
      task: text,
      done: false,
    };
    const updated = [...actions, newStep];
    await saveActionsList(updated);
  };

  const handleDeleteStep = async (stepId: string) => {
    const step = actions.find((s) => s.id === stepId);
    if (step?.scheduleId && removeSchedule) {
      await removeSchedule(step.scheduleId, true).catch((err) => console.error(err));
    }
    if (step?.todoId && deleteTodo) {
      await deleteTodo(step.todoId, true).catch((err) => console.error(err));
    }
    const updated = actions.filter((s) => s.id !== stepId);
    await saveActionsList(updated);
  };

  const handleOpenTaskDetailModal = (step: ReadingActionItem) => {
    setActiveStep(step);
    setTaskEditText(step.task);
    setTaskEditAssumedVal(step.assumedContributionValue || '');
    const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
    setTaskEditKind(kind as 'none' | 'schedule' | 'todo');
    setShowConvertOptions(kind === 'schedule' || kind === 'todo');

    setTaskEditDate(step.dueDate || todayStr);
    setTaskEditStartTime(step.time || '21:00');
    setTaskEditEndTime('21:30');
    setTaskEditTodoTime(step.time || '');
    setTaskEditAssignee(step.assignee || '');
    setTaskModalOpen(true);
  };

  const handleSaveTaskDetail = async () => {
    if (!activeStep || !taskEditText.trim()) return;
    setSavingTaskEdit(true);
    try {
      let updatedScheduleId = activeStep.scheduleId;
      let updatedTodoId = activeStep.todoId;
      const rawDate = taskEditDate || todayStr;
      const targetDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;

      if (taskEditKind === 'schedule') {
        if (updatedTodoId && deleteTodo) {
          await deleteTodo(updatedTodoId, true).catch((err) => console.error(err));
          updatedTodoId = undefined;
        }
        if (!updatedScheduleId) {
          if (addSchedule) {
            const created = await addSchedule({
              userId: user?.uid || '',
              title: taskEditText.trim(),
              date: targetDate,
              startTime: taskEditStartTime || '21:00',
              endTime: taskEditEndTime || '21:30',
              status: activeStep.done ? 'completed' : 'pending',
              linkedGoalId: goal.id,
              goalTitle: goal.title,
            });
            if (typeof created === 'string') updatedScheduleId = created;
            else if (created && typeof (created as { id?: string }).id === 'string') updatedScheduleId = (created as { id: string }).id;
          }
        } else if (editSchedule) {
          await editSchedule(updatedScheduleId, {
            title: taskEditText.trim(),
            date: targetDate,
            startTime: taskEditStartTime || '21:00',
            endTime: taskEditEndTime || '21:30',
          });
        }
      } else if (taskEditKind === 'todo') {
        if (updatedScheduleId && removeSchedule) {
          await removeSchedule(updatedScheduleId, true).catch((err) => console.error(err));
          updatedScheduleId = undefined;
        }
        if (!updatedTodoId) {
          if (addTodo) {
            const created = await addTodo({
              title: taskEditText.trim(),
              status: activeStep.done ? 'completed' : 'in_progress',
              priority: 'routine',
              projectId: goal.projectId || '',
              authorId: user?.uid || '',
              dueDate: new Date(targetDate),
              steps: [],
              tags: [],
              progressPercent: 0,
              assignedUsers: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              linkedGoalId: goal.id,
              goalTitle: goal.title,
            });
            if (typeof created === 'string') updatedTodoId = created;
            else if (created && typeof (created as { id?: string }).id === 'string') updatedTodoId = (created as { id: string }).id;
          }
        } else if (updateTodo) {
          await updateTodo(updatedTodoId, {
            title: taskEditText.trim(),
            dueDate: new Date(targetDate),
          });
        }
      } else {
        if (updatedScheduleId && removeSchedule) {
          await removeSchedule(updatedScheduleId, true).catch((err) => console.error(err));
          updatedScheduleId = undefined;
        }
        if (updatedTodoId && deleteTodo) {
          await deleteTodo(updatedTodoId, true).catch((err) => console.error(err));
          updatedTodoId = undefined;
        }
      }

      const updatedActions = actions.map((s) => {
        if (s.id === activeStep.id) {
          return {
            ...s,
            task: taskEditText.trim(),
            assumedContributionValue: typeof taskEditAssumedVal === 'number' ? taskEditAssumedVal : undefined,
            kind: taskEditKind === 'none' ? undefined : taskEditKind,
            dueDate: targetDate,
            time: taskEditKind === 'schedule' ? taskEditStartTime : taskEditKind === 'todo' ? taskEditTodoTime : undefined,
            assignee: taskEditAssignee.trim() || undefined,
            scheduleId: updatedScheduleId,
            todoId: updatedTodoId,
          };
        }
        return s;
      });

      await saveActionsList(updatedActions);
      setTaskModalOpen(false);
    } catch (err) {
      console.error('Failed to save task detail:', err);
    } finally {
      setSavingTaskEdit(false);
    }
  };

  // Quick Target Edit Save Handler
  const handleSaveTargets = async () => {
    const newTotal = typeof editTotalPagesVal === 'number' && editTotalPagesVal > 0 ? editTotalPagesVal : 0;
    const newDaily = typeof editDailyTargetVal === 'number' && editDailyTargetVal > 0 ? editDailyTargetVal : 10;

    setSavingTargets(true);
    try {
      const updatedAnswers = {
        ...answers,
        track_by: editTrackBy,
        total_pages: editTrackBy === 'pages' ? newTotal : answers.total_pages,
        total_chapters: editTrackBy === 'chapters' ? newTotal : answers.total_chapters,
        daily_target_qty: newDaily,
      };

      const updates: Partial<Goal> = {
        overallTargetValue: newTotal,
        unit: editTrackBy,
        overallTargetUnit: editTrackBy,
        questionnaireAnswers: updatedAnswers,
      };

      if (newTotal > 0) {
        updates.progress = Math.min(100, Math.round((currentPages / newTotal) * 100));
      }

      await persistReadingData(updates);
      setEditTargetsOpen(false);
    } catch (err) {
      console.error('Failed to save target edits:', err);
    } finally {
      setSavingTargets(false);
    }
  };

  // Preference Card Save Handler
  const handleSavePreferences = async (slotId: string, durationVal: number) => {
    setSavingPref(true);
    try {
      const slotObj = TIME_SLOTS.find((s) => s.id === slotId) || TIME_SLOTS[2];
      const durationObj = DURATIONS.find((d) => d.value === durationVal) || DURATIONS[1];

      const slotLabel = `${slotObj.label} (${slotObj.sub})`;
      const prefObj: ReadingPreferences = {
        timeSlot: slotId,
        timeSlotLabel: slotLabel,
        duration: durationVal,
        durationLabel: durationObj.label,
        pages: durationObj.pages,
      };

      const updatedAnswers = {
        ...answers,
        preferred_time: slotLabel,
        daily_target_qty: durationObj.pages,
        reading_duration: durationVal,
      };

      await persistReadingData({
        readingPreferences: prefObj as unknown as Goal['readingPreferences'],
        questionnaireAnswers: updatedAnswers,
      });

      setSelectedSlot(slotId);
      setSelectedDuration(durationVal);
      setPrefModalOpen(false);
    } catch (err) {
      console.error('Failed to save reading preferences:', err);
    } finally {
      setSavingPref(false);
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

  // Checkpoint Handlers
  const toggleCheckpoint = async (id: string) => {
    const updated = checkpoints.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    setCheckpoints(updated);
    await persistReadingData({ learningCheckpoints: updated });
  };

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

  const surfaceBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1e293b';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  // Sub-component: ReadingPreferenceCard Content
  const renderPreferenceCardContent = (inModal = false) => {
    const activeSlotObj = TIME_SLOTS.find((s) => s.id === selectedSlot) || TIME_SLOTS[2];
    const activeDurationObj = DURATIONS.find((d) => d.value === selectedDuration) || DURATIONS[1];

    return (
      <div
        className={`w-full rounded-2xl overflow-hidden transition-colors duration-200 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg ${
          inModal ? 'max-w-full' : 'max-w-md mx-auto mb-6'
        }`}
      >
        {/* Header banner */}
        <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-transparent dark:from-teal-400/10 dark:via-emerald-400/5 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 bg-white shadow-sm border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              {TYPE_EMOJIS[materialType] || '📖'}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider font-semibold text-teal-600 dark:text-teal-400 truncate">
                Learning · Reading · {materialType}
              </p>
              <h2 className="text-[13px] leading-tight font-bold text-slate-900 dark:text-white">
                Preferred reading time?
              </h2>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3 space-y-4">
          {/* Time of day picker */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">
              TIME OF DAY
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {TIME_SLOTS.map(({ id, label, sub, icon: Icon }) => {
                const active = selectedSlot === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedSlot(id)}
                    className={`flex flex-col items-center gap-1 rounded-xl py-2 px-1 border transition-all duration-150 ${
                      active
                        ? 'bg-gradient-to-b from-teal-500 to-emerald-500 border-transparent text-white shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <Icon sx={{ fontSize: 16 }} />
                    <span className="text-[9px] font-bold leading-none">{label}</span>
                    <span className={`text-[7.5px] leading-none ${active ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                      {sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration presets */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">
              HOW LONG?
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {DURATIONS.map(({ label, value, note }) => {
                const active = selectedDuration === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedDuration(value)}
                    className={`relative rounded-xl py-2 px-1 border text-center transition-all duration-150 ${
                      active
                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm dark:bg-gradient-to-br dark:from-teal-500 dark:to-emerald-500 dark:border-transparent'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {active && <CheckIcon sx={{ fontSize: 12, position: 'absolute', top: 4, right: 4, opacity: 0.8 }} />}
                    <span className="block text-[12px] font-bold leading-none">{label}</span>
                    <span className={`block text-[8.5px] mt-0.5 leading-none ${active ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                      {note}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live summary */}
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-teal-50 border border-teal-100 dark:bg-teal-400/10 dark:border-teal-400/20">
            <BookIcon sx={{ fontSize: 16, color: isDark ? '#2dd4bf' : '#0d9488', shrink: 0 }} />
            <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
              You&apos;ll read for{' '}
              <span className="font-bold text-slate-900 dark:text-white">{activeDurationObj.label}</span> ({activeDurationObj.pages} {trackByUnit}) every{' '}
              <span className="font-bold text-slate-900 dark:text-white">{activeSlotObj.label.toLowerCase()}</span>.
            </p>
          </div>

          {/* Save button */}
          <button
            type="button"
            disabled={savingPref}
            onClick={() => handleSavePreferences(selectedSlot, selectedDuration)}
            className="w-full py-2.5 rounded-xl font-bold text-xs tracking-wide text-white bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-[0.98] transition-all duration-150 shadow-md shadow-emerald-500/20 disabled:opacity-50"
          >
            {savingPref ? 'Saving preferences...' : 'Save reading preference'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
      {/* ── 1. BOOK / READING HERO CARD ── */}
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

          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip
              label={`${progressPercent}% Read`}
              size="small"
              sx={{ bgcolor: isDark ? '#1e3a8a' : '#dbeafe', color: '#3b82f6', fontWeight: 700, fontSize: 11 }}
            />
          </Stack>
        </Box>

        {/* Reading Progress Gauge & Quick Edit Targets Control */}
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: textPrimary, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 1 }}>
              {currentPages.toLocaleString()}{' '}
              <span style={{ fontSize: 14, fontWeight: 600, color: textMuted }}>
                {targetPages > 0 ? `/ ${targetPages} ${trackByUnit}` : `${trackByUnit} read`}
              </span>
              <IconButton
                size="small"
                onClick={() => {
                  setEditTotalPagesVal(targetPages > 0 ? targetPages : '');
                  setEditDailyTargetVal(dailyTargetNum);
                  setEditTrackBy(trackByUnit);
                  setEditTargetsOpen(true);
                }}
                sx={{ color: textMuted, '&:hover': { color: '#3b82f6' } }}
                title="Edit Target & Pages"
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
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

        {/* Preferred Routine & Preferences Button */}
        <Box sx={{ mt: 3, p: 1.5, borderRadius: '16px', bgcolor: isDark ? '#0c4a6e' : '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ClockIcon sx={{ color: '#0284c7', fontSize: 22 }} />
            <Box>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                Preferred Reading Routine
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>
                {dailyReadingTime} · {dailyTargetNum} {trackByUnit}/session
              </Typography>
            </Box>
          </Box>

          <Button
            size="small"
            onClick={() => setPrefModalOpen(true)}
            startIcon={<ScheduleIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: 11.5,
              bgcolor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
              color: '#0284c7',
              '&:hover': { bgcolor: isDark ? 'rgba(56, 189, 248, 0.25)' : '#bae6fd' },
            }}
          >
            Preferences
          </Button>
        </Box>

        {/* ── DAILY READING PROMPT & LOG CONTROL ── */}
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

      {/* ── 3. STRATEGY TASKS SECTION FOR READING GOAL ── */}
      <Box sx={{ mt: 3, pt: 3, mb: 4, borderTop: `1px solid ${cardBorder}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: textPrimary, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              🎯 Strategy Tasks ({actions.length})
            </Typography>
            <Typography sx={{ fontSize: 11, color: textMuted, mt: 0.2 }}>
              Action steps, reading schedules, and chapter tasks synced across your app
            </Typography>
          </Box>
        </Box>

        {/* Strategic Tasks List */}
        <div className="space-y-2 mb-3">
          {actions.map((step) => {
            const kind = step.kind || (step.scheduleId ? 'schedule' : step.todoId ? 'todo' : 'none');
            const hasLink = kind === 'schedule' || kind === 'todo';

            return (
              <div
                key={step.id}
                onClick={() => handleOpenTaskDetailModal(step)}
                className="group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStepCompletion(step);
                    }}
                    className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0 ${
                      step.done
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
                    }`}
                  >
                    {step.done && (
                      <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 stroke-current stroke-[3]">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <span
                    className={`text-xs font-bold truncate ${
                      step.done
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {step.task}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                      hasLink
                        ? kind === 'schedule'
                          ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                          : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {kind === 'schedule'
                      ? '🗓 Schedule'
                      : kind === 'todo'
                      ? '✅ Todo'
                      : '+ Schedule/Todo'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStep(step.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete step"
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Task Creation Box */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="+ Quickly add a strategy task for your reading goal…"
            value={newGeneralStepInput}
            onChange={(e) => setNewGeneralStepInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newGeneralStepInput.trim()) {
                handleAddStep(newGeneralStepInput);
                setNewGeneralStepInput('');
              }
            }}
            className="flex-1 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => {
              handleAddStep(newGeneralStepInput);
              setNewGeneralStepInput('');
            }}
            disabled={!newGeneralStepInput.trim()}
            className="px-3.5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-bold transition-colors shadow-sm"
          >
            Add Task
          </button>
        </div>
      </Box>

      {/* ── 4. READING LOG HISTORY ── */}
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

      {/* ── 5. READING MILESTONES / CHECKPOINTS ── */}
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

      {/* ── MODAL: PREFERENCES ── */}
      <Dialog open={prefModalOpen} onClose={() => setPrefModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '24px', p: 0, overflow: 'hidden' } }}>
        <DialogTitle sx={{ p: 2, pb: 1, fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Reading Preferences</span>
          <IconButton size="small" onClick={() => setPrefModalOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2, pt: 0 }}>
          {renderPreferenceCardContent(true)}
        </DialogContent>
      </Dialog>

      {/* ── MODAL: QUICK TARGET EDIT ── */}
      <Dialog open={editTargetsOpen} onClose={() => setEditTargetsOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16 }}>Edit Reading Targets</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, mb: 1 }}>
                Tracking Unit
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  fullWidth
                  variant={editTrackBy === 'pages' ? 'contained' : 'outlined'}
                  onClick={() => setEditTrackBy('pages')}
                  size="small"
                  sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                >
                  By Pages 📄
                </Button>
                <Button
                  fullWidth
                  variant={editTrackBy === 'chapters' ? 'contained' : 'outlined'}
                  onClick={() => setEditTrackBy('chapters')}
                  size="small"
                  sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                >
                  By Chapters 🔖
                </Button>
              </Stack>
            </Box>

            <TextField
              label={`Total ${editTrackBy === 'chapters' ? 'Chapters' : 'Pages'} in Book/Item`}
              type="number"
              placeholder="e.g. 300 (leave blank for open-ended)"
              fullWidth
              size="small"
              value={editTotalPagesVal}
              onChange={(e) => setEditTotalPagesVal(e.target.value ? Number(e.target.value) : '')}
            />

            <TextField
              label={`Daily Target (${editTrackBy === 'chapters' ? 'chapters' : 'pages'} / session)`}
              type="number"
              placeholder="e.g. 20"
              fullWidth
              size="small"
              value={editDailyTargetVal}
              onChange={(e) => setEditDailyTargetVal(e.target.value ? Number(e.target.value) : '')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditTargetsOpen(false)} sx={{ textTransform: 'none', color: textMuted }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingTargets}
            onClick={handleSaveTargets}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', bgcolor: '#3b82f6', '&:hover': { bgcolor: '#2563eb' } }}
          >
            {savingTargets ? 'Saving...' : 'Save Targets'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── MODAL: LOG READING PROGRESS ── */}
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

      {/* ── MODAL: ADD CHECKPOINT ── */}
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

      {/* ── MODAL: STRATEGY TASK DETAIL MODAL ── */}
      <Modal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        closeAfterTransition
      >
        <Fade in={taskModalOpen}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[28px] w-[90%] sm:w-[440px] shadow-2xl overflow-hidden border outline-none bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <p className="text-[1.05rem] font-extrabold text-slate-800 dark:text-slate-100">
                Task Details
              </p>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
              {/* Task Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                  Task Title / Strategy Step
                </label>
                <input
                  type="text"
                  value={taskEditText}
                  onChange={(e) => setTaskEditText(e.target.value)}
                  placeholder="e.g. Read 20 pages of Chapter 3"
                  className="w-full text-sm font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Toggle Convert Options Button */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowConvertOptions(!showConvertOptions)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-blue-400 text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🗓️</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {taskEditKind === 'schedule'
                          ? 'Converted to Schedule'
                          : taskEditKind === 'todo'
                          ? 'Converted to Todo'
                          : 'Convert to Schedule or Todo'}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Sync status in real-time across app
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-blue-500 font-bold">
                    {showConvertOptions ? 'Hide' : 'Options'}
                  </span>
                </button>

                <Collapse in={showConvertOptions}>
                  <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('none')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                          taskEditKind === 'none'
                            ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-100 dark:text-slate-900'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Simple Task
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('schedule')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                          taskEditKind === 'schedule'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        🗓 Schedule
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskEditKind('todo')}
                        className={`py-2 px-1 text-[11px] font-bold rounded-xl border transition-all ${
                          taskEditKind === 'todo'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        ✅ Todo
                      </button>
                    </div>

                    {(taskEditKind === 'schedule' || taskEditKind === 'todo') && (
                      <div className="space-y-2.5 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                            Due Date
                          </label>
                          <input
                            type="date"
                            value={taskEditDate}
                            onChange={(e) => setTaskEditDate(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        {taskEditKind === 'schedule' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={taskEditStartTime}
                                onChange={(e) => setTaskEditStartTime(e.target.value)}
                                className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={taskEditEndTime}
                                onChange={(e) => setTaskEditEndTime(e.target.value)}
                                className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                            Assignee (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Self or Username"
                            value={taskEditAssignee}
                            onChange={(e) => setTaskEditAssignee(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Collapse>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <button
                type="button"
                onClick={() => activeStep && handleDeleteStep(activeStep.id)}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 px-3 py-2 rounded-xl transition-colors"
              >
                Delete Task
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3.5 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingTaskEdit || !taskEditText.trim()}
                  onClick={handleSaveTaskDetail}
                  className="text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-40 px-4 py-2 rounded-xl shadow-md transition-colors"
                >
                  {savingTaskEdit ? 'Saving...' : 'Save Task'}
                </button>
              </div>
            </div>
          </div>
        </Fade>
      </Modal>
    </Box>
  );
}
