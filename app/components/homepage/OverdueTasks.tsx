'use client';

import {
  Box,
  IconButton,
  Stack,
  Typography,
  Skeleton,
  Modal,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Fade,
  Chip,
  Divider,
  Collapse,
} from '@mui/material';
import {
  Event,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { useState, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import moment from 'moment-timezone';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Todo } from '@/app/lib/interface';
import Link from 'next/link';
import { deleteTodoReminder, rescheduleTodoReminder } from '@/app/lib/utils/whatsapp-reminder';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { incrementTodoRescheduleCount } from '@/app/lib/utilts';
import { useTodoContext } from '@/app/lib/context/todoContext';
import ReminderSendButton from '@/app/components/global/ReminderSendButton';

// Converts a Firestore Timestamp or plain Date to a JS Date
function toPlainDate(v: Date | { toDate: () => Date } | null | undefined): Date | null {
  if (!v) return null;
  if (typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  return v as Date;
}

// Custom CheckIcon SVG for todo cards
const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    style={{ width: '16px', height: '16px' }}
    stroke="white"
    strokeWidth="3"
  >
    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CARD_STYLE = {
  border: 'border-slate-200/80 dark:border-slate-800/80',
  bg: 'bg-slate-50/50 dark:bg-slate-900/15',
  checkBorder: 'border-slate-300 dark:border-slate-700',
  checkBorderHover: 'hover:border-indigo-400 dark:hover:border-indigo-500',
  checkedBg: 'bg-indigo-500 dark:bg-indigo-600',
};

const TodoCardItem = ({
  task,
  theme,
  completingId,
  expanded,
  toggleExpanded,
  handleReschedule,
  toggleStepStatus,
  markCompleted,
}: {
  task: Todo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: any;
  completingId: string | null;
  expanded: Set<string>;
  toggleExpanded: (taskId?: string) => void;
  handleReschedule: (task: Todo) => void;
  toggleStepStatus: (task: Todo, stepIndex: number) => void;
  markCompleted: (task: Todo) => void;
}) => {
  const isDone = task.status === 'completed';
  const cardStyle = CARD_STYLE;

  return (
    <Box sx={{ width: '100%', mb: 1.5 }}>
      <Box
        className={`flex min-h-[68px] items-center gap-3 rounded-xl border ${cardStyle.border} ${cardStyle.bg} px-3 py-2.5`}
        sx={{
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: theme?.mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.03)',
          },
        }}
      >
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => markCompleted(task)}
          disabled={completingId === task.id}
          aria-pressed={isDone}
          aria-label={`Mark ${task.title} as done`}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition ${
            isDone
              ? `${cardStyle.checkedBg} border-transparent`
              : `${theme?.mode === 'dark' ? 'bg-slate-800' : 'bg-white'} ${cardStyle.checkBorder} ${cardStyle.checkBorderHover}`
          }`}
        >
          {completingId === task.id ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            isDone && <CheckIcon />
          )}
        </button>

        {/* Content */}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

            <Link href={`/to-do/${task.id}`} style={{ textDecoration: 'none', minWidth: 0 }}>
              <Typography
                variant="body2"
                className={`font-semibold ${
                  isDone
                    ? 'text-slate-400 dark:text-slate-500 line-through'
                    : theme?.mode === 'dark' ? 'text-slate-200' : 'text-slate-800'
                }`}
                sx={{
                  fontSize: '15px',
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
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
            {task.dueDate && (
              <Chip
                label={`Overdue: ${moment(task.dueDate).format('MMM D')}`}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '9px',
                  fontWeight: 800,
                  backgroundColor: '#ef4444',
                  color: 'white',
                }}
              />
            )}
            
            <Chip
              label={task.priority.toUpperCase()}
              size="small"
              sx={{
                height: 18,
                fontSize: '9px',
                fontWeight: 800,
                backgroundColor:
                  task.priority === 'critical' ? '#ef4444'
                  : task.priority === 'urgent' ? '#f59e0b'
                  : '#10b981',
                color: 'white',
              }}
            />

            {task.assignee && (
              <Chip
                label={task.assignee}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '9px',
                  fontWeight: 700,
                  backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#eff6ff',
                  color: theme?.mode === 'dark' ? '#38bdf8' : '#1d4ed8',
                }}
              />
            )}
          </Box>
        </Box>

        {/* Actions on the right */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, shrink: 0, ml: 'auto' }}>
          {task.steps && task.steps.length > 0 && (
            <IconButton
              size="small"
              onClick={() => toggleExpanded(task.id)}
              sx={{
                p: 0.5,
                color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
                '&:hover': { color: '#6366f1' },
              }}
              title={expanded.has(task.id!) ? 'Hide steps' : 'Show steps'}
            >
              {expanded.has(task.id!) ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          )}



          <IconButton
            size="small"
            onClick={() => handleReschedule(task)}
            sx={{
              p: 0.5,
              color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
              '&:hover': { color: '#f59e0b' },
            }}
            title="Reschedule"
          >
            <Event fontSize="small" />
          </IconButton>

          <ReminderSendButton
            itemId={task.id!}
            itemTitle={task.title}
            itemType="task"
            customItemTypeName="Overdue task"
            itemDetailUrl={`/to-do/${task.id}`}
            buttonType="icon"
            iconSize="small"
            itemDateTime={task.dueDate ? toPlainDate(task.dueDate) : null}
            buttonSx={{
              p: 0.5,
              color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
              '&:hover': { color: '#6366f1' },
            }}
          />
        </Box>
      </Box>

      {/* Steps (collapsible) */}
      <Collapse in={expanded.has(task.id!)} timeout="auto" unmountOnExit>
        <Box className="pl-6 pr-2 py-2 mt-1 space-y-1">
          {task.steps?.map((step, idx) => {
            const stepDone = step.status === 'completed';
            return (
              <Box key={idx} className="flex items-center gap-2 py-1">
                <button
                  type="button"
                  onClick={() => toggleStepStatus(task, idx)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                    stepDone
                      ? 'bg-green-500 border-transparent text-white'
                      : `${theme?.mode === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'} hover:border-green-400`
                  }`}
                >
                  {stepDone && (
                    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="4">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <Typography
                  variant="caption"
                  className={`truncate ${
                    stepDone
                      ? 'text-slate-400 dark:text-slate-500 line-through'
                      : theme?.mode === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}
                  sx={{ fontSize: '12px', fontWeight: 500 }}
                >
                  {step.text}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
};

