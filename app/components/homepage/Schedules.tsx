'use client';

import moment from 'moment';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  Chip,
  Card,
  CardContent,
  Button,
  Skeleton,
  Alert,
  Snackbar,
  Badge,
  styled,
  
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  AccessTime as TimeIcon,
  CalendarMonth as CalendarIcon,
  ArrowForward as ArrowIcon,
  CheckCircle,
  RadioButtonUnchecked,
} from '@mui/icons-material';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { SchedulesProps } from '../../lib/interface';
import {
  getSchedulesByUserAndDate,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedulesByUserAndDateRange,
  getAllSchedulesByUser,
} from '../../lib/functions/schedules';
import SchedulesModal from './SchedulesModal';

// Custom Styled Badge
const StyledBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    right: -3,
    top: 3,
    border: `2px solid ${theme.palette.background.paper}`,
    padding: '0 4px',
  },
}));

// Custom Step Icon Component
const CustomStepIcon: React.FC<{
  completed?: boolean;
  active?: boolean;
  isTimePassed?: boolean;
  children?: React.ReactNode;
}> = ({ isTimePassed, children }) => {
  const { theme } = useCustomTheme();

  return (
    <Box
      sx={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: isTimePassed
          ? theme?.mode === 'dark' ? '#3b82f6' : '#2563eb'
          : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isTimePassed
          ? 'white'
          : theme?.mode === 'dark' ? '#9ca3af' : '#6b7280',
        fontSize: '12px',
        fontWeight: 'bold',
        border: `2px solid ${
          isTimePassed
            ? theme?.mode === 'dark' ? '#3b82f6' : '#2563eb'
            : theme?.mode === 'dark' ? '#9ca3af' : '#6b7280'
        }`,
      }}
    >
      {children}
    </Box>
  );
};

// ─── QuickAddScheduleRow ────────────────────────────────────────────────────
interface QuickAddScheduleRowProps {
  selectedDate: string;
  isDark: boolean;
  onAdd: (title: string, startTime: string) => Promise<void>;
}

