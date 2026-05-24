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
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  PlaylistAdd as AddTaskIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  AccessTime as TimeIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { useState, useRef, useEffect } from 'react';
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  getDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { PRIORITY_OPTIONS } from '@/app/lib/constant';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import AIStepGeneratorModal from '@/app/components/to-do/AI/AIStepGeneratorModal';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CustomWheelTimePicker from '@/app/test/time-picker/TimePicker';
import { DateRange as CustomDateIcon } from '@mui/icons-material';
import {
  WhatsApp as WhatsAppIcon,
  NotificationsActive as PushIcon,
} from '@mui/icons-material';
import {
  createWhatsAppReminder,
  getUserWhatsAppConfig,
} from '@/app/lib/utils/whatsapp-reminder';
import { requestNotificationPermissionAndGetToken } from '@/app/lib/utils/fcm';

type Props = {
  open: boolean;
  onClose: () => void;
};

type TaskPriority = 'routine' | 'urgent' | 'critical';

const getEndOfWeekDate = () => {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 7 : 7 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

const formatCompactDate = (date: Date) =>
  date.toLocaleDateString([], { month: 'short', day: 'numeric' });

const normalizeWhatsappPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const withCountryCode = digits.startsWith('0')
    ? `92${digits.slice(1)}`
    : digits;
  return withCountryCode.slice(0, 12);
};

