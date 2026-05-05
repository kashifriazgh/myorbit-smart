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
  Button,
  Card,
  CardContent,
  MobileStepper,
  CircularProgress,
  Fade,
  Chip,
  Divider,
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
        .map((doc) => ({ ...doc.data(), id: doc.id }) as Todo)
        .filter((t) => {
          const due = moment(
            (t.dueDate as Timestamp)?.toDate?.() || t.dueDate,
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
            moment(b.dueDate as Timestamp).valueOf(),
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
                  <Chip
                    label={activeTask.status}
                    size="small"
                    sx={{ bgcolor: 'transparent', border: 'none', px: 0 }}
                  />
                  <Chip
                    label={activeTask.priority}
                    size="small"
                    sx={{
                      bgcolor: 'transparent',
                      border: 'none',
                      px: 0,
                      textTransform: 'capitalize',
                    }}
                  />
                  <Chip
                    label={`Due: ${moment(
                      (activeTask.dueDate as Timestamp)?.toDate?.() ||
                        activeTask.dueDate,
                    ).format('MMM D')}`}
                    size="small"
                    variant="outlined"
                  />
                  {/* Show overall task assignee */}
                  {activeTask.assignee && (
                    <Chip
                      size="small"
                      label={activeTask.assignee}
                      variant="outlined"
                    />
                  )}
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
    </Box>
  );
}
