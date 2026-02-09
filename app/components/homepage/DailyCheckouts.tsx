'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  Timestamp,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import type { DailyCheckout } from '@/app/lib/interface';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteIcon from '@mui/icons-material/Delete';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import WorkIcon from '@mui/icons-material/Work';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ListAltIcon from '@mui/icons-material/ListAlt';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  MenuItem,
  CircularProgress,
  Box,
  Typography,
  Tabs,
  Tab,
} from '@mui/material';
import moment from 'moment-timezone';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const CATEGORIES = [
  'Fitness',
  'Work',
  'Spiritual',
  'Health',
  'Personal',
  'Shopping',
  'Other',
];

// Predefined icons for each category (MUI icons)
const CATEGORY_ICONS: { category: string; icon: React.ReactNode }[] = [
  { category: 'Fitness', icon: <FitnessCenterIcon /> },
  { category: 'Work', icon: <WorkIcon /> },
  { category: 'Spiritual', icon: <MenuBookIcon /> },
  { category: 'Health', icon: <LocalHospitalIcon /> },
  { category: 'Personal', icon: <PersonIcon /> },
  { category: 'Shopping', icon: <ShoppingCartIcon /> },
  { category: 'Other', icon: <ListAltIcon /> },
];

const DEFAULT_ICON = <ListAltIcon />;
const VISIBLE_ITEMS_DEFAULT = 6;

