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
} from '@mui/material';
import {
  MenuBook as BookIcon,
  AccessTime as ClockIcon,
  CheckCircle,
  RadioButtonUnchecked,
  Add as AddIcon,
  Flag as CheckpointIcon,
  Bookmark as BookmarkIcon,
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
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import StreakCard from '@/app/components/goals/StreakCard';
import StrategyTasksSection, { StrategyActionItem } from '@/app/components/goals/StrategyTasksSection';

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

function getPredefinedSlots(unit: string, targetValue: number): Array<{ label: string; value: number }> {
  const target = targetValue && targetValue > 0 ? targetValue : (unit === 'chapters' ? 2 : unit === 'minutes' ? 30 : 20);
  const normUnit = (unit || '').toLowerCase().trim();

  if (normUnit === 'chapters') {
    if (target === 1) {
      return [
        { label: '+0.25 ch', value: 0.25 },
        { label: '+0.5 ch', value: 0.5 },
        { label: '+0.75 ch', value: 0.75 },
        { label: 'Full (1 ch)', value: 1 },
      ];
    }
    const q1 = Math.max(0.5, Math.round(target * 0.25 * 2) / 2);
    const q2 = Math.max(1, Math.round(target * 0.5 * 2) / 2);
    const q3 = Math.max(1.5, Math.round(target * 0.75 * 2) / 2);
    return [
      { label: `+${q1} ch`, value: q1 },
      { label: `+${q2} ch`, value: q2 },
      { label: `+${q3} ch`, value: q3 },
      { label: `Full (${target} ch)`, value: target },
    ];
  }

  if (normUnit === 'minutes' || normUnit === 'mins') {
    const q1 = Math.max(5, Math.round(target * 0.25));
    const q2 = Math.max(10, Math.round(target * 0.5));
    const q3 = Math.max(15, Math.round(target * 0.75));
    return [
      { label: `+${q1} mins`, value: q1 },
      { label: `+${q2} mins`, value: q2 },
      { label: `+${q3} mins`, value: q3 },
      { label: `Full (${target} mins)`, value: target },
    ];
  }

  // Default: pages
  const q1 = Math.max(1, Math.round(target * 0.25));
  const q2 = Math.max(2, Math.round(target * 0.5));
  const q3 = Math.max(3, Math.round(target * 0.75));
  return [
    { label: `+${q1} pages`, value: q1 },
    { label: `+${q2} pages`, value: q2 },
    { label: `+${q3} pages`, value: q3 },
    { label: `Full (${target} pages)`, value: target },
  ];
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
  const { todos } = useTodoContext();
  const { allSchedules } = useSchedules();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const answers = goal.questionnaireAnswers || {};

  const materialType = String(answers.material_type || answers.format || 'Book');
  const bookTitle = goal.title || String(answers.material_name || answers.reading_title || answers.book_title || 'Reading Item');
  const author = String(answers.author || answers.writer || '');

  // Track by unit ('pages' | 'chapters' | 'minutes')
  const trackByUnit = useMemo(() => {
    const rawTrack = String(answers.track_by || goal.overallTargetUnit || goal.unit || 'pages').toLowerCase();
    if (rawTrack.includes('chapter')) return 'chapters';
    if (rawTrack.includes('minute') || rawTrack.includes('min')) return 'minutes';
    return 'pages';
  }, [answers.track_by, goal.overallTargetUnit, goal.unit]);

  // Overall total pages, chapters, or minutes of book
  const targetPages = Number(
    goal.overallTargetValue ||
    answers.total_pages ||
    answers.total_chapters ||
    answers.target_pages ||
    0
  );

  // Daily target pages/chapters/minutes user wants to read per session
  const dailyTargetNum = Number(
    answers.daily_target_qty ||
    answers.daily_pages ||
    answers.daily_chapters ||
    answers.daily_reading_target ||
    (trackByUnit === 'chapters' ? 2 : trackByUnit === 'minutes' ? 30 : 10)
  );

  // Derived predefined slots for 1-tap progress logging
  const predefinedSlots = useMemo(() => {
    return getPredefinedSlots(trackByUnit, dailyTargetNum);
  }, [trackByUnit, dailyTargetNum]);

  const dailyReadingTime = String(answers.preferred_time || answers.reading_time || 'Flexible');

  const [currentPages, setCurrentPages] = useState<number>(goal.currentValue || 0);

  // Habit check-ins state for streak synchronization
  const [habitCheckIns, setHabitCheckIns] = useState<NonNullable<Goal['habitCheckIns']>>(() => {
    return Array.isArray(goal.habitCheckIns) ? goal.habitCheckIns : [];
  });

  // Synchronize habit check-ins when goal object updates externally
  useEffect(() => {
    if (Array.isArray(goal.habitCheckIns)) {
      setHabitCheckIns(goal.habitCheckIns);
    }
  }, [goal.habitCheckIns]);

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
  const [editTrackBy, setEditTrackBy] = useState<'pages' | 'chapters' | 'minutes'>(trackByUnit);
  const [savingTargets, setSavingTargets] = useState(false);

  // Daily Logging & Checkpoint Modals State
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [pagesInput, setPagesInput] = useState<number | ''>('');
  const [noteInput, setNoteInput] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  const [addCpOpen, setAddCpOpen] = useState(false);
  const [cpLabelInput, setCpLabelInput] = useState('');
  const [savingCp, setSavingCp] = useState(false);



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

  // Synced goal object for StreakCard real-time updates
  const syncedGoal = useMemo(() => {
    return {
      ...goal,
      currentValue: currentPages,
      progress: progressPercent,
      readingLogs: readingLogs,
      habitCheckIns: habitCheckIns,
    };
  }, [goal, currentPages, progressPercent, readingLogs, habitCheckIns]);

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

  // Quick Log Reading Progress (Predefined slots or custom log)
  const handleSaveLog = async (addPagesVal?: number, customNote?: string) => {
    const val =
      typeof addPagesVal === 'number' && addPagesVal > 0
        ? addPagesVal
        : typeof pagesInput === 'number' && pagesInput > 0
        ? pagesInput
        : dailyTargetNum > 0
        ? dailyTargetNum
        : 1;

    if (val <= 0 || !goal.id) return;
    setSavingLog(true);
    try {
      const newTotal = currentPages + val;
      setCurrentPages(newTotal);

      // Check if today already has a log entry
      const existingTodayLog = readingLogs.find((l) => l.date === todayStr);
      let updatedLogs: ReadingLog[];
      if (existingTodayLog) {
        updatedLogs = readingLogs.map((l) =>
          l.date === todayStr
            ? {
                ...l,
                pagesRead: l.pagesRead + val,
                chapterNote: customNote !== undefined ? customNote : l.chapterNote || (noteInput.trim() || undefined),
              }
            : l
        );
      } else {
        const newLog: ReadingLog = {
          id: String(Date.now()),
          date: todayStr,
          pagesRead: val,
          chapterNote: customNote || (noteInput.trim() || undefined),
        };
        updatedLogs = [newLog, ...readingLogs];
      }
      setReadingLogs(updatedLogs);

      // Update habitCheckIns for streak card real-time sync
      const hasTodayCheckIn = habitCheckIns.some((c) => c.date && c.date.split('T')[0] === todayStr);
      const updatedCheckIns = hasTodayCheckIn
        ? habitCheckIns.map((c) => (c.date && c.date.split('T')[0] === todayStr ? { ...c, completed: true } : c))
        : [...habitCheckIns, { id: 'chk_' + Date.now(), date: todayStr, completed: true }];
      setHabitCheckIns(updatedCheckIns);

      const updates: Partial<Goal> = {
        currentValue: newTotal,
        readingLogs: updatedLogs,
        habitCheckIns: updatedCheckIns,
      };

      if (!targetPages || targetPages <= 0) {
        const incrementPct = trackByUnit === 'chapters' ? 8.66 : trackByUnit === 'minutes' ? 5.0 : 3.0;
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
    const deletedLog = readingLogs.find((l) => l.id === logId);
    const updatedLogs = readingLogs.filter((l) => l.id !== logId);
    setReadingLogs(updatedLogs);

    let newCurrent = currentPages;
    if (deletedLog) {
      newCurrent = Math.max(0, currentPages - deletedLog.pagesRead);
      setCurrentPages(newCurrent);
    }

    // Recalculate habitCheckIns if no log remains for deleted log date
    let updatedCheckIns = habitCheckIns;
    if (deletedLog) {
      const remainingLogsForDate = updatedLogs.filter((l) => l.date === deletedLog.date);
      if (remainingLogsForDate.length === 0) {
        updatedCheckIns = habitCheckIns.filter((c) => !(c.date && c.date.split('T')[0] === deletedLog.date));
        setHabitCheckIns(updatedCheckIns);
      }
    }

    const updates: Partial<Goal> = {
      currentValue: newCurrent,
      readingLogs: updatedLogs,
      habitCheckIns: updatedCheckIns,
    };
    if (targetPages > 0) {
      updates.progress = Math.min(100, Math.round((newCurrent / targetPages) * 100));
    }
    await persistReadingData(updates);
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
      </Box>

      {/* ── 2. DAILY READING PROGRESS UPDATE CARD WITH PREDEFINED SLOTS ── */}
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Daily Progress Logging
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: textPrimary, mt: 0.2 }}>
              Log Today&apos;s Reading Progress
            </Typography>
          </Box>
          <Chip
            label={`Daily Target: ${dailyTargetNum} ${trackByUnit}`}
            size="small"
            sx={{
              bgcolor: isDark ? 'rgba(45, 212, 191, 0.15)' : '#ccfbf1',
              color: isDark ? '#2dd4bf' : '#0d9488',
              fontWeight: 700,
              fontSize: 11,
            }}
          />
        </Box>

        {/* Quick Predefined Slot Chips */}
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: textMuted, mb: 1.5 }}>
          Quick 1-Tap Progress Slots:
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2.5 }}>
          {predefinedSlots.map((slot, idx) => (
            <button
              key={idx}
              type="button"
              disabled={savingLog}
              onClick={() => handleSaveLog(slot.value)}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-teal-200 dark:border-teal-800/60 bg-teal-50/50 dark:bg-teal-950/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 text-teal-800 dark:text-teal-200 active:scale-[0.98] transition-all shadow-sm group cursor-pointer disabled:opacity-50"
            >
              <span className="text-xs font-bold group-hover:scale-105 transition-transform">{slot.label}</span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold mt-0.5">
                Tap to add
              </span>
            </button>
          ))}
        </Box>

        {/* Primary Action Buttons & Status */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', pt: 1, borderTop: `1px dashed ${cardBorder}` }}>
          <Button
            variant="contained"
            size="small"
            disabled={savingLog}
            onClick={() => handleSaveLog(dailyTargetNum > 0 ? dailyTargetNum : 10)}
            startIcon={<CheckIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: 12.5,
              bgcolor: '#0d9488',
              '&:hover': { bgcolor: '#0f766e' },
              py: 1,
              px: 2.5,
            }}
          >
            {`Full Target (+${dailyTargetNum || 10} ${trackByUnit})`}
          </Button>

          <Button
            variant="outlined"
            size="small"
            disabled={savingLog}
            onClick={() => setLogModalOpen(true)}
            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 12,
              borderColor: cardBorder,
              color: textPrimary,
              py: 1,
              px: 2,
            }}
          >
            Custom Amount / Note
          </Button>
        </Box>

        {/* Today's Logged Summary Banner */}
        {hasLoggedToday ? (
          <Box sx={{ mt: 2, p: 1.5, borderRadius: '12px', bgcolor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ecfdf5', border: '1px solid', borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <span>✅ Today&apos;s logged total:</span>
              <strong style={{ fontSize: 13 }}>{todayLog?.pagesRead} {trackByUnit}</strong>
            </Typography>
            <Typography sx={{ fontSize: 11, color: textMuted }}>
              Streak active today 🔥
            </Typography>
          </Box>
        ) : (
          <Typography sx={{ fontSize: 11.5, color: textMuted, mt: 1.5 }}>
            💡 Select a slot above or log custom reading activity to maintain your streak for today.
          </Typography>
        )}
      </Box>

      {/* ── 3. STREAK STATUS CARD (REAL-TIME SYNCED) ── */}
      <StreakCard
        goal={syncedGoal}
        onUpdateGoal={onUpdateGoal}
        logs={readingLogs.map((r) => ({ date: r.date, value: r.pagesRead }))}
        metricLabel="reading activity"
      />

      {/* ── 4. STRATEGY TASKS SECTION ── */}
      <StrategyTasksSection
        goal={goal}
        actions={actions as StrategyActionItem[]}
        onSaveActions={async (updated) => saveActionsList(updated as ReadingLog extends unknown ? ReadingActionItem[] : never)}
        placeholder="+ Quickly add a strategy task for your reading goal…"
      />

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
                <Button
                  fullWidth
                  variant={editTrackBy === 'minutes' ? 'contained' : 'outlined'}
                  onClick={() => setEditTrackBy('minutes')}
                  size="small"
                  sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                >
                  By Minutes ⏱️
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

    </Box>
  );
}