export default function OverdueTasks() {
  const { user } = useAuth();
  const customTheme = useCustomTheme();
  const theme = customTheme?.theme;

  const { todos, loading, updateTodo, updateStepStatus } = useTodoContext();

  const [completingId, setCompletingId] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<Todo | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Filter tasks from Context: overdue only
  const tasks = useMemo(() => {
    if (!user) return [];
    const now = moment().tz('Asia/Karachi').startOf('day');

    return todos
      .filter((t) => {
        if (!t.dueDate) return false;
        const due = moment(t.dueDate).startOf('day');
        return (
          t.authorId === user.uid &&
          t.status !== 'completed' &&
          due.isBefore(now, 'day')
        );
      })
      .sort((a, b) => {
        const timeA = toPlainDate(a.dueDate)?.getTime() ?? 0;
        const timeB = toPlainDate(b.dueDate)?.getTime() ?? 0;
        return timeA - timeB;
      })
      .slice(0, 6);
  }, [todos, user]);

  const markCompleted = async (task: Todo) => {
    if (!task.id) return;
    setCompletingId(task.id);

    try {
      await updateTodo(task.id, {
        status: 'completed',
        progressPercent: 100,
        completedAt: new Date(),
      });

      await deleteTodoReminder(task.id).catch((e) => console.error(e));
    } catch (err) {
      console.error('❌ Error updating task:', err);
    } finally {
      setCompletingId(null);
    }
  };



  const toggleStepStatus = async (task: Todo, stepIndex: number) => {
    if (!task.id) return;

    const currentStep = task.steps?.[stepIndex];
    if (!currentStep) return;

    const newStatus =
      currentStep.status === 'completed' ? 'in_progress' : 'completed';
    await updateStepStatus(task.id, stepIndex, newStatus);
  };

  const toggleExpanded = (taskId?: string) => {
    if (!taskId) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleReschedule = (task: Todo) => {
    setRescheduleTask(task);
    const date = toPlainDate(task.dueDate) ?? new Date();
    setNewDueDate(date);
    setRescheduleOpen(true);
  };

  const updateDueDate = async () => {
    if (!rescheduleTask || !rescheduleTask.id || !newDueDate) return;
    setReschedulingLoading(true);
    try {
      const oldDate = toPlainDate(rescheduleTask.dueDate);
      const isDateChanged = oldDate ? !moment(oldDate).isSame(newDueDate, 'day') : true;

      await updateTodo(rescheduleTask.id, {
        dueDate: Timestamp.fromDate(newDueDate),
      });

      if (isDateChanged) {
        await incrementTodoRescheduleCount(rescheduleTask.id).catch((e) => console.error(e));
      }

      if (user) {
        await rescheduleTodoReminder(rescheduleTask.id, newDueDate, user.uid).catch((e) => console.error(e));
      }

      setRescheduleOpen(false);
      setRescheduleTask(null);
    } catch (err) {
      console.error('❌ Failed to reschedule:', err);
    } finally {
      setReschedulingLoading(false);
    }
  };

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
        {!loading && tasks.length > 0 && (
          <Typography
            fontWeight={700}
            fontSize={17}
            mb={2}
            color={theme?.mode === 'dark' ? '#f87171' : '#b91c1c'}
          >
            ⏰ Overdue Tasks – Take Action!
          </Typography>
        )}

        {loading ? (
          <Box className="p-2">
            {[...Array(3)].map((_, idx) => (
              <Box key={idx} mb={2}>
                <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
              </Box>
            ))}
          </Box>
        ) : tasks.length > 0 ? (
          <Stack spacing={1}>
            {tasks.map((task) => (
              <TodoCardItem
                key={task.id}
                task={task}
                theme={theme}
                completingId={completingId}
                expanded={expanded}
                toggleExpanded={toggleExpanded}
                handleReschedule={handleReschedule}
                toggleStepStatus={toggleStepStatus}
                markCompleted={markCompleted}
              />
            ))}
          </Stack>
        ) : (
          !loading && (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={4} textAlign="center">
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                No overdue tasks. Great job! 🎉
              </Typography>
            </Box>
          )
        )}

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
              <Box className="p-6 bg-gradient-to-br from-amber-400 to-orange-600 text-white">
                <Typography variant="h6" className="font-extrabold">
                  Reschedule Task
                </Typography>
                <Typography variant="body2" className="opacity-90">
                  Give this overdue task a new deadline
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
                                    ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-400' 
                                    : 'bg-slate-50 dark:bg-slate-800/50 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
                                  }`}
                      >
                        <Typography className={`text-sm font-bold ${isSelected ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
                          {option.label}
                        </Typography>
                        <Typography className={`text-[10px] ${isSelected ? 'text-amber-600/70 dark:text-amber-400/70' : 'text-slate-500 dark:text-slate-400'}`}>
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
                               text-slate-900 dark:text-white font-semibold outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 transition-all"
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
                    className="rounded-2xl py-3 font-bold bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 normal-case
                               hover:from-amber-600 hover:to-orange-700 disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-800 dark:disabled:to-slate-800"
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
      </CardContent>
    </Card>
  );
}
