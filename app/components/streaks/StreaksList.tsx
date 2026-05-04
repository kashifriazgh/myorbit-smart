'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Tooltip,
  Chip,
  Skeleton,
  Stack,
} from '@mui/material';
import moment from 'moment-timezone';
import { StreakProps } from '@/app/lib/interface';
import { useStreaks } from '@/app/lib/context/StreaksContext';
import ProgressModal from './StreakMarkDone';
import DeleteStreak from './StreakDelete';
import { Timestamp } from 'firebase/firestore';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import StreaksModal from './StreaksModal';

/* ---------------------- Helpers ---------------------- */

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

function convertToDate(date: Timestamp | string | Date): Date {
  if (date instanceof Timestamp) return date.toDate();
  if (typeof date === 'string') return new Date(date);
  return date;
}

/* ---------------------- NEW CORE LOGIC ---------------------- */

function getUnitsByType(streak: StreakProps, isExpanded: boolean) {
  const attendance = streak.attendance || [];
  const today = moment();

  switch (streak.habitType) {
    case 'daily': {
      const length = isExpanded ? 30 : 7;
      return Array.from({ length }, (_, i) => {
        const date = moment().subtract(length - 1 - i, 'days');
        const found = attendance.find((a) =>
          moment(convertToDate(a.date)).isSame(date, 'day')
        );
        return {
          label: date.format('ddd, MMM DD'),
          short: date.format('D MMM'),
          isDone: !!found,
          isMissed: date.isBefore(today, 'day') && !found,
          isToday: date.isSame(today, 'day'),
        };
      });
    }

    case 'weekly': {
      const length = isExpanded ? 12 : 6;
      return Array.from({ length }, (_, i) => {
        const week = moment().startOf('week').subtract(length - 1 - i, 'weeks');
        const found = attendance.find((a) =>
          moment(convertToDate(a.date)).isSame(week, 'week')
        );
        return {
          label: `Week of ${week.format('MMM DD')}`,
          short: week.format('D MMM'),
          isDone: !!found,
          isMissed: week.isBefore(today, 'week') && !found,
          isToday: week.isSame(today, 'week'),
        };
      });
    }

    case 'bi-weekly': {
      const length = isExpanded ? 10 : 6;
      return Array.from({ length }, (_, i) => {
        const start = moment().startOf('week').subtract((length - 1 - i) * 2, 'weeks');
        const found = attendance.find((a) =>
          moment(convertToDate(a.date)).isSame(start, 'week') ||
          moment(convertToDate(a.date)).isSame(start.clone().add(1, 'week'), 'week')
        );
        return {
          label: `Bi-weekly: ${start.format('MMM DD')} - ${start.clone().add(13, 'days').format('MMM DD')}`,
          short: start.format('D MMM'),
          isDone: !!found,
          isMissed: start.isBefore(today, 'week') && !found,
          isToday: today.isBetween(start, start.clone().add(2, 'weeks'), 'day', '[)'),
        };
      });
    }

    case 'monthly': {
      const length = isExpanded ? 12 : 6;
      return Array.from({ length }, (_, i) => {
        const month = moment().subtract(length - 1 - i, 'months');
        const found = attendance.find((a) =>
          moment(convertToDate(a.date)).isSame(month, 'month')
        );
        return {
          label: month.format('MMMM YYYY'),
          short: month.format('MMM'),
          isDone: !!found,
          isMissed: month.isBefore(today, 'month') && !found,
          isToday: month.isSame(today, 'month'),
        };
      });
    }

    case 'quarterly': {
      const length = isExpanded ? 8 : 4;
      return Array.from({ length }, (_, i) => {
        const q = moment().subtract(length - 1 - i, 'quarters');
        const found = attendance.find((a) =>
          moment(convertToDate(a.date)).isSame(q, 'quarter')
        );
        return {
          label: `${q.format('YYYY')} - Quarter ${q.quarter()}`,
          short: `Q${q.quarter()}`,
          isDone: !!found,
          isMissed: q.isBefore(today, 'quarter') && !found,
          isToday: q.isSame(today, 'quarter'),
        };
      });
    }

    default:
      return [];
  }
}