const QuickAddScheduleRow = ({ isDark, onAdd }: QuickAddScheduleRowProps) => {
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(() => {
    // Default to next rounded hour
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    return now.toTimeString().slice(0, 5);
  });
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active) setTimeout(() => titleRef.current?.focus(), 50);
  }, [active]);

  const commit = async () => {
    if (title.trim()) {
      await onAdd(title.trim(), startTime);
      setTitle('');
    }
    setActive(false);
  };

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className={`
          flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 w-full text-left
          focus:outline-none focus:ring-2 focus:ring-amber-300 mb-2
          ${isDark
            ? 'text-slate-500 hover:text-amber-400 hover:bg-slate-800/50'
            : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'}
        `}
      >
        <span
          className={`w-5 h-5 rounded-md border-2 border-dashed flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
            isDark ? 'border-slate-700' : 'border-slate-300'
          }`}
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
        </span>
        Quickly add a schedule…
      </button>
    );
  }

  return (
    <Box
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-2 transition-all ${
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
      }`}
    >
      {/* Time input */}
      <input
        type="time"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
        className={`bg-transparent border-none text-xs outline-none cursor-pointer p-0.5 w-[72px] flex-shrink-0 ${
          isDark ? 'text-amber-400' : 'text-amber-600'
        }`}
        style={{ colorScheme: isDark ? 'dark' : 'light' }}
      />

      {/* Title input */}
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setActive(false); setTitle(''); }
        }}
        placeholder="Schedule title…"
        className={`
          flex-1 text-sm bg-transparent border-none
          focus:outline-none placeholder:text-slate-500
          ${isDark ? 'text-slate-200' : 'text-slate-700'}
        `}
      />

      <Button
        size="small"
        variant="text"
        onClick={commit}
        disabled={!title.trim()}
        sx={{ minWidth: 'auto', p: 0.5, fontWeight: 'bold', color: '#f59e0b' }}
      >
        Add
      </Button>
    </Box>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────
const Schedules: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'quick' | 'daily' | 'future'>('quick');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load view mode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('schedules_view_mode');
    if (savedMode === 'quick' || savedMode === 'daily' || savedMode === 'future') {
      setViewMode(savedMode);
    }
    setIsLoaded(true);
  }, []);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('schedules_view_mode', viewMode);
    }
  }, [viewMode, isLoaded]);

  const [schedules, setSchedules] = useState<SchedulesProps[]>([]);
  const [counts, setCounts] = useState<{ [date: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SchedulesProps | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  const isDark = theme?.mode === 'dark';

  // Generate 5 dates starting from today
  const dates = useMemo(() => {
    const d = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      d.push({
        date: date.getDate().toString(),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: date.toISOString().split('T')[0],
      });
    }
    return d;
  }, []);

  useEffect(() => {
    if (dates.length > 0) setSelectedDate(dates[0].fullDate);
  }, [dates]);

  const fetchCounts = useCallback(async () => {
    if (user) {
      try {
        const start = dates[0].fullDate;
        const end = new Date();
        end.setDate(end.getDate() + 30);
        const range = await getSchedulesByUserAndDateRange(
          user.uid,
          start,
          end.toISOString().split('T')[0]
        );
        const countsMap: { [date: string]: number } = {};
        const todayStr = new Date().toISOString().split('T')[0];
        range.forEach(s => {
          if (s.isFlexible) {
            countsMap[todayStr] = (countsMap[todayStr] || 0) + 1;
          } else {
            countsMap[s.date] = (countsMap[s.date] || 0) + 1;
          }
        });
        setCounts(countsMap);
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    }
  }, [user, dates]);

  const fetchSchedules = useCallback(async () => {
    if (selectedDate && user && (viewMode === 'daily' || viewMode === 'quick')) {
      setLoading(true);
      try {
        const fetchedSchedules = await getSchedulesByUserAndDate(user.uid, selectedDate);
        const todayStr = new Date().toISOString().split('T')[0];
        const finalSchedules = fetchedSchedules;
        if (selectedDate === todayStr) {
          const all = await getAllSchedulesByUser(user.uid, 500);
          const flexible = all.filter(s => s.isFlexible);
          const existingIds = new Set(finalSchedules.map(s => s.id));
          flexible.forEach(s => { if (!existingIds.has(s.id)) finalSchedules.push(s); });
        }
        setSchedules(finalSchedules.sort((a, b) => a.startTime.localeCompare(b.startTime)));
      } catch (error) {
        console.error('Error fetching schedules:', error);
        setSnackbar({ open: true, message: 'Failed to load schedules', severity: 'error' });
      } finally {
        setLoading(false);
      }
    } else if (user && viewMode === 'future') {
      setLoading(true);
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const end = new Date();
        end.setDate(end.getDate() + 90);
        const fetched = await getSchedulesByUserAndDateRange(
          user.uid,
          todayStr,
          end.toISOString().split('T')[0]
        );
        setSchedules(fetched);
      } catch {
        setSnackbar({ open: true, message: 'Failed to load future schedules', severity: 'error' });
      } finally {
        setLoading(false);
      }
    }
  }, [selectedDate, user, viewMode]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  useEffect(() => {
    const handleScheduleCreated = (event: CustomEvent) => {
      const createdDate = event.detail?.date;
      if (user) {
        fetchCounts();
        if (createdDate === selectedDate || viewMode === 'future') fetchSchedules();
      }
    };
    window.addEventListener('scheduleCreated', handleScheduleCreated as EventListener);
    return () => window.removeEventListener('scheduleCreated', handleScheduleCreated as EventListener);
  }, [selectedDate, user, viewMode, fetchSchedules, fetchCounts]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTimeRange = (startTime: string, endTime: string, isFlexible?: boolean) => {
    if (isFlexible) return 'Flexible';
    return `${formatTime(startTime)} – ${formatTime(endTime)}`;
  };

  const handleAddSchedule = () => { setEditingSchedule(null); setModalOpen(true); };

  const handleEditSchedule = (scheduleId: string) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (schedule) { setEditingSchedule(schedule); setModalOpen(true); }
  };

  const handleSaveSchedule = async (scheduleData: SchedulesProps) => {
    setIsSaving(true);
    try {
      if (!scheduleData.title || !scheduleData.startTime) throw new Error('Title and start time are required');
      if (scheduleData.id) {
        await updateSchedule(scheduleData.id, scheduleData);
        setSnackbar({ open: true, message: 'Schedule updated successfully', severity: 'success' });
      } else {
        const { ...scheduleToCreate } = scheduleData;
        await createSchedule(scheduleToCreate);
        setSnackbar({ open: true, message: 'Schedule created successfully', severity: 'success' });
      }
      fetchCounts();
      fetchSchedules();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save schedule';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    setIsSaving(true);
    try {
      await deleteSchedule(scheduleId);
      setSnackbar({ open: true, message: 'Schedule deleted successfully', severity: 'success' });
      fetchCounts();
      fetchSchedules();
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete schedule', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => { setModalOpen(false); setEditingSchedule(null); };
  const handleCloseSnackbar = () => setSnackbar(prev => ({ ...prev, open: false }));

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'medium': return '#2196f3';
      case 'low': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  const isTimePassed = (startTime: string, date: string) => {
    const now = new Date();
    const scheduleDateTime = new Date(`${date}T${startTime}:00`);
    return now > scheduleDateTime;
  };

  // Quick add handler
  const handleQuickAdd = async (title: string, startTime: string) => {
    if (!user) return;
    const endHour = (parseInt(startTime.split(':')[0]) + 1) % 24;
    const endTime = `${String(endHour).padStart(2, '0')}:${startTime.split(':')[1]}`;
    try {
      await createSchedule({
        userId: user.uid,
        title,
        date: selectedDate,
        startTime,
        endTime,
        status: 'pending',
        isFlexible: false,
      });
      await fetchSchedules();
      await fetchCounts();
    } catch (err) {
      console.error('Failed to quick-add schedule:', err);
    }
  };

  // Toggle schedule status (quick view)
  const handleToggleStatus = async (schedule: SchedulesProps) => {
    if (!schedule.id) return;
    const newStatus = schedule.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateSchedule(schedule.id, { status: newStatus });
      setSchedules(prev =>
        prev.map(s => s.id === schedule.id ? { ...s, status: newStatus } : s)
      );
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Date tab strip (shared across quick + daily)
  const DateTabStrip = () => (
    <Box display="flex" justifyContent="center" mb={2}>
      <Box display="flex" alignItems="center" gap={1}>
        {dates.map((dateInfo) => {
          const isSelected = selectedDate === dateInfo.fullDate;
          const count = counts[dateInfo.fullDate] || 0;
          return (
            <StyledBadge
              key={dateInfo.fullDate}
              badgeContent={count}
              color="secondary"
              invisible={count === 0}
            >
              <Box
                onClick={() => setSelectedDate(dateInfo.fullDate)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 64,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease-in-out',
                  backgroundColor: isSelected
                    ? '#fbbf24'
                    : isDark ? '#374151' : '#f3f4f6',
                  '&:hover': {
                    backgroundColor: isSelected
                      ? '#f59e0b'
                      : isDark ? '#4b5563' : '#e5e7eb',
                  },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: isSelected ? '#000' : isDark ? '#d1d5db' : '#6b7280' }}
                >
                  {dateInfo.date}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: '0.7rem', color: isSelected ? '#000' : '#9ca3af' }}
                >
                  {dateInfo.day}
                </Typography>
              </Box>
            </StyledBadge>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <Card
      sx={{
        height: '100%',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        position: 'relative',
      }}
    >
      <CardContent sx={{ p: 2 }}>
        {/* Title row */}
        <Box mb={1.5}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
            📅 Schedules
          </Typography>
        </Box>

        {/* Controls row: tab switcher left, Add button right */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              bgcolor: isDark ? '#0f172a' : '#f1f5f9',
              p: '4px',
              borderRadius: '10px',
            }}
          >
            {(['quick', 'daily', 'future'] as const).map((mode) => (
              <Button
                key={mode}
                size="small"
                onClick={() => setViewMode(mode)}
                sx={{
                  borderRadius: '7px',
                  px: 1.5,
                  py: 0.4,
                  minWidth: 60,
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  fontWeight: 700,
                  color: viewMode === mode
                    ? (isDark ? '#fff' : '#0f172a')
                    : '#64748b',
                  bgcolor: viewMode === mode
                    ? (isDark ? '#1e293b' : '#fff')
                    : 'transparent',
                  boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: viewMode === mode
                      ? (isDark ? '#1e293b' : '#fff')
                      : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                  },
                }}
              >
                {mode === 'quick' ? '⚡ Quick' : mode === 'daily' ? '📋 Daily' : '🗓 Future'}
              </Button>
            ))}
          </Box>

          <IconButton size="small" onClick={handleAddSchedule} sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* ── QUICK VIEW ── */}
        {viewMode === 'quick' && (
          <>
            <DateTabStrip />

            {/* Quick add row */}
            <QuickAddScheduleRow
              selectedDate={selectedDate}
              isDark={isDark}
              onAdd={handleQuickAdd}
            />

            {/* Compact schedule list */}
            {loading ? (
              <Box>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={44} sx={{ borderRadius: 2, mb: 1 }} />
                ))}
              </Box>
            ) : schedules.length === 0 ? (
              <Box display="flex" flexDirection="column" alignItems="center" py={3} textAlign="center">
                <TimeIcon sx={{ fontSize: 36, color: 'grey.400', mb: 1 }} />
                <Typography variant="body2" color="text.secondary" fontSize="0.8rem">
                  No schedules for this day
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {schedules.slice(0, 8).map((schedule) => {
                  const done = schedule.status === 'completed';
                  const passed = isTimePassed(schedule.startTime, schedule.date);
                  return (
                    <Box
                      key={schedule.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        px: 1.5,
                        py: 0.9,
                        borderRadius: '10px',
                        bgcolor: done
                          ? (isDark ? 'transparent' : '#fafafa')
                          : (isDark ? '#0f172a' : '#fffbeb'),
                        border: `1px solid ${
                          done
                            ? (isDark ? '#1e293b' : '#f1f5f9')
                            : (isDark ? '#1e293b' : '#fde68a')
                        }`,
                        opacity: done ? 0.55 : 1,
                        transition: 'all 0.2s ease',
                        '&:hover': { opacity: 1, bgcolor: isDark ? '#1e293b' : '#fef3c7' },
                      }}
                    >
                      {/* Status toggle */}
                      <Box
                        onClick={() => handleToggleStatus(schedule)}
                        sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      >
                        {done
                          ? <CheckCircle sx={{ fontSize: 18, color: '#22c55e' }} />
                          : <RadioButtonUnchecked sx={{ fontSize: 18, color: passed ? '#3b82f6' : (isDark ? '#64748b' : '#94a3b8') }} />
                        }
                      </Box>

                      {/* Time badge */}
                      {!schedule.isFlexible && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: passed && !done ? '#3b82f6' : (isDark ? '#94a3b8' : '#64748b'),
                            fontSize: '0.68rem',
                            flexShrink: 0,
                            minWidth: 56,
                          }}
                        >
                          {formatTime(schedule.startTime)}
                        </Typography>
                      )}
                      {schedule.isFlexible && (
                        <Typography variant="caption" sx={{ color: '#8b5cf6', fontWeight: 700, fontSize: '0.68rem', flexShrink: 0 }}>
                          Flexible
                        </Typography>
                      )}

                      {/* Title */}
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          flex: 1,
                          fontWeight: done ? 400 : 600,
                          color: done
                            ? (isDark ? '#475569' : '#94a3b8')
                            : (isDark ? '#f1f5f9' : '#1e293b'),
                          textDecoration: done ? 'line-through' : 'none',
                          fontSize: '0.82rem',
                        }}
                      >
                        {schedule.title}
                      </Typography>

                      {/* Edit */}
                      <IconButton
                        size="small"
                        onClick={() => handleEditSchedule(schedule.id!)}
                        sx={{ p: 0.3, flexShrink: 0, color: isDark ? '#475569' : '#94a3b8', '&:hover': { color: '#f59e0b' } }}
                      >
                        <EditIcon sx={{ fontSize: '0.85rem' }} />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* Footer */}
            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button
                variant="text"
                size="small"
                onClick={() => setViewMode('daily')}
                sx={{ textTransform: 'none', fontSize: '0.75rem', color: isDark ? '#64748b' : '#94a3b8' }}
              >
                Full View →
              </Button>
            </Box>
          </>
        )}

        {/* ── DAILY VIEW ── */}
        {viewMode === 'daily' && (
          <>
            <DateTabStrip />

            <Box sx={{ maxHeight: '420px', overflowY: 'auto', pr: 1 }}>
              {isSaving && (
                <Box mb={2} p={1.5} sx={{
                  borderRadius: 2,
                  border: '1px dashed #fbbf24',
                  backgroundColor: isDark ? 'rgba(251,191,36,0.05)' : 'rgba(251,191,36,0.1)',
                  display: 'flex', alignItems: 'center', gap: 2,
                }}>
                  <Box className="animate-spin" sx={{ width: 14, height: 14, border: '2px solid transparent', borderTopColor: '#fbbf24', borderRadius: '50%' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: isDark ? '#fbbf24' : '#b45309' }}>
                    Saving schedule…
                  </Typography>
                </Box>
              )}

              {loading ? (
                <Box>
                  {[...Array(4)].map((_, i) => (
                    <Box key={i} mb={2}>
                      <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
                    </Box>
                  ))}
                </Box>
              ) : schedules.length === 0 ? (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={4} textAlign="center">
                  <TimeIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No schedules found</Typography>
                  <Button size="small" onClick={handleAddSchedule} sx={{ mt: 1 }}>Add your first schedule</Button>
                </Box>
              ) : (
                <ScheduleDetailList
                  schedules={schedules}
                  viewMode="daily"
                  theme={theme}
                  isTimePassed={isTimePassed}
                  getTimeRange={getTimeRange}
                  getPriorityColor={getPriorityColor}
                  handleEditSchedule={handleEditSchedule}
                />
              )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setViewMode('future')}
                startIcon={<CalendarIcon />}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                View All Future
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddSchedule}
                sx={{
                  backgroundColor: isDark ? '#3b82f6' : '#2563eb',
                  '&:hover': { backgroundColor: isDark ? '#2563eb' : '#1d4ed8' },
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                Add Schedule
              </Button>
            </Box>
          </>
        )}

        {/* ── FUTURE VIEW ── */}
        {viewMode === 'future' && (
          <>
            <Box sx={{ maxHeight: '420px', overflowY: 'auto', pr: 1 }}>
              {loading ? (
                <Box>
                  {[...Array(4)].map((_, i) => (
                    <Box key={i} mb={2}>
                      <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
                    </Box>
                  ))}
                </Box>
              ) : schedules.length === 0 ? (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={4} textAlign="center">
                  <TimeIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No future schedules found</Typography>
                  <Button size="small" onClick={handleAddSchedule} sx={{ mt: 1 }}>Add your first schedule</Button>
                </Box>
              ) : (
                <ScheduleDetailList
                  schedules={schedules}
                  viewMode="future"
                  theme={theme}
                  isTimePassed={isTimePassed}
                  getTimeRange={getTimeRange}
                  getPriorityColor={getPriorityColor}
                  handleEditSchedule={handleEditSchedule}
                />
              )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setViewMode('daily')}
                startIcon={<ArrowIcon sx={{ transform: 'rotate(180deg)' }} />}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                Back to Daily
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddSchedule}
                sx={{
                  backgroundColor: isDark ? '#3b82f6' : '#2563eb',
                  '&:hover': { backgroundColor: isDark ? '#2563eb' : '#1d4ed8' },
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                Add Schedule
              </Button>
            </Box>
          </>
        )}
      </CardContent>

      <SchedulesModal
        open={modalOpen}
        onClose={handleCloseModal}
        schedule={editingSchedule}
        selectedDate={selectedDate}
        onSave={handleSaveSchedule}
        onDelete={handleDeleteSchedule}
        onDateChange={setSelectedDate}
        existingSchedules={schedules}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
};

// ─── Shared Detail List (used by Daily + Future views) ──────────────────────
interface ScheduleDetailListProps {
  schedules: SchedulesProps[];
  viewMode: 'daily' | 'future';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: any;
  isTimePassed: (startTime: string, date: string) => boolean;
  getTimeRange: (startTime: string, endTime: string, isFlexible?: boolean) => string;
  getPriorityColor: (priority: string) => string;
  handleEditSchedule: (id: string) => void;
}

const ScheduleDetailList = ({
  schedules,
  viewMode,
  theme,
  isTimePassed,
  getTimeRange,
  getPriorityColor,
  handleEditSchedule,
}: ScheduleDetailListProps) => {
  const groups: { [date: string]: SchedulesProps[] } = {};
  const todayStr = new Date().toISOString().split('T')[0];

  schedules.forEach(s => {
    const effectiveDate = s.isFlexible ? todayStr : s.date;
    if (!groups[effectiveDate]) groups[effectiveDate] = [];
    groups[effectiveDate].push(s);
  });

  return (
    <Box>
      {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
        <Box key={date} sx={{ mb: 3 }}>
          {viewMode === 'future' && (
            <Box sx={{ mb: 2, ml: 1, borderLeft: '4px solid #fbbf24', pl: 1 }}>
              <Typography variant="caption" fontWeight="bold" color="primary">
                {moment(date).format('dddd, MMM DD')}
              </Typography>
            </Box>
          )}
          <Stepper
            orientation="vertical"
            sx={{
              '& .MuiStepConnector-root': {
                marginLeft: '11px',
                '& .MuiStepConnector-line': {
                  borderLeftWidth: '2px',
                  borderLeftStyle: 'dashed',
                  borderLeftColor: theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
                  minHeight: '20px',
                },
              },
            }}
          >
            {items.map((schedule) => (
              <Step key={schedule.id} active={true} completed={schedule.status === 'completed'}>
                <StepLabel
                  StepIconComponent={() => (
                    <CustomStepIcon
                      completed={schedule.status === 'completed'}
                      active={true}
                      isTimePassed={isTimePassed(schedule.startTime, schedule.date)}
                    >
                      {schedule.status === 'completed' ? '✓' : ''}
                    </CustomStepIcon>
                  )}
                  sx={{ '& .MuiStepLabel-labelContainer': { paddingLeft: '8px' } }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a' }}>
                        {schedule.title}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleEditSchedule(schedule.id!)}
                        sx={{ padding: '2px', color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b', '&:hover': { color: '#fbbf24' } }}
                      >
                        <EditIcon sx={{ fontSize: '0.9rem' }} />
                      </IconButton>
                    </Box>

                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mt={0.25}>
                      <Typography variant="caption" sx={{ color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <TimeIcon sx={{ fontSize: '0.8rem' }} />
                        {getTimeRange(schedule.startTime, schedule.endTime, schedule.isFlexible)}
                      </Typography>

                      {schedule.isFlexible && (
                        <>
                          <Chip
                            label="Flexible"
                            size="small"
                            variant="outlined"
                            icon={<Box sx={{ ml: 0.5 }}>✨</Box>}
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 900, borderColor: '#8b5cf6', color: '#8b5cf6', borderWidth: '1.5px' }}
                          />
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<CalendarIcon sx={{ fontSize: 12 }} />}
                            onClick={() => handleEditSchedule(schedule.id!)}
                            sx={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'none', height: 20, py: 0, px: 0.5 }}
                          >
                            Add Specific Date
                          </Button>
                        </>
                      )}
                      {schedule.objective && (
                        <Chip label={schedule.objective} size="small" sx={{ height: 20, fontSize: '0.7rem', backgroundColor: getPriorityColor(schedule.priority || 'low'), color: 'white' }} />
                      )}
                      {schedule.duration && (
                        <Chip
                          icon={<TimeIcon sx={{ fontSize: '0.7rem' }} />}
                          label={`${schedule.duration}min`}
                          size="small"
                          sx={{ height: 20, fontSize: '0.7rem', backgroundColor: theme?.mode === 'dark' ? '#374151' : '#f3f4f6', color: theme?.mode === 'dark' ? '#d1d5db' : '#374151' }}
                        />
                      )}
                    </Box>
                  </Box>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      ))}
    </Box>
  );
};

export default Schedules;
