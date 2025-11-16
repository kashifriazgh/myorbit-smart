'use client';

import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Stack,
  Button,
  CircularProgress,
  TextField,
  IconButton,
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { TimeTableProps, TimeTableStep } from '@/app/lib/interface';
import { LocalizationProvider, TimePicker } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';

interface Props {
  open: boolean;
  onClose: () => void;
  rawText: string;
  onTimeTableCreated?: () => void;
}

interface EditableTimeTable {
  title: string;
  description: string;
  steps: TimeTableStep[];
}

interface ParsedTimeTableData {
  title?: string;
  description?: string;
  steps?: Array<{
    field1?: string;
    startTime?: string;
    endTime?: string;
  }>;
}

export default function TimeTableDraftModal({
  open,
  onClose,
  rawText,
  onTimeTableCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [editableTimeTable, setEditableTimeTable] =
    useState<EditableTimeTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  const parseAIResponse = (result: string): ParsedTimeTableData => {
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
      setError('Please enter some text to generate a timetable draft.');
      return;
    }

    setLoading(true);
    setError(null);

    const prompt = `
You are a productivity assistant. Analyze the following user input and extract timetable information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

{
  "title": "string (required, extract from text or create a meaningful title)",
  "description": "string (optional, extract description if mentioned, otherwise empty string)",
  "steps": [
    {
      "field1": "string (step name, e.g., 'Morning Routine', 'Study Time')",
      "startTime": "HH:mm format (extract start time)",
      "endTime": "HH:mm format (extract end time, optional)"
    }
  ]
}

Guidelines for extraction:
- Title: Extract the timetable name (e.g., "Daily Schedule", "Study Plan", "Work Routine")
- Description: Extract additional details if mentioned, otherwise use empty string
- Steps: Extract time blocks mentioned in the text. Each step should have:
  * field1: Activity name
  * startTime: Start time in HH:mm format
  * endTime: End time in HH:mm format (optional, can be empty string)
- Minimum 1 step is required. If no clear steps found, create at least one step from the text.

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

      let parsedData: ParsedTimeTableData;
      try {
        parsedData = parseAIResponse(result);
      } catch (parseError) {
        console.warn('AI response parsing failed, using defaults:', parseError);
        parsedData = {};
      }

      const steps: TimeTableStep[] =
        Array.isArray(parsedData.steps) && parsedData.steps.length > 0
          ? parsedData.steps.map((step) => ({
              field1: step.field1 || 'Untitled Step',
              startTime: step.startTime || '09:00',
              endTime: step.endTime || '',
            }))
          : [
              {
                field1: rawText.substring(0, 30) || 'Untitled Step',
                startTime: '09:00',
                endTime: '',
              },
            ];

      const draft: EditableTimeTable = {
        title:
          parsedData.title || rawText.substring(0, 50) || 'Untitled Time Table',
        description: parsedData.description || '',
        steps: steps,
      };

      setEditableTimeTable(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate timetable draft. Please try again.';

      setError(
        `AI parsing failed: ${errorMessage}. You can edit the fields below.`
      );

      const fallbackDraft: EditableTimeTable = {
        title: rawText.substring(0, 50) || 'Untitled Time Table',
        description: '',
        steps: [{ field1: 'Untitled Step', startTime: '09:00', endTime: '' }],
      };
      setEditableTimeTable(fallbackDraft);
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  useEffect(() => {
    if (open && rawText.trim() && !editableTimeTable && !loading) {
      generateDraft();
    }
  }, [open, rawText, editableTimeTable, loading, generateDraft]);

  useEffect(() => {
    if (!open) {
      setEditableTimeTable(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleInputChange = (
    field: keyof EditableTimeTable,
    value: string | TimeTableStep[]
  ) => {
    setEditableTimeTable((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleStepChange = (
    index: number,
    field: 'field1' | 'startTime' | 'endTime',
    value: string
  ) => {
    const newSteps = [...(editableTimeTable.steps || [])];
    newSteps[index] = { ...newSteps[index], [field]: value };
    handleInputChange('steps', newSteps);
  };

  const addStep = () => {
    const newSteps = [
      ...(editableTimeTable.steps || []),
      { field1: '', startTime: '09:00', endTime: '' },
    ];
    handleInputChange('steps', newSteps);
  };

  const removeStep = (index: number) => {
    const newSteps = editableTimeTable.steps.filter(
      (_, i: number) => i !== index
    );
    if (newSteps.length === 0) {
      newSteps.push({ field1: '', startTime: '09:00', endTime: '' });
    }
    handleInputChange('steps', newSteps);
  };

  const handleConfirmSave = async () => {
    if (!editableTimeTable || !user) {
      setError('Missing timetable data or user information.');
      return;
    }

    if (!editableTimeTable.title?.trim()) {
      setError('Title is required.');
      return;
    }

    if (!editableTimeTable.steps || editableTimeTable.steps.length === 0) {
      setError('At least one step is required.');
      return;
    }

    for (const step of editableTimeTable.steps) {
      if (!step.field1?.trim() || !step.startTime?.trim()) {
        setError('Each step requires a name and start time.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const data: Omit<TimeTableProps, 'id'> = {
        title: editableTimeTable.title.trim(),
        description: editableTimeTable.description || '',
        steps: editableTimeTable.steps,
        userId: user.uid,
        updatedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'timeTables'), data);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('timeTableCreated'));
      }

      if (onTimeTableCreated) {
        onTimeTableCreated();
      }

      onClose();
    } catch (error) {
      console.error('Error saving timetable:', error);
      setError('Failed to save timetable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
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
          Edit Time Table Draft
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading && !editableTimeTable && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            py={4}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Analyzing your input and generating timetable...
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

        {editableTimeTable && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Title *"
              value={editableTimeTable.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              variant="outlined"
              size="medium"
            />

            <TextField
              fullWidth
              label="Description (Optional)"
              value={editableTimeTable.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              variant="outlined"
              size="medium"
              multiline
              rows={2}
            />

            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Steps
            </Typography>

            <LocalizationProvider dateAdapter={AdapterMoment}>
              {editableTimeTable.steps?.map(
                (step: TimeTableStep, idx: number) => (
                  <Stack
                    key={idx}
                    spacing={1}
                    mb={2}
                    p={1.5}
                    sx={{ border: '1px solid #eee', borderRadius: 2 }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        placeholder="Step name *"
                        value={step.field1}
                        onChange={(e) =>
                          handleStepChange(idx, 'field1', e.target.value)
                        }
                        fullWidth
                      />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeStep(idx)}
                        disabled={editableTimeTable.steps.length === 1}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <TimePicker
                        label="Start Time *"
                        value={
                          step.startTime
                            ? moment(step.startTime, 'HH:mm')
                            : null
                        }
                        onChange={(newValue) =>
                          handleStepChange(
                            idx,
                            'startTime',
                            newValue ? moment(newValue).format('HH:mm') : ''
                          )
                        }
                        slotProps={{
                          textField: { size: 'small', fullWidth: true },
                        }}
                      />

                      {step.endTime ? (
                        <TimePicker
                          label="End Time"
                          value={
                            step.endTime ? moment(step.endTime, 'HH:mm') : null
                          }
                          onChange={(newValue) =>
                            handleStepChange(
                              idx,
                              'endTime',
                              newValue ? moment(newValue).format('HH:mm') : ''
                            )
                          }
                          slotProps={{
                            textField: { size: 'small', fullWidth: true },
                          }}
                        />
                      ) : (
                        <Button
                          size="small"
                          onClick={() =>
                            handleStepChange(idx, 'endTime', '00:00')
                          }
                        >
                          + Add End Time
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                )
              )}
            </LocalizationProvider>

            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={addStep}
              variant="outlined"
            >
              Add Step
            </Button>
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
          disabled={loading || !editableTimeTable?.title?.trim()}
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
            },
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Save Time Table'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
