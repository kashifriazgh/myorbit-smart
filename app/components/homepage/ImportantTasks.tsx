'use client';

import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Modal,
  Button,
  Stack,
  Skeleton,
  CircularProgress,
  Fade,
  Chip,
  Divider,
  Badge,
  styled,
  Collapse,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Event,
  CheckCircleOutline,
  PlayArrow,
  Pause,
  ExpandMore,
  ExpandLess,
  Add,
  NotificationsActive as NotifyIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { Menu, MenuItem } from '@mui/material';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import moment from 'moment';
import { Timestamp } from 'firebase/firestore';
import { useTodoContext } from '@/app/lib/context/todoContext';
import TodoCacheDebugOverlay from '@/app/components/dev/TodoCacheDebugOverlay';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { Todo } from '@/app/lib/interface';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ToDoModal from '@/app/components/to-do/todoModal';
import { incrementTodoRescheduleCount } from '@/app/lib/utilts';

const PRIORITY_ORDER = { critical: 0, urgent: 1, routine: 2 };

// Custom Styled Badge
const StyledBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    right: -3,
    top: 3,
    border: `2px solid ${theme.palette.background.paper}`,
    padding: '0 4px',
  },
}));

// Checkmark component styled same as in todoDetailPage
function Checkmark({
  done,
  onToggle,
  size = 'md',
  isDark,
}: {
  done: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
  isDark: boolean;
}) {
  const base = size === 'sm' ? 'w-5 h-5 rounded-md' : 'w-6 h-6 rounded-lg';
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={done ? 'Mark as not done' : 'Mark as done'}
      className={`
        flex-shrink-0 ${base} border-2 transition-all duration-200 flex items-center justify-center
        focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1
        ${
          done
            ? 'bg-indigo-500 border-indigo-500 shadow-sm shadow-indigo-200'
            : isDark
            ? 'border-slate-600 bg-slate-800 hover:border-indigo-400 hover:bg-slate-700'
            : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50'
        }
      `}
    >
      {done && (
        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 12 10" fill="none">
          <path
            d="M1 5l3.5 3.5L11 1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

interface QuickAddTaskRowProps {
  selectedDate: string;
  isDark: boolean;
  onAdd: (title: string, dueDate: Date) => void;
}

const QuickAddTaskRow = ({ selectedDate, isDark, onAdd }: QuickAddTaskRowProps) => {
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDateStr, setDueDateStr] = useState(selectedDate || moment().format('YYYY-MM-DD'));

  useEffect(() => {
    if (selectedDate) {
      setDueDateStr(selectedDate);
    }
  }, [selectedDate]);

  const commit = () => {
    if (title.trim()) {
      onAdd(title.trim(), moment(dueDateStr).toDate());
      setTitle('');
    }
    setActive(false);
  };

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className={`
          flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 w-full text-left
          focus:outline-none focus:ring-2 focus:ring-sky-300 mb-2
          ${
            isDark
              ? 'text-slate-500 hover:text-sky-400 hover:bg-slate-800/50'
              : 'text-slate-400 hover:text-sky-500 hover:bg-sky-50'
          }
        `}
      >
        <span
          className={`w-6 h-6 rounded-md border-2 border-dashed flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
            isDark ? 'border-slate-700' : 'border-slate-300'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
        </span>
        Quickly add a task...
      </button>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.75,
        mb: 2,
        borderRadius: '14px',
        border: `1.5px solid ${isDark ? '#0284c744' : '#bae6fd88'}`,
        bgcolor: isDark ? '#0f172a' : '#f0f9ff',
        boxShadow: isDark
          ? 'inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 3px rgba(56,189,248,0.07)'
          : '0 0 0 3px rgba(186,230,253,0.1)',
        overflow: 'hidden',
      }}
    >
      {/* Date badge with Calendar icon */}
      <Tooltip title={`Due: ${moment(dueDateStr).format('MMM D, YYYY')}`} arrow>
        <Box sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: '8px',
          bgcolor: isDark ? 'rgba(56,189,248,0.1)' : 'rgba(224,242,254,0.6)',
          flexShrink: 0,
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: isDark ? 'rgba(56,189,248,0.2)' : 'rgba(224,242,254,0.9)',
          }
        }}>
          <Event sx={{ fontSize: '1.1rem', color: isDark ? '#38bdf8' : '#0284c7' }} />
          <input
            type="date"
            value={dueDateStr}
            onChange={(e) => setDueDateStr(e.target.value)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
            }}
          />
        </Box>
      </Tooltip>

      {/* Divider */}
      <Box sx={{ width: '1px', height: 18, bgcolor: isDark ? '#1e293b' : '#bae6fd', flexShrink: 0 }} />

      {/* Input - minWidth: 0 prevents overflow */}
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setActive(false); setTitle(''); }
        }}
        placeholder="Task title…"
        style={{ minWidth: 0, flex: 1, background: 'transparent', border: 'none', outline: 'none' }}
        className={`text-[0.93rem] placeholder:text-slate-400 ${
          isDark ? 'text-slate-100' : 'text-slate-800'
        }`}
      />

      {/* Circular Glowing button */}
      <Box
        component="button"
        onClick={commit}
        disabled={!title.trim()}
        sx={{
          flexShrink: 0,
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: 'none',
          cursor: title.trim() ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: title.trim()
            ? '#0284c7'
            : (isDark ? '#1e293b' : '#f1f5f9'),
          color: title.trim() ? '#fff' : (isDark ? '#475569' : '#cbd5e1'),
          boxShadow: title.trim() ? '0 0 10px rgba(2,132,199,0.55)' : 'none',
          outline: `2px solid ${title.trim() ? '#38bdf8' : 'transparent'}`,
          outlineOffset: '2px',
          transition: 'all 0.18s ease',
          '&:hover': {
            transform: title.trim() ? 'scale(1.1)' : 'none',
            boxShadow: title.trim() ? '0 0 16px rgba(2,132,199,0.7)' : 'none',
          },
        }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,7 5.5,11 12,3" />
        </svg>
      </Box>
    </Box>
  );
};

const ImportantTasks = () => {
  const { todos, loading, updateStepStatus, addTodo, updateTodo } = useTodoContext();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [viewMode, setViewMode] = useState<'quick' | 'detail'>('quick');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load view mode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('important_tasks_view_mode');
    if (savedMode === 'quick' || savedMode === 'detail') {
      setViewMode(savedMode);
    }
    setIsLoaded(true);
  }, []);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('important_tasks_view_mode', viewMode);
    }
  }, [viewMode, isLoaded]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<Todo | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false);
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [notiMenuAnchorEl, setNotiMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [activeNotiTask, setActiveNotiTask] = useState<Todo | null>(null);
  const [sendingNotiTaskId, setSendingNotiTaskId] = useState<string | null>(null);

  // Calculate daily progress percentage based on active & completed tasks of the selected date
  const progressPercent = useMemo(() => {
    if (!selectedDate) return 0;
    const selectedStart = moment(selectedDate).startOf('day');
    const selectedEnd = moment(selectedDate).endOf('day');
    const todayStr = moment().format('YYYY-MM-DD');

    const tasksForDay = todos.filter((t) => {
      // Flexible task on today
      if (t.isFlexible && selectedDate === todayStr) return true;
      // Fixed due date
      if (!t.dueDate) return false;
      const due = moment(t.dueDate);
      return due.isBetween(selectedStart, selectedEnd, 'day', '[]');
    });

    const total = tasksForDay.length;
    const completed = tasksForDay.filter((t) => t.status === 'completed').length;

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [todos, selectedDate]);

  const handleQuickAddTask = (title: string, dueDate: Date) => {
    if (!user) return;
    const newTodo: Omit<Todo, 'id'> = {
      title,
      priority: 'routine',
      status: 'in_progress',
      dueDate: Timestamp.fromDate(dueDate),
      isFlexible: false,
      progressPercent: 0,
      steps: [],
      assignedUsers: [],
      authorId: user.uid,
      authorName: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    addTodo(newTodo).catch((err) => {
      console.error('Failed to add quick task:', err);
      alert('Failed to save task. Action undone.');
    });
  };

  // Generate 5 dates starting from today (same as Schedules)
  const generateDates = () => {
    const dates = [] as { date: string; day: string; fullDate: string }[];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: date.getDate().toString(),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: date.toISOString().split('T')[0],
      });
    }
    return dates;
  };

  const dates = useMemo(() => generateDates(), []);

  // Set initial selected date to today
  useEffect(() => {
    if (dates.length > 0) setSelectedDate(dates[0].fullDate);
  }, [dates]);

  // Calculate task counts for each day
  const taskCounts = useMemo(() => {
    const counts: { [date: string]: number } = {};
    const todayStr = moment().format('YYYY-MM-DD');
    todos.forEach((t) => {
      if (t.status !== 'completed') {
        if (t.isFlexible) {
          counts[todayStr] = (counts[todayStr] || 0) + 1;
        } else if (t.dueDate) {
          const dueDate = moment(t.dueDate).format('YYYY-MM-DD');
          counts[dueDate] = (counts[dueDate] || 0) + 1;
        }
      }
    });
    return counts;
  }, [todos]);

  // Filter and sort todos — includes completed tasks so they stay visible
  const filteredTasks = useMemo(() => {
    if (!selectedDate) return [] as Todo[];
    const selectedStart = moment(selectedDate).startOf('day');
    const selectedEnd = moment(selectedDate).endOf('day');
    const todayStr = moment().format('YYYY-MM-DD');

    return todos
      .filter((t) => {
        // Show ALL tasks (active + completed) for the selected date
        if (t.isFlexible && selectedDate === todayStr) return true;
        if (!t.dueDate) return false;
        const due = moment(t.dueDate);
        return due.isBetween(selectedStart, selectedEnd, 'day', '[]');
      })
      .sort((a, b) => {
        // Completed tasks always sink to the bottom
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        const dueA = moment(a.dueDate);
        const dueB = moment(b.dueDate);
        return (
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          dueA.diff(dueB)
        );
      });
  }, [todos, selectedDate]);

  // Toggle completion — goes through context so state + cache update instantly
  const markCompleted = async (task: Todo) => {
    if (!task.id) return;
    const newStatus = task.status === 'completed' ? 'in_progress' : 'completed';
    setCompletingId(task.id);
    try {
      await updateTodo(task.id, { status: newStatus });
    } catch (err) {
      console.error('Failed to update task status:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const toggleStepStatus = async (task: Todo, stepIndex: number) => {
    if (!task.id) return;

    const currentStep = task.steps?.[stepIndex];
    if (!currentStep) return;

    const newStatus =
      currentStep.status === 'completed' ? 'pending' : 'completed';
    await updateStepStatus(task.id, stepIndex, newStatus);
  };

  const handleReschedule = (task: Todo) => {
    setRescheduleTask(task);
    setNewDueDate(
      task.dueDate 
        ? (task.dueDate instanceof Timestamp ? task.dueDate.toDate() : new Date(task.dueDate))
        : new Date()
    );
    setRescheduleOpen(true);
  };

  const updateDueDate = async () => {
    if (!rescheduleTask?.id || !newDueDate) return;
    setReschedulingLoading(true);
    try {
      const oldDate = rescheduleTask.dueDate
        ? (rescheduleTask.dueDate instanceof Timestamp ? rescheduleTask.dueDate.toDate() : new Date(rescheduleTask.dueDate))
        : null;
      const isDateChanged = oldDate ? !moment(oldDate).isSame(newDueDate, 'day') : true;

      // updateTodo handles optimistic update + cache + Firebase write
      await updateTodo(rescheduleTask.id, {
        dueDate: Timestamp.fromDate(newDueDate),
        isFlexible: false,
      });

      if (isDateChanged) {
        await incrementTodoRescheduleCount(rescheduleTask.id);
      }

      setRescheduleOpen(false);
      setRescheduleTask(null);
    } catch (err) {
      console.error('Failed to reschedule task:', err);
    } finally {
      setReschedulingLoading(false);
    }
  };

  const toggleWorkStarted = async (task: Todo) => {
    if (!task.id) return;
    try {
      await updateTodo(task.id, { workStarted: !task.workStarted });
    } catch (err) {
      console.error('Failed to toggle workStarted:', err);
    }
  };

  const toggleExpanded = (taskId?: string) => {
    if (!taskId) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleOpenNotiMenu = (event: React.MouseEvent<HTMLElement>, task: Todo) => {
    setNotiMenuAnchorEl(event.currentTarget);
    setActiveNotiTask(task);
  };

  const handleCloseNotiMenu = () => {
    setNotiMenuAnchorEl(null);
    setActiveNotiTask(null);
  };

  const handleSendTaskNotification = async (targetUid: string | null) => {
    if (!user || !activeNotiTask || !activeNotiTask.id) return;
    const task = activeNotiTask;
    handleCloseNotiMenu();
    setSendingNotiTaskId(task.id);
    try {
      const { userAuth } = await import('@/app/lib/firebase');
      const idToken = await userAuth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error('Could not retrieve authentication session token.');
      const res = await fetch('/api/send-test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          targetUid,
          title: targetUid
            ? `Task Reminder from ${user.displayName || 'User'} 📋`
            : `Task Reminder: ${task.title} 📋`,
          bodyText: targetUid
            ? `${user.displayName || 'User'} wants to remind you about: ${task.title}`
            : `Don't forget: ${task.title}. Click to view in app!`,
          appUrl: `/to-do/${task.id}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch notification.');
    } catch (err) {
      console.error('Task notification error:', err);
    } finally {
      setSendingNotiTaskId(null);
    }
  };

  if (loading) {
    return (
      <Card
        sx={{
          height: '100%',
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
          position: 'relative',
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Box className="flex justify-between items-center mb-3">
            <Typography variant="subtitle1" fontWeight="bold">
              🚀 On Going Plans
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => setTodoModalOpen(true)}
            >
              New Task
            </Button>
          </Box>

          {/* Skeleton Card */}
          <Card className="rounded-xl shadow-sm mb-2"
            sx={{ backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#f8fafc', border: `1px solid ${theme?.mode === 'dark' ? '#1e293b' : '#e2e8f0'}` }}
          >
            <CardContent>
              <Box className="flex justify-between mb-2">
                <Box>
                  <Skeleton width={140} height={20} />
                  <Skeleton width={100} height={16} sx={{ mt: 0.5 }} />
                </Box>
                <Skeleton width={60} height={20} />
              </Box>

              <Stack direction="row" spacing={1} mb={2}>
                <Skeleton width={80} height={16} />
                <Skeleton width={60} height={16} />
              </Stack>

              {/* Steps Skeleton */}
              <Box>
                {[...Array(3)].map((_, idx) => (
                  <Box key={idx} className="flex items-center gap-2 my-1">
                    <Skeleton variant="circular" width={24} height={24} />
                    <Skeleton width="80%" height={16} />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          <ToDoModal
            open={todoModalOpen}
            onClose={() => setTodoModalOpen(false)}
          />
        </CardContent>
      </Card>
    );
  }

  
  return (
    <>
    <Card
      sx={{
        height: '100%',
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
        position: 'relative',
      }}
    >
      <CardContent sx={{ p: 2 }}>
        {/* Title row */}
        <Box mb={1.5}>
          <Typography variant="subtitle1" fontWeight={700}>
            🚀 On Going Plans
          </Typography>
        </Box>

        {/* Controls row: tab switcher left, New Task button right */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              bgcolor: theme?.mode === 'dark' ? '#0f172a' : '#f1f5f9',
              p: '4px',
              borderRadius: '10px',
            }}
          >
            {(['quick', 'detail'] as const).map((mode) => (
              <Button
                key={mode}
                size="small"
                onClick={() => setViewMode(mode)}
                disableRipple={false}
                sx={{
                  borderRadius: '7px',
                  px: 2,
                  py: 0.4,
                  minWidth: 76,
                  fontSize: '0.78rem',
                  textTransform: 'none',
                  fontWeight: 700,
                  color: viewMode === mode
                    ? (theme?.mode === 'dark' ? '#fff' : '#0f172a')
                    : '#64748b',
                  bgcolor: viewMode === mode
                    ? (theme?.mode === 'dark' ? '#1e293b' : '#fff')
                    : 'transparent',
                  boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: viewMode === mode
                      ? (theme?.mode === 'dark' ? '#1e293b' : '#fff')
                      : (theme?.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                  },
                }}
              >
                {mode === 'quick' ? '⚡ Quick' : '📋 Detail'}
              </Button>
            ))}
          </Box>

          {viewMode === 'detail' && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => setTodoModalOpen(true)}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                py: 0.5,
              }}
            >
              New Task
            </Button>
          )}
        </Box>

        {/* Date Picker - Always visible with professional light blue theme */}
        <Box display="flex" justifyContent="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            {dates.map((dateInfo) => {
              const isSelected = selectedDate === dateInfo.fullDate;
              const count = taskCounts[dateInfo.fullDate] || 0;
              return (
                <StyledBadge
                  key={dateInfo.fullDate}
                  badgeContent={count}
                  color="primary"
                  invisible={count === 0}
                >
                  <Box
                    onClick={() => setSelectedDate(dateInfo.fullDate)}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 64,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease-in-out',
                      backgroundColor: isSelected ? '#bae6fd' : '#e0f2fe',
                      border: `1px solid ${isSelected ? '#7dd3fc' : '#bae6fd'}`,
                      boxShadow: isSelected ? 'inset 0 0 0 1px #38bdf8' : 'none',
                      '&:hover': {
                        backgroundColor: isSelected ? '#7dd3fc' : '#bae6fd',
                      },
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, color: '#0c4a6e' }}
                    >
                      {dateInfo.date}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontSize: '0.7rem', color: '#0369a1' }}
                    >
                      {dateInfo.day}
                    </Typography>
                  </Box>
                </StyledBadge>
              );
            })}
          </Box>
        </Box>

        {/* Progress Bar (calculated like todo detail steps) */}
        <Box mb={3} px={1}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="caption" fontWeight={700} sx={{ color: theme?.mode === 'dark' ? '#94a3b8' : '#475569' }}>
              Daily Progress
            </Typography>
            <Typography variant="caption" fontWeight={800} sx={{ color: '#4f46e5' }}>
              {progressPercent}%
            </Typography>
          </Box>
          <Box
            sx={{
              height: 8,
              bgcolor: theme?.mode === 'dark' ? '#1e293b' : '#f1f5f9',
              borderRadius: 99,
              overflow: 'hidden',
              border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${progressPercent}%`,
                background: 'linear-gradient(to right, #38bdf8, #6366f1)',
                borderRadius: 99,
                transition: 'width 0.7s ease-out',
              }}
            />
          </Box>
        </Box>

        {viewMode === 'quick' && (
          <QuickAddTaskRow
            selectedDate={selectedDate}
            isDark={theme?.mode === 'dark'}
            onAdd={handleQuickAddTask}
          />
        )}

        {filteredTasks.length === 0 ? (
          <Box className="p-4 flex flex-col items-center justify-center min-h-64">
            <Typography variant="h6" fontWeight="bold" className="mb-4 text-center">
              📋 No Tasks Yet
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              className="mb-6 text-center"
            >
              Create your first task to get started!
            </Typography>
            {viewMode === 'detail' ? (
              <Button
                variant="contained"
                size="large"
                startIcon={<Add />}
                onClick={() => setTodoModalOpen(true)}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                }}
              >
                Create New Task
              </Button>
            ) : (
              <Typography variant="caption" color="textSecondary">
                Use the field above to add a task quickly.
              </Typography>
            )}
          </Box>
        ) : viewMode === 'quick' ? (
          <Stack spacing={1}>
            {filteredTasks.slice(0, 8).map((task) => {
              const isDone = task.status === 'completed';
              return (
                <Box
                  key={task.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 1,
                    borderRadius: '10px',
                    bgcolor: isDone
                      ? (theme?.mode === 'dark' ? 'transparent' : '#fafafa')
                      : (theme?.mode === 'dark' ? '#0f172a' : '#f8fafc'),
                    border: `1px solid ${theme?.mode === 'dark' ? '#1e293b' : '#e2e8f0'}`,
                    opacity: isDone ? 0.55 : 1,
                    transition: 'opacity 0.25s ease',
                    '&:hover': { opacity: 1, bgcolor: theme?.mode === 'dark' ? '#1e293b' : '#f1f5f9' },
                  }}
                >
                  <Checkmark
                    done={isDone}
                    onToggle={() => markCompleted(task)}
                    isDark={theme?.mode === 'dark'}
                    size="md"
                  />

                  <Link href={`/to-do/${task.id}`} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isDone ? 400 : 600,
                        color: isDone
                          ? (theme?.mode === 'dark' ? '#475569' : '#94a3b8')
                          : (theme?.mode === 'dark' ? '#f1f5f9' : '#1e293b'),
                        textDecoration: isDone ? 'line-through' : 'none',
                        cursor: 'pointer',
                        transition: 'color 0.15s',
                        '&:hover': { color: '#6366f1' },
                        fontSize: '0.95rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        wordBreak: 'break-word',
                      }}
                    >
                      {task.title}
                    </Typography>
                  </Link>

                  {!isDone && (
                    <Box display="flex" alignItems="center" gap={0.75} flexShrink={0}>
                      {task.isFlexible ? (
                        <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 700, fontSize: '0.67rem' }}>
                          Flexible
                        </Typography>
                      ) : task.dueDate ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.67rem' }}>
                          {moment(task.dueDate).format('MMM D')}
                        </Typography>
                      ) : null}
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor:
                        task.priority === 'critical' ? 'error.main'
                        : task.priority === 'urgent' ? 'warning.main'
                        : 'success.main',
                      }} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Stack spacing={2}>
            {filteredTasks.slice(0, 5).map((task) => (
              <Fade in key={task.id} timeout={300}>
                <Card className="rounded-xl shadow-sm hover:shadow-md transition" sx={{ opacity: task.status === 'completed' ? 0.65 : 1 }}>
                <CardContent>
                  <Box className="flex justify-between items-start gap-2">
                    <Box className="flex items-center gap-2">
                      {task.workStarted && (
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: 'success.main',
                            boxShadow: '0 0 0 0 rgba(34,197,94, 0.7)',
                            animation: 'pulse 1.2s infinite',
                            '@keyframes pulse': {
                              '0%': { boxShadow: '0 0 0 0 rgba(34,197,94, 0.7)' },
                              '70%': {
                                boxShadow: '0 0 0 8px rgba(34,197,94, 0)',
                              },
                              '100%': { boxShadow: '0 0 0 0 rgba(34,197,94, 0)' },
                            },
                          }}
                        />
                      )}
                      <Link href={`/to-do/${task.id}`} style={{ textDecoration: 'none' }}>
                        <Typography
                          variant="subtitle1"
                          fontWeight="medium"
                          sx={{
                            textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                            color: task.status === 'completed'
                              ? (theme?.mode === 'dark' ? '#475569' : '#94a3b8')
                              : 'inherit',
                          }}
                        >
                          {task?.title}
                        </Typography>
                      </Link>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ display: { xs: 'none', sm: 'flex' } }}
                    >
                      <Tooltip
                        title={
                          expanded.has(task.id!) ? 'Hide steps' : 'Show steps'
                        }
                      >
                        <IconButton
                          size="small"
                          onClick={() => toggleExpanded(task.id)}
                        >
                          {expanded.has(task.id!) ? (
                            <ExpandLess fontSize="small" />
                          ) : (
                            <ExpandMore fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip
                        title={task.workStarted ? 'Stop Work' : 'Work Start'}
                      >
                        <IconButton
                          size="small"
                          onClick={() => toggleWorkStarted(task)}
                        >
                          {task.workStarted ? (
                            <Pause fontSize="small" />
                          ) : (
                            <PlayArrow fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reschedule">
                        <IconButton
                          size="small"
                          onClick={() => handleReschedule(task)}
                        >
                          <Event fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Send Reminder Notification">
                        <IconButton
                          size="small"
                          disabled={sendingNotiTaskId === task.id}
                          onClick={(e) => handleOpenNotiMenu(e, task)}
                        >
                          {sendingNotiTaskId === task.id ? (
                            <CircularProgress size={18} />
                          ) : (
                            <NotifyIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Mark as done">
                        <IconButton
                          size="small"
                          disabled={completingId === task.id}
                          onClick={() => markCompleted(task)}
                        >
                          {completingId === task.id ? (
                            <CircularProgress size={18} />
                          ) : (
                            <CheckCircleOutline fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>

                  <Stack
                    direction="row"
                    spacing={1}
                    mb={1.5}
                    mt={0.5}
                    pl={1}
                    flexWrap="wrap"
                    alignItems="center"
                  >
                    {task.isFlexible ? (
                      <Chip
                        size="small"
                        label="Flexible"
                        icon={<Box sx={{ ml: 0.5, fontSize: '0.8rem' }}>✨</Box>}
                        variant="outlined"
                        sx={{ 
                          borderColor: '#8b5cf6', 
                          color: '#8b5cf6', 
                          fontWeight: 900,
                          borderWidth: '1.5px',
                          '& .MuiChip-label': { px: 1 }
                        }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        label={`Due: ${moment(task.dueDate).format('MMM D')}`}
                        variant="outlined"
                      />
                    )}
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Chip
                      size="small"
                      label={task.priority.toUpperCase()}
                      color={
                        task.priority === 'critical'
                          ? 'error'
                          : task.priority === 'urgent'
                            ? 'warning'
                            : 'success'
                      }
                      variant={
                        task.priority === 'routine' ? 'outlined' : 'filled'
                      }
                    />
                    <Chip
                      size="small"
                      label={task.status.replace('_', ' ')}
                      variant="outlined"
                    />
                    {/* Show overall task assignee for quick glance */}
                    {task.assignee && (
                      <Chip
                        size="small"
                        label={task.assignee}
                        variant="outlined"
                        sx={{ ml: 0.5, fontWeight: 600 }}
                      />
                    )}
                  </Stack>

                  {/* Mobile action bar (bottom) */}
                  <Box
                    mt={1}
                    sx={{ display: { xs: 'flex', sm: 'none' } }}
                    className="justify-end"
                  >
                    <Stack direction="row" spacing={1}>
                      <Tooltip
                        title={
                          expanded.has(task.id!) ? 'Hide steps' : 'Show steps'
                        }
                      >
                        <IconButton
                          size="small"
                          onClick={() => toggleExpanded(task.id)}
                        >
                          {expanded.has(task.id!) ? (
                            <ExpandLess fontSize="small" />
                          ) : (
                            <ExpandMore fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip
                        title={task.workStarted ? 'Stop Work' : 'Work Start'}
                      >
                        <IconButton
                          size="small"
                          onClick={() => toggleWorkStarted(task)}
                        >
                          {task.workStarted ? (
                            <Pause fontSize="small" />
                          ) : (
                            <PlayArrow fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reschedule">
                        <IconButton
                          size="small"
                          onClick={() => handleReschedule(task)}
                        >
                          <Event fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Mark as done">
                        <IconButton
                          size="small"
                          disabled={completingId === task.id}
                          onClick={() => markCompleted(task)}
                        >
                          {completingId === task.id ? (
                            <CircularProgress size={18} />
                          ) : (
                            <CheckCircleOutline fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>

                  {/* Steps (collapsible) */}
                  <Collapse
                    in={expanded.has(task.id!)}
                    timeout="auto"
                    unmountOnExit
                  >
                    <Box className="pl-2 mt-1">
                      {task.steps?.map((step, idx) => (
                        <Box key={idx} className="flex items-start gap-2 my-1">
                          <IconButton
                            size="small"
                            onClick={() => toggleStepStatus(task, idx)}
                          >
                            {step.status === 'completed' ? (
                              <CheckCircle
                                className="text-green-500"
                                fontSize="small"
                              />
                            ) : (
                              <RadioButtonUnchecked
                                className="text-gray-400"
                                fontSize="small"
                              />
                            )}
                          </IconButton>
                          <Typography
                            variant="body2"
                            className={
                              step.status === 'completed'
                                ? 'line-through text-gray-400'
                                : ''
                            }
                          >
                            {step.text}
                          </Typography>
                        </Box>
                      ))}
                      {!task.steps || task.steps.length === 0 ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          className="pl-9"
                        >
                          No steps added
                        </Typography>
                      ) : null}
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Fade>
          ))}
          </Stack>
        )}

        <Box mt={2} display="flex" justifyContent="flex-end">
          <Link href="/to-do" style={{ textDecoration: 'none' }}>
            <Button variant="text">View more</Button>
          </Link>
        </Box>

        {/* Reschedule Modal */}
        <Modal 
          open={rescheduleOpen} 
          onClose={() => setRescheduleOpen(false)}
          closeAfterTransition
        >
          <Fade in={rescheduleOpen}>
            <Box
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[28px] w-[90%] sm:w-[420px] shadow-2xl overflow-hidden border outline-none 
                         bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
              sx={{ p: 0 }}
            >
              {/* Header with soft gradient */}
              <Box className="p-6 bg-gradient-to-br from-sky-400 to-sky-600 text-white">
                <Typography variant="h6" className="font-extrabold">
                  Reschedule Task
                </Typography>
                <Typography variant="body2" className="opacity-90">
                  Pick a new timeline for your task
                </Typography>
              </Box>

              <Box className="p-6">
                {/* Quick Select Options */}
                <Typography className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                  ✨ Quick Suggestions
                </Typography>
                <Box className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { label: 'Tomorrow', sub: moment().add(1, 'day').format('ddd'), date: moment().add(1, 'day') },
                    { 
                      label: 'In 2 Days', 
                      sub: moment().add(2, 'days').format('dddd'), 
                      date: moment().add(2, 'days') 
                    },
                    { label: 'Next Week', sub: moment().add(1, 'week').format('MMM D'), date: moment().add(1, 'week') },
                    { label: 'Next Monday', sub: moment().add(1, 'week').startOf('isoWeek').format('MMM D'), date: moment().add(1, 'week').startOf('isoWeek') }
                  ].map((option) => {
                    const isSelected = newDueDate && moment(newDueDate).isSame(option.date, 'day');
                    return (
                      <Box
                        key={option.label}
                        onClick={() => setNewDueDate(option.date.toDate())}
                        className={`p-3 rounded-2xl cursor-pointer text-center transition-all duration-200 border-2 
                                  ${isSelected 
                                    ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-400' 
                                    : 'bg-slate-50 dark:bg-slate-800/50 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
                                  }`}
                      >
                        <Typography className={`text-sm font-bold ${isSelected ? 'text-sky-700 dark:text-sky-400' : 'text-slate-700 dark:text-slate-200'}`}>
                          {option.label}
                        </Typography>
                        <Typography className={`text-[10px] ${isSelected ? 'text-sky-600/70 dark:text-sky-400/70' : 'text-slate-500 dark:text-slate-400'}`}>
                          {option.sub}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>

                <Divider className="my-6 border-slate-100 dark:border-slate-800">
                  <Chip label="OR" size="small" className="font-bold bg-transparent text-slate-400 text-[10px]" />
                </Divider>

                <Typography className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                  📅 Custom Date
                </Typography>
                <Box className="relative">
                  <DatePicker
                    selected={newDueDate}
                    onChange={(date: Date | null) => setNewDueDate(date)}
                    minDate={new Date()}
                    dateFormat="MMMM d, yyyy"
                    placeholderText="Select a date"
                    className="w-full p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 
                               text-slate-900 dark:text-white font-semibold outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 transition-all"
                  />
                </Box>

                <Stack direction="row" spacing={2} mt={4}>
                  <Button 
                    fullWidth
                    onClick={() => setRescheduleOpen(false)}
                    className="rounded-2xl py-3 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 normal-case"
                  >
                    Cancel
                  </Button>
                  <Button
                    fullWidth
                    onClick={updateDueDate}
                    variant="contained"
                    disabled={!newDueDate || reschedulingLoading}
                    className="rounded-2xl py-3 font-bold bg-gradient-to-r from-sky-500 to-sky-600 shadow-lg shadow-sky-500/30 normal-case
                               hover:from-sky-600 hover:to-sky-700 disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-800 dark:disabled:to-slate-800"
                  >
                    {reschedulingLoading ? (
                      <CircularProgress size={24} color="inherit" />
                    ) : (
                      'Reschedule Now'
                    )}
                  </Button>
                </Stack>
              </Box>
            </Box>
          </Fade>
        </Modal>

        {/* Todo Modal */}
        <ToDoModal open={todoModalOpen} onClose={() => setTodoModalOpen(false)} />

        {/* Notification share Menu */}
        <Menu
          anchorEl={notiMenuAnchorEl}
          open={Boolean(notiMenuAnchorEl)}
          onClose={handleCloseNotiMenu}
          PaperProps={{
            sx: {
              bgcolor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
              border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
              borderRadius: '12px',
              minWidth: '200px',
              py: 0.5,
            }
          }}
        >
          <Box sx={{ px: 2, py: 0.75, opacity: 0.6, fontSize: '0.65rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Send Task Reminder
          </Box>
          <MenuItem onClick={() => handleSendTaskNotification(null)} sx={{ fontSize: '0.8rem', fontWeight: 600, py: 1 }}>
            <PersonIcon sx={{ fontSize: '1rem', mr: 1 }} /> Send to Myself
          </MenuItem>
          {user?.sharedWith && user.sharedWith.length > 0 && [
            <Divider key="task-noti-divider" sx={{ my: 0.5 }} />,
            <Box key="task-noti-label" sx={{ px: 2, py: 0.75, opacity: 0.6, fontSize: '0.65rem', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Shared Users
            </Box>,
            ...user.sharedWith.map((su) => (
              <MenuItem key={su.uid} onClick={() => handleSendTaskNotification(su.uid)} sx={{ fontSize: '0.8rem', fontWeight: 600, py: 1 }}>
                <PersonIcon sx={{ fontSize: '1rem', mr: 1 }} /> Send to {su.displayName}
              </MenuItem>
            ))
          ]}
        </Menu>
      </CardContent>
    </Card>

    {/* ── DEV: cache status overlay (remove when no longer needed) ── */}
    <TodoCacheDebugOverlay />
  </>
  );
};

export default ImportantTasks;
