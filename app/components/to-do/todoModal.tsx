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

} from '@mui/material';
import {

  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  AccessTime as TimeIcon,
  CalendarMonth as CalendarIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
} from '@mui/icons-material';
import { useState, useRef, useEffect } from 'react';
import {
  serverTimestamp,
  Timestamp,
  getDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { PRIORITY_OPTIONS } from '@/app/lib/constant';
import CustomWheelTimePicker from '@/app/test/time-picker/TimePicker';
import {
  WhatsApp as WhatsAppIcon,
  NotificationsActive as PushIcon,
} from '@mui/icons-material';
import {
  createWhatsAppReminder,
  getUserWhatsAppConfig,
} from '@/app/lib/utils/whatsapp-reminder';
import { requestNotificationPermissionAndGetToken } from '@/app/lib/utils/fcm';
import { isPremiumClient } from '@/app/lib/members';

type Props = {
  open: boolean;
  onClose: () => void;
};

type TaskPriority = 'routine' | 'urgent' | 'critical';

const normalizeWhatsappPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const withCountryCode = digits.startsWith('0')
    ? `92${digits.slice(1)}`
    : digits;
  return withCountryCode.slice(0, 12);
};

import { useTodoContext } from '@/app/lib/context/todoContext';

export default function ToDoModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const { addTodo } = useTodoContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isPremium = isPremiumClient(process.env.NEXT_PUBLIC_CLIENT_ID);

  const [title, setTitle] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('routine');
  const [privacy, setPrivacy] = useState<'private' | 'public'>('private');
  const [dueDate, setDueDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [isFlexible, setIsFlexible] = useState(false);
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

  const [hasReminder, setHasReminder] = useState(false);
  const [reminderMethod, setReminderMethod] = useState<'whatsapp' | 'push'>(
    'whatsapp',
  );
  const [reminderDate, setReminderDate] = useState<Date | null>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0); // Default to 1 hour from now
    return d;
  });
  const [whatsappPhone, setWhatsappPhone] = useState('923164709208');

  const handleQuickReminderDate = (
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
    const current = reminderDate ? new Date(reminderDate) : new Date();
    current.setFullYear(date.getFullYear());
    current.setMonth(date.getMonth());
    current.setDate(date.getDate());
    setReminderDate(current);
  };

  // const reminderSummary =
  //   hasReminder && reminderDate
  //     ? `${reminderMethod === 'whatsapp' ? 'WhatsApp' : 'Push'} at ${reminderDate.toLocaleString(
  //       [],
  //       {
  //         month: 'short',
  //         day: 'numeric',
  //         hour: 'numeric',
  //         minute: '2-digit',
  //       },
  //     )}`
  //     : 'Off';




  const whatsappPhoneError =
    hasReminder && reminderMethod === 'whatsapp' && whatsappPhone.length < 11;

  // Load user phone number from Firestore if available
  useEffect(() => {
    if (user?.uid) {
      const fetchUserPhone = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.phone || data.whatsapp) {
              setWhatsappPhone(
                normalizeWhatsappPhone(data.phone || data.whatsapp),
              );
            }
          }
        } catch (err) {
          console.error('Error fetching user phone:', err);
        }
      };
      fetchUserPhone();
    }
  }, [user]);

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
    setHasReminder(false);
    setReminderMethod('whatsapp');
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    setReminderDate(d);
  };
  // handle cancle
  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    if (
      hasReminder &&
      reminderMethod === 'whatsapp' &&
      whatsappPhone.length < 11
    ) {
      alert('Please enter a valid WhatsApp number with 11 to 12 digits.');
      return;
    }

    setLoading(true);

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
      dueDate: isFlexible ? null : Timestamp.fromDate(dueDate || new Date()),
      isFlexible,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      privacy,
      isImportant,
      hasReminder,
      reminderDate:
        hasReminder && reminderDate ? Timestamp.fromDate(reminderDate) : null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docId = await addTodo(docData as any);
    const docRef = { id: docId };

    if (hasReminder && reminderDate && user) {
      try {
        const clientId =
          process.env.NEXT_PUBLIC_CLIENT_ID || `user_${user.uid}`;
        const config = getUserWhatsAppConfig(user.uid, whatsappPhone);
        config.itemType = 'todo';
        config.method = reminderMethod; // 'whatsapp' or 'push'

        // For push reminders, ensure the FCM token is registered under the
        // actual user.uid so the Node.js worker can find it at
        // fcm-tokens/{clientId}/{user.uid}
        if (reminderMethod === 'push') {
          try {
            await requestNotificationPermissionAndGetToken(clientId, user.uid);
          } catch (tokenErr) {
            console.warn(
              'Could not refresh FCM token before saving push reminder:',
              tokenErr,
            );
          }
        }

        await createWhatsAppReminder(
          {
            id: docRef.id,
            title: title.trim(),
            reminderDate: reminderDate,
            priority: priority === 'routine' ? 'low' : priority,
            dueDate: isFlexible
              ? undefined
              : (dueDate || new Date()).toISOString(),
          },
          config,
        );
      } catch (err) {
        console.error('Failed to schedule reminder:', err);
      }
    }

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

          {/* 2b. Reminder Section (WhatsApp or Push Notification) */}
          <Box
            className={`
              p-4 sm:p-6 rounded-[24px] border transition-all
              ${hasReminder
                ? theme.palette.mode === 'dark'
                  ? 'bg-teal-950/20 border-teal-800/60'
                  : 'bg-teal-50/70 border-teal-100'
                : theme.palette.mode === 'dark'
                  ? 'bg-slate-800/30 border-slate-700'
                  : 'bg-slate-50 border-slate-100'
              }
            `}
          >
            <Box
              onClick={() => {
                // Temporarily disabled
                // if (!isPremium) return;
                // setHasReminder(!hasReminder);
              }}
              className="flex select-none items-center justify-between gap-3 cursor-not-allowed"
            >
              <Box className="min-w-0">
                <Typography className="text-[11px] font-extrabold text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em]">
                  Task Reminder (Temporarily Disabled)
                </Typography>
                <Typography className="mt-1 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                  Reminders are temporarily disabled.
                </Typography>
              </Box>
              <UncheckedIcon className="text-slate-400" fontSize="small" />
              {/*
              {isPremium ? (
                hasReminder ? (
                  <CheckIcon className="text-teal-500" fontSize="small" />
                ) : (
                  <UncheckedIcon className="text-slate-400" fontSize="small" />
                )
              ) : (
                <Typography className="text-[10px] font-bold text-red-500 uppercase tracking-wider bg-red-500/10 px-2 py-0.5 rounded-full">
                  Locked
                </Typography>
              )}
              */}
            </Box>

            {!isPremium && (
              <Box className="mt-3 text-xs font-semibold text-red-500 dark:text-red-400">
                ⚠️ WhatsApp/Push reminders are only available for premium members.
              </Box>
            )}

            <Collapse in={hasReminder}>
              <Box className="mt-5 space-y-5">
                <Box>
                  <Box className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setReminderMethod('whatsapp')}
                      className={`
                        flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-extrabold border transition-all
                        ${reminderMethod === 'whatsapp'
                          ? theme.palette.mode === 'dark'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-inner'
                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-500 shadow-sm'
                          : theme.palette.mode === 'dark'
                            ? 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                        }
                      `}
                    >
                      <WhatsAppIcon style={{ fontSize: 16 }} />
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderMethod('push')}
                      className={`
                        flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-extrabold border transition-all
                        ${reminderMethod === 'push'
                          ? theme.palette.mode === 'dark'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-450 shadow-inner'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500 shadow-sm'
                          : theme.palette.mode === 'dark'
                            ? 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                        }
                      `}
                    >
                      <PushIcon style={{ fontSize: 16 }} />
                      Push
                    </button>
                  </Box>
                  {/* Custom Synced Date-Time Control Center */}
                  <Box className="space-y-5">
                    {/* Date Picker Section */}
                    <Box>
                      <Box className="flex items-center justify-between mb-2.5 px-1">
                        <Typography className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <CalendarIcon style={{ fontSize: 13 }} />
                          Select Reminder Date
                        </Typography>
                      </Box>
                      <TextField
                        type="date"
                        value={reminderDate ? `${reminderDate.getFullYear()}-${String(reminderDate.getMonth() + 1).padStart(2, '0')}-${String(reminderDate.getDate()).padStart(2, '0')}` : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            const [y, m, d] = e.target.value.split('-').map(Number);
                            const current = reminderDate ? new Date(reminderDate) : new Date();
                            current.setFullYear(y);
                            current.setMonth(m - 1);
                            current.setDate(d);
                            setReminderDate(current);
                          } else {
                            setReminderDate(null);
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
                          reminderDate && (
                            <Typography
                              variant="caption"
                              className="text-slate-400 dark:text-slate-500 font-bold ml-1 uppercase tracking-wider"
                            >
                              {reminderDate.toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </Typography>
                          )
                        }
                      />
                      <Stack
                        direction="row"
                        spacing={1}
                        mt={2}
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
                            onClick={() => handleQuickReminderDate(item.value as 'tomorrow' | 'afterTomorrow' | 'endOfWeek')}
                            className={`rounded-full normal-case text-[12px] font-bold px-5 py-1.5 whitespace-nowrap transition-all ${
                              theme.palette.mode === 'dark'
                                ? 'border-slate-700 text-slate-300 hover:border-teal-400 hover:text-teal-400 hover:bg-teal-950/20'
                                : 'border-slate-200 text-slate-500 hover:border-teal-400 hover:text-teal-500 hover:bg-teal-50'
                            }`}
                          >
                            {item.label}
                          </Button>
                        ))}
                      </Stack>
                    </Box>

                    {/* Expandable Reusable Custom Wheel Picker */}
                    {reminderDate && (
                      <Box className="mt-3">
                        <CustomWheelTimePicker
                          value={reminderDate}
                          isDark={theme.palette.mode === 'dark'}
                          onChange={(nextDate) => {
                            setReminderDate(nextDate);
                          }}
                        />
                      </Box>
                    )}
                  </Box>

                  {/* WhatsApp phone — only shown when method is whatsapp */}
                  {reminderMethod === 'whatsapp' && (
                    <Box className="flex-1 w-full">
                      <Typography className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">
                        WhatsApp Number
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={whatsappPhone}
                        onChange={(e) =>
                          setWhatsappPhone(
                            normalizeWhatsappPhone(e.target.value),
                          )
                        }
                        placeholder="923164709208"
                        error={whatsappPhoneError}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: '12px',
                            backgroundColor:
                              theme.palette.mode === 'dark'
                                ? 'rgba(15, 23, 42, 0.7)'
                                : '#fff',
                            fontWeight: 700,
                          },
                          '& .MuiFormHelperText-root': {
                            marginLeft: '4px',
                            fontSize: '10px',
                          },
                        }}
                        helperText={
                          whatsappPhoneError
                            ? 'Use 11 to 12 digits'
                            : '0323 becomes 92323 automatically'
                        }
                      />
                    </Box>
                  )}

                  {/* Push info hint */}
                  {reminderMethod === 'push' && (
                    <Box className="flex-1 w-full">
                      <Box className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/70 dark:bg-amber-950/20">
                        <TimeIcon
                          className="text-amber-600 dark:text-amber-400"
                          sx={{ fontSize: 17 }}
                        />
                        <a
                          href="/settings/push-notifications"
                          target="_blank"
                          className="text-xs font-extrabold text-amber-700 underline-offset-4 hover:underline dark:text-amber-300"
                        >
                          Push notification settings
                        </a>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </Collapse>
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
