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
  CircularProgress,
  Fade,
} from '@mui/material';
import {
  Done,
  Event,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { useEffect, useState, useCallback } from 'react';
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

export default function OverdueTasks() {
  const { user } = useAuth();
  const customTheme = useCustomTheme();
  const theme = customTheme?.theme;
  const muiTheme = useMuiTheme();

  const [tasks, setTasks] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [fadeOutId, setFadeOutId] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<Todo | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false);

  const [activeStep, setActiveStep] = useState(0);
  const maxSteps = Math.min(tasks.length, 6);

  const fetchTasks = useCallback(async () => {
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
        .slice(0, 6);

      setTasks(filtered);
    } catch (err) {
      console.error('❌ Failed to fetch overdue tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markCompleted = async (task: Todo) => {
    if (!task.id) return;

    setCompletingId(task.id);

    try {
      await updateDoc(doc(db, 'todos', task.id), {
        status: 'completed',
        progressPercent: 100,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      // Trigger fade out animation
      setFadeOutId(task.id);
      setTimeout(() => {
        setTasks((prev) => {
          const updated = prev.filter((t) => t.id !== task.id);
          if (activeStep >= updated.length) {
            setActiveStep(Math.max(updated.length - 1, 0));
          }
          return updated;
        });
        setFadeOutId(null);
      }, 400); // fade duration in ms
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
    setReschedulingLoading(true);
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
    } finally {
      setReschedulingLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const activeTask = tasks[activeStep];

  return (
    <Box mt={4} className="px-4">
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
        <Box className="p-4">
          <Typography variant="subtitle1" fontWeight="bold" className="mb-3">
            ⏰ Overdue Tasks
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
      ) : tasks.length > 0 ? (
        <>
          <Fade in={fadeOutId !== activeTask.id} timeout={400}>
            <Card className="rounded-xl shadow-md transition mb-4">
              <CardContent>
                <Box className="flex justify-between items-start mb-2">
                  <Link href={`/to-do/${activeTask.id}`} passHref>
                    <Typography
                      variant="subtitle1"
                      fontWeight="bold"
                      className="underline cursor-pointer"
                      sx={{
                        color:
                          theme?.mode === 'dark'
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
                                : theme?.mode === 'dark'
                                ? '#cbd5e1'
                                : 'gray',
                          }}
                        >
                          {completingId === activeTask.id ? (
                            <CircularProgress size={20} />
                          ) : (
                            <Done />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Box>

                <Box className="flex flex-wrap gap-2 mt-1 text-xs">
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">
                    {activeTask.status}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 capitalize">
                    {activeTask.priority}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                    Due:{' '}
                    {moment(
                      (activeTask.dueDate as Timestamp)?.toDate?.() ||
                        activeTask.dueDate
                    ).format('MMM D')}
                  </span>
                </Box>
              </CardContent>
            </Card>
          </Fade>

          <MobileStepper
            variant="dots"
            steps={maxSteps}
            position="static"
            activeStep={activeStep}
            nextButton={
              <Button
                size="small"
                onClick={() =>
                  setActiveStep((p) => Math.min(p + 1, maxSteps - 1))
                }
                disabled={activeStep === maxSteps - 1}
              >
                Next{' '}
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
                onClick={() => setActiveStep((p) => Math.max(p - 1, 0))}
                disabled={activeStep === 0}
              >
                {muiTheme.direction === 'rtl' ? (
                  <KeyboardArrowRight />
                ) : (
                  <KeyboardArrowLeft />
                )}{' '}
                Back
              </Button>
            }
          />
        </>
      ) : (
        !loading && (
          <Typography variant="body2" color="text.secondary"></Typography>
        )
      )}

      {/* Reschedule Modal */}
      <Modal open={rescheduleOpen} onClose={() => setRescheduleOpen(false)}>
        <Box
          className="absolute rounded-lg p-6 shadow-lg"
          sx={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: 320,
            outline: 'none',
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
            border:
              theme?.mode === 'dark'
                ? '1px solid #334155'
                : '1px solid #e5e7eb',
          }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
            }}
          >
            Reschedule Task
          </Typography>
          <TextField
            fullWidth
            label="Task Title"
            value={rescheduleTask?.title || ''}
            InputProps={{ readOnly: true }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                '& fieldset': {
                  borderColor: theme?.mode === 'dark' ? '#475569' : '#d1d5db',
                },
                '&:hover fieldset': {
                  borderColor: theme?.mode === 'dark' ? '#64748b' : '#9ca3af',
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme?.mode === 'dark' ? '#64748b' : '#3b82f6',
                },
              },
              '& .MuiInputLabel-root': {
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                '&.Mui-focused': {
                  color: theme?.mode === 'dark' ? '#cbd5e1' : '#3b82f6',
                },
              },
            }}
          />
          <Typography
            variant="body2"
            gutterBottom
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
            }}
          >
            New Due Date
          </Typography>
          <Box
            sx={{
              mb: 2,
              '& .react-datepicker-wrapper': { width: '100%' },
              '& .react-datepicker__input-container input': {
                width: '100%',
                padding: '12px',
                border:
                  theme?.mode === 'dark'
                    ? '2px solid #475569'
                    : '2px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                '&:focus': {
                  borderColor: theme?.mode === 'dark' ? '#64748b' : '#3b82f6',
                  outline: 'none',
                },
                '&::placeholder': {
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#666666',
                },
              },
            }}
          >
            <DatePicker
              selected={newDueDate}
              onChange={(date: Date | null) => setNewDueDate(date)}
              dateFormat="yyyy-MM-dd"
              className="w-full"
              placeholderText="Select new date"
            />
          </Box>
          <Stack direction="row" justifyContent="flex-end" mt={3} spacing={2}>
            <Button
              onClick={() => setRescheduleOpen(false)}
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                '&:hover': {
                  backgroundColor:
                    theme?.mode === 'dark' ? '#475569' : '#f3f4f6',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={updateDueDate}
              variant="contained"
              color="primary"
              disabled={!newDueDate || reschedulingLoading}
              sx={{
                backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#1976d2',
                '&:hover': {
                  backgroundColor:
                    theme?.mode === 'dark' ? '#2563eb' : '#1565c0',
                },
                '&:disabled': {
                  backgroundColor:
                    theme?.mode === 'dark' ? '#475569' : '#e5e7eb',
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#9ca3af',
                },
              }}
            >
              {reschedulingLoading ? (
                <CircularProgress size={20} sx={{ color: 'white' }} />
              ) : (
                'Save'
              )}
            </Button>
          </Stack>
        </Box>
      </Modal>
    </Box>
  );
}
