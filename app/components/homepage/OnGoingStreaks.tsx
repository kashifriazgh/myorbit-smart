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
  
  InputAdornment,
  Chip,
  useMediaQuery,
} from '@mui/material';
import {
  CheckCircleOutline,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  AccessTime,
  LocalFireDepartment,
  Edit,
  Save,
} from '@mui/icons-material';
import { useState, useMemo, useEffect, useRef } from 'react';
import { StreakProps } from '@/app/lib/interface';
import { useStreaks } from '@/app/lib/context/StreaksContext';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import moment from 'moment';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import 'keen-slider/keen-slider.min.css';
import { useKeenSlider } from 'keen-slider/react';

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

// Calculate time difference in minutes from current time
function getTimeDifferenceInMinutes(reminderTime: string | undefined): number {
  if (!reminderTime) return Infinity; // No reminder = lowest priority

  const [hours, minutes] = reminderTime.split(':').map(Number);
  const reminderMoment = moment().hours(hours).minutes(minutes).seconds(0);
  const now = moment();

  // If reminder time has passed today, consider it for tomorrow
  if (reminderMoment.isBefore(now)) {
    reminderMoment.add(1, 'day');
  }

  return Math.abs(reminderMoment.diff(now, 'minutes'));
}

const OnGoingStreaks = () => {
  
  const { theme } = useCustomTheme();
  const { streaks, markStreakDone, updateRemarks } = useStreaks();
  const { user } = useAuth();
  const isMobile = useMediaQuery('(max-width:639px)', { noSsr: true });

  const [activeStep, setActiveStep] = useState(0);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [selectedStreakId, setSelectedStreakId] = useState<string | null>(null);
  const [currentProgress, setCurrentProgress] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);

  const lastSavedRef = useRef<string>('');

  // 🔑 filter for user-specific streaks
  const userStreaks = useMemo(() => {
    if (!user?.uid) return [];
    return streaks.filter((s) => s.userId === user.uid);
  }, [streaks, user?.uid]);

  // streaks not yet done today, sorted by reminder time proximity
  const filteredStreaks = useMemo(() => {
    const notDoneToday = userStreaks.filter((s) => {
      if (!s.attendance || s.attendance.length === 0) return true;
      const today = moment().startOf('day');
      return !s.attendance.some((a) => {
        const date = convertToDate(a.date);
        return moment(date).isSame(today, 'day');
      });
    });

    // Sort by reminder time proximity (closest to current time first)
    return notDoneToday.sort((a, b) => {
      const timeA = a.reminder?.time || a.reminderTime || '';
      const timeB = b.reminder?.time || b.reminderTime || '';

      const diffA = getTimeDifferenceInMinutes(timeA);
      const diffB = getTimeDifferenceInMinutes(timeB);

      return diffA - diffB;
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

  // auto-save remarks (progress only, not marking done)
  useEffect(() => {
    if (!progressModalOpen || !selectedStreakId || !dirty) return;
    if (debouncedProgress === lastSavedRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        setSavingProgress(true);
        const streak = filteredStreaks.find((s) => s.id === selectedStreakId);
        if (streak) {
          await updateRemarks(streak, debouncedProgress);
          if (!cancelled) {
            lastSavedRef.current = debouncedProgress;
          }
        }
      } catch (err) {
        console.error('Failed to auto-save progress:', err);
      } finally {
        if (!cancelled) setSavingProgress(false);
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
    filteredStreaks,
  ]);

  // Keen Slider for mobile
  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>({
    slides: { perView: 1.1, spacing: 12 },
    breakpoints: {
      '(min-width: 640px)': { slides: { perView: 2, spacing: 16 } },
    },
    loop: false,
    drag: true,
    rubberband: true,
    initial: activeStep,
    slideChanged: (slider) => {
      setActiveStep(slider.track.details.abs);
    },
  });

  // Sync slider with activeStep changes
  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.moveToIdx(activeStep);
    }
  }, [activeStep, instanceRef]);

  // if no user → render nothing
  if (!user?.uid) return null;
  // if no streaks → render nothing
  if (filteredStreaks.length === 0) return null;

  const currentStreak = filteredStreaks[activeStep];
  if (!currentStreak) return null;

  const openProgressModal = (streak: StreakProps) => {
    setSelectedStreakId(streak.id!);
    const initial = streak.currentProgress ?? '';
    setCurrentProgress(initial);
    lastSavedRef.current = initial;
    setDirty(false);
    setProgressModalOpen(true);
  };

  const handleSaveProgressOnly = async () => {
    if (!selectedStreakId) return;
    setSaving(true);
    try {
      const streak = filteredStreaks.find((s) => s.id === selectedStreakId);
      if (streak) {
        await updateRemarks(streak, currentProgress);
        lastSavedRef.current = currentProgress;
        setDirty(false);
      }
    } catch (err) {
      console.error('Failed to save progress:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkDone = async (streakId?: string, progress?: string) => {
    const targetStreakId = streakId || selectedStreakId;
    if (!targetStreakId) return;

    setSaving(true);
    try {
      const streak = filteredStreaks.find((s) => s.id === targetStreakId);
      if (streak) {
        const progressToSave =
          progress !== undefined ? progress : currentProgress;
        await markStreakDone(streak, progressToSave);

        if (progressModalOpen) {
          setProgressModalOpen(false);
        }
        setSelectedStreakId(null);
        setCurrentProgress('');
        setDirty(false);

        // Move to next streak if available
        const currentIndex = filteredStreaks.findIndex(
          (s) => s.id === targetStreakId
        );
        if (currentIndex !== -1) {
          if (currentIndex < filteredStreaks.length - 1) {
            setActiveStep(currentIndex + 1);
          } else if (currentIndex > 0) {
            setActiveStep(currentIndex - 1);
          }
        }
      }
    } catch (err) {
      console.error('Failed to mark streak done:', err);
    } finally {
      setSaving(false);
    }
  };

  const handlePrevious = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleNext = () => {
    if (activeStep < filteredStreaks.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const getTimeStatusColor = (reminderTime: string | undefined): string => {
    if (!reminderTime) return theme?.mode === 'dark' ? '#64748b' : '#94a3b8';

    const diffMinutes = getTimeDifferenceInMinutes(reminderTime);

    if (diffMinutes <= 30) return '#ef4444'; // Red - very soon
    if (diffMinutes <= 60) return '#f59e0b'; // Orange - soon
    if (diffMinutes <= 120) return '#3b82f6'; // Blue - upcoming
    return theme?.mode === 'dark' ? '#64748b' : '#94a3b8'; // Gray - later
  };

  const StreakCard = ({
    streak,
  }: {
    streak: StreakProps;
    index: number;
  }) => {
    const reminderTime = streak.reminder?.time || streak.reminderTime;
    const timeFormatted = reminderTime
      ? moment(reminderTime, 'HH:mm').format('hh:mm A')
      : null;

    const lastProgressEntry = streak.attendance
      ?.filter((entry) => entry.progress)
      ?.sort((a, b) => {
        const dateA = convertToDate(a.date);
        const dateB = convertToDate(b.date);
        return moment(dateB).diff(moment(dateA));
      })?.[0];

    return (
      <Card
        sx={{
          height: '100%',
          minHeight: 200,
          background:
            theme?.mode === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
          borderRadius: 3,
          boxShadow:
            '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow:
              '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          },
        }}
      >
        <CardContent
          sx={{
            p: 3,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
                mb: 1,
                fontSize: '1.25rem',
                lineHeight: 1.3,
              }}
              noWrap
            >
              {streak.title}
            </Typography>

            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              <Chip
                label={streak.habitType.toUpperCase()}
                size="small"
                sx={{
                  backgroundColor:
                    theme?.mode === 'dark' ? '#475569' : '#e2e8f0',
                  color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: 22,
                }}
              />
              {timeFormatted && (
                <Chip
                  icon={<AccessTime sx={{ fontSize: '0.875rem !important' }} />}
                  label={timeFormatted}
                  size="small"
                  sx={{
                    backgroundColor: getTimeStatusColor(reminderTime) + '20',
                    color: getTimeStatusColor(reminderTime),
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: 22,
                    border: `1px solid ${getTimeStatusColor(reminderTime)}40`,
                  }}
                />
              )}
              <Chip
                icon={
                  <LocalFireDepartment
                    sx={{ fontSize: '0.875rem !important' }}
                  />
                }
                label={`${streak.streaksCount}🔥`}
                size="small"
                sx={{
                  backgroundColor:
                    theme?.mode === 'dark' ? '#7f1d1d' : '#fee2e2',
                  color: theme?.mode === 'dark' ? '#fca5a5' : '#991b1b',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  height: 22,
                }}
              />
            </Stack>
          </Box>

          {/* Progress Display */}
          <Box sx={{ flexGrow: 1, mb: 2 }}>
            {streak.currentProgress ? (
              <Typography
                variant="body2"
                sx={{
                  fontStyle: 'italic',
                  color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
                  mb: 1,
                  lineHeight: 1.6,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                title={streak.currentProgress}
              >
                {streak.currentProgress}
              </Typography>
            ) : lastProgressEntry ? (
              <Typography
                variant="body2"
                sx={{
                  fontStyle: 'italic',
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
                  mb: 1,
                  lineHeight: 1.6,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                title={`Last progress (${moment(
                  convertToDate(lastProgressEntry.date)
                ).format('MMM DD')}): ${lastProgressEntry.progress}`}
              >
                Last: {lastProgressEntry.progress}
              </Typography>
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#64748b' : '#94a3b8',
                  fontStyle: 'italic',
                }}
              >
                No progress recorded yet
              </Typography>
            )}
          </Box>

          {/* Actions */}
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Edit />}
              onClick={() => openProgressModal(streak)}
              sx={{
                flex: 1,
                textTransform: 'none',
                borderColor: theme?.mode === 'dark' ? '#475569' : '#cbd5e1',
                color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
                '&:hover': {
                  borderColor: theme?.mode === 'dark' ? '#64748b' : '#94a3b8',
                  backgroundColor:
                    theme?.mode === 'dark' ? '#334155' : '#f1f5f9',
                },
              }}
            >
              Update
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<CheckCircleOutline />}
              onClick={() =>
                handleMarkDone(streak.id!, streak.currentProgress || '')
              }
              disabled={saving}
              sx={{
                flex: 1,
                textTransform: 'none',
                backgroundColor: '#10b981',
                '&:hover': {
                  backgroundColor: '#059669',
                },
                '&:disabled': {
                  backgroundColor:
                    theme?.mode === 'dark' ? '#374151' : '#9ca3af',
                },
              }}
            >
              Done
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Card
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        borderRadius: '1rem',
        p: 3,
      }}
    >
      <Box className="flex justify-between items-center mb-4">
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
          }}
        >
          🔥 Today&#39;s Streaks
        </Typography>
        <Link
          href="/streaks"
          style={{
            fontSize: '0.875rem',
            color: theme?.mode === 'dark' ? '#60a5fa' : '#2563eb',
            textDecoration: 'none',
          }}
          className="hover:underline"
        >
          See all
        </Link>
      </Box>

      {filteredStreaks.length === 0 ? (
        <Box className="text-center py-8">
          <Typography
            variant="body1"
            sx={{
              color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
              mb: 2,
            }}
          >
            All streaks completed for today! 🎉
          </Typography>
        </Box>
      ) : (
        <>
          {/* Desktop view: 2 cards per row */}
          <Box className="hidden sm:grid grid-cols-2 gap-4">
            {filteredStreaks.slice(0, 4).map((streak, index) => (
              <StreakCard key={streak.id} streak={streak} index={index} />
            ))}
          </Box>

          {/* Mobile view: slider */}
          {isMobile && (
            <Box sx={{ position: 'relative' }}>
              <div ref={sliderRef} className="keen-slider">
                {filteredStreaks.map((streak, index) => (
                  <div key={streak.id} className="keen-slider__slide">
                    <div className="pr-3">
                      <StreakCard streak={streak} index={index} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation arrows */}
              {filteredStreaks.length > 1 && (
                <>
                  <IconButton
                    size="small"
                    onClick={handlePrevious}
                    disabled={activeStep === 0}
                    sx={{
                      position: 'absolute',
                      left: -12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor:
                        theme?.mode === 'dark' ? '#334155' : '#ffffff',
                      border: `1px solid ${
                        theme?.mode === 'dark' ? '#475569' : '#e2e8f0'
                      }`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      zIndex: 2,
                      '&:hover': {
                        backgroundColor:
                          theme?.mode === 'dark' ? '#475569' : '#f1f5f9',
                      },
                      '&:disabled': {
                        opacity: 0.3,
                      },
                    }}
                  >
                    <KeyboardArrowLeft />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleNext}
                    disabled={activeStep === filteredStreaks.length - 1}
                    sx={{
                      position: 'absolute',
                      right: -12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      backgroundColor:
                        theme?.mode === 'dark' ? '#334155' : '#ffffff',
                      border: `1px solid ${
                        theme?.mode === 'dark' ? '#475569' : '#e2e8f0'
                      }`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      zIndex: 2,
                      '&:hover': {
                        backgroundColor:
                          theme?.mode === 'dark' ? '#475569' : '#f1f5f9',
                      },
                      '&:disabled': {
                        opacity: 0.3,
                      },
                    }}
                  >
                    <KeyboardArrowRight />
                  </IconButton>
                </>
              )}
            </Box>
          )}
        </>
      )}

      {/* Progress Modal */}
      <Modal
        open={progressModalOpen}
        onClose={() => {
          setProgressModalOpen(false);
          setSelectedStreakId(null);
          setDirty(false);
        }}
      >
        <Box
          sx={{
            p: 3,
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
            borderRadius: 3,
            width: { xs: '90%', sm: 420 },
            maxWidth: 420,
            mx: 'auto',
            mt: { xs: '10%', sm: '15%' },
            boxShadow:
              '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography fontWeight={700} variant="h6" sx={{ mb: 0.5 }}>
                Update Progress
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
                }}
              >
                {currentStreak.title}
              </Typography>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={4}
              value={currentProgress}
              onChange={(e) => {
                setCurrentProgress(e.target.value);
                setDirty(true);
              }}
              placeholder="Add your progress or remarks (optional)..."
              inputProps={{ maxLength: 200 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor:
                    theme?.mode === 'dark' ? '#0f172a' : '#f8fafc',
                },
              }}
              InputProps={{
                endAdornment: savingProgress && (
                  <InputAdornment position="end">
                    <CircularProgress size={16} />
                  </InputAdornment>
                ),
              }}
            />

            {dirty && debouncedProgress !== lastSavedRef.current && (
              <Typography
                variant="caption"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
                  fontStyle: 'italic',
                }}
              >
                Auto-saving...
              </Typography>
            )}

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                onClick={() => {
                  setProgressModalOpen(false);
                  setSelectedStreakId(null);
                  setDirty(false);
                }}
                disabled={saving}
                sx={{
                  color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
                }}
              >
                Cancel
              </Button>
              <Button
                variant="outlined"
                startIcon={<Save />}
                onClick={handleSaveProgressOnly}
                disabled={saving || savingProgress}
                sx={{
                  borderColor: theme?.mode === 'dark' ? '#475569' : '#cbd5e1',
                  color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
                  '&:hover': {
                    borderColor: theme?.mode === 'dark' ? '#64748b' : '#94a3b8',
                    backgroundColor:
                      theme?.mode === 'dark' ? '#334155' : '#f1f5f9',
                  },
                }}
              >
                {savingProgress ? 'Saving...' : 'Save Progress'}
              </Button>
              <Button
                variant="contained"
                startIcon={<CheckCircleOutline />}
                onClick={() => handleMarkDone()}
                disabled={saving}
                sx={{
                  backgroundColor: '#10b981',
                  '&:hover': {
                    backgroundColor: '#059669',
                  },
                }}
              >
                {saving ? (
                  <CircularProgress size={18} sx={{ color: 'white' }} />
                ) : (
                  'Mark Done'
                )}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Modal>
    </Card>
  );
};

export default OnGoingStreaks;
