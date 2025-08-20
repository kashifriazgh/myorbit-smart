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
} from '@mui/material';
import {
  CheckCircleOutline,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { StreakProps } from '@/app/lib/interface';
import moment from 'moment';
import Link from 'next/link';

const OnGoingStreaks = () => {
  const theme = useMuiTheme();
  const [streaks, setStreaks] = useState<StreakProps[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [selectedStreak, setSelectedStreak] = useState<StreakProps | null>(
    null
  );
  const [currentProgress, setCurrentProgress] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch streaks in real-time
  useEffect(() => {
    const streaksRef = collection(db, 'streaks');
    const unsub = onSnapshot(streaksRef, (snap) => {
      const allStreaks = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as StreakProps),
      }));
      setStreaks(allStreaks);
    });
    return () => unsub();
  }, []);

  // Filter streaks not yet done
  const filteredStreaks = useMemo(() => {
    return streaks.filter((s) => {
      if (!s.attendance || s.attendance.length === 0) return true;

      const today = moment().startOf('day');
      if (s.habitType === 'daily') {
        return !s.attendance.some((a) => moment(a.date).isSame(today, 'day'));
      } else if (s.habitType === 'weekly') {
        const weekStart = moment().startOf('week');
        const weekEnd = moment().endOf('week');
        return !s.attendance.some((a) => {
          const aDate = moment(a.date);
          return aDate.isBetween(weekStart, weekEnd, undefined, '[]');
        });
      }
      return true;
    });
  }, [streaks]);

  const currentStreak = filteredStreaks[activeStep];
  if (!currentStreak) return null;

  const timeFormatted = currentStreak.reminderTime
    ? moment(currentStreak.reminderTime, 'HH:mm').format('hh:mm A')
    : null;

  const isDoneToday = currentStreak.lastChecked
    ? moment(currentStreak.lastChecked.toDate()).isSame(moment(), 'day')
    : false;

  const handleMarkDone = (streak: StreakProps) => {
    setSelectedStreak(streak);
    setCurrentProgress('');
    setProgressModalOpen(true);
  };

  const saveProgress = async () => {
    if (!selectedStreak?.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'streaks', selectedStreak.id), {
        currentProgress,
        updatedAt: Timestamp.now(),
        lastChecked: Timestamp.now(),
      });
      setProgressModalOpen(false);
      setSelectedStreak(null);
    } catch (err) {
      console.error('Failed to update streak:', err);
    } finally {
      setSaving(false);
    }
  };

  if (filteredStreaks.length === 0) return null;

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
        {/* Left Arrow */}
        <IconButton
          size="small"
          onClick={() => setActiveStep((prev) => prev - 1)}
          disabled={activeStep === 0}
          className="bg-white dark:bg-gray-800 shadow"
          sx={{ mr: 2 }}
        >
          {theme.direction === 'rtl' ? (
            <KeyboardArrowRight />
          ) : (
            <KeyboardArrowLeft />
          )}
        </IconButton>

        {/* Streak Card */}
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
              >
                {currentStreak.currentProgress}
              </Typography>
            )}

            <Button
              variant="outlined"
              size="small"
              startIcon={<CheckCircleOutline />}
              onClick={() => handleMarkDone(currentStreak)}
              disabled={isDoneToday}
            >
              {isDoneToday ? 'Done Today' : 'Mark as Done'}
            </Button>
          </CardContent>
        </Card>

        {/* Right Arrow */}
        <IconButton
          size="small"
          onClick={() => setActiveStep((prev) => prev + 1)}
          disabled={activeStep === filteredStreaks.length - 1}
          className="bg-white dark:bg-gray-800 shadow"
          sx={{ ml: 2 }}
        >
          {theme.direction === 'rtl' ? (
            <KeyboardArrowLeft />
          ) : (
            <KeyboardArrowRight />
          )}
        </IconButton>
      </Box>

      {/* Progress Modal */}
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
            width: 320,
            mx: 'auto',
            mt: '20%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <Typography fontWeight={600} mb={2}>
            Update Progress
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={currentProgress}
            onChange={(e) => setCurrentProgress(e.target.value)}
            placeholder="Write today’s progress (e.g. Surah Baqarah verse 20)"
            sx={{
              backgroundColor:
                theme.palette.mode === 'dark' ? '#2a2a2a' : 'white',
              color: theme.palette.text.primary,
            }}
            inputProps={{ maxLength: 100 }}
          />
          <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
            <Button onClick={() => setProgressModalOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              disabled={saving || !currentProgress}
              onClick={saveProgress}
            >
              {saving ? (
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

export default OnGoingStreaks;
