'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { SchedulesProps } from '../../lib/interface';
import {
  getSchedulesByUserAndDate,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '../../lib/functions/schedules';
import SchedulesModal from './SchedulesModal';

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
  const [schedules, setSchedules] = useState<SchedulesProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SchedulesProps | null>(
    null
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
  const generateDates = () => {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      dates.push({
        date: date.getDate().toString(),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: date.toISOString().split('T')[0], // YYYY-MM-DD format
      });
    }

    return dates;
  };

  const dates = useMemo(() => generateDates(), []);

  // Set initial selected date to today
  useEffect(() => {
    if (dates.length > 0) {
      setSelectedDate(dates[0].fullDate);
    }
  }, [dates]);

  // Fetch schedules from Firebase
  useEffect(() => {
    const fetchSchedules = async () => {
      if (selectedDate && user) {
        setLoading(true);
        try {
          const fetchedSchedules = await getSchedulesByUserAndDate(
            user.uid,
            selectedDate
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
      }
    };

    fetchSchedules();
  }, [selectedDate, user]);

  // Listen for schedule creation events from QuickEditor
  useEffect(() => {
    const handleScheduleCreated = (event: CustomEvent) => {
      const createdDate = event.detail?.date;
      // Refresh if the created schedule is for the currently selected date
      if (createdDate === selectedDate && user) {
        const refreshSchedules = async () => {
          if (selectedDate && user) {
            try {
              const fetchedSchedules = await getSchedulesByUserAndDate(
                user.uid,
                selectedDate
              );
              setSchedules(fetchedSchedules);
              setSnackbar({
                open: true,
                message: 'Schedule created successfully',
                severity: 'success',
              });
            } catch (error) {
              console.error('Error refreshing schedules:', error);
            }
          }
        };
        refreshSchedules();
      }
    };

    window.addEventListener(
      'scheduleCreated',
      handleScheduleCreated as EventListener
    );

    return () => {
      window.removeEventListener(
        'scheduleCreated',
        handleScheduleCreated as EventListener
      );
    };
  }, [selectedDate, user]);

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
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (schedule) {
      setEditingSchedule(schedule);
      setModalOpen(true);
    }
  };

  const handleSaveSchedule = async (scheduleData: SchedulesProps) => {
    try {
      console.log('handleSaveSchedule called with:', scheduleData);

      // Validate required fields
      if (!scheduleData.title || !scheduleData.startTime) {
        throw new Error('Title and start time are required');
      }

      if (scheduleData.id) {
        // Update existing schedule
        console.log('Updating existing schedule:', scheduleData.id);
        await updateSchedule(scheduleData.id, scheduleData);
        setSnackbar({
          open: true,
          message: 'Schedule updated successfully',
          severity: 'success',
        });
      } else {
        // Create new schedule - remove id from the data
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...scheduleToCreate } = scheduleData;
        console.log('Creating new schedule:', scheduleToCreate);
        const scheduleId = await createSchedule(scheduleToCreate);
        console.log('Created schedule with ID:', scheduleId);
        setSnackbar({
          open: true,
          message: 'Schedule created successfully',
          severity: 'success',
        });
      }

      // Refresh schedules
      if (selectedDate && user) {
        console.log('Refreshing schedules for date:', selectedDate);
        const fetchedSchedules = await getSchedulesByUserAndDate(
          user.uid,
          selectedDate
        );
        console.log('Fetched schedules:', fetchedSchedules);
        setSchedules(fetchedSchedules);
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save schedule';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteSchedule(scheduleId);
      setSnackbar({
        open: true,
        message: 'Schedule deleted successfully',
        severity: 'success',
      });

      // Refresh schedules
      if (selectedDate && user) {
        const fetchedSchedules = await getSchedulesByUserAndDate(
          user.uid,
          selectedDate
        );
        setSchedules(fetchedSchedules);
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete schedule',
        severity: 'error',
      });
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingSchedule(null);
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return '#f44336';
      case 'high':
        return '#ff9800';
      case 'medium':
        return '#2196f3';
      case 'low':
        return '#4caf50';
      default:
        return '#9e9e9e';
    }
  };

  const isTimePassed = (startTime: string, selectedDate: string) => {
    const now = new Date();
    const scheduleDateTime = new Date(`${selectedDate}T${startTime}:00`);
    return now > scheduleDateTime;
  };

  return (
    <Card
      sx={{
        height: '100%',
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
      }}
    >
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
            }}
          >
            View today&#39;s schedule
          </Typography>
          <IconButton
  size="small"
  onClick={handleAddSchedule}
>
  <EditIcon fontSize="small" />
