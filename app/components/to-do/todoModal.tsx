'use client';
import {
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Typography,
  MenuItem,
  Box,
  Divider,
  useMediaQuery,
  useTheme,
  IconButton,
  Collapse,
  Fade,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
} from '@mui/icons-material';
import { useState, useRef, useEffect } from 'react';
import {
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import { PRIORITY_OPTIONS } from '@/app/lib/constant';

type Props = {
  open: boolean;
  onClose: () => void;
};

type TaskPriority = 'routine' | 'urgent' | 'critical';

import { useTodoContext } from '@/app/lib/context/todoContext';

export default function ToDoModal({ open, onClose }: Props) {
  const { user, isGuest } = useAuth();
  const { todos, addTodo } = useTodoContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [title, setTitle] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('routine');
  const [privacy, setPrivacy] = useState<'private' | 'public'>('private');
  const [dueDate, setDueDate] = useState<Date | null>(new Date());
  const [dueTime, setDueTime] = useState<string>('07:00');
  const [loading, setLoading] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [isFlexible, setIsFlexible] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseDueDateToDate = (dueDateVal: any): Date | null => {
    if (!dueDateVal) return null;
    if (dueDateVal instanceof Date) return dueDateVal;
    if (typeof dueDateVal === 'object') {
      if (typeof dueDateVal.toDate === 'function') {
        return dueDateVal.toDate();
      }
      if (dueDateVal.seconds !== undefined) {
        return new Date(dueDateVal.seconds * 1000);
      }
    }
    const d = new Date(dueDateVal);
    return isNaN(d.getTime()) ? null : d;
  };

  // Helper to find default time slots: 7 AM, 8 AM, etc. for same day tasks
  const getDefaultTimeForDate = (selectedDate: Date) => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const sameDayTasks = todos.filter((t) => {
      if (!t.dueDate) return false;
      const tDate = parseDueDateToDate(t.dueDate);
      if (!tDate) return false;
      return tDate.toISOString().split('T')[0] === dateStr;
    });

    if (sameDayTasks.length === 0) {
      return '07:00';
    }

    let maxHour = 6; // start before 7
    sameDayTasks.forEach((t) => {
      const tDate = parseDueDateToDate(t.dueDate);
      if (tDate) {
        const hour = tDate.getHours();
        if (hour > maxHour) {
          maxHour = hour;
        }
      }
    });

    const nextHour = maxHour + 1;
    const displayHour = nextHour >= 24 ? 7 : nextHour;
    return `${String(displayHour).padStart(2, '0')}:00`;
  };

  // Auto-calculate default due time when dueDate changes
  useEffect(() => {
    if (dueDate) {
      const calculated = getDefaultTimeForDate(dueDate);
      setDueTime(calculated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueDate, todos]);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Small delay to ensure Dialog transition is underway and focus trap is ready
      const timer = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const [assignee, setAssignee] = useState('Me');

  const handleQuickDate = (
    type: 'tomorrow' | 'afterTomorrow' | 'endOfWeek',
  ) => {
    const date = new Date();
    if (type === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    } else if (type === 'afterTomorrow') {
      date.setDate(date.getDate() + 2);
    } else if (type === 'endOfWeek') {
      const day = date.getDay();
      const diff = day === 0 ? 7 : 7 - day;
      date.setDate(date.getDate() + diff);
    }
    setDueDate(date);
  };

  // reset the form
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setShowDescription(false);
    setPriority('routine');
    setPrivacy('private');
    setDueDate(new Date());
    setIsImportant(false);
    setIsFlexible(false);
    setAssignee('Me');
    setLoading(false);
  };
  // handle cancle
  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (isGuest) {
      alert('Guest users are not allowed to create tasks. Please sign up first.');
      return;
    }
    if (!title.trim()) return;

    setLoading(true);

    let finalDueDate: Date | null = null;
    if (!isFlexible && dueDate) {
      finalDueDate = new Date(dueDate);
      if (dueTime) {
        const [hours, minutes] = dueTime.split(':').map(Number);
        finalDueDate.setHours(hours, minutes, 0, 0);
      } else {
        finalDueDate.setHours(7, 0, 0, 0);
      }
    }

    const docData = {
      title: title.trim(),
      description,
      steps: [],
      priority,
      status: 'in_progress',
      progressPercent: 0,
      pinned: false,
      isArchived: false,
      authorId: user!.uid,
      authorName: user!.firstName || '',
      assignedUsers: [],
      sharedWith: [],
      assignee: assignee.trim() || null,
      startDate: Timestamp.fromDate(new Date()),
      dueDate: isFlexible ? null : (finalDueDate ? Timestamp.fromDate(finalDueDate) : null),
      isFlexible,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      privacy,
      isImportant,
      hasReminder: false,
      reminderDate: null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await addTodo(docData as any);

    setLoading(false);
    resetForm();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      TransitionComponent={Fade}
      transitionDuration={400}
      PaperProps={{
        className:
          'rounded-[28px] overflow-hidden shadow-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800',
        sx: { borderRadius: isMobile ? 0 : '28px' },
      }}
    >
      {/* ── Premium Gradient Header ── */}
      <Box className="p-6 bg-gradient-to-br from-teal-500 to-cyan-700 text-white flex justify-between items-center">
        <Box>
          <Typography variant="h6" className="font-extrabold">
            {title ? 'Edit Task' : 'New Task'} 📝
          </Typography>
          <Typography variant="body2" className="opacity-90">
            Stay organized. Stay focused.
          </Typography>
        </Box>
        <Box className="flex items-center gap-2">
          {isMobile && (
            <Button
              variant="contained"
              size="small"
              onClick={handleSave}
              disabled={loading || !title.trim()}
              className="bg-white text-teal-600 font-bold hover:bg-teal-50 rounded-xl mr-2"
            >
              {loading ? 'Saving…' : 'Save'}
            </Button>
          )}
          <IconButton
            onClick={handleCancel}
            className="text-white hover:bg-white/20 transition-colors"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      <DialogContent className="p-6">
        <Box className="flex flex-col gap-10 pt-4">
          {/* 1. Title */}
          <Box>
            <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
              🏷️ Task Title <span className="text-red-500">*</span>
            </Typography>
            <TextField
              inputRef={titleInputRef}
              fullWidth
              multiline
              maxRows={3}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '16px',
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(15, 23, 42, 0.5)'
                      : '#fff',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  transition: 'all-0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '& fieldset': {
                    borderColor:
                      theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0',
                  },
                  '&:hover fieldset': { borderColor: '#14b8a6' },
                  '&.Mui-focused fieldset': {
                    borderColor: '#14b8a6',
                    borderWidth: '2px',
                  },
                },
              }}
            />
          </Box>

          {/* 2. Date / Deadline Section */}
          <Box
            className={`
              p-6 rounded-[24px] border transition-all
              ${theme.palette.mode === 'dark' ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-100'}
            `}
          >
            <Collapse in={!isFlexible}>
              <Box className="w-full">
                <Box className="flex flex-col sm:flex-row gap-4 mb-4">
                  <Box className="flex-1">
                    <TextField
                      type="date"
                      value={dueDate ? `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}` : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          const [y, m, d] = e.target.value.split('-').map(Number);
                          setDueDate(new Date(y, m - 1, d));
                        } else {
                          setDueDate(null);
                        }
                      }}
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '16px',
                          backgroundColor:
                            theme.palette.mode === 'dark' ? '#1e3a8a20' : '#f0f7ff',
                          '& fieldset': {
                            borderColor: '#3b82f6',
                            borderWidth: '2px',
                          },
                        },
                        '& .MuiInputBase-input': {
                          textAlign: 'center',
                          fontWeight: 800,
                          color: '#2563eb',
                          fontSize: '1.1rem',
                          letterSpacing: '1px',
                        },
                      }}
                      helperText={
                        dueDate && (
                          <Typography
                            variant="caption"
                            className="text-slate-400 dark:text-slate-500 font-bold ml-1 uppercase tracking-wider"
                          >
                            {dueDate.toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </Typography>
                        )
                      }
                    />
                  </Box>

                  <Box className="flex-1">
                    <TextField
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      fullWidth
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '16px',
                          backgroundColor:
                            theme.palette.mode === 'dark' ? '#1e3a8a20' : '#f0f7ff',
                          '& fieldset': {
                            borderColor: '#3b82f6',
                            borderWidth: '2px',
                          },
                        },
                        '& .MuiInputBase-input': {
                          textAlign: 'center',
                          fontWeight: 800,
                          color: '#2563eb',
                          fontSize: '1.1rem',
                          letterSpacing: '1px',
                        },
                      }}
                      helperText={
                        <Typography
                          variant="caption"
                          className="text-slate-400 dark:text-slate-500 font-bold ml-1 uppercase tracking-wider"
                        >
                          🕒 Specific Target Time
                        </Typography>
                      }
                    />
                  </Box>
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  mt={2.5}
                  className="overflow-x-auto pb-1 no-scrollbar flex-nowrap"
                >
                  {[
                    { label: 'Tomorrow', value: 'tomorrow' },
                    { label: 'In 2 Days', value: 'afterTomorrow' },
                    { label: 'Weekend', value: 'endOfWeek' },
                  ].map((item) => (
                    <Button
                      key={item.value}
                      variant="outlined"
                      onClick={() =>
                        handleQuickDate(
                          item.value as
                          | 'tomorrow'
                          | 'afterTomorrow'
                          | 'endOfWeek',
                        )
                      }
                      className="rounded-full normal-case text-[12px] font-bold px-5 py-1.5 whitespace-nowrap border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-teal-400 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/10 transition-all"
                    >
                      {item.label}
                    </Button>
                  ))}
                </Stack>
              </Box>
            </Collapse>

            {/* 'Or' divider line right below the date swiper */}
            <Box className="my-4 flex items-center justify-center gap-3">
              <Box className="flex-1 h-[1px] bg-slate-200 dark:bg-slate-800/60" />
              <Typography variant="caption" className="font-extrabold text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Or
              </Typography>
              <Box className="flex-1 h-[1px] bg-slate-200 dark:bg-slate-800/60" />
            </Box>

            {/* 'No Fix Date' toggler styled like 'Mark as Starred' */}
            <Box
              onClick={() => setIsFlexible(!isFlexible)}
              className={`
                flex cursor-pointer select-none items-center justify-between rounded-xl border px-3 py-2 transition-all
                ${isFlexible
                  ? theme.palette.mode === 'dark'
                    ? 'border-teal-800 bg-teal-950/30 text-teal-300'
                    : 'border-teal-200 bg-teal-50 text-teal-700'
                  : theme.palette.mode === 'dark'
                    ? 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-teal-800 hover:text-teal-300'
                    : 'border-slate-100 bg-white text-slate-500 hover:border-teal-200 hover:text-teal-600'
                }
              `}
            >
              <Typography className="text-xs font-extrabold">
                No Fix Date
              </Typography>
              {isFlexible ? (
                <CheckIcon className="text-teal-500" fontSize="small" />
              ) : (
                <UncheckedIcon className="text-slate-400" fontSize="small" />
              )}
            </Box>
          </Box>

          <Box
            onClick={() => setIsImportant(!isImportant)}
            className={`
              -mt-6 flex cursor-pointer select-none items-center justify-between rounded-xl border px-3 py-2 transition-all
              ${isImportant
                ? theme.palette.mode === 'dark'
                  ? 'border-amber-800 bg-amber-950/30 text-amber-300'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
                : theme.palette.mode === 'dark'
                  ? 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-amber-800 hover:text-amber-300'
                  : 'border-slate-100 bg-white text-slate-500 hover:border-amber-200 hover:text-amber-600'
              }
            `}
          >
            <Typography className="text-xs font-extrabold">
              Mark as Starred
            </Typography>
            {isImportant ? (
              <StarIcon className="text-amber-500" fontSize="small" />
            ) : (
              <StarBorderIcon className="text-slate-400" fontSize="small" />
            )}
          </Box>

          {/* Reminder Info Message Box */}
          <Box
            sx={{
              p: 2,
              borderRadius: '16px',
              border: `1px dashed ${theme.palette.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.2)' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              mt: 2
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontSize: '13px',
                fontWeight: 600,
                color: theme.palette.mode === 'dark' ? '#94a3b8' : '#475569',
                textAlign: 'center',
                width: '100%',
              }}
            >
              {"📢 You can set reminder for notification after creating the task by clicking 'Notification' icon."}
            </Typography>
          </Box>

          {/* 3. Priority & Privacy & Starred Row */}
          <Box className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                ⚡ Priority
              </Typography>
              <TextField
                select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? 'rgba(15, 23, 42, 0.5)'
                        : '#fff',
                    fontWeight: 700,
                  },
                }}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <MenuItem key={p.value} value={p.value} className="font-bold">
                    {p.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                👤 Assignee
              </Typography>
              <TextField
                placeholder="Who is tackling this?"
                fullWidth
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? 'rgba(15, 23, 42, 0.5)'
                        : '#fff',
                  },
                }}
              />
            </Box>
          </Box>

          {/* 4. Privacy & Description Toggle */}
          <Box className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                🔒 Privacy
              </Typography>
              <TextField
                select
                value={privacy}
                onChange={(e) =>
                  setPrivacy(e.target.value as 'private' | 'public')
                }
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? 'rgba(15, 23, 42, 0.5)'
                        : '#fff',
                    fontWeight: 700,
                  },
                }}
              >
                <MenuItem value="private" className="font-bold">
                  Only Me
                </MenuItem>
                <MenuItem value="public" className="font-bold">
                  Public
                </MenuItem>
              </TextField>
            </Box>

            <Box className="pt-7">
              <Collapse in={!showDescription}>
                <Button
                  onClick={() => setShowDescription(true)}
                  startIcon={<ExpandMoreIcon />}
                  className="normal-case font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl px-4"
                >
                  + Add Detailed Description
                </Button>
              </Collapse>
            </Box>
          </Box>

          {/* 5. Description Area */}
          <Collapse in={showDescription}>
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                📝 Description
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Context, details, or notes..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? 'rgba(15, 23, 42, 0.5)'
                        : '#fff',
                    '& fieldset': {
                      borderColor:
                        theme.palette.mode === 'dark' ? '#334155' : '#e2e8f0',
                    },
                  },
                }}
              />
              <Button
                onClick={() => setShowDescription(false)}
                className="normal-case font-bold text-slate-400 hover:text-red-500 mt-2"
                size="small"
              >
                – Hide Description
              </Button>
            </Box>
          </Collapse>

          <Divider className="dark:border-slate-800" />

          {/* ── Post-Creation Steps Info Banner ── */}
          <Box className="p-4 rounded-[20px] bg-teal-500/10 dark:bg-teal-500/5 border border-teal-500/20 dark:border-teal-500/10 flex items-start gap-2.5">
            <Typography variant="body2" className="text-xs font-bold text-teal-700 dark:text-teal-400 leading-5">
              💡 You can create Steps and sub steps in the task detail page after creating the task.
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions className="p-6 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 gap-3">
        <Button
          onClick={handleCancel}
          className="rounded-xl font-bold px-6 py-2 normal-case text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Cancel
        </Button>
        {!isMobile && (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading || !title.trim()}
            className="rounded-xl font-extrabold px-8 py-2 normal-case bg-gradient-to-r from-teal-500 to-cyan-700 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 transition-all"
          >
            {loading ? 'Saving…' : 'Create Task'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
