'use client';

import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Modal,
  TextField,
  Button,
  Stack,
  Skeleton,
  CircularProgress,
  Fade,
  Chip,
  Divider,
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
} from '@mui/icons-material';
import Link from 'next/link';
import { useState } from 'react';
import moment from 'moment';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { Todo } from '@/app/lib/interface';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const ImportantTasks = () => {
  const { todos, loading, updateStepStatus } = useTodoContext();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<Todo | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [fadeOutId, setFadeOutId] = useState<string | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false);

  const PRIORITY_ORDER = { critical: 0, urgent: 1, routine: 2 };

  // Filter and sort todos for display
  const filteredTasks = todos
    .filter((t) => {
      const due = moment(t.dueDate);
      const today = moment().startOf('day');
      const rangeEnd = moment().add(2, 'days').endOf('day');
      return (
        t.status !== 'completed' && due.isBetween(today, rangeEnd, 'day', '[]')
      );
    })
    .sort((a, b) => {
      const dueA = moment(a.dueDate);
      const dueB = moment(b.dueDate);
      return (
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        dueA.diff(dueB)
      );
    });

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
      task.dueDate instanceof Timestamp
        ? task.dueDate.toDate()
        : new Date(task.dueDate),
    );
    setRescheduleOpen(true);
  };

  const updateDueDate = async () => {
    if (!rescheduleTask?.id || !newDueDate) return;
    setReschedulingLoading(true);
    try {
      await updateDoc(doc(db, 'todos', rescheduleTask.id), {
        dueDate: Timestamp.fromDate(newDueDate),
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
        <Typography variant="subtitle1" fontWeight="bold" className="mb-3">
          🚀 On Going Plans
        </Typography>

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
      </Box>
    );
  }

  if (filteredTasks.length === 0) return null;

  return (
    <Box className="p-4">
      <Typography variant="subtitle1" fontWeight="bold" className="mb-3">
        🚀 On Going Plans
      </Typography>

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
                  <Chip
                    size="small"
                    label={`Due: ${moment(task.dueDate).format('MMM D')}`}
                    variant="outlined"
                  />
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

      <Box mt={2} display="flex" justifyContent="flex-end">
        <Link href="/to-do" style={{ textDecoration: 'none' }}>
          <Button variant="text">View more</Button>
        </Link>
      </Box>

      {/* Reschedule Modal */}
      <Modal open={rescheduleOpen} onClose={() => setRescheduleOpen(false)}>
        <Box
          sx={{
            p: 3,
            backgroundColor: 'white',
            borderRadius: 2,
            width: 300,
            mx: 'auto',
            mt: '15%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <Typography fontWeight={600} mb={2}>
            Reschedule Task
          </Typography>
          <DatePicker
            selected={newDueDate}
            onChange={(date: Date | null) => setNewDueDate(date)}
            minDate={new Date()}
            dateFormat="yyyy-MM-dd"
            customInput={
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                label="Expected Date"
              />
            }
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
            <Button onClick={() => setRescheduleOpen(false)}>Cancel</Button>
            <Button
              onClick={updateDueDate}
              variant="contained"
              disabled={!newDueDate || reschedulingLoading}
            >
              {reschedulingLoading ? (
                <CircularProgress size={18} sx={{ color: 'white' }} />
              ) : (
                'Save'
              )}
            </Button>
          </Stack>
        </Box>
      </Modal>
    </Box>
  );
};

export default ImportantTasks;
