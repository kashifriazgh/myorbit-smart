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
import { EXPENSE_CATEGORIES } from '@/app/lib/constant';
import { Expenditure } from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface Props {
  open: boolean;
  onClose: () => void;
  rawText: string;
  onExpenseCreated?: () => void;
}

interface EditableExpense {
  title: string;
  amount: number;
  category: string;
  type: 'one-time' | 'recurring';
  frequency: 'monthly' | 'weekly' | 'daily' | 'one_time';
  dueDate: Date;
  isPaid: boolean;
  notes: string;
}

interface ParsedExpenseData {
  title?: string;
  amount?: number;
  category?: string;
  type?: 'one-time' | 'recurring';
  frequency?: 'monthly' | 'weekly' | 'daily' | 'one_time';
  dueDate?: string;
}

export default function ExpenseDraftModal({
  open,
  onClose,
  rawText,
  onExpenseCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [editableExpense, setEditableExpense] =
    useState<EditableExpense | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  const parseAIResponse = (result: string): ParsedExpenseData => {
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
      setError('Please enter some text to generate an expense draft.');
      return;
    }

    setLoading(true);
    setError(null);

    const prompt = `
You are a productivity assistant. Analyze the following user input and extract expenditure information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

{
  "title": "string (required, extract from text or create a meaningful title)",
  "amount": number (extract monetary amount from text, default 0 if not found),
  "category": "string (extract or infer category from: Food, Transport, Rent, Utilities, Healthcare, Education, Entertainment, Subscriptions, Clothing, Gifts, Others)",
  "type": "one-time" | "recurring" (determine based on keywords like "monthly", "weekly", "daily", "recurring" → recurring, otherwise one-time),
  "frequency": "monthly" | "weekly" | "daily" | "one_time" (extract from text, default "one_time" if type is one-time),
  "dueDate": "YYYY-MM-DD format (extract from text, default to today if not specified)"
}

Guidelines for extraction:
- Title: Extract the expenditure name (e.g., "Rent", "Groceries", "Netflix subscription")
- Amount: Extract numbers mentioned (look for currency symbols, numbers with context). If multiple amounts, use the largest or most relevant.
- Category: Infer from title and context:
  * rent/house/accommodation → Rent
  * food/groceries/restaurant → Food
  * transport/taxi/bus/train → Transport
  * electricity/water/internet/phone → Utilities
  * hospital/medicine/doctor → Healthcare
  * school/course/book → Education
  * movie/game/entertainment → Entertainment
  * subscription/netflix/spotify → Subscriptions
  * cloth/shoes → Clothing
  * gift/present → Gifts
  * Default → Others
- Type: Look for "monthly", "weekly", "daily", "recurring", "every month" → recurring, otherwise one-time
- Frequency: If recurring, extract "monthly", "weekly", or "daily", otherwise "one_time"
- DueDate: Extract dates mentioned, default to today

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

      let parsedData: ParsedExpenseData;
      try {
        parsedData = parseAIResponse(result);
      } catch (parseError) {
        console.warn('AI response parsing failed, using defaults:', parseError);
        parsedData = {};
      }

      const draft: EditableExpense = {
        title: parsedData.title || 'Untitled Expense',
        amount:
          parsedData.amount && parsedData.amount > 0 ? parsedData.amount : 0,
        category:
          parsedData.category &&
          EXPENSE_CATEGORIES.includes(parsedData.category)
            ? parsedData.category
            : 'Others',
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
        dueDate: parsedData.dueDate ? new Date(parsedData.dueDate) : new Date(),
        isPaid: false,
        notes: '',
      };

      setEditableExpense(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate expense draft. Please try again.';

      setError(
        `AI parsing failed: ${errorMessage}. You can edit the fields below.`
      );

      const fallbackDraft: EditableExpense = {
        title: rawText.substring(0, 50) || 'Untitled Expense',
        amount: 0,
        category: 'Others',
        type: 'one-time',
        frequency: 'one_time',
        dueDate: new Date(),
        isPaid: false,
        notes: '',
      };
      setEditableExpense(fallbackDraft);
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  useEffect(() => {
    if (open && rawText.trim() && !editableExpense && !loading) {
      generateDraft();
    }
  }, [open, rawText, editableExpense, loading, generateDraft]);

  useEffect(() => {
    if (!open) {
      setEditableExpense(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleInputChange = (
    field: keyof EditableExpense,
    value: string | number | Date | boolean
  ) => {
    setEditableExpense((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value,
      };
    });

    // Auto-update frequency when type changes
    if (field === 'type' && value === 'one-time') {
      setEditableExpense((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          frequency: 'one_time',
        };
      });
    }
  };

  const handleConfirmSave = async () => {
    if (!editableExpense || !user) {
      setError('Missing expense data or user information.');
      return;
    }

    if (
      !editableExpense.title ||
      !editableExpense.amount ||
      editableExpense.amount <= 0
    ) {
      setError('Title and amount are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: Omit<Expenditure, 'id'> = {
        userId: user.uid,
        title: editableExpense.title.trim(),
        amount: Number(editableExpense.amount),
        type: editableExpense.type || 'one-time',
        frequency: editableExpense.frequency || 'one_time',
        category: editableExpense.category || 'Others',
        isPaid: editableExpense.isPaid || false,
        notes: editableExpense.notes || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (editableExpense.type === 'one-time') {
        payload.dueDate = editableExpense.dueDate || new Date();
      } else if (editableExpense.type === 'recurring') {
        if (editableExpense.frequency === 'weekly') {
          payload.dayOfWeek = 0; // Default to Sunday
        }
        if (editableExpense.frequency === 'monthly') {
          payload.dayOfMonth = 1; // Default to 1st of month
        }
        payload.effectiveFromDate = editableExpense.dueDate || new Date();
      }

      await addDoc(collection(db, 'expenditures'), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('expenseCreated'));
      }

      if (onExpenseCreated) {
        onExpenseCreated();
      }

      onClose();
    } catch (error) {
      console.error('Error saving expense:', error);
      setError('Failed to save expense. Please try again.');
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
          Edit Expense Draft
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading && !editableExpense && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            py={4}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Analyzing your input and generating expense...
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

        {editableExpense && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Title *"
              value={editableExpense.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              variant="outlined"
              size="medium"
              placeholder="e.g., Rent, Groceries"
            />

            <TextField
              fullWidth
              label="Amount (Rs) *"
              type="number"
              value={editableExpense.amount || ''}
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
                value={editableExpense.category || 'Others'}
                onChange={(e) => handleInputChange('category', e.target.value)}
                label="Category"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="medium">
              <InputLabel>Type</InputLabel>
              <Select
                value={editableExpense.type || 'one-time'}
                onChange={(e) => handleInputChange('type', e.target.value)}
                label="Type"
              >
                <MenuItem value="one-time">One-time</MenuItem>
                <MenuItem value="recurring">Recurring</MenuItem>
              </Select>
            </FormControl>

            {editableExpense.type === 'recurring' && (
              <FormControl fullWidth size="medium">
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={editableExpense.frequency || 'monthly'}
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
                {editableExpense.type === 'one-time'
                  ? 'Due Date'
                  : 'Effective From'}
              </Typography>
              <DatePicker
                selected={editableExpense.dueDate || new Date()}
                onChange={(date: Date | null) =>
                  handleInputChange('dueDate', date || new Date())
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
            !editableExpense?.title ||
            !editableExpense?.amount ||
            editableExpense?.amount <= 0
          }
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
            },
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Save Expense'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
