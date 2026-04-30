'use client';

import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  CircularProgress,
  TextField,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { Close as CloseIcon } from '@mui/icons-material';
import { SchedulesProps } from '@/app/lib/interface';
import { createSchedule } from '@/app/lib/functions/schedules';
import { getCurrentTimePK, getTomorrowDatePK } from '@/app/lib/utils/dateUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  rawText: string;
  onScheduleCreated?: () => void;
}

interface ParsedScheduleData {
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  objective?: string;
  duration?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  reminder?: {
    before: number;
    method: 'notification' | 'whatsapp' | 'email';
  };
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
}

const parseAIResponse = (result: string): ParsedScheduleData => {
  if (!result || typeof result !== 'string') {
    throw new Error('Empty or invalid AI response');
  }

  let cleanedResult = result.trim();

  // Strategy 1: Remove markdown code blocks
  cleanedResult = cleanedResult
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  // Strategy 2: Try direct JSON parse
  try {
    return JSON.parse(cleanedResult);
  } catch (e) {
    console.log(e);
    // Continue to next strategy
  }

  // Strategy 3: Extract JSON object from text
  const jsonMatch = cleanedResult.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.log(e);
      // Continue to next strategy
    }
  }

  // Strategy 4: Try to find JSON between brackets (nested)
  const bracketMatch = cleanedResult.match(/\{[\s\S]*\}/);
  if (bracketMatch) {
    try {
      const extracted = bracketMatch[0];
      // Remove any trailing commas
      const fixed = extracted.replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(fixed);
    } catch (e) {
      console.log(e);
      // Continue to fallback
    }
  }

  // Fallback: Return null and use defaults
  throw new Error('Could not parse AI response. Using default values.');
};