export default function ToDoModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [title, setTitle] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('routine');
  const [privacy, setPrivacy] = useState<'private' | 'public'>('private');
  const [dueDate, setDueDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [isFlexible, setIsFlexible] = useState(false);
  const [aiStepModalOpen, setAiStepModalOpen] = useState(false);
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

  const [showCustomTimeWheel, setShowCustomTimeWheel] = useState(true);
  const [activeReminderPreset, setActiveReminderPreset] = useState('custom');
  const [datesList, setDatesList] = useState<{ dayName: string; dayNum: string; fullDate: Date }[]>([]);

  useEffect(() => {
    const list = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      list.push({
        dayName: days[d.getDay()],
        dayNum: String(d.getDate()).padStart(2, '0'),
        fullDate: d,
      });
    }
    setDatesList(list);
  }, []);

  const isSameReminderDay = (d1: Date, d2: Date | null) => {
    if (!d2) return false;
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const handleReminderDateSelect = (date: Date) => {
    const current = reminderDate ? new Date(reminderDate) : new Date();
    current.setFullYear(date.getFullYear());
    current.setMonth(date.getMonth());
    current.setDate(date.getDate());
    setReminderDate(current);
    setActiveReminderPreset('custom');
  };

  const handleApplyReminderPreset = (preset: string) => {
    setActiveReminderPreset(preset);
    if (preset === 'none') {
      setReminderDate(null);
      setShowCustomTimeWheel(false);
    } else if (preset === '15m') {
      setRelativeReminder(15);
      setShowCustomTimeWheel(false);
    } else if (preset === '30m') {
      setRelativeReminder(30);
      setShowCustomTimeWheel(false);
    } else if (preset === '1h') {
      setRelativeReminder(60);
      setShowCustomTimeWheel(false);
    } else if (preset === '3h') {
      setRelativeReminder(180);
      setShowCustomTimeWheel(false);
    } else if (preset === 'tomorrow') {
      setTomorrowMorningReminder();
      setShowCustomTimeWheel(false);
    } else if (preset === 'custom') {
      setShowCustomTimeWheel(true);
      if (!reminderDate) {
        setReminderDate(new Date());
      }
    }
  };

  const reminderSummary =
    hasReminder && reminderDate
      ? `${reminderMethod === 'whatsapp' ? 'WhatsApp' : 'Push'} at ${reminderDate.toLocaleString(
        [],
        {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        },
      )}`
      : 'Off';

  const setRelativeReminder = (minutesFromNow: number) => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutesFromNow);
    date.setSeconds(0, 0);
    setReminderDate(date);
  };

  const setTomorrowMorningReminder = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    setReminderDate(date);
  };

  const endOfWeekDate = getEndOfWeekDate();
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

  const [steps, setSteps] = useState<
    {
      text: string;
      description: string;
      showDescription: boolean;
      done: boolean;
      status: 'in_progress' | 'completed' | 'hold' | 'left-over';
      subSteps: {
        text: string;
        description: string;
        showDescription: boolean;
        done: boolean;
        status: 'in_progress' | 'completed' | 'hold' | 'left-over';
      }[];
    }[]
  >([]);

  const addStep = () => {
    setSteps((prev) => [
      ...prev.map((step) => ({ ...step, showDescription: false })),
      {
        text: '',
        description: '',
        showDescription: false,
        done: false,
        status: 'in_progress',
        subSteps: [],
      },
    ]);
  };

  const handleAIStepsApply = (
    aiSteps: { text: string; description?: string }[],
  ) => {
    const newSteps = aiSteps.map((aiStep) => ({
      text: aiStep.text,
      description: aiStep.description || '',
      showDescription: false,
      done: false,
      status: 'in_progress' as const,
      subSteps: [],
    }));

    setSteps((prev) => [
      ...prev.map((step) => ({ ...step, showDescription: false })),
      ...newSteps,
    ]);
  };

  const removeStep = (stepIndex: number) => {
    setSteps((prev) => prev.filter((_, index) => index !== stepIndex));
  };

  const addSubStep = (stepIndex: number) => {
    const updated = [...steps];
    updated[stepIndex].subSteps.push({
      text: '',
      description: '',
      showDescription: false,
      done: false,
      status: 'in_progress',
    });
    setSteps(updated);
  };

  const removeSubStep = (stepIndex: number, subIndex: number) => {
    const updated = [...steps];
    updated[stepIndex].subSteps = updated[stepIndex].subSteps.filter(
      (_, idx) => idx !== subIndex,
    );
    setSteps(updated);
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
    setSteps([]);
    setAiStepModalOpen(false);
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

    // Check if all steps are empty
    const allStepsEmpty = steps.every((step) => {
      const stepEmpty = !step.text.trim() && !step.description.trim();
      const allSubStepsEmpty = step.subSteps.every(
        (sub) => !sub.text.trim() && !sub.description.trim(),
      );
      return stepEmpty && allSubStepsEmpty;
    });

    if (steps.length > 0 && allStepsEmpty) {
      alert('Please fill in at least one step or substep before saving.');
      return;
    }

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
      steps,
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

    const docRef = await addDoc(collection(db, 'todos'), docData);

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
            <Box className="flex items-center justify-between mb-4">
              <Typography className="text-[11px] font-extrabold text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em]">
                📅 Deadline
              </Typography>
              <Button
                onClick={() => setIsFlexible(!isFlexible)}
                variant={isFlexible ? 'contained' : 'outlined'}
                size="small"
                className={`
                  rounded-xl px-3 py-1.5 normal-case text-[10px] font-black transition-all
                  ${isFlexible
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 hover:bg-slate-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-400'
                  }
                `}
              >
                {isFlexible ? 'Flexible On' : 'Make Flexible'}
              </Button>
            </Box>

            <Collapse in={!isFlexible}>
              <Box className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                <DatePicker
                  selected={dueDate}
                  onChange={(date: Date | null) => setDueDate(date)}
                  className="custom-datepicker-premium"
                  dateFormat="MMMM d, yyyy"
                  minDate={new Date()}
                />
                <Box className="flex w-full min-w-0 overflow-x-auto gap-2 pb-1 sm:w-auto">
                  {[
                    { label: 'Tomorrow', value: 'tomorrow' },
                    { label: 'After Tomorrow', value: 'afterTomorrow' },
                    { label: 'Next Week', value: 'endOfWeek' },
                  ].map((item) => (
                    <Button
                      size="small"
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
                      className="
        min-h-[42px]
        min-w-[110px]
        max-w-[160px]
        flex-shrink-0
        rounded-xl
        normal-case
        text-[9px]
        sm:text-[10px]
        font-bold
        px-3
        py-1
        border-slate-200
        bg-white/80
        text-slate-500
        hover:border-teal-500
        hover:text-teal-600
        transition-all
        dark:bg-slate-900/60
        dark:border-slate-700
        dark:text-slate-300
      "
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span className="flex flex-col items-center leading-tight text-center min-w-0">
                        <span className="truncate">{item.label}</span>

                        {item.value === 'endOfWeek' && (
                          <span className="mt-0.5 flex items-center gap-0.5 text-[7px] font-bold text-slate-400 dark:text-slate-500">
                            <CalendarIcon sx={{ fontSize: 8 }} />
                            {formatCompactDate(endOfWeekDate)}
                          </span>
                        )}
                      </span>
                    </Button>
                  ))}
                </Box>
              </Box>
            </Collapse>
          </Box>

          <Box
            onClick={() => setIsImportant(!isImportant)}
            className={`
              -mt-6 flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 transition-all
              ${isImportant
                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                : 'border-slate-100 bg-white text-slate-500 hover:border-amber-200 hover:text-amber-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:border-amber-800 dark:hover:text-amber-300'
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
            <Box className="flex items-center justify-between gap-3">
              <Box className="min-w-0">
                <Typography className="text-[11px] font-extrabold text-teal-600 dark:text-teal-400 uppercase tracking-[0.2em]">
                  Task Reminder
                </Typography>
                <Typography className="mt-1 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                  {reminderSummary}
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={hasReminder}
                    onChange={(e) => setHasReminder(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#14b8a6',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track':
                        { backgroundColor: '#14b8a6' },
                    }}
                  />
                }
                label=""
                sx={{ mr: 0, ml: 0 }}
              />
            </Box>

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
                          ? 'bg-teal-500/10 text-teal-500 border-teal-500/50 shadow-inner dark:bg-teal-500/10 dark:text-teal-400'
                          : 'bg-white dark:bg-slate-800/60 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-teal-400 hover:text-teal-500'
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
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/50 shadow-inner dark:bg-amber-500/10 dark:text-amber-400'
                          : 'bg-white dark:bg-slate-800/60 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:text-amber-500'
                        }
                      `}
                    >
                      <PushIcon style={{ fontSize: 16 }} />
                      Push
                    </button>
                  </Box>
                </Box>

                {/* Custom Synced Date-Time Control Center */}
                <Box className="space-y-5">
                  {/* Date Picker Section */}
                  <Box>
                    <Box className="flex items-center justify-between mb-2.5 px-1">
                      <Typography className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <CalendarIcon style={{ fontSize: 13 }} />
                        1. Select Reminder Date
                      </Typography>
                      {reminderDate && (
                        <Typography className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20 dark:border-teal-400/20">
                          {reminderDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </Typography>
                      )}
                    </Box>

                    {/* Premium Horizontal Day Slider */}
                    <Box className="flex gap-1.5 overflow-x-auto pb-2 mb-1 scrollbar-none snap-x">
                      {datesList.map((item, idx) => {
                        const isSelected = isSameReminderDay(item.fullDate, reminderDate);
                        const isToday = isSameReminderDay(item.fullDate, new Date());
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleReminderDateSelect(item.fullDate)}
                            className={`flex flex-col items-center justify-center min-w-[50px] h-[64px] rounded-xl border transition-all duration-200 snap-center cursor-pointer ${isSelected
                                ? 'bg-gradient-to-br from-teal-500 to-cyan-600 border-teal-400 text-white shadow-md shadow-teal-500/10 scale-102 font-black'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}
                          >
                            <span className={`text-[8.5px] font-bold uppercase ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                              {item.dayName}
                            </span>
                            <span className="text-sm font-black mt-0.5 tracking-tight">{item.dayNum}</span>
                            {isToday && !isSelected && (
                              <span className="w-1 h-1 rounded-full bg-teal-500 dark:bg-teal-400 mt-0.5" />
                            )}
                          </button>
                        );
                      })}

                      {/* Custom Date Picker Popup Selector */}
                      <Box className="flex items-center justify-center">
                        <DatePicker
                          selected={reminderDate}
                          onChange={(date: Date | null) => {
                            if (date) {
                              const current = reminderDate ? new Date(reminderDate) : new Date();
                              current.setFullYear(date.getFullYear());
                              current.setMonth(date.getMonth());
                              current.setDate(date.getDate());
                              setReminderDate(current);
                              setActiveReminderPreset('custom');
                            }
                          }}
                          minDate={new Date()}
                          customInput={
                            <button
                              type="button"
                              className="flex flex-col items-center justify-center min-w-[50px] h-[64px] rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-transparent text-slate-400 hover:text-teal-500 hover:border-teal-500 transition-all cursor-pointer"
                            >
                              <CustomDateIcon style={{ fontSize: 18 }} />
                              <span className="text-[7.5px] font-bold mt-1 uppercase">Custom</span>
                            </button>
                          }
                        />
                      </Box>
                    </Box>
                  </Box>

                  {/* Predefined Time Slots / Quick Presets & Custom Time Trigger */}
                  <Box>
                    <Typography className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-2 ml-1">
                      <TimeIcon style={{ fontSize: 13 }} />
                      2. Predefined Time Slots & Presets
                    </Typography>

                    <Box className="flex flex-wrap gap-1.5">
                      {[
                        { id: '15m', label: 'In 15m' },
                        { id: '30m', label: 'In 30m' },
                        { id: '1h', label: 'In 1h' },
                        { id: '3h', label: 'In 3h' },
                        { id: 'tomorrow', label: 'Tomorrow Morning (9 AM)' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyReminderPreset(preset.id)}
                          className={`px-3 py-2 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${activeReminderPreset === preset.id
                              ? 'bg-teal-500 text-white shadow-sm border border-teal-500'
                              : 'bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                          {preset.label}
                        </button>
                      ))}

                      {/* Custom Time Wheel Picker Trigger */}
                      <button
                        type="button"
                        onClick={() => handleApplyReminderPreset('custom')}
                        className={`px-3.5 py-2 rounded-xl font-extrabold text-xs transition-all duration-200 flex items-center gap-1 cursor-pointer border ${activeReminderPreset === 'custom' && showCustomTimeWheel
                            ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white border-teal-400 shadow-sm'
                            : 'bg-white dark:bg-slate-800/60 text-teal-600 dark:text-teal-400 border-teal-500/20 dark:border-teal-400/20 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                      >
                        ⏰ Custom Time
                      </button>
                    </Box>
                  </Box>

                  {/* Expandable Reusable Custom Wheel Picker */}
                  {showCustomTimeWheel && reminderDate && (
                    <Box className="mt-3 animate-fadeIn">
                      <CustomWheelTimePicker
                        value={reminderDate}
                        onChange={(nextDate) => {
                          setReminderDate(nextDate);
                          setActiveReminderPreset('custom');
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

          {/* ── Task Steps ── */}
          <Box>
            <Box className="flex justify-between items-center mb-6">
              <Typography className="text-sm font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                📋 Execution Steps
              </Typography>
              <Box className="flex gap-3">
                <Button
                  variant="contained"
                  startIcon={<AddTaskIcon />}
                  onClick={addStep}
                  className="rounded-xl font-bold px-4 py-2 bg-teal-600 hover:bg-teal-700 shadow-md transition-all normal-case"
                >
                  Add Step
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={() => setAiStepModalOpen(true)}
                  disabled={!title.trim()}
                  className="rounded-xl font-bold px-4 py-2 border-teal-200 text-teal-600 hover:bg-teal-50 transition-all normal-case"
                >
                  AI Steps
                </Button>
              </Box>
            </Box>

            {/* Steps Instruction */}
            <Box className="flex items-center gap-3 p-4 mb-8 rounded-2xl bg-teal-50/50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/30 text-teal-700 dark:text-teal-300">
              <Typography variant="body2" className="italic font-medium">
                💡 Breakdown your task into actionable steps for better
                tracking.
              </Typography>
            </Box>

            <Stack gap={3}>
              {steps.map((step, stepIndex) => (
                <Box
                  key={stepIndex}
                  className="group p-5 rounded-[20px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm transition-all hover:shadow-md"
                >
                  <Box className="flex items-center justify-between mb-4">
                    <Typography className="text-xs font-black text-teal-600 uppercase tracking-[0.2em]">
                      Step {stepIndex + 1}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => removeStep(stepIndex)}
                      className="text-slate-300 hover:text-red-500"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    className="mb-2"
                  >
                    <TextField
                      fullWidth
                      value={step.text}
                      onChange={(e) => {
                        const updated = [...steps];
                        updated[stepIndex].text = e.target.value;
                        setSteps(updated);
                      }}
                      placeholder={`What's Step ${stepIndex + 1}?`}
                      variant="standard"
                      InputProps={{ disableUnderline: true }}
                      className="font-bold text-slate-700 dark:text-slate-200"
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        const updated = [...steps];
                        updated[stepIndex].showDescription =
                          !updated[stepIndex].showDescription;
                        setSteps(updated);
                      }}
                    >
                      {step.showDescription ? (
                        <ExpandLessIcon />
                      ) : (
                        <ExpandMoreIcon />
                      )}
                    </IconButton>
                  </Stack>

                  <Collapse in={step.showDescription}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      value={step.description}
                      onChange={(e) => {
                        const updated = [...steps];
                        updated[stepIndex].description = e.target.value;
                        setSteps(updated);
                      }}
                      placeholder="Add step details..."
                      className="mt-3"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                        },
                      }}
                    />
                  </Collapse>

                  {/* Substeps */}
                  <Box className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-800">
                    <Typography className="text-[10px] font-black text-slate-400 uppercase mb-3">
                      Sub-Tasks
                    </Typography>
                    <Stack gap={2}>
                      {step.subSteps.map((sub, subIndex) => (
                        <Box
                          key={subIndex}
                          className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl"
                        >
                          <TextField
                            fullWidth
                            size="small"
                            value={sub.text}
                            onChange={(e) => {
                              const updated = [...steps];
                              updated[stepIndex].subSteps[subIndex].text =
                                e.target.value;
                              setSteps(updated);
                            }}
                            placeholder="Sub-task name..."
                            variant="standard"
                            InputProps={{ disableUnderline: true }}
                            className="font-bold text-xs"
                          />
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeSubStep(stepIndex, subIndex)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                      <Button
                        size="small"
                        onClick={() => addSubStep(stepIndex)}
                        className="self-start normal-case font-bold text-teal-600 hover:bg-teal-50 rounded-lg px-3"
                      >
                        + Add Sub-task
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              ))}
            </Stack>
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

      {/* AI Step Generator Modal */}
      <AIStepGeneratorModal
        open={aiStepModalOpen}
        onClose={() => setAiStepModalOpen(false)}
        onApply={handleAIStepsApply}
        taskTitle={title}
        taskDescription={description}
      />
    </Dialog>
  );
}
