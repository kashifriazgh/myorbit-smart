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
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  TaskAlt,
  Event,
  CheckCircleOutline,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import moment from 'moment';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { Todo } from '@/app/lib/interface';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const ImportantTasks = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<Todo | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const PRIORITY_ORDER = { critical: 0, urgent: 1, routine: 2 };
  const PRIORITY_COLOR = {
    critical: 'text-red-600',
    urgent: 'text-yellow-600',
    routine: 'text-green-600',
  };

  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const snap = await getDocs(collection(db, 'todos'));

      const today = moment().startOf('day');
      const rangeEnd = moment().add(2, 'days').endOf('day');

      const rawTodos = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          ...(data as Todo),
          id: doc.id,
          dueDate:
            data.dueDate instanceof Timestamp
              ? data.dueDate.toDate()
              : new Date(data.dueDate),
        };
      }) as Todo[];

      const filtered = rawTodos
        .filter((t) => {
          const due = moment(t.dueDate);
          return (
            t.authorId === user.uid &&
            t.status !== 'completed' &&
            due.isBetween(today, rangeEnd, 'day', '[]')
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

      setTasks(filtered.slice(0, 6)); // ✅ sets full Todo[]
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const markCompleted = async (task: Todo) => {
    if (!task.id) return;

    // 👇 1. Optimistically remove from local state
    setTasks((prev) => {
      const updated = prev.filter((t) => t.id !== task.id);
      if (activeStep >= updated.length) {
        setActiveStep(Math.max(updated.length - 1, 0));
      }
      return updated;
    });

    try {
      // 👇 2. Firestore update in background
      setCompletingId(task.id);
      await updateDoc(doc(db, 'todos', task.id), {
        status: 'completed',
        progressPercent: 100,
        completedAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setCompletingId(null);
      // 👇 Optional: Re-sync in background
      // fetchTasks();
    }
  };

  const updateTaskInState = (updatedTask: Todo) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === updatedTask.id ? updatedTask : task))
    );
  };

  const toggleStepStatus = async (task: Todo, stepIndex: number) => {
    if (!task.id || !task.steps) return;
    const updatedSteps = [...task.steps];
    updatedSteps[stepIndex].done = !updatedSteps[stepIndex].done;
    const updatedTask = { ...task, steps: updatedSteps };
    updateTaskInState(updatedTask);

    try {
      await updateDoc(doc(db, 'todos', task.id), {
        steps: updatedSteps,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('Failed to update steps:', err);
    }
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
    await updateDoc(doc(db, 'todos', rescheduleTask.id), {
      dueDate: Timestamp.fromDate(newDueDate),
      updatedAt: new Date(),
    });
    setRescheduleOpen(false);
    setRescheduleTask(null);
    fetchTasks();
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  if (loading || tasks.length === 0) return null;

  const currentTask = tasks[activeStep];
  if (!currentTask) return null;

  return (
    <Box className="p-4">
      <Typography variant="subtitle1" fontWeight="bold" className="mb-3">
        🚀 On Going Plans
      </Typography>

      {/* Single Task Card Displayed */}
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
                    <TaskAlt fontSize="small" className="text-green-600" />
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
                  {step.done ? (
                    <CheckCircle className="text-green-500" fontSize="small" />
                  ) : (
                    <RadioButtonUnchecked
                      className="text-gray-400"
                      fontSize="small"
                    />
                  )}
                </IconButton>
                <Typography
                  variant="body2"
                  className={step.done ? 'line-through text-gray-400' : ''}
                >
                  {step.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Stepper Controls */}
      <MobileStepper
        variant="progress"
        steps={tasks.length}
        position="static"
        activeStep={activeStep}
        nextButton={
          <Button
            size="small"
            onClick={() => setActiveStep((prev) => prev + 1)}
            disabled={activeStep === tasks.length - 1}
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
              disabled={!newDueDate}
            >
              Save
            </Button>
          </Stack>
        </Box>
      </Modal>
    </Box>
  );
};

export default ImportantTasks;
