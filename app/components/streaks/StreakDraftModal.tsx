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
import { db } from '@/app/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { StreakProps } from '@/app/lib/interface';

const daysOfWeek = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

interface Props {
  open: boolean;
  onClose: () => void;
  rawText: string;
  onStreakCreated?: () => void;
}

interface EditableStreak {
  title: string;
  description: string;
  habitType: 'daily' | 'weekly';
  reminderTime: string;
  reminderDay: string;
}

interface ParsedStreakData {
  title?: string;
  description?: string;
  habitType?: 'daily' | 'weekly';
  reminderTime?: string;
  reminderDay?: string;
}

export default function StreakDraftModal({
  open,
  onClose,
  rawText,
  onStreakCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [editableStreak, setEditableStreak] = useState<EditableStreak | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  const parseAIResponse = (result: string): ParsedStreakData => {
    if (!result || typeof result !== 'string') {
      throw new Error('Empty or invalid AI response');
    }

    let cleanedResult = result.trim();
    cleanedResult = cleanedResult
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      return JSON.parse(cleanedResult);
    } catch (e) {
      const jsonMatch = cleanedResult.match(/\{[\s\S]*\}/);
      console.log(e);
      if (jsonMatch) {
        try {
          const fixed = jsonMatch[0].replace(/,(\s*[}\]])/g, '$1');
          return JSON.parse(fixed);
        } catch (e2) {
          throw new Error('Could not parse AI response');
          console.log(e2);
        }
      }
      throw new Error('Could not parse AI response');
    }
  };

  const generateDraft = useCallback(async () => {
    if (!rawText.trim()) {
      setError('Please enter some text to generate a streak draft.');
      return;
    }

    setLoading(true);
    setError(null);

    const prompt = `
You are a productivity assistant. Analyze the following user input and extract streak/habit information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

{
  "title": "string (required, extract from text or create a meaningful title)",
  "description": "string (optional, extract description if mentioned, otherwise empty string)",
  "habitType": "daily" | "weekly" (determine based on keywords in text, default "daily"),
  "reminderTime": "HH:mm format (extract time if mentioned, otherwise empty string)",
  "reminderDay": "string (if weekly, extract day name like 'Monday', otherwise empty string)"
}

Guidelines for extraction:
- Title: Extract the habit/streak name (e.g., "Morning Walk", "Reading", "Exercise")
- Description: Extract additional details if mentioned, otherwise use empty string
- HabitType: 
  * Look for "weekly", "every week", "once a week" → weekly
  * Default → daily
- ReminderTime: Extract time mentioned (e.g., "6am", "06:00", "9:30 PM"). Convert to 24-hour HH:mm format. If not found, use empty string.
- ReminderDay: If habitType is weekly, extract day name. Otherwise empty string.

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

      let parsedData: ParsedStreakData;
      try {
        parsedData = parseAIResponse(result);
      } catch (parseError) {
        console.warn('AI response parsing failed, using defaults:', parseError);
        parsedData = {};
      }

      const draft: EditableStreak = {
        title:
          parsedData.title || rawText.substring(0, 50) || 'Untitled Streak',
        description: parsedData.description || '',
        habitType: ['daily', 'weekly'].includes(parsedData.habitType)
          ? parsedData.habitType
          : 'daily',
        reminderTime: parsedData.reminderTime || '',
        reminderDay: parsedData.reminderDay || 'Monday',
      };

      setEditableStreak(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate streak draft. Please try again.';

      setError(
        `AI parsing failed: ${errorMessage}. You can edit the fields below.`
      );

      const fallbackDraft: EditableStreak = {
        title: rawText.substring(0, 50) || 'Untitled Streak',
        description: '',
        habitType: 'daily',
        reminderTime: '',
        reminderDay: 'Monday',
      };
      setEditableStreak(fallbackDraft);
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  useEffect(() => {
    if (open && rawText.trim() && !editableStreak && !loading) {
      generateDraft();
    }
  }, [open, rawText, editableStreak, loading, generateDraft]);

  useEffect(() => {
    if (!open) {
      setEditableStreak(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleInputChange = (field: keyof EditableStreak, value: string) => {
    setEditableStreak((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleConfirmSave = async () => {
    if (!editableStreak || !user) {
      setError('Missing streak data or user information.');
      return;
    }

    if (!editableStreak.title?.trim()) {
      setError('Title is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const streakData: StreakProps = {
        userId: user.uid,
        title: editableStreak.title.trim(),
        description: editableStreak.description?.trim() || '',
        category: '',
        habitType: editableStreak.habitType || 'daily',
        target: '',
        startDate: Timestamp.now(),
        ...(editableStreak.reminderTime
          ? { reminderTime: editableStreak.reminderTime }
          : {}),
        privacy: 'private',
        reminder: { time: editableStreak.reminderTime || '' },
        ...(editableStreak.habitType === 'weekly'
          ? { reminderDay: editableStreak.reminderDay }
          : {}),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        attendance: [],
        streaksCount: 0,
      };

      await addDoc(collection(db, 'streaks'), streakData);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('streakCreated'));
      }

      if (onStreakCreated) {
        onStreakCreated();
      }

      onClose();
    } catch (error) {
      console.error('Error saving streak:', error);
      setError('Failed to save streak. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          Edit Streak Draft
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading && !editableStreak && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            py={4}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Analyzing your input and generating streak...
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

        {editableStreak && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Title *"
              value={editableStreak.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              variant="outlined"
              size="medium"
              placeholder="e.g., Morning Walk"
            />

            <TextField
              fullWidth
              label="Description (Optional)"
              value={editableStreak.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              variant="outlined"
              size="medium"
              multiline
              rows={3}
              placeholder="Add more details..."
            />

            <FormControl fullWidth size="medium">
              <InputLabel>Type</InputLabel>
              <Select
                value={editableStreak.habitType || 'daily'}
                onChange={(e) => handleInputChange('habitType', e.target.value)}
                label="Type"
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
              </Select>
            </FormControl>

            {editableStreak.habitType === 'weekly' && (
              <FormControl fullWidth size="medium">
                <InputLabel>Day</InputLabel>
                <Select
                  value={editableStreak.reminderDay || 'Monday'}
                  onChange={(e) =>
                    handleInputChange('reminderDay', e.target.value)
                  }
                  label="Day"
                >
                  {daysOfWeek.map((day) => (
                    <MenuItem key={day} value={day}>
                      {day}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              fullWidth
              label="Reminder Time"
              type="time"
              value={editableStreak.reminderTime || ''}
              onChange={(e) =>
                handleInputChange('reminderTime', e.target.value)
              }
              variant="outlined"
              size="medium"
              InputLabelProps={{ shrink: true }}
            />
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
          disabled={loading || !editableStreak?.title?.trim()}
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
            },
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Save Streak'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
