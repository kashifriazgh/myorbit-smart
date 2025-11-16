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
import { PRIORITY_OPTIONS } from '@/app/lib/constant';
import { db } from '@/app/lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface Props {
  open: boolean;
  onClose: () => void;
  rawText: string;
  onTaskCreated?: () => void;
}

interface EditableTask {
  title: string;
  description: string;
  priority: 'routine' | 'urgent' | 'critical';
  dueDate: Date;
  privacy: 'private' | 'public';
  isImportant: boolean;
}

interface ParsedTaskData {
  title?: string;
  description?: string;
  priority?: 'routine' | 'urgent' | 'critical';
  dueDate?: string;
}

export default function TaskDraftModal({
  open,
  onClose,
  rawText,
  onTaskCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [editableTask, setEditableTask] = useState<EditableTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  };

  const parseAIResponse = (result: string): ParsedTaskData => {
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
      setError('Please enter some text to generate a task draft.');
      return;
    }

    setLoading(true);
    setError(null);

    const prompt = `
You are a productivity assistant. Analyze the following user input and extract task information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

{
  "title": "string (required, extract from text or create a meaningful title)",
  "description": "string (optional, extract description if mentioned, otherwise empty string)",
  "priority": "routine" | "urgent" | "critical" (determine based on urgency keywords in text, default "routine"),
  "dueDate": "YYYY-MM-DD format (extract from text, default to tomorrow if not specified)"
}

Guidelines for extraction:
- Title: Extract the main task or create a meaningful title based on the activity
- Description: Extract additional details if mentioned, otherwise use empty string
- Priority: 
  * "critical" or "urgent" or "asap" or "emergency" → critical
  * "important" or "high priority" or "soon" → urgent
  * Default → routine
- DueDate: Look for keywords like "today", "tomorrow", "Monday", specific dates. If not found, use tomorrow.

Current date context: ${new Date().toISOString().split('T')[0]}
Tomorrow date: ${getTomorrowDate().toISOString().split('T')[0]}

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

      let parsedData: ParsedTaskData;
      try {
        parsedData = parseAIResponse(result);
      } catch (parseError) {
        console.warn('AI response parsing failed, using defaults:', parseError);
        parsedData = {};
      }

      const draft: EditableTask = {
        title: parsedData.title || rawText.substring(0, 50) || 'Untitled Task',
        description: parsedData.description || '',
        priority: ['routine', 'urgent', 'critical'].includes(
          parsedData.priority
        )
          ? parsedData.priority
          : 'routine',
        dueDate: parsedData.dueDate
          ? new Date(parsedData.dueDate)
          : getTomorrowDate(),
        privacy: 'private',
        isImportant: false,
      };

      setEditableTask(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate task draft. Please try again.';

      setError(
        `AI parsing failed: ${errorMessage}. You can edit the fields below.`
      );

      const fallbackDraft: EditableTask = {
        title: rawText.substring(0, 50) || 'Untitled Task',
        description: '',
        priority: 'routine',
        dueDate: getTomorrowDate(),
        privacy: 'private',
        isImportant: false,
      };
      setEditableTask(fallbackDraft);
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  useEffect(() => {
    if (open && rawText.trim() && !editableTask && !loading) {
      generateDraft();
    }
  }, [open, rawText, editableTask, loading, generateDraft]);

  useEffect(() => {
    if (!open) {
      setEditableTask(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleInputChange = (
    field: keyof EditableTask,
    value: string | Date | boolean
  ) => {
    setEditableTask((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleConfirmSave = async () => {
    if (!editableTask || !user) {
      setError('Missing task data or user information.');
      return;
    }

    if (!editableTask.title) {
      setError('Title is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const docData = {
        title: editableTask.title.trim(),
        description: editableTask.description || '',
        priority: editableTask.priority || 'routine',
        status: 'in_progress',
        progressPercent: 0,
        pinned: false,
        isArchived: false,
        authorId: user.uid,
        authorName: user.firstName || '',
        assignedUsers: [],
        sharedWith: [],
        startDate: Timestamp.fromDate(new Date()),
        dueDate: Timestamp.fromDate(editableTask.dueDate || getTomorrowDate()),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        privacy: editableTask.privacy || 'private',
        isImportant: editableTask.isImportant || false,
        steps: [],
      };

      await addDoc(collection(db, 'todos'), docData);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taskCreated'));
      }

      if (onTaskCreated) {
        onTaskCreated();
      }

      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      setError('Failed to save task. Please try again.');
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
          Edit Task Draft
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading && !editableTask && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            py={4}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Analyzing your input and generating task...
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

        {editableTask && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Title *"
              value={editableTask.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              variant="outlined"
              size="medium"
              placeholder="What needs to be done?"
            />

            <TextField
              fullWidth
              label="Description (Optional)"
              value={editableTask.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              variant="outlined"
              size="medium"
              multiline
              rows={3}
              placeholder="Add more details..."
            />

            <FormControl fullWidth size="medium">
              <InputLabel>Priority</InputLabel>
              <Select
                value={editableTask.priority || 'routine'}
                onChange={(e) => handleInputChange('priority', e.target.value)}
                label="Priority"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Due Date
              </Typography>
              <DatePicker
                selected={editableTask.dueDate || getTomorrowDate()}
                onChange={(date: Date | null) =>
                  handleInputChange('dueDate', date || getTomorrowDate())
                }
                className="custom-datepicker"
                dateFormat="MMMM d, yyyy"
                minDate={new Date()}
                wrapperClassName="date-picker-wrapper"
              />
            </Box>
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
          disabled={loading || !editableTask?.title}
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
            },
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Save Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