export default function ScheduleDraftModal({
  open,
  onClose,
  rawText,
  onScheduleCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [editableSchedule, setEditableSchedule] =
    useState<Partial<SchedulesProps> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  const getCurrentTime = () => getCurrentTimePK();
  const getTomorrowDate = () => getTomorrowDatePK();

  const generateDraft = useCallback(async () => {
    if (!rawText.trim()) {
      setError('Please enter some text to generate a schedule draft.');
      return;
    }

    setLoading(true);
    setError(null);

    const prompt = `
You are a productivity assistant. Analyze the following user input and extract schedule information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

{
  "title": "string (required, extract from text or create a meaningful title based on the activity)",
  "date": "YYYY-MM-DD format (extract from text, default to tomorrow if not specified)",
  "startTime": "HH:mm format (extract from text, default to current time if not specified)",
  "endTime": "HH:mm format (calculate from duration or estimate, default to 30 minutes after startTime)",
  "objective": "string (optional, extract the goal or purpose, leave empty string if not mentioned)",
  "duration": number (in minutes, calculate from times if both provided, otherwise estimate),
  "priority": "low" | "medium" | "high" | "critical" (determine based on urgency keywords in text),
  "reminder": {
    "before": number (minutes before, default 10),
    "method": "notification" | "whatsapp" | "email" (default "notification")
  },
  "repeat": "none" | "daily" | "weekly" | "monthly" (extract from text, default "none")
}

Guidelines for extraction:
- Date: Look for keywords like "today", "tomorrow", "Monday", "next week", or specific dates. If not found, use tomorrow.
- Time: Extract times mentioned (e.g., "3pm", "15:00", "9:30 AM"). Convert to 24-hour HH:mm format. If not found, use current time.
- Priority: 
  * "critical" or "urgent" or "asap" or "emergency" → critical
  * "important" or "high priority" → high
  * "low priority" or casual mentions → low
  * Default → medium
- Duration: If both start and end times are provided, calculate the difference. Otherwise estimate:
  * Meeting/appointment: 30-60 minutes
  * Task/work: 15-30 minutes
  * Event/activity: 60-120 minutes
  * Default: 30 minutes
- EndTime: If not explicitly mentioned, add duration to startTime. If duration not clear, add 30 minutes.
- Objective: Extract the purpose, goal, or reason if mentioned. Otherwise use empty string.
- Repeat: Look for "daily", "every day", "weekly", "every week", "monthly", "every month". Default to "none".

            Current date context (Pakistan timezone): ${getTomorrowDatePK()}
            Current time context (Pakistan timezone): ${getCurrentTimePK()}
            Tomorrow date (Pakistan timezone): ${getTomorrowDatePK()}

User input: "${rawText}"

CRITICAL: Return ONLY valid JSON, no markdown, no explanations, no additional text.
`.trim();

    try {
      const response = await fetch('/api/ideas/improve-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: rawText,
          instructions: prompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const result = data.result || '';

      if (!result) {
        throw new Error('Empty response from AI');
      }

      // Calculate end time helper
      const calculateEndTime = (start: string, dur?: number) => {
        const [hours, minutes] = start.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + (dur || 30);
        const endHours = Math.floor(endMinutes / 60) % 24;
        const endMins = endMinutes % 60;
        return `${endHours.toString().padStart(2, '0')}:${endMins
          .toString()
          .padStart(2, '0')}`;
      };

      // Try to parse AI response
      let parsedData: ParsedScheduleData;
      try {
        parsedData = parseAIResponse(result);
      } catch (parseError) {
        console.warn('AI response parsing failed, using defaults:', parseError);
        // Use fallback defaults if parsing fails
        parsedData = {};
      }

      // Validate and set defaults with proper fallbacks
      const startTime = parsedData.startTime || getCurrentTime();
      const duration = parsedData.duration || 30;
      const endTime =
        parsedData.endTime || calculateEndTime(startTime, duration);

      const draft: Partial<SchedulesProps> = {
        title:
          parsedData.title || rawText.substring(0, 50) || 'Untitled Schedule',
        date: parsedData.date || getTomorrowDate(),
        startTime: startTime,
        endTime: endTime,
        objective: parsedData.objective || '',
        duration: duration,
        priority: ['low', 'medium', 'high', 'critical'].includes(
          parsedData.priority
        )
          ? parsedData.priority
          : 'medium',
        reminder:
          parsedData.reminder &&
          typeof parsedData.reminder === 'object' &&
          parsedData.reminder.before &&
          ['notification', 'whatsapp', 'email'].includes(
            parsedData.reminder.method
          )
            ? parsedData.reminder
            : { before: 10, method: 'notification' },
        repeat: ['none', 'daily', 'weekly', 'monthly'].includes(
          parsedData.repeat
        )
          ? parsedData.repeat
          : 'none',
        status: 'pending',
        autoGenerated: false,
        colorCode: '#E3F2FD',
      };

      setEditableSchedule(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate schedule draft. Please try again.';

      // Set error but also provide a basic fallback draft
      setError(
        `AI parsing failed: ${errorMessage}. You can edit the fields below.`
      );

      // Create a basic fallback draft
      const calculateEndTimeFallback = (start: string, dur?: number) => {
        const [hours, minutes] = start.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + (dur || 30);
        const endHours = Math.floor(endMinutes / 60) % 24;
        const endMins = endMinutes % 60;
        return `${endHours.toString().padStart(2, '0')}:${endMins
          .toString()
          .padStart(2, '0')}`;
      };

      const fallbackDraft: Partial<SchedulesProps> = {
        title: rawText.substring(0, 50) || 'Untitled Schedule',
        date: getTomorrowDate(),
        startTime: getCurrentTime(),
        endTime: calculateEndTimeFallback(getCurrentTime(), 30),
        objective: '',
        duration: 30,
        priority: 'medium',
        reminder: { before: 10, method: 'notification' },
        repeat: 'none',
        status: 'pending',
        autoGenerated: false,
        colorCode: '#E3F2FD',
      };
      setEditableSchedule(fallbackDraft);
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  // Auto-generate draft when modal opens
  useEffect(() => {
    if (open && rawText.trim() && !editableSchedule && !loading) {
      generateDraft();
    }
  }, [open, rawText, editableSchedule, loading, generateDraft]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setEditableSchedule(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const calculateEndTime = (start: string, dur?: number) => {
    const [hours, minutes] = start.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + (dur || 30);
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins
      .toString()
      .padStart(2, '0')}`;
  };

  const handleDurationChange = (startTime: string, endTime: string) => {
    if (startTime && endTime) {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      const duration = endMinutes - startMinutes;
      if (duration > 0) {
        setEditableSchedule((prev) => ({
          ...prev,
          duration,
        }));
      }
    }
  };

  const handleInputChange = (
    field: keyof SchedulesProps,
    value: string | number | boolean | { before: number; method: string }
  ) => {
    setEditableSchedule((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleConfirmSave = async () => {
    if (!editableSchedule || !user) {
      setError('Missing schedule data or user information.');
      return;
    }

    if (
      !editableSchedule.title ||
      !editableSchedule.startTime ||
      !editableSchedule.date
    ) {
      setError('Title, date, and start time are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const scheduleData: Omit<SchedulesProps, 'id'> = {
        userId: user.uid,
        date: editableSchedule.date,
        title: editableSchedule.title,
        startTime: editableSchedule.startTime,
        endTime:
          editableSchedule.endTime ||
          calculateEndTime(
            editableSchedule.startTime,
            editableSchedule.duration
          ),
        objective: editableSchedule.objective || '',
        duration: editableSchedule.duration || 30,
        status: editableSchedule.status || 'pending',
        priority: editableSchedule.priority || 'medium',
        reminder: editableSchedule.reminder || {
          before: 10,
          method: 'notification',
        },
        repeat: editableSchedule.repeat || 'none',
        autoGenerated: editableSchedule.autoGenerated || false,
        colorCode: editableSchedule.colorCode || '#E3F2FD',
      };

      await createSchedule(scheduleData);

      // Dispatch custom event to notify other components (like Schedules) to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('scheduleCreated', {
            detail: { date: scheduleData.date },
          })
        );
      }

      if (onScheduleCreated) {
        onScheduleCreated();
      }

      onClose();
    } catch (error) {
      console.error('Error saving schedule:', error);
      setError('Failed to save schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const priorityOptions = [
    { value: 'low', label: 'Low', color: '#4caf50' },
    { value: 'medium', label: 'Medium', color: '#2196f3' },
    { value: 'high', label: 'High', color: '#ff9800' },
    { value: 'critical', label: 'Critical', color: '#f44336' },
  ];

  const reminderMethods = [
    { value: 'notification', label: 'Notification' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'email', label: 'Email' },
  ];

  const repeatOptions = [
    { value: 'none', label: 'No Repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          Edit Schedule Draft
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading && !editableSchedule && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            py={4}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Analyzing your input and generating schedule...
            </Typography>
          </Box>
        )}

        {error && (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor: theme?.mode === 'dark' ? '#7f1d1d' : '#fee2e2',
              color: theme?.mode === 'dark' ? '#fca5a5' : '#991b1b',
              mb: 2,
            }}
          >
            <Typography variant="body2">{error}</Typography>
          </Box>
        )}

        {editableSchedule && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Title */}
            <TextField
              fullWidth
              label="Title *"
              value={editableSchedule.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              variant="outlined"
              size="medium"
              placeholder="What are you planning to do?"
            />

            {/* Date */}
            <TextField
              type="date"
              label="Date *"
              value={editableSchedule.date || getTomorrowDate()}
              onChange={(e) => handleInputChange('date', e.target.value)}
              required
              variant="outlined"
              size="medium"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            {/* Time Fields */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Start Time *"
                type="time"
                value={editableSchedule.startTime || getCurrentTime()}
                onChange={(e) => {
                  handleInputChange('startTime', e.target.value);
                  if (editableSchedule.endTime) {
                    handleDurationChange(
                      e.target.value,
                      editableSchedule.endTime
                    );
                  }
                }}
                required
                variant="outlined"
                size="medium"
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1, minWidth: '150px' }}
              />

              <TextField
                label="End Time"
                type="time"
                value={editableSchedule.endTime || ''}
                onChange={(e) => {
                  handleInputChange('endTime', e.target.value);
                  if (editableSchedule.startTime) {
                    handleDurationChange(
                      editableSchedule.startTime,
                      e.target.value
                    );
                  }
                }}
                variant="outlined"
                size="medium"
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1, minWidth: '150px' }}
                helperText={
                  editableSchedule.duration
                    ? `${editableSchedule.duration} minutes`
                    : 'Optional'
                }
              />
            </Box>

            {/* Objective */}
            <TextField
              fullWidth
              label="Objective (Optional)"
              value={editableSchedule.objective || ''}
              onChange={(e) => handleInputChange('objective', e.target.value)}
              variant="outlined"
              size="medium"
              placeholder="What's the goal or purpose?"
              multiline
              rows={2}
            />

            {/* Priority */}
            <FormControl fullWidth size="medium">
              <InputLabel>Priority</InputLabel>
              <Select
                value={editableSchedule.priority || 'medium'}
                onChange={(e) => handleInputChange('priority', e.target.value)}
                label="Priority"
              >
                {priorityOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: option.color,
                        }}
                      />
                      {option.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Reminder Settings */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Remind me"
                type="number"
                value={editableSchedule.reminder?.before || 10}
                onChange={(e) =>
                  handleInputChange('reminder', {
                    ...editableSchedule.reminder,
                    before: parseInt(e.target.value) || 10,
                    method: editableSchedule.reminder?.method || 'notification',
                  })
                }
                variant="outlined"
                size="medium"
                sx={{ flex: 1, minWidth: '120px' }}
                helperText="minutes before"
              />

              <FormControl size="medium" sx={{ flex: 1, minWidth: '150px' }}>
                <InputLabel>Alert via</InputLabel>
                <Select
                  value={editableSchedule.reminder?.method || 'notification'}
                  onChange={(e) =>
                    handleInputChange('reminder', {
                      ...editableSchedule.reminder,
                      before: editableSchedule.reminder?.before || 10,
                      method: e.target.value,
                    })
                  }
                  label="Alert via"
                >
                  {reminderMethods.map((method) => (
                    <MenuItem key={method.value} value={method.value}>
                      {method.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Repeat */}
            <FormControl fullWidth size="medium">
              <InputLabel>Repeat</InputLabel>
              <Select
                value={editableSchedule.repeat || 'none'}
                onChange={(e) => handleInputChange('repeat', e.target.value)}
                label="Repeat"
              >
                {repeatOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirmSave}
          variant="contained"
          disabled={
            loading ||
            !editableSchedule?.title ||
            !editableSchedule?.startTime ||
            !editableSchedule?.date
          }
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
            },
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Save Schedule'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
