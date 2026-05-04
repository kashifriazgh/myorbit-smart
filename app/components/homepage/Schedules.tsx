'use client';

import moment from 'moment';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Card,
  CardContent,
  Button,
  Skeleton,
  Alert,
  Snackbar,
  Badge,
  styled,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  AccessTime as TimeIcon,
  CalendarMonth as CalendarIcon,
  ArrowForward as ArrowIcon,
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
          ? theme?.mode === 'dark'
            ? '#3b82f6'
            : '#2563eb'
          : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isTimePassed
          ? 'white'
          : theme?.mode === 'dark'
            ? '#9ca3af'
            : '#6b7280',
        fontSize: '12px',
        fontWeight: 'bold',
        border: `2px solid ${
          isTimePassed
            ? theme?.mode === 'dark'
              ? '#3b82f6'
              : '#2563eb'
            : theme?.mode === 'dark'
              ? '#9ca3af'
              : '#6b7280'
        }`,
      }}
    >
      {children}
    </Box>
  );
};

const Schedules: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'daily' | 'future'>('daily');
  const [schedules, setSchedules] = useState<SchedulesProps[]>([]);
  const [counts, setCounts] = useState<{ [date: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SchedulesProps | null>(
    null,
  );
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

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

  // Set initial selected date to today
  useEffect(() => {
    if (dates.length > 0) {
      setSelectedDate(dates[0].fullDate);
    }
  }, [dates]);

  const fetchCounts = useCallback(async () => {
    if (user) {
      try {
        const start = dates[0].fullDate;
        // Fetch a bit more into the future for "future" view
        const end = new Date();
        end.setDate(end.getDate() + 30);
        const range = await getSchedulesByUserAndDateRange(
          user.uid,
          start,
          end.toISOString().split('T')[0]
        );
        
        const countsMap: { [date: string]: number } = {};
        range.forEach(s => {
          countsMap[s.date] = (countsMap[s.date] || 0) + 1;
        });
        setCounts(countsMap);
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    }
  }, [user, dates]);

  // Fetch schedules from Firebase
  const fetchSchedules = useCallback(async () => {
    if (selectedDate && user && viewMode === 'daily') {
      setLoading(true);
      try {
        const fetchedSchedules = await getSchedulesByUserAndDate(
          user.uid,
          selectedDate,
        );
        setSchedules(fetchedSchedules);
      } catch (error) {
        console.error('Error fetching schedules:', error);
        setSnackbar({
          open: true,
          message: 'Failed to load schedules',
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    } else if (user && viewMode === 'future') {
      setLoading(true);
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const end = new Date();
        end.setDate(end.getDate() + 90); // Next 3 months
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

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Listen for schedule creation events from QuickEditor
  useEffect(() => {
    const handleScheduleCreated = (event: CustomEvent) => {
      const createdDate = event.detail?.date;
      if (user) {
        fetchCounts();
        if (createdDate === selectedDate || viewMode === 'future') {
          fetchSchedules();
        }
      }
    };

    window.addEventListener(
      'scheduleCreated',
      handleScheduleCreated as EventListener,
    );

    return () => {
      window.removeEventListener(
        'scheduleCreated',
        handleScheduleCreated as EventListener,
      );
    };
  }, [selectedDate, user, viewMode, fetchSchedules, fetchCounts]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTimeRange = (startTime: string, endTime: string) => {
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  };

  const handleAddSchedule = () => {
    setEditingSchedule(null);
    setModalOpen(true);
  };

  const handleEditSchedule = (scheduleId: string) => {
    // Look in either current list or future list
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (schedule) {
      setEditingSchedule(schedule);
      setModalOpen(true);
    }
  };

  const handleSaveSchedule = async (scheduleData: SchedulesProps) => {
    try {
      if (!scheduleData.title || !scheduleData.startTime) {
        throw new Error('Title and start time are required');
      }

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
      console.error('Error saving schedule:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save schedule';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteSchedule(scheduleId);
      setSnackbar({ open: true, message: 'Schedule deleted successfully', severity: 'success' });
      fetchCounts();
      fetchSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setSnackbar({ open: true, message: 'Failed to delete schedule', severity: 'error' });
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSchedule(null);
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

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

  return (
    <Card
      sx={{
        height: '100%',
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
        position: 'relative'
      }}
    >
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
            }}
          >
            {viewMode === 'daily' ? 'Make schedule for today' : 'All Future Schedules'}
          </Typography>
          <Box display="flex" gap={1}>
            <Tooltip title={viewMode === 'daily' ? "View All Future" : "View Daily"}>
              <IconButton 
                size="small" 
                onClick={() => setViewMode(viewMode === 'daily' ? 'future' : 'daily')}
                color={viewMode === 'future' ? 'primary' : 'default'}
              >
                {viewMode === 'daily' ? <CalendarIcon fontSize="small" /> : <ArrowIcon fontSize="small" sx={{ transform: 'rotate(180deg)' }} />}
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={handleAddSchedule}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Date Picker */}
        {viewMode === 'daily' && (
          <Box display="flex" justifyContent="center" mb={3}>
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
                        backgroundColor: isSelected ? '#fbbf24' : theme?.mode === 'dark' ? '#374151' : '#f3f4f6',
                        '&:hover': {
                          backgroundColor: isSelected ? '#f59e0b' : theme?.mode === 'dark' ? '#4b5563' : '#e5e7eb',
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: isSelected ? '#000000' : theme?.mode === 'dark' ? '#d1d5db' : '#6b7280',
                        }}
                      >
                        {dateInfo.date}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.7rem',
                          color: isSelected ? '#000000' : theme?.mode === 'dark' ? '#9ca3af' : '#9ca3af',
                        }}
                      >
                        {dateInfo.day}
                      </Typography>
                    </Box>
                  </StyledBadge>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Schedules List */}
        <Box sx={{ maxHeight: '420px', overflowY: 'auto', pr: 1 }}>
          {loading ? (
            <Box>
              {[...Array(4)].map((_, index) => (
                <Box key={index} mb={2}>
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
            <Box>
              {/* Group schedules by date for future view */}
              {(() => {
                const groups: { [date: string]: SchedulesProps[] } = {};
                schedules.forEach(s => {
                  if (!groups[s.date]) groups[s.date] = [];
                  groups[s.date].push(s);
                });

                return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
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
                              <Typography variant="caption" sx={{ color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 500 }}>
                                {getTimeRange(schedule.startTime, schedule.endTime)}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a' }}>
                                {schedule.title}
                              </Typography>
                              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                {schedule.objective && (
                                  <Chip label={schedule.objective} size="small" sx={{ height: 20, fontSize: '0.7rem', backgroundColor: getPriorityColor(schedule.priority || 'low'), color: 'white' }} />
                                )}
                                {schedule.duration && (
                                  <Chip icon={<TimeIcon sx={{ fontSize: '0.7rem' }} />} label={`${schedule.duration}min`} size="small" sx={{ height: 20, fontSize: '0.7rem', backgroundColor: theme?.mode === 'dark' ? '#374151' : '#f3f4f6', color: theme?.mode === 'dark' ? '#d1d5db' : '#374151' }} />
                                )}
                              </Box>
                            </Box>
                          </StepLabel>
                          <StepContent>
                            <Box display="flex" justifyContent="flex-end" mt={1}>
                              <IconButton size="small" onClick={() => handleEditSchedule(schedule.id!)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </StepContent>
                        </Step>
                      ))}
                    </Stepper>
                  </Box>
                ));
              })()}
            </Box>
          )}
        </Box>

        {/* View All Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setViewMode(viewMode === 'daily' ? 'future' : 'daily')}
            startIcon={viewMode === 'daily' ? <CalendarIcon /> : <ArrowIcon sx={{ transform: 'rotate(180deg)' }} />}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            {viewMode === 'daily' ? 'View All Future' : 'Back to Daily'}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSchedule}
            sx={{
              backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
              '&:hover': { backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8' },
              borderRadius: 2,
              textTransform: 'none'
            }}
          >
            Add Schedule
          </Button>
        </Box>
      </CardContent>

      <SchedulesModal
        open={modalOpen}
        onClose={handleCloseModal}
        schedule={editingSchedule}
        selectedDate={selectedDate}
        onSave={handleSaveSchedule}
        onDelete={handleDeleteSchedule}
        onDateChange={setSelectedDate}
      />

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Card>
  );
};

export default Schedules;
