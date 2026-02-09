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
import { useGoals } from '@/app/lib/context/GoalsContext';
import { Goal, GoalType, GoalStep, GoalPriority } from '@/app/lib/interface';
import { Timestamp } from 'firebase/firestore';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { getCurrentDatePK, parseDatePK } from '@/app/lib/utils/dateUtils';

const goalTypes: GoalType[] = [
  'finance',
  'health',
  'learning',
  'habit',
  'work',
  'lifestyle',
  'custom',
];

interface Props {
  open: boolean;
  onClose: () => void;
  rawText: string;
  onGoalCreated?: () => void;
}

interface EditableGoal {
  title: string;
  description: string;
  type: GoalType;
  priority: GoalPriority;
  dueDate: Date;
  overallTargetValue: number | '';
  overallTargetUnit: string;
  steps: GoalStep[];
}

interface ParsedGoalData {
  title?: string;
  description?: string;
  type?: GoalType;
  priority?: GoalPriority;
  dueDate?: string;
  overallTargetValue?: number;
  overallTargetUnit?: string;
}

export default function GoalDraftModal({
  open,
  onClose,
  rawText,
  onGoalCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [editableGoal, setEditableGoal] = useState<EditableGoal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useCustomTheme();
  const { user } = useAuth();
  const { addGoal } = useGoals();

  const parseAIResponse = (result: string): ParsedGoalData => {
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
      setError('Please enter some text to generate a goal draft.');
      return;
    }

    setLoading(true);
    setError(null);

    const prompt = `
You are a productivity assistant. Analyze the following user input and extract goal information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

{
  "title": "string (required, extract from text or create a meaningful title)",
  "description": "string (optional, extract description if mentioned, otherwise empty string)",
  "type": "finance" | "health" | "learning" | "habit" | "work" | "lifestyle" | "custom" (infer from context, default "custom"),
  "priority": "Low" | "Medium" | "High" (determine based on urgency keywords, default "Medium"),
  "dueDate": "YYYY-MM-DD format (extract from text, default to 3 months from now if not specified)",
  "overallTargetValue": number (extract target value/number from text, can be 0 if not found),
  "overallTargetUnit": "string (extract unit like 'Rs', 'kg', 'hours', etc., can be empty string)"
}

Guidelines for extraction:
- Title: Extract the goal name (e.g., "Save Rs 5000", "Lose 10kg", "Learn React")
- Description: Extract additional details if mentioned, otherwise use empty string
- Type: Infer from keywords:
  * money/save/earn/budget → finance
  * health/fitness/exercise/weight → health
  * learn/study/course/skill → learning
  * habit/routine/daily → habit
  * work/career/job → work
  * lifestyle/personal/life → lifestyle
  * Default → custom
- Priority: 
  * "urgent" or "critical" or "high priority" → High
  * "important" or "medium" → Medium
  * Default → Low
- DueDate: Extract dates mentioned. If not found, default to 3 months from now. IMPORTANT: Use Pakistan timezone (Asia/Karachi, UTC+5).
- OverallTargetValue: Extract numbers mentioned (money amounts, weights, quantities)
- OverallTargetUnit: Extract unit (Rs, kg, hours, pages, etc.)

Current date context (Pakistan timezone): ${getCurrentDatePK()}

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

      let parsedData: ParsedGoalData;
      try {
        parsedData = parseAIResponse(result);
      } catch (parseError) {
        console.warn('AI response parsing failed, using defaults:', parseError);
        parsedData = {};
      }

      // Calculate default due date (3 months from now)
      const defaultDueDate = new Date();
      defaultDueDate.setMonth(defaultDueDate.getMonth() + 3);

      const draft: EditableGoal = {
        title: parsedData.title || rawText.substring(0, 50) || 'Untitled Goal',
        description: parsedData.description || '',
        type: goalTypes.includes(parsedData.type) ? parsedData.type : 'custom',
        priority: ['Low', 'Medium', 'High'].includes(parsedData.priority)
          ? parsedData.priority
          : 'Medium',
        dueDate: parsedData.dueDate
          ? parseDatePK(parsedData.dueDate)
          : defaultDueDate,
        overallTargetValue:
          parsedData.overallTargetValue && parsedData.overallTargetValue > 0
            ? parsedData.overallTargetValue
            : '',
        overallTargetUnit: parsedData.overallTargetUnit || '',
        steps: [] as GoalStep[], // Will be auto-generated or user can add manually
      };

      setEditableGoal(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate goal draft. Please try again.';

      setError(
        `AI parsing failed: ${errorMessage}. You can edit the fields below.`,
      );

      const defaultDueDate = new Date();
      defaultDueDate.setMonth(defaultDueDate.getMonth() + 3);

      const fallbackDraft: EditableGoal = {
        title: rawText.substring(0, 50) || 'Untitled Goal',
        description: '',
        type: 'custom',
        priority: 'Medium',
        dueDate: defaultDueDate,
        overallTargetValue: '',
        overallTargetUnit: '',
        steps: [],
      };
      setEditableGoal(fallbackDraft);
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  useEffect(() => {
    if (open && rawText.trim() && !editableGoal && !loading) {
      generateDraft();
    }
  }, [open, rawText, editableGoal, loading, generateDraft]);

  useEffect(() => {
    if (!open) {
      setEditableGoal(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleInputChange = (
    field: keyof EditableGoal,
    value: string | GoalType | GoalPriority | Date | number | '' | GoalStep[],
  ) => {
    setEditableGoal((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleConfirmSave = async () => {
    if (!editableGoal || !user) {
      setError('Missing goal data or user information.');
      return;
    }

    if (!editableGoal.title?.trim()) {
      setError('Title is required.');
      return;
    }

    if (!editableGoal.dueDate) {
      setError('Due date is required.');
      return;
    }

    // Ensure at least one milestone/step
    let steps: GoalStep[] = editableGoal.steps || [];
    if (steps.length === 0) {
      // Create a default milestone
      steps = [
        {
          id: Date.now().toString(),
          title: 'Milestone 1',
          description: undefined,
          targetValue: undefined,
          startDate: undefined,
          endDate: undefined,
          completed: false,
          skipped: false,
        },
      ];
    }

    setLoading(true);
    setError(null);

    try {
      const now = new Date();

      const goalData: Omit<Goal, 'id'> = {
        title: editableGoal.title.trim(),
        description: editableGoal.description || undefined,
        type: editableGoal.type || 'custom',
        priority: editableGoal.priority || 'Medium',
        dueDate: Timestamp.fromDate(new Date(editableGoal.dueDate)),
        overallTargetValue:
          typeof editableGoal.overallTargetValue === 'number'
            ? editableGoal.overallTargetValue
            : undefined,
        overallTargetUnit: editableGoal.overallTargetUnit || undefined,
        steps: steps.map((step) => ({
          ...step,
          startDate: step.startDate
            ? Timestamp.fromDate(
                step.startDate instanceof Date
                  ? step.startDate
                  : step.startDate.toDate(),
              )
            : undefined,
          endDate: step.endDate
            ? Timestamp.fromDate(
                step.endDate instanceof Date
                  ? step.endDate
                  : step.endDate.toDate(),
              )
            : undefined,
        })),
        pinned: false,
        progress: 0,
        status: 'Not Started',
        userId: user.uid,
        authorName: user.email || 'Anonymous',
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };

      await addGoal(goalData);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('goalCreated'));
      }

      if (onGoalCreated) {
        onGoalCreated();
      }

      onClose();
    } catch (error) {
      console.error('Error saving goal:', error);
      setError('Failed to save goal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
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
            Edit Goal Draft
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {loading && !editableGoal && (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              gap={2}
              py={4}
            >
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Analyzing your input and generating goal...
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

          {editableGoal && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                fullWidth
                label="Goal Title *"
                value={editableGoal.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                required
                variant="outlined"
                size="medium"
                placeholder="e.g., Save ₹5000 in 5 months"
              />

              <TextField
                fullWidth
                label="Description (Optional)"
                value={editableGoal.description || ''}
                onChange={(e) =>
                  handleInputChange('description', e.target.value)
                }
                variant="outlined"
                size="medium"
                multiline
                rows={3}
                placeholder="Describe your goal..."
              />

              <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  fullWidth
                  label="Target Value"
                  type="number"
                  value={editableGoal.overallTargetValue || ''}
                  onChange={(e) =>
                    handleInputChange(
                      'overallTargetValue',
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                  placeholder="e.g., 5000"
                />
                <TextField
                  fullWidth
                  label="Target Unit"
                  value={editableGoal.overallTargetUnit || ''}
                  onChange={(e) =>
                    handleInputChange('overallTargetUnit', e.target.value)
                  }
                  placeholder="e.g., Rs, kg, hours"
                />
              </Box>

              <DatePicker
                label="Target Date *"
                value={editableGoal.dueDate}
                onChange={(date) => {
                  if (date === null) {
                    handleInputChange('dueDate', new Date());
                  } else if (date instanceof Date) {
                    handleInputChange('dueDate', date);
                  } else {
                    // Handle Moment or other date-like objects
                    const dateValue = date as unknown as Date;
                    handleInputChange(
                      'dueDate',
                      dateValue instanceof Date
                        ? dateValue
                        : new Date(dateValue),
                    );
                  }
                }}
                slotProps={{ textField: { fullWidth: true } }}
              />

              <FormControl fullWidth size="medium">
                <InputLabel>Type</InputLabel>
                <Select
                  value={editableGoal.type || 'custom'}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  label="Type"
                >
                  {goalTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="medium">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={editableGoal.priority || 'Medium'}
                  onChange={(e) =>
                    handleInputChange('priority', e.target.value)
                  }
                  label="Priority"
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="body2" color="text.secondary">
                Note: At least one milestone will be created automatically. You
                can add more milestones after creating the goal.
              </Typography>
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
              loading || !editableGoal?.title?.trim() || !editableGoal?.dueDate
            }
            sx={{
              backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
              '&:hover': {
                backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
              },
            }}
          >
            {loading ? <CircularProgress size={20} /> : 'Save Goal'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}
