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
} from '@mui/icons-material';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import moment from 'moment';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { Todo } from '@/app/lib/interface';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ToDoModal from '@/app/components/to-do/todoModal';

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

const ImportantTasks = () => {
  const { todos, loading, updateStepStatus } = useTodoContext();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<Todo | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [fadeOutId, setFadeOutId] = useState<string | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false);
  const [todoModalOpen, setTodoModalOpen] = useState(false);

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

  // Filter and sort todos for display based on selectedDate (today + next 4 days)
  const filteredTasks = useMemo(() => {
    if (!selectedDate) return [] as Todo[];
    const selectedStart = moment(selectedDate).startOf('day');
    const selectedEnd = moment(selectedDate).endOf('day');

    const todayStr = moment().format('YYYY-MM-DD');

    return todos
      .filter((t) => {
        if (t.status === 'completed') return false;
        if (t.isFlexible && selectedDate === todayStr) return true;
        
        if (!t.dueDate) return false;
        const due = moment(t.dueDate);
        return due.isBetween(selectedStart, selectedEnd, 'day', '[]');
      })
      .sort((a, b) => {
        const dueA = moment(a.dueDate);
        const dueB = moment(b.dueDate);
        return (
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          dueA.diff(dueB)
        );
      });
  }, [todos, selectedDate]);

  const markCompleted = async (task: Todo) => {
    if (!task.id) return;
    setCompletingId(task.id);
    try {
      await updateDoc(doc(db, 'todos', task.id), {
        status: 'completed',
        updatedAt: new Date(),
      });
      setFadeOutId(task.id);
      setTimeout(() => {
        setFadeOutId(null);
        setCompletingId(null);
      }, 400);
    } catch (err) {
      console.error('Failed to mark as completed:', err);
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
      await updateDoc(doc(db, 'todos', rescheduleTask.id), {
        dueDate: Timestamp.fromDate(newDueDate),
        isFlexible: false, // Turn off flexible if date is set
        updatedAt: new Date(),
      });
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
      await updateDoc(doc(db, 'todos', task.id), {
        workStarted: !task.workStarted,
        updatedAt: new Date(),
      });
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

  if (loading) {
    return (
      <Box className="p-4">
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
        <Card className="rounded-xl shadow-sm mb-2">
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
      </Box>
    );
  }

  
  return (
    <Box className="p-4">
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

      {/* Date Picker (cloned from Schedules) - Always visible with professional light blue theme */}
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
                    backgroundColor: isSelected ? '#bae6fd' : '#e0f2fe', // selected: sky-200, default: sky-100
                    border: `1px solid ${isSelected ? '#7dd3fc' : '#bae6fd'}`, // subtle border
                    boxShadow: isSelected ? 'inset 0 0 0 1px #38bdf8' : 'none',
                    '&:hover': {
                      backgroundColor: isSelected ? '#7dd3fc' : '#bae6fd', // hover: sky-300/200
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
        </Box>
      ) : (
        <Stack spacing={2}>
          {filteredTasks.slice(0, 5).map((task) => (
            <Fade in={fadeOutId !== task.id} timeout={400} key={task.id}>
              <Card className="rounded-xl shadow-sm hover:shadow-md transition">
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
                      <Link href={`/to-do/${task.id}`}>
                        <Typography variant="subtitle1" fontWeight="medium">
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
    </Box>
  );
};

export default ImportantTasks;
