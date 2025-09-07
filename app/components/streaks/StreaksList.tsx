'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  Button,
  TextField,
  Tooltip,
  Chip,
} from '@mui/material';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import moment from 'moment-timezone';
import { StreakProps } from '@/app/lib/interface';
import { useStreaks } from '@/app/lib/context/StreaksContext';
import ProgressModal from './StreakMarkDone';
import DeleteStreak from './StreakDelete';
import { Timestamp } from 'firebase/firestore';

// ✅ simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
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

export default function StreaksList() {
  const { streaks, loading, markStreakDone, updateRemarks } = useStreaks();
  const [selectedStreak, setSelectedStreak] = useState<StreakProps | null>(
    null
  );
  const [modalOpen, setModalOpen] = useState(false);

  // Local remarks state per streak
  const [remarksMap, setRemarksMap] = useState<{ [id: string]: string }>({});

  // Handle saving streak done
  const handleSaveProgress = async (progress: string) => {
    if (!selectedStreak) return;
    await markStreakDone(selectedStreak, progress);
    setModalOpen(false);
    setSelectedStreak(null);
  };

  // ✅ Debounced remarks updater
  const debouncedRemarks = useDebounce(remarksMap, 1000);

  useEffect(() => {
    Object.entries(debouncedRemarks).forEach(([id, text]) => {
      const streak = streaks.find((s) => s.id === id);
      if (streak && streak.currentProgress !== text) {
        updateRemarks(streak, text); // 🔥 update only if changed
      }
    });
  }, [debouncedRemarks, streaks, updateRemarks]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (streaks.length === 0) {
    return <Typography>No streaks found.</Typography>;
  }

  return (
    <Box mt={4} display="grid" gap={2}>
      {streaks.map((streak) => {
        const timeFormatted = streak.reminder?.time
          ? moment(streak.reminder.time, 'HH:mm').format('hh:mm A')
          : null;

        const last7Days = Array.from({ length: 7 }, (_, i) =>
          moment()
            .subtract(6 - i, 'days')
            .startOf('day')
        );

        const attendanceDots = last7Days.map((date) => {
          const attendanceEntry = streak.attendance?.find((a) => {
            // Handle both Timestamp and string dates
            const entryDate = convertToDate(a.date);
            return moment(entryDate).isSame(date, 'day');
          });
          return {
            date: date.format('YYYY-MM-DD'),
            isPresent: !!attendanceEntry,
            progress: attendanceEntry?.progress,
          };
        });

        const today = moment().startOf('day');
        const alreadyDoneToday = streak.attendance?.some((a) => {
          // Handle both Timestamp and string dates
          const date = convertToDate(a.date);
          return moment(date).isSame(today, 'day');
        });

        return (
          <Card
            key={streak.id}
            sx={{
              position: 'relative',
              borderRadius: 2,
              boxShadow: 2,
              bgcolor: 'background.paper',
              '&:hover .delete-btn': { opacity: 1 },
            }}
          >
            {/* Delete Button */}
            <Box
              className="delete-btn"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                opacity: 0,
                transition: 'opacity 0.3s',
              }}
            >
              <DeleteStreak streakId={streak.id!} />
            </Box>

            <CardContent>
              <Typography variant="h6">{streak.title}</Typography>

              {streak.description && (
                <Typography variant="body2" color="text.secondary">
                  {streak.description}
                </Typography>
              )}

              <Typography
                variant="body2"
                mt={1}
                sx={{ color: 'green', fontWeight: 500 }}
              >
                {streak.habitType.toUpperCase()} •{' '}
                {timeFormatted ? `at ${timeFormatted}` : '—'} •{' '}
                {streak.streaksCount}🔥
              </Typography>

              {/* Attendance Stepper */}
              <Box mt={2}>
                <Stepper activeStep={-1} alternativeLabel>
                  {attendanceDots.map((dot, i) => {
                    const dayLetter = moment(dot.date).format('dd')[0];
                    const tooltipTitle = dot.isPresent
                      ? `${moment(dot.date).format('MMM DD')}${
                          dot.progress ? `: ${dot.progress}` : ''
                        }`
                      : `${moment(dot.date).format('MMM DD')}: Not completed`;

                    return (
                      <Step key={i}>
                        <StepLabel
                          icon={
                            <Tooltip title={tooltipTitle} arrow>
                              <Box
                                sx={{
                                  width: 28,
                                  height: 28,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '50%',
                                  bgcolor: dot.isPresent ? 'green' : 'grey.300',
                                  color: dot.isPresent ? 'white' : 'black',
                                  fontSize: 14,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                {dayLetter}
                              </Box>
                            </Tooltip>
                          }
                        />
                      </Step>
                    );
                  })}
                </Stepper>
              </Box>

              {/* Recent Progress Entries */}
              {streak.attendance && streak.attendance.length > 0 && (
                <Box mt={2}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Recent Progress:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {streak.attendance
                      .filter((entry) => entry.progress)
                      .slice(-3) // Show last 3 entries with progress
                      .map((entry, index) => (
                        <Chip
                          key={index}
                          label={`${moment(convertToDate(entry.date)).format(
                            'MMM DD'
                          )}: ${entry.progress}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      ))}
                  </Box>
                </Box>
              )}

              {/* Mark Done + Remarks */}
              <Box
                mt={2}
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap={1}
              >
                <Button
                  variant="contained"
                  color="success"
                  disabled={alreadyDoneToday}
                  onClick={() => {
                    setSelectedStreak(streak);
                    setModalOpen(true);
                  }}
                >
                  {alreadyDoneToday ? 'Done Today ✅' : 'Mark as Done'}
                </Button>

                {/* Remarks input (auto-save) */}
                <TextField
                  size="small"
                  placeholder="Write your remarks..."
                  value={remarksMap[streak.id!] ?? streak.currentProgress ?? ''}
                  onChange={(e) =>
                    setRemarksMap((prev) => ({
                      ...prev,
                      [streak.id!]: e.target.value,
                    }))
                  }
                  fullWidth
                  multiline
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        );
      })}

      {selectedStreak && (
        <ProgressModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          streakTitle={selectedStreak.title}
          onSave={handleSaveProgress}
        />
      )}
    </Box>
  );
}
