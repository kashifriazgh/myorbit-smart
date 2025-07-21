'use client';

import {
  Box,
  IconButton,
  Stack,
  Typography,
  Tooltip,
  Skeleton,
  useTheme as useMuiTheme,
  Modal,
  TextField,
  Button,
  Card,
  CardContent,
  MobileStepper,
} from '@mui/material';
import {
  Done,
  DoneAll,
  Event,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import moment from 'moment-timezone';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Todo } from '@/app/lib/interface';
import Link from 'next/link';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface ColorMapEntry {
  bg: string;
  color: string;
}
export default function OverdueTasks() {
  const { user } = useAuth();
  const customTheme = useCustomTheme();
  const theme = customTheme?.theme;

  const muiTheme = useMuiTheme();

  const [tasks, setTasks] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<Todo | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);

  const [activeStep, setActiveStep] = useState(0);
  const maxSteps = Math.min(tasks.length, 6); // Show max 6 steps

  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'todos'));
      const now = moment().tz('Asia/Karachi').startOf('day');

      const filtered = snap.docs
        .map((doc) => ({ ...doc.data(), id: doc.id } as Todo))
        .filter((t) => {
          const due = moment(
            (t.dueDate as Timestamp)?.toDate?.() || t.dueDate
          ).startOf('day');
          return (
            t.authorId === user.uid &&
            t.status !== 'completed' &&
            due.isBefore(now, 'day')
          );
        })
        .sort(
          (a, b) =>
            moment(a.dueDate as Timestamp).valueOf() -
            moment(b.dueDate as Timestamp).valueOf()
        )
        .slice(0, 6); // Show only max 6

      setTasks(filtered);
    } catch (err) {
      console.error('❌ Failed to fetch overdue tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const markCompleted = async (task: Todo) => {
    if (!task.id) return;

    // 1️⃣ Immediately remove from state
    setTasks((prev) => {
      const updated = prev.filter((t) => t.id !== task.id);
      if (activeStep >= updated.length) {
        setActiveStep(Math.max(updated.length - 1, 0));
      }
      return updated;
    });

    try {
      setCompletingId(task.id);

      // 2️⃣ Firestore update in background
      await updateDoc(doc(db, 'todos', task.id), {
        status: 'completed',
        progressPercent: 100,
        completedAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('❌ Error updating task:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const handleReschedule = (task: Todo) => {
    setRescheduleTask(task);
    const date =
      task.dueDate instanceof Timestamp
        ? task.dueDate.toDate()
        : new Date(task.dueDate as Date);
    setNewDueDate(date);
    setRescheduleOpen(true);
  };

  const updateDueDate = async () => {
    if (!rescheduleTask || !rescheduleTask.id || !newDueDate) return;
    try {
      await updateDoc(doc(db, 'todos', rescheduleTask.id), {
        dueDate: Timestamp.fromDate(newDueDate),
        updatedAt: new Date(),
      });
      setRescheduleOpen(false);
      setRescheduleTask(null);
      await fetchTasks();
    } catch (err) {
      console.error('❌ Failed to reschedule:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const getColor = (key: string, value: string) => {
    const isDark = theme.mode === 'dark';
    const map: Record<string, ColorMapEntry> = {
      status: {
        bg: isDark ? '#7f1d1d' : '#fee2e2',
        color: isDark ? '#fca5a5' : '#b91c1c',
      },
      critical: {
        bg: isDark ? '#7f1d1d' : '#fecaca',
        color: isDark ? '#fca5a5' : '#dc2626',
      },
      urgent: {
        bg: isDark ? '#78350f' : '#fde68a',
        color: isDark ? '#fcd34d' : '#92400e',
      },
      normal: {
        bg: isDark ? '#064e3b' : '#d1fae5',
        color: isDark ? '#86efac' : '#166534',
      },
      due: {
        bg: isDark ? '#78350f' : '#fef9c3',
        color: isDark ? '#fde68a' : '#92400e',
      },
    };
    return map[value] || map[key];
  };

  const TaskSkeleton = () => (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: `2px dashed ${muiTheme.palette.divider}`,
        mb: 2,
      }}
    >
      <Skeleton height={20} width="60%" sx={{ mb: 1 }} />
      <Skeleton height={16} width="40%" />
    </Box>
  );

  const handleNext = () => {
    setActiveStep((prev) => Math.min(prev + 1, maxSteps - 1));
  };

  const handleBack = () => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const activeTask = tasks[activeStep];
  if (!theme) return null;

  return (
    <Box mt={4} className="px-4">
      {!loading && tasks.length > 0 && (
        <Typography
          fontWeight={700}
          fontSize={17}
          mb={2}
          color={theme.mode === 'dark' ? '#f87171' : '#b91c1c'}
        >
          ⏰ Overdue Tasks – Take Action!
        </Typography>
      )}

      {loading ? (
        [1, 2, 3].map((i) => <TaskSkeleton key={i} />)
      ) : tasks.length > 0 ? (
        <>
          <Card className="rounded-xl shadow-sm hover:shadow-md transition mb-4">
            <CardContent>
              <Box className="flex justify-between items-start mb-2">
                <Link href={`/to-do/${activeTask.id}`} passHref>
                  <Typography
                    variant="subtitle1"
                    fontWeight="bold"
                    sx={{
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      color:
                        theme.mode === 'dark'
                          ? '#fca5a5'
                          : muiTheme.palette.error.main,
                    }}
                  >
                    {activeTask.title}
                  </Typography>
                </Link>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Reschedule">
                    <IconButton
                      size="small"
                      onClick={() => handleReschedule(activeTask)}
                    >
                      <Event sx={{ color: '#f59e0b' }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Mark as Done">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => markCompleted(activeTask)}
                        disabled={completingId === activeTask.id}
                        sx={{
                          color:
                            completingId === activeTask.id
                              ? 'gray'
                              : theme.mode === 'dark'
                              ? '#cbd5e1'
                              : 'gray',
                        }}
                      >
                        {completingId === activeTask.id ? (
                          <DoneAll sx={{ color: 'green' }} />
                        ) : (
                          <Done />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Box>

              <Box className="flex flex-wrap gap-2 mt-1">
                <Box
                  className="text-xs px-2 py-0.5 rounded"
                  sx={getColor('status', 'status')}
                >
                  {activeTask.status}
                </Box>
                <Box
                  className="text-xs px-2 py-0.5 rounded capitalize"
                  sx={getColor('status', activeTask.priority)}
                >
                  {activeTask.priority}
                </Box>
                <Box
                  className="text-xs px-2 py-0.5 rounded"
                  sx={getColor('due', 'due')}
                >
                  Due:{' '}
                  {moment(
                    (activeTask.dueDate as Timestamp)?.toDate?.() ||
                      activeTask.dueDate
                  ).format('MMM D')}
                </Box>
              </Box>
            </CardContent>
          </Card>

          <MobileStepper
            variant="dots"
            steps={maxSteps}
            position="static"
            activeStep={activeStep}
            nextButton={
              <Button
                size="small"
                onClick={handleNext}
                disabled={activeStep === maxSteps - 1}
              >
                Next
                {muiTheme.direction === 'rtl' ? (
                  <KeyboardArrowLeft />
                ) : (
                  <KeyboardArrowRight />
                )}
              </Button>
            }
            backButton={
              <Button
                size="small"
                onClick={handleBack}
                disabled={activeStep === 0}
              >
                {muiTheme.direction === 'rtl' ? (
                  <KeyboardArrowRight />
                ) : (
                  <KeyboardArrowLeft />
                )}
                Back
              </Button>
            }
          />
        </>
      ) : (
        !loading && (
          <Typography variant="body2" color="text.secondary">
            No overdue tasks found.
          </Typography>
        )
      )}

      <Modal open={rescheduleOpen} onClose={() => setRescheduleOpen(false)}>
        <Box
          className="absolute bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg"
          sx={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: 320,
            outline: 'none',
          }}
        >
          <Typography variant="h6" gutterBottom>
            Reschedule Task
          </Typography>
          <TextField
            fullWidth
            label="Task Title"
            value={rescheduleTask?.title || ''}
            InputProps={{ readOnly: true }}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" gutterBottom>
            New Due Date
          </Typography>
          <DatePicker
            selected={newDueDate}
            onChange={(date: Date | null) => setNewDueDate(date)}
            dateFormat="yyyy-MM-dd"
            className="border px-3 py-2 rounded-md w-full"
            placeholderText="Select new date"
          />
          <Stack direction="row" justifyContent="flex-end" mt={3} spacing={2}>
            <Button onClick={() => setRescheduleOpen(false)}>Cancel</Button>
            <Button
              onClick={updateDueDate}
              variant="contained"
              color="primary"
              disabled={!newDueDate}
            >
              Save
            </Button>
          </Stack>
        </Box>
      </Modal>
    </Box>
  );
}