export default function DailyCheckouts() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [checkouts, setCheckouts] = useState<DailyCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showPastCheckouts, setShowPastCheckouts] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkoutToDelete, setCheckoutToDelete] =
    useState<DailyCheckout | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [dayOrDate, setDayOrDate] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateTab, setDateTab] = useState<'day' | 'date'>('day');
  const [category, setCategory] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');

  // Get today's day name and date string
  const todayDayName = moment().format('dddd');
  const todayDateString = moment().format('YYYY-MM-DD');

  // Fetch checkouts - optimized: only fetch user's checkouts, filter client-side
  const fetchCheckouts = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      // Single field query - no composite index needed
      const q = query(
        collection(db, 'dailyCheckouts'),
        where('userId', '==', user.uid),
      );

      const snapshot = await getDocs(q);
      const allCheckouts = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate()
              : new Date(data.createdAt),
        } as DailyCheckout;
      });

      // Filter client-side for today's checkouts only
      const todayCheckouts = allCheckouts.filter((checkout) => {
        const checkoutDayOrDate = checkout.dayOrDate.toLowerCase();
        return (
          checkoutDayOrDate === todayDayName.toLowerCase() ||
          checkoutDayOrDate === todayDateString
        );
      });

      setCheckouts(todayCheckouts);
    } catch (error) {
      console.error('Error fetching checkouts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, todayDayName, todayDateString]);

  useEffect(() => {
    fetchCheckouts();
  }, [fetchCheckouts]);

  // Sort and categorize checkouts by time
  const sortedCheckouts = useMemo(() => {
    const now = moment();
    const sorted = [...checkouts].sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;

      const timeA = moment(a.time, 'HH:mm');
      const timeB = moment(b.time, 'HH:mm');
      return timeA.diff(timeB);
    });

    return sorted.map((checkout) => {
      if (!checkout.time) return { ...checkout, status: 'upcoming' };

      const checkoutTime = moment(checkout.time, 'HH:mm');
      const diffMinutes = checkoutTime.diff(now, 'minutes');

      // Active: within 30 minutes before or after the time
      if (diffMinutes >= -30 && diffMinutes <= 30 && !checkout.done) {
        return { ...checkout, status: 'active' };
      }
      // Past: time has passed by more than 30 minutes
      if (diffMinutes < -30) {
        return { ...checkout, status: 'past' };
      }
      // Upcoming: time is more than 30 minutes away
      return { ...checkout, status: 'upcoming' };
    });
  }, [checkouts]);

  const handleToggleDone = async (checkout: DailyCheckout) => {
    if (!checkout.id || !user?.uid) return;

    try {
      await updateDoc(doc(db, 'dailyCheckouts', checkout.id), {
        done: !checkout.done,
        updatedAt: serverTimestamp(),
      });

      setCheckouts((prev) =>
        prev.map((c) => (c.id === checkout.id ? { ...c, done: !c.done } : c)),
      );
    } catch (error) {
      console.error('Error updating checkout:', error);
    }
  };

  const handleDeleteCheckout = async (checkout: DailyCheckout) => {
    if (!checkout.id || !user?.uid) return;

    try {
      await deleteDoc(doc(db, 'dailyCheckouts', checkout.id));
      setCheckouts((prev) => prev.filter((c) => c.id !== checkout.id));
    } catch (error) {
      console.error('Error deleting checkout:', error);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !dayOrDate.trim() || !user?.uid || saving) return;

    setSaving(true);
    try {
      // Build data object, only including defined fields
      // Use Partial<DailyCheckout> because some fields (category, time, duration)
      // are optional when creating the doc.
      const checkoutData: Omit<
        Partial<DailyCheckout>,
        'createdAt' | 'updatedAt'
      > & {
        createdAt?: Date | Timestamp | ReturnType<typeof serverTimestamp>;
        updatedAt?: Date | Timestamp | ReturnType<typeof serverTimestamp>;
      } = {
        userId: user.uid,
        title: title.trim(),
        dayOrDate: dayOrDate.trim(),
        done: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Only add optional fields if they have values
      if (category.trim()) {
        checkoutData.category = category.trim();
      }
      if (time.trim()) {
        checkoutData.time = time.trim();
      }
      if (duration.trim()) {
        checkoutData.duration = duration.trim();
      }

      await addDoc(collection(db, 'dailyCheckouts'), checkoutData);

      // Reset form
      setTitle('');
      setDayOrDate('');
      setSelectedDate(null);
      setDateTab('day');
      setCategory('');
      setTime('');
      setDuration('');
      setModalOpen(false);

      // Refresh checkouts
      fetchCheckouts();
    } catch (error) {
      console.error('Error saving checkout:', error);
    } finally {
      setSaving(false);
    }
  };

  const getCategoryIcon = (category?: string) => {
    if (!category) return DEFAULT_ICON;
    const entry = CATEGORY_ICONS.find(
      (c) => c.category.toLowerCase() === category.toLowerCase(),
    );
    return entry ? entry.icon : DEFAULT_ICON;
  };

  // Filter out past checkouts when hidden
  const displayCheckouts = useMemo(() => {
    if (showPastCheckouts) return sortedCheckouts;
    return sortedCheckouts.filter((c) => (c.status as string) !== 'past');
  }, [sortedCheckouts, showPastCheckouts]);

  const pastCount = useMemo(
    () => sortedCheckouts.filter((c) => (c.status as string) === 'past').length,
    [sortedCheckouts],
  );

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm mb-6"
        style={{
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          borderColor: theme?.mode === 'dark' ? '#475569' : '#e5e7eb',
        }}
      >
        <Box sx={{ p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      </motion.div>
    );
  }

  const visibleCheckouts = expanded
    ? displayCheckouts
    : displayCheckouts.slice(0, VISIBLE_ITEMS_DEFAULT);
  const hasMore = displayCheckouts.length > VISIBLE_ITEMS_DEFAULT;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full rounded-2xl border shadow-sm mb-6"
        style={{
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          borderColor: theme?.mode === 'dark' ? '#475569' : '#e5e7eb',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{
            borderColor: theme?.mode === 'dark' ? '#475569' : '#e5e7eb',
          }}
        >
          <div
            className="flex items-center gap-2 text-lg font-semibold"
            style={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
            }}
          >
            📋 Daily Checkout
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1 text-sm hover:opacity-80 transition"
              style={{
                color: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
              }}
            >
              <AddIcon fontSize="small" />
              Add
            </button>
          </div>
        </div>

        {/* List */}
        {displayCheckouts.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Typography
              variant="body2"
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
              }}
            >
              No checkouts for today. Add one to get started!
            </Typography>
          </div>
        ) : (
          <div className="flex flex-col divide-y">
            <AnimatePresence>
              {visibleCheckouts.map((checkout) => (
                <CheckoutItem
                  key={checkout.id}
                  checkout={checkout}
                  status={checkout.status as 'active' | 'upcoming' | 'past'}
                  onToggleDone={() => handleToggleDone(checkout)}
                  onDelete={() => setCheckoutToDelete(checkout)}
                  theme={theme}
                  icon={getCategoryIcon(checkout.category)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Show/Hide past checkouts */}
        {pastCount > 0 && (
          <div
            className="px-5 py-2 border-t"
            style={{
              borderColor: theme?.mode === 'dark' ? '#475569' : '#e5e7eb',
            }}
          >
            <button
              onClick={() => setShowPastCheckouts(!showPastCheckouts)}
              className="text-sm hover:opacity-80 transition"
              style={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
              }}
            >
              {showPastCheckouts
                ? `Hide past checkouts (${pastCount})`
                : `Show past checkouts (${pastCount})`}
            </button>
          </div>
        )}

        {/* View more / Show less */}
        {hasMore && (
          <div
            className="px-5 py-3 border-t text-center"
            style={{
              borderColor: theme?.mode === 'dark' ? '#475569' : '#e5e7eb',
            }}
          >
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-center gap-1 text-sm hover:opacity-80 transition w-full"
              style={{
                color: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
              }}
            >
              {expanded ? (
                <>
                  <ExpandLessIcon fontSize="small" />
                  Show Less
                </>
              ) : (
                <>
                  <ExpandMoreIcon fontSize="small" />
                  View more ({displayCheckouts.length -
                    VISIBLE_ITEMS_DEFAULT}{' '}
                  more)
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!checkoutToDelete}
        onClose={() => setCheckoutToDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete checkout?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{checkoutToDelete?.title}
            &quot;? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCheckoutToDelete(null)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              if (checkoutToDelete) {
                await handleDeleteCheckout(checkoutToDelete);
                setCheckoutToDelete(null);
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Checkout Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Daily Checkout</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              size="small"
            />
            {/* Day or Date Selection */}
            <Box>
              <Tabs
                value={dateTab}
                onChange={(_, newValue) => {
                  setDateTab(newValue);
                  if (newValue === 'day') {
                    setSelectedDate(null);
                  } else {
                    setDayOrDate('');
                  }
                }}
                sx={{ mb: 2 }}
              >
                <Tab label="Day of Week" value="day" />
                <Tab label="Specific Date" value="date" />
              </Tabs>

              {dateTab === 'day' ? (
                <TextField
                  select
                  label="Day of Week *"
                  value={dayOrDate}
                  onChange={(e) => setDayOrDate(e.target.value)}
                  fullWidth
                  required
                  size="small"
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <MenuItem key={day} value={day}>
                      {day}
                    </MenuItem>
                  ))}
                  <MenuItem value={todayDateString}>
                    Today ({todayDateString})
                  </MenuItem>
                </TextField>
              ) : (
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ mb: 1, color: 'text.secondary' }}
                  >
                    Select Date * (up to 1 month ahead)
                  </Typography>
                  <Box
                    sx={{
                      '& .react-datepicker-wrapper': { width: '100%' },
                      '& .react-datepicker__input-container': { width: '100%' },
                      '& .react-datepicker__input-container input': {
                        width: '100%',
                        padding: '8.5px 14px',
                        border: `1px solid ${
                          theme?.mode === 'dark' ? '#475569' : '#cbd5e1'
                        }`,
                        borderRadius: '4px',
                        fontSize: '14px',
                        backgroundColor:
                          theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
                        color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
                        '&:focus': {
                          borderColor:
                            theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
                          outline: 'none',
                        },
                        '&::placeholder': {
                          color: theme?.mode === 'dark' ? '#64748b' : '#94a3b8',
                        },
                      },
                    }}
                  >
                    <DatePicker
                      selected={selectedDate}
                      onChange={(date: Date | null) => {
                        setSelectedDate(date);
                        if (date) {
                          setDayOrDate(moment(date).format('YYYY-MM-DD'));
                        } else {
                          setDayOrDate('');
                        }
                      }}
                      minDate={moment().toDate()}
                      maxDate={moment().add(1, 'month').toDate()}
                      dateFormat="yyyy-MM-dd"
                      placeholderText="Select a date"
                      wrapperClassName="w-full"
                    />
                  </Box>
                </Box>
              )}
            </Box>
            <TextField
              select
              label="Category (recommended)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="">None</MenuItem>
              {CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Time (recommended)"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Duration (optional)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              fullWidth
              placeholder="e.g., 30 mins, 1 hour"
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={
              !title.trim() || (!dayOrDate.trim() && !selectedDate) || saving
            }
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

type CheckoutItemProps = {
  checkout: DailyCheckout;
  status: 'active' | 'upcoming' | 'past';
  onToggleDone: () => void;
  onDelete: () => void;
  // Use the theme shape returned by useCustomTheme; avoid importing Theme type directly.
  theme: ReturnType<typeof useCustomTheme>['theme'] | null;
  icon: React.ReactNode;
};

function CheckoutItem({
  checkout,
  status,
  onToggleDone,
  onDelete,
  theme,
  icon,
}: CheckoutItemProps) {
  const bgColor =
    status === 'active'
      ? theme?.mode === 'dark'
        ? '#065f46'
        : '#d1fae5'
      : status === 'past'
        ? theme?.mode === 'dark'
          ? '#1e293b'
          : '#f8fafc'
        : theme?.mode === 'dark'
          ? '#1e293b'
          : '#ffffff';

  const textColor =
    status === 'active'
      ? theme?.mode === 'dark'
        ? '#f1f5f9'
        : '#065f46'
      : status === 'past'
        ? theme?.mode === 'dark'
          ? '#64748b'
          : '#94a3b8'
        : theme?.mode === 'dark'
          ? '#f1f5f9'
          : '#0f172a';

  const categoryColor =
    status === 'active'
      ? theme?.mode === 'dark'
        ? '#a7f3d0'
        : '#047857'
      : theme?.mode === 'dark'
        ? '#94a3b8'
        : '#64748b';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      whileHover={{ scale: 0.995 }}
      className="group flex items-center justify-between px-5 py-4 transition"
      style={{
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      {/* Left */}
      <div className="flex items-start gap-3 flex-1">
        <div className="mt-1 flex items-center justify-center text-[1.25rem] [&>svg]:text-[1.25rem]">
          {icon}
        </div>

        <div className="flex-1">
          <div
            className="font-medium"
            style={{
              textDecoration: checkout.done ? 'line-through' : 'none',
              opacity: checkout.done ? 0.6 : 1,
            }}
          >
            {checkout.title}
          </div>
          {checkout.category && (
            <div className="text-sm mt-0.5" style={{ color: categoryColor }}>
              {checkout.category}
            </div>
          )}
        </div>
      </div>

      {/* Right: time/duration, done, delete (on hover) */}
      <div className="flex items-center gap-2">
        {(checkout.time || checkout.duration) && (
          <div className="text-sm whitespace-nowrap">
            {checkout.time && (
              <span>{moment(checkout.time, 'HH:mm').format('h:mm A')}</span>
            )}
            {checkout.time && checkout.duration && ' · '}
            {checkout.duration && <span>{checkout.duration}</span>}
          </div>
        )}

        <button
          onClick={onToggleDone}
          className="rounded-full p-1 transition hover:opacity-80"
          style={{
            backgroundColor:
              status === 'active' && !checkout.done
                ? theme?.mode === 'dark'
                  ? 'rgba(255,255,255,0.2)'
                  : 'rgba(255,255,255,0.8)'
                : 'transparent',
            color: checkout.done
              ? theme?.mode === 'dark'
                ? '#10b981'
                : '#059669'
              : textColor,
          }}
        >
          <CheckCircleIcon
            fontSize="small"
            sx={{
              color: checkout.done
                ? theme?.mode === 'dark'
                  ? '#10b981'
                  : '#059669'
                : 'inherit',
            }}
          />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-full p-1.5 transition min-w-[32px] min-h-[32px] flex items-center justify-center opacity-100 hover:opacity-90 hover:bg-red-100 dark:hover:bg-red-900/40"
          style={{
            color: theme?.mode === 'dark' ? '#f87171' : '#dc2626',
            backgroundColor:
              theme?.mode === 'dark'
                ? 'rgba(248,113,113,0.15)'
                : 'rgba(220,38,38,0.08)',
          }}
          aria-label="Delete checkout"
        >
          <DeleteIcon fontSize="small" />
        </button>
      </div>
    </motion.div>
  );
}