/* ---------------------- Loading Skeleton ---------------------- */

function StreaksSkeleton() {
  return (
    <Stack spacing={2} mt={4}>
      {[1, 2, 3].map((i) => (
        <Card key={i} sx={{ borderRadius: 3, boxShadow: 3 }}>
          <CardContent>
            <Skeleton variant="text" width="40%" height={32} />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="20%" sx={{ mt: 1 }} />
            <Box mt={2} display="flex" gap={1}>
              {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                <Skeleton key={j} variant="rounded" width={48} height={56} sx={{ borderRadius: 2 }} />
              ))}
            </Box>
            <Box mt={2} display="flex" gap={2}>
              <Skeleton variant="rounded" width={120} height={36} />
              <Skeleton variant="rounded" width="100%" height={36} />
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

/* ---------------------- Component ---------------------- */

export default function StreaksList() {
  const { streaks, loading, markStreakDone, updateRemarks } = useStreaks();

  const [selectedStreak, setSelectedStreak] =
    useState<StreakProps | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [expandedStreaks, setExpandedStreaks] = useState<Set<string>>(new Set());

  const [remarksMap, setRemarksMap] = useState<{ [id: string]: string }>({});

  const debouncedRemarks = useDebounce(remarksMap, 1000);

  useEffect(() => {
    Object.entries(debouncedRemarks).forEach(([id, text]) => {
      const streak = streaks.find((s) => s.id === id);
      if (streak && streak.currentProgress !== text) {
        updateRemarks(streak, text);
      }
    });
  }, [debouncedRemarks, streaks, updateRemarks]);

  const toggleExpand = (id: string) => {
    setExpandedStreaks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveProgress = async (progress: string) => {
    if (!selectedStreak) return;
    await markStreakDone(selectedStreak, progress);
    setModalOpen(false);
    setSelectedStreak(null);
  };

  if (loading) {
    return <StreaksSkeleton />;
  }

  return (
    <Box mt={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight="bold">My Streaks</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => setCreateModalOpen(true)}
          sx={{ borderRadius: 2, textTransform: 'none' }}
        >
          New Streak
        </Button>
      </Box>

      {streaks.length === 0 ? (
        <Box 
          sx={{ 
            mt: 8, 
            textAlign: 'center', 
            p: 4, 
            bgcolor: 'background.paper', 
            borderRadius: 4, 
            boxShadow: 1 
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No streaks found. 
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Start tracking a new habit to build your consistency!
          </Typography>
          <Button 
            variant="outlined" 
            onClick={() => setCreateModalOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Create Your First Streak
          </Button>
        </Box>
      ) : (
        <Box display="grid" gap={2}>
          {streaks.map((streak) => {
            const timeFormatted = streak.reminder?.time
              ? moment(streak.reminder.time, 'HH:mm').format('hh:mm A')
              : null;

            const today = moment().startOf('day');

            const alreadyDoneToday = streak.attendance?.some((a) =>
              moment(convertToDate(a.date)).isSame(today, 'day')
            );

            const isExpanded = expandedStreaks.has(streak.id!);
            const units = getUnitsByType(streak, isExpanded);

            return (
              <Card key={streak.id} sx={{ borderRadius: 3, boxShadow: 3, position: 'relative' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    opacity: 0.7,
                    display: 'flex',
                    gap: 1
                  }}
                >
                  <Tooltip title={isExpanded ? "Show Less" : "View History"}>
                    <Button 
                      size="small" 
                      onClick={() => toggleExpand(streak.id!)}
                      sx={{ minWidth: 0, p: 0.5, color: isExpanded ? 'primary.main' : 'text.secondary' }}
                    >
                      <HistoryIcon fontSize="small" />
                    </Button>
                  </Tooltip>
                  <DeleteStreak streakId={streak.id!} />
                </Box>

                <CardContent>
                  <Typography variant="h6">{streak.title}</Typography>

                  <Typography variant="body2" color="text.secondary">
                    {streak.description}
                  </Typography>

                  <Typography
                    variant="body2"
                    mt={1}
                    sx={{ color: 'green', fontWeight: 600 }}
                  >
                    {streak.habitType.toUpperCase()} •{' '}
                    {timeFormatted || '—'} • {streak.streaksCount}🔥
                  </Typography>

                  {/* 🔥 NEW TIMELINE UI */}
                  <Box 
                    mt={2} 
                    display="flex" 
                    gap={1} 
                    sx={{ 
                      overflowX: 'auto', 
                      pb: 1,
                      '::-webkit-scrollbar': { height: 6 },
                      '::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 }
                    }}
                  >
                    {units.map((u, i) => (
                      <Tooltip key={i} title={u.label}>
                        <Box
                          sx={{
                            width: 48,
                            minWidth: 48,
                            height: 56,
                            borderRadius: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            flexShrink: 0,

                            bgcolor: u.isDone
                              ? '#d1fae5'
                              : u.isMissed
                              ? '#fee2e2'
                              : '#f3f4f6',
                          }}
                        >
                          {/* circle */}
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              border: '2px solid',
                              borderColor: u.isDone
                                ? 'green'
                                : u.isMissed
                                ? 'red'
                                : '#ccc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                              color: u.isDone ? 'green' : 'red',
                            }}
                          >
                            {u.isDone ? '✓' : u.isMissed ? '!' : ''}
                          </Box>

                          {/* label */}
                          <Typography fontSize={10} mt={0.5} align="center">
                            {u.short}
                          </Typography>

                          {/* today indicator */}
                          {u.isToday && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 4,
                                width: 18,
                                height: 3,
                                borderRadius: 2,
                                bgcolor: 'blue',
                              }}
                            />
                          )}
                        </Box>
                      </Tooltip>
                    ))}
                  </Box>

                  {/* Recent Progress */}
                  {streak.attendance && streak.attendance.length > 0 && (
                    <Box mt={2}>
                      <Typography variant="body2" color="text.secondary">
                        Recent Progress:
                      </Typography>

                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {streak.attendance
                          .filter((e) => e.progress)
                          .slice(-3)
                          .map((entry, i) => (
                            <Chip
                              key={i}
                              label={`${moment(convertToDate(entry.date)).format(
                                'MMM DD'
                              )}: ${entry.progress}`}
                              size="small"
                            />
                          ))}
                      </Box>
                    </Box>
                  )}

                  {/* Actions */}
                  <Box mt={2}>
                    <Button
                      variant="contained"
                      color="success"
                      disabled={alreadyDoneToday}
                      onClick={() => {
                        setSelectedStreak(streak);
                        setModalOpen(true);
                      }}
                    >
                      {alreadyDoneToday
                        ? 'Done Today ✅'
                        : 'Mark as Done'}
                    </Button>

                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      placeholder="Write remarks..."
                      sx={{ mt: 1 }}
                      value={
                        remarksMap[streak.id!] ??
                        streak.currentProgress ??
                        ''
                      }
                      onChange={(e) =>
                        setRemarksMap((prev) => ({
                          ...prev,
                          [streak.id!]: e.target.value,
                        }))
                      }
                    />
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      {selectedStreak && (
        <ProgressModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          streakTitle={selectedStreak.title}
          onSave={handleSaveProgress}
        />
      )}

      <StreaksModal 
        open={createModalOpen} 
        onClose={() => setCreateModalOpen(false)} 
        onSave={() => {}} // useStreaks context handles the update automatically
      />
    </Box>
  );
}