'use client';

import {
  Box,
  Typography,
  IconButton,
  Card,
  CardContent,
  Modal,
  TextField,
  Button,
  Stack,
  CircularProgress,
  useTheme as useMuiTheme,
  InputAdornment,
} from '@mui/material';
import {
  CheckCircleOutline,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { useState, useMemo, useEffect, useRef } from 'react';
import { StreakProps } from '@/app/lib/interface';
import { useStreaks } from '@/app/lib/context/StreaksContext';
import { useAuth } from '@/app/lib/context/userContext';
import moment from 'moment';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ✅ Helper function to convert date to Date object
function convertToDate(date: Timestamp | string | Date): Date {
  if (date instanceof Timestamp) {
    return date.toDate();
  } else if (typeof date === 'string') {
    return new Date(date);
  } else {
    return date;
  }
}

const OnGoingStreaks = () => {
  const theme = useMuiTheme();
  const { streaks, markStreakDone, updateRemarks } = useStreaks();
  const { user } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [selectedStreakId, setSelectedStreakId] = useState<string | null>(null);

  const [currentProgress, setCurrentProgress] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const lastSavedRef = useRef<string>('');

  // 🔑 filter for user-specific streaks
  const userStreaks = useMemo(() => {
    if (!user?.uid) return [];
    return streaks.filter((s) => s.userId === user.uid);
  }, [streaks, user?.uid]);

  // streaks not yet done today
  const filteredStreaks = useMemo(() => {
    return userStreaks.filter((s) => {
      if (!s.attendance || s.attendance.length === 0) return true;
      const today = moment().startOf('day');
      return !s.attendance.some((a) => {
        // Handle both Timestamp and string dates
        const date = convertToDate(a.date);
        return moment(date).isSame(today, 'day');
      });
    });
  }, [userStreaks]);

  // keep activeStep in range
  useEffect(() => {
    if (filteredStreaks.length === 0) {
      if (activeStep !== 0) setActiveStep(0);
      return;
    }
    if (activeStep >= filteredStreaks.length) {
      setActiveStep(filteredStreaks.length - 1);
    }
  }, [filteredStreaks.length, activeStep]);

  const debouncedProgress = useDebounce(currentProgress, 1000);

  // auto-save remarks
  useEffect(() => {
    if (!progressModalOpen || !selectedStreakId || !dirty) return;
    if (debouncedProgress === lastSavedRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        setSaving(true);
        await updateRemarks(
          { id: selectedStreakId } as StreakProps,
          debouncedProgress
        );
        if (!cancelled) {
          lastSavedRef.current = debouncedProgress;
        }
      } catch (err) {
        console.error('Failed to auto-save remarks:', err);
      } finally {
        if (!cancelled) setSaving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    debouncedProgress,
    dirty,
    progressModalOpen,
    selectedStreakId,
    updateRemarks,
  ]);

  // if no user → render nothing
  if (!user?.uid) return null;
  // if no streaks → render nothing
  if (filteredStreaks.length === 0) return null;

  const currentStreak = filteredStreaks[activeStep];
  if (!currentStreak) return null;

  const timeFormatted = currentStreak.reminder?.time
    ? moment(currentStreak.reminder.time, 'HH:mm').format('hh:mm A')
    : null;

  // Get the last progress entry from attendance
  const lastProgressEntry = currentStreak.attendance
    ?.filter((entry) => entry.progress)
    ?.sort((a, b) => {
      const dateA = convertToDate(a.date);
      const dateB = convertToDate(b.date);
      return moment(dateB).diff(moment(dateA));
    })?.[0];

  const openMarkUpdate = (streak: StreakProps) => {
    setSelectedStreakId(streak.id!);
    const initial = streak.currentProgress ?? '';
    setCurrentProgress(initial);
    lastSavedRef.current = initial;
    setDirty(false);
    setProgressModalOpen(true);
  };

  const saveAndMarkDone = async () => {
    if (!selectedStreakId) return;
    setSaving(true);
    try {
      // Find the full streak object to preserve existing attendance
      const fullStreak = streaks.find((s) => s.id === selectedStreakId);
      if (!fullStreak) {
        console.error('Streak not found');
        return;
      }

      await markStreakDone(fullStreak, currentProgress);
      setProgressModalOpen(false);
      setSelectedStreakId(null);
    } catch (err) {
      console.error('Failed to mark streak done:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box className="p-4 w-full max-w-4xl mx-auto">
      <Box className="flex justify-between items-center mb-3">
        <Typography variant="subtitle1" fontWeight="bold">
          🔥 Todays Streaks
        </Typography>
        <Link href="/streaks" className="text-sm text-sky-600 hover:underline">
          See all
        </Link>
      </Box>

      <Box className="flex items-center relative">
        <IconButton
          size="small"
          onClick={() => setActiveStep((prev) => prev - 1)}
          disabled={activeStep === 0}
          className="bg-white dark:bg-gray-800 shadow"
          sx={{ mr: 2 }}
        >
          <KeyboardArrowLeft />
        </IconButton>

        <Card className="flex-1 rounded-xl shadow-sm" sx={{ height: 160 }}>
          <CardContent className="flex flex-col justify-between h-full">
            <Typography
              variant="subtitle1"
              fontWeight="medium"
              gutterBottom
              noWrap
            >
              {currentStreak.title}
            </Typography>

            <Stack direction="row" spacing={1} mb={1} flexWrap="wrap">
              <Box className="text-xs text-gray-600 dark:text-gray-300">
                {currentStreak.habitType.toUpperCase()}
              </Box>
              <Box className="text-xs text-gray-500 dark:text-gray-400">
                {timeFormatted ? `at ${timeFormatted}` : ''}
              </Box>
              <Box className="text-xs text-sky-600 dark:text-sky-400">
                {currentStreak.streaksCount}🔥
              </Box>
            </Stack>

            {currentStreak.currentProgress && (
              <Typography
                variant="body2"
                sx={{
                  fontStyle: 'italic',
                  color: theme.palette.text.secondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  mb: 1,
                }}
                title={currentStreak.currentProgress}
              >
                {currentStreak.currentProgress}
              </Typography>
            )}

            {lastProgressEntry && !currentStreak.currentProgress && (
              <Typography
                variant="body2"
                sx={{
                  fontStyle: 'italic',
                  color: theme.palette.text.secondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  mb: 1,
                }}
                title={`Last progress (${moment(
                  convertToDate(lastProgressEntry.date)
                ).format('MMM DD')}): ${lastProgressEntry.progress}`}
              >
                Last: {lastProgressEntry.progress}
              </Typography>
            )}

            <Button
              variant="outlined"
              size="small"
              startIcon={<CheckCircleOutline />}
              onClick={() => openMarkUpdate(currentStreak)}
            >
              Mark / Update
            </Button>
          </CardContent>
        </Card>

        <IconButton
          size="small"
          onClick={() => setActiveStep((prev) => prev + 1)}
          disabled={activeStep === filteredStreaks.length - 1}
          className="bg-white dark:bg-gray-800 shadow"
          sx={{ ml: 2 }}
        >
          <KeyboardArrowRight />
        </IconButton>
      </Box>

      {/* Modal */}
      <Modal
        open={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
      >
        <Box
          sx={{
            p: 3,
            backgroundColor:
              theme.palette.mode === 'dark' ? '#1e1e1e' : 'white',
            color: theme.palette.text.primary,
            borderRadius: 2,
            width: 360,
            mx: 'auto',
            mt: '20%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            mb={2}
          >
            <Typography fontWeight={600}>Update Progress</Typography>
            {saving && <CircularProgress size={16} />}
          </Stack>

          <TextField
            fullWidth
            size="small"
            value={currentProgress}
            onChange={(e) => {
              setCurrentProgress(e.target.value);
              setDirty(true);
            }}
            placeholder="Remarks (optional)"
            inputProps={{ maxLength: 100 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {saving ? <CircularProgress size={16} /> : null}
                </InputAdornment>
              ),
            }}
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
            <Button onClick={() => setProgressModalOpen(false)}>
              Save & Close
            </Button>
            <Button
              variant="contained"
              disabled={saving}
              onClick={saveAndMarkDone}
            >
              {saving ? (
                <CircularProgress size={18} sx={{ color: 'white' }} />
              ) : (
                'Mark as Done'
              )}
            </Button>
          </Stack>
        </Box>
      </Modal>
    </Box>
  );
};

export default OnGoingStreaks;
