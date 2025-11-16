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
import { INCOME_CATEGORIES } from '@/app/lib/constant';
import { IncomeSource } from '@/app/lib/interface';
import { saveIncomeSource } from '@/app/lib/functions/incomeSources';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  getCurrentDatePK,
  getTomorrowDatePK,
  parseDatePK,
} from '@/app/lib/utils/dateUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  rawText: string;
  onIncomeCreated?: () => void;
}

interface EditableIncome {
  title: string;
  amount: number;
  category: string;
  type: 'one-time' | 'recurring';
  frequency: 'monthly' | 'weekly' | 'daily' | 'one_time';
  expectedDate: Date;
  isReceived: boolean;
  notes: string;
}

interface ParsedIncomeData {
  title?: string;
  amount?: number;
  category?: string;
  type?: 'one-time' | 'recurring';
  frequency?: 'monthly' | 'weekly' | 'daily' | 'one_time';
  expectedDate?: string;
}

export default function IncomeDraftModal({
  open,
  onClose,
  rawText,
  onIncomeCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [editableIncome, setEditableIncome] = useState<EditableIncome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  const parseAIResponse = (result: string): ParsedIncomeData => {
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
      setError('Please enter some text to generate an income draft.');
      return;
    }

    setLoading(true);
    setError(null);

    const prompt = `
You are a productivity assistant. Analyze the following user input and extract income source information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

{
  "title": "string (required, extract from text or create a meaningful title)",
  "amount": number (extract monetary amount from text, default 0 if not found),
  "category": "string (extract or infer category from: Salary, Freelancing, Business, Rent, Shop Sales, Investments, Gifts & Donations, Government Support, Side Hustle, Other)",
  "type": "one-time" | "recurring" (determine based on keywords like "monthly", "weekly", "daily", "recurring" → recurring, otherwise one-time),
  "frequency": "monthly" | "weekly" | "daily" | "one_time" (extract from text, default "one_time" if type is one-time),
  "expectedDate": "YYYY-MM-DD format (extract from text, default to today if not specified)"
}

Guidelines for extraction:
- Title: Extract the income name (e.g., "Salary", "Freelance Project", "Rental Income")
- Amount: Extract numbers mentioned (look for currency symbols, numbers with context). If multiple amounts, use the largest or most relevant.
- Category: Infer from title and context:
  * salary/job/work → Salary
  * freelance/project/client → Freelancing
  * business/shop/sales → Business
  * rent/rental → Rent
  * shop/store/sales → Shop Sales
  * investment/dividend/interest → Investments
  * gift/donation → Gifts & Donations
  * government/support/benefit → Government Support
  * side/hustle/part-time → Side Hustle
  * Default → Other
- Type: Look for "monthly", "weekly", "daily", "recurring", "every month" → recurring, otherwise one-time
- Frequency: If recurring, extract "monthly", "weekly", or "daily", otherwise "one_time"
- ExpectedDate: Extract dates mentioned, default to today. IMPORTANT: Use Pakistan timezone (Asia/Karachi, UTC+5).

Current date context (Pakistan timezone): ${getCurrentDatePK()}
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

      let parsedData: ParsedIncomeData;
      try {
        parsedData = parseAIResponse(result);
      } catch (parseError) {
        console.warn('AI response parsing failed, using defaults:', parseError);
        parsedData = {};
      }

      const draft: EditableIncome = {
        title: parsedData.title || 'Untitled Income',
        amount:
          parsedData.amount && parsedData.amount > 0 ? parsedData.amount : 0,
        category:
          parsedData.category && INCOME_CATEGORIES.includes(parsedData.category)
            ? parsedData.category
            : 'Other',
        type: ['one-time', 'recurring'].includes(parsedData.type)
          ? parsedData.type
          : 'one-time',
        frequency:
          parsedData.type === 'one-time'
            ? 'one_time'
            : ['monthly', 'weekly', 'daily', 'one_time'].includes(
                parsedData.frequency
              )
            ? parsedData.frequency
            : 'one_time',
        expectedDate: parsedData.expectedDate
          ? parseDatePK(parsedData.expectedDate)
          : new Date(),
        isReceived: false,
        notes: '',
      };

      setEditableIncome(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate income draft. Please try again.';

      setError(
        `AI parsing failed: ${errorMessage}. You can edit the fields below.`
      );

      const fallbackDraft: EditableIncome = {
        title: rawText.substring(0, 50) || 'Untitled Income',
        amount: 0,
        category: 'Other',
        type: 'one-time',
        frequency: 'one_time',
        expectedDate: new Date(),
        isReceived: false,
        notes: '',
      };
      setEditableIncome(fallbackDraft);
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  useEffect(() => {
    if (open && rawText.trim() && !editableIncome && !loading) {
      generateDraft();
    }
  }, [open, rawText, editableIncome, loading, generateDraft]);

  useEffect(() => {
    if (!open) {
      setEditableIncome(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleInputChange = (field: keyof EditableIncome, value: string | number | Date | boolean) => {
    setEditableIncome((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value,
      };
    });

    // Auto-update frequency when type changes
    if (field === 'type' && value === 'one-time') {
      setEditableIncome((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          frequency: 'one_time',
        };
      });
    }
  };

  const handleConfirmSave = async () => {
    if (!editableIncome || !user) {
      setError('Missing income data or user information.');
      return;
    }

    if (
      !editableIncome.title ||
      !editableIncome.amount ||
      editableIncome.amount <= 0
    ) {
      setError('Title and amount are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: IncomeSource = {
        userId: user.uid,
        title: editableIncome.title.trim(),
        amount: Number(editableIncome.amount),
        type: editableIncome.type || 'one-time',
        frequency: editableIncome.frequency || 'one_time',
        category: editableIncome.category || 'Other',
        isReceived: editableIncome.isReceived || false,
        notes: editableIncome.notes || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (editableIncome.type === 'one-time') {
        payload.expectedDate = editableIncome.expectedDate || new Date();
      } else if (editableIncome.type === 'recurring') {
        if (editableIncome.frequency === 'weekly') {
          payload.dayOfWeek = 0; // Default to Sunday
        }
        if (editableIncome.frequency === 'monthly') {
          payload.dayOfMonth = 1; // Default to 1st of month
        }
        payload.effectiveFromDate = editableIncome.expectedDate || new Date();
      }

      await saveIncomeSource(payload);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('incomeCreated'));
      }

      if (onIncomeCreated) {
        onIncomeCreated();
      }

      onClose();
    } catch (error) {
      console.error('Error saving income:', error);
      setError('Failed to save income. Please try again.');
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
          Edit Income Draft
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading && !editableIncome && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            py={4}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Analyzing your input and generating income source...
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

        {editableIncome && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Title *"
              value={editableIncome.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              variant="outlined"
              size="medium"
              placeholder="e.g., Salary, Freelance Project"
            />

            <TextField
              fullWidth
              label="Amount (Rs) *"
              type="number"
              value={editableIncome.amount || ''}
              onChange={(e) =>
                handleInputChange('amount', Number(e.target.value) || 0)
              }
              required
              variant="outlined"
              size="medium"
              placeholder="0"
            />

            <FormControl fullWidth size="medium" required>
              <InputLabel>Category</InputLabel>
              <Select
                value={editableIncome.category || 'Other'}
                onChange={(e) => handleInputChange('category', e.target.value)}
                label="Category"
              >
                {INCOME_CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="medium">
              <InputLabel>Type</InputLabel>
              <Select
                value={editableIncome.type || 'one-time'}
                onChange={(e) => handleInputChange('type', e.target.value)}
                label="Type"
              >
                <MenuItem value="one-time">One-time</MenuItem>
                <MenuItem value="recurring">Recurring</MenuItem>
              </Select>
            </FormControl>

            {editableIncome.type === 'recurring' && (
              <FormControl fullWidth size="medium">
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={editableIncome.frequency || 'monthly'}
                  onChange={(e) =>
                    handleInputChange('frequency', e.target.value)
                  }
                  label="Frequency"
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            )}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                {editableIncome.type === 'one-time'
                  ? 'Expected Date'
                  : 'Effective From'}
              </Typography>
              <DatePicker
                selected={editableIncome.expectedDate || new Date()}
                onChange={(date: Date | null) =>
                  handleInputChange('expectedDate', date || new Date())
                }
                className="custom-datepicker"
                dateFormat="yyyy-MM-dd"
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
          disabled={
            loading ||
            !editableIncome?.title ||
            !editableIncome?.amount ||
            editableIncome?.amount <= 0
          }
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
            },
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Save Income'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