</IconButton>

        </Box>

        {/* Date Picker */}
        <Box display="flex" justifyContent="center" mb={3}>
          <Box display="flex" alignItems="center" gap={1}>
            {dates.map((dateInfo) => {
              const isSelected = selectedDate === dateInfo.fullDate;
              return (
                <Box
                  key={dateInfo.fullDate}
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
                      : theme?.mode === 'dark'
                      ? '#374151'
                      : '#f3f4f6',
                    '&:hover': {
                      backgroundColor: isSelected
                        ? '#f59e0b'
                        : theme?.mode === 'dark'
                        ? '#4b5563'
                        : '#e5e7eb',
                    },
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      color: isSelected
                        ? '#000000'
                        : theme?.mode === 'dark'
                        ? '#d1d5db'
                        : '#6b7280',
                    }}
                  >
                    {dateInfo.date}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.7rem',
                      color: isSelected
                        ? '#000000'
                        : theme?.mode === 'dark'
                        ? '#9ca3af'
                        : '#9ca3af',
                    }}
                  >
                    {dateInfo.day}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Schedules List */}
        <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
          {loading ? (
            // Loading skeleton
            <Box>
              {[...Array(4)].map((_, index) => (
                <Box key={index} mb={2}>
                  <Skeleton variant="rectangular" height={80} />
                </Box>
              ))}
            </Box>
          ) : schedules.length === 0 ? (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              py={4}
              textAlign="center"
            >
              <TimeIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No schedules for this day
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Add your first schedule to get started
              </Typography>
            </Box>
          ) : (
            <Stepper
              orientation="vertical"
              sx={{
                '& .MuiStepConnector-root': {
                  marginLeft: '11px',
                  '& .MuiStepConnector-line': {
                    borderLeftWidth: '2px',
                    borderLeftStyle: 'dashed',
                    borderLeftColor:
                      theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
                    minHeight: '20px',
                  },
                },
              }}
            >
              {schedules.map((schedule) => (
                <Step
                  key={schedule.id}
                  active={true}
                  completed={schedule.status === 'completed'}
                >
                  <StepLabel
                    StepIconComponent={({ active, completed }) => (
                      <CustomStepIcon
                        completed={completed}
                        active={active}
                        isTimePassed={isTimePassed(
                          schedule.startTime,
                          selectedDate
                        )}
                      >
                        {completed ? '✓' : ''}
                      </CustomStepIcon>
                    )}
                    sx={{
                      '& .MuiStepLabel-labelContainer': {
                        paddingLeft: '8px',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        width: '100%',
                      }}
                    >
                      {/* Time Range */}
                      <Typography
                        variant="caption"
                        sx={{
                          color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
                          fontWeight: 500,
                        }}
                      >
                        {getTimeRange(schedule.startTime, schedule.endTime)}
                      </Typography>

                      {/* Title */}
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
                        }}
                      >
                        {schedule.title}
                      </Typography>

                      {/* Third line with objective and duration */}
                      <Box
                        display="flex"
                        alignItems="center"
                        gap={1}
                        flexWrap="wrap"
                      >
                        {schedule.objective && (
                          <Chip
                            label={schedule.objective}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: getPriorityColor(
                                schedule.priority || 'low'
                              ),
                              color: 'white',
                            }}
                          />
                        )}
                        {schedule.duration && (
                          <Chip
                            icon={<TimeIcon sx={{ fontSize: '0.7rem' }} />}
                            label={`${schedule.duration}min`}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor:
                                theme?.mode === 'dark' ? '#374151' : '#f3f4f6',
                              color:
                                theme?.mode === 'dark' ? '#d1d5db' : '#374151',
                            }}
                          />
                        )}
                        {schedule.location && (
                          <Chip
                            icon={<LocationIcon sx={{ fontSize: '0.7rem' }} />}
                            label={schedule.location}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor:
                                theme?.mode === 'dark' ? '#374151' : '#f3f4f6',
                              color:
                                theme?.mode === 'dark' ? '#d1d5db' : '#374151',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </StepLabel>
                  <StepContent>
                    <Box display="flex" justifyContent="flex-end" mt={1}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditSchedule(schedule.id!)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          )}
        </Box>

        {/* Add Schedule Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSchedule}
            sx={{
              backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
              '&:hover': {
                backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
              },
            }}
          >
            Add Schedule
          </Button>
        </Box>
      </CardContent>

      {/* Schedule Modal */}
      <SchedulesModal
        open={modalOpen}
        onClose={handleCloseModal}
        schedule={editingSchedule}
        selectedDate={selectedDate}
        onSave={handleSaveSchedule}
        onDelete={handleDeleteSchedule}
        onDateChange={handleDateChange}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
};

export default Schedules;
