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
  MobileStepper,
  Skeleton,
  CircularProgress,
  Fade,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Event,
  CheckCircleOutline,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import moment from 'moment';
import { updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { Todo } from '@/app/lib/interface';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const ImportantTasks = () => {
  const theme = useTheme();
  const { todos, loading, updateStepStatus } = useTodoContext();
  const [activeStep, setActiveStep] = useState(0);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<Todo | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [fadeOutId, setFadeOutId] = useState<string | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false);

  const PRIORITY_ORDER = { critical: 0, urgent: 1, routine: 2 };
  const PRIORITY_COLOR = {
    critical: 'text-red-600',
    urgent: 'text-yellow-600',
    routine: 'text-green-600',
  };

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
        : new Date(task.dueDate)
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

  const currentTask = filteredTasks[activeStep];
  if (!currentTask) return null;

  return (
    <Box className="p-4">
      <Typography variant="subtitle1" fontWeight="bold" className="mb-3">
        🚀 On Going Plans
      </Typography>

      {/* Single Task Card Displayed */}
      <Fade in={fadeOutId !== currentTask.id} timeout={400}>
        <Card className="rounded-xl shadow-sm mb-2 hover:shadow-md transition">
          <CardContent>
            <Box className="flex justify-between mb-2">
              <Typography variant="subtitle1" fontWeight="medium">
                {currentTask?.title}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Reschedule">
                  <IconButton
                    size="small"
                    onClick={() => handleReschedule(currentTask)}
                  >
                    <Event fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Mark as done">
                  <IconButton
                    size="small"
                    disabled={completingId === currentTask.id}
                    onClick={() => markCompleted(currentTask)}
                  >
                    {completingId === currentTask.id ? (
                      <CircularProgress size={18} />
                    ) : (
                      <CheckCircleOutline fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>

            {/* Meta Info */}
            <Stack direction="row" spacing={1} mb={2} pl={1} flexWrap="wrap">
              <Box className="text-xs text-gray-500">
                Due: {moment(currentTask.dueDate).format('MMM D')}
              </Box>

              <Box
                className={`text-xs font-bold ${
                  PRIORITY_COLOR[currentTask.priority]
                }`}
              >
                {currentTask.priority.toUpperCase()}
              </Box>
              <Box className="text-xs text-sky-600">{currentTask.status}</Box>
            </Stack>

            {/* Steps */}
            <Box className="pl-2">
              {currentTask.steps?.map((step, idx) => (
                <Box key={idx} className="flex items-start gap-2 my-1">
                  <IconButton
                    size="small"
                    onClick={() => toggleStepStatus(currentTask, idx)}
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
            </Box>
          </CardContent>
        </Card>
      </Fade>

      {/* Stepper Controls */}
      <MobileStepper
        variant="progress"
        steps={filteredTasks.length}
        position="static"
        activeStep={activeStep}
        nextButton={
          <Button
            size="small"
            onClick={() => setActiveStep((prev) => prev + 1)}
            disabled={activeStep === filteredTasks.length - 1}
          >
            Next
            {theme.direction === 'rtl' ? (
              <KeyboardArrowLeft />
            ) : (
              <KeyboardArrowRight />
            )}
          </Button>
        }
        backButton={
          <Button
            size="small"
            onClick={() => setActiveStep((prev) => prev - 1)}
            disabled={activeStep === 0}
          >
            {theme.direction === 'rtl' ? (
              <KeyboardArrowRight />
            ) : (
              <KeyboardArrowLeft />
            )}
            Back
          </Button>
        }
      />

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
