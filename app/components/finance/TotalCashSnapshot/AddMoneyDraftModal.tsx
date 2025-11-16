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
  Checkbox,
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { Close as CloseIcon } from '@mui/icons-material';
import { TransactionSource, Bank } from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

const SOURCE_OPTIONS: TransactionSource[] = [
  'bank',
  'in_hand',
  'easypaisa',
  'jazzcash',
  'other',
];

interface Props {
  open: boolean;
  onClose: () => void;
  rawText: string;
  onMoneyAdded?: () => void;
  onSave: (
    amount: number,
    source: TransactionSource,
    isFreezed: boolean,
    bankId?: string,
    bankName?: string
  ) => Promise<void>;
}

interface EditableMoney {
  amount: number;
  source: TransactionSource;
  isFreezed: boolean;
  bankName: string;
  selectedBank: string;
}

interface ParsedMoneyData {
  amount?: number;
  source?: TransactionSource;
  isFreezed?: boolean;
  bankName?: string;
}

export default function AddMoneyDraftModal({
  open,
  onClose,
  rawText,
  onMoneyAdded,
  onSave,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [editableMoney, setEditableMoney] = useState<EditableMoney | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !open) return;
    const fetchBanks = async () => {
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched: Bank[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Bank, 'id'>),
      }));
      setBanks(fetched);
    };
    fetchBanks();
  }, [user, open]);

  const parseAIResponse = (result: string): ParsedMoneyData => {
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
          throw new Error(`Could not parse AI response - ${e2}`);
        }
      }
      throw new Error('Could not parse AI response');
    }
  };

  const generateDraft = useCallback(async () => {
    if (!rawText.trim()) {
      setError('Please enter some text to generate a money addition draft.');
      return;
    }

    setLoading(true);
    setError(null);

    const prompt = `
You are a productivity assistant. Analyze the following user input and extract money addition information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

{
  "amount": number (extract monetary amount from text, default 0 if not found),
  "source": "bank" | "in_hand" | "easypaisa" | "jazzcash" | "other" (infer from context, default "in_hand"),
  "isFreezed": boolean (look for keywords like "freeze", "freezed", "locked", default false),
  "bankName": "string (if source is bank, extract bank name, otherwise empty string)"
}

Guidelines for extraction:
- Amount: Extract numbers mentioned (look for currency symbols, numbers with context)
- Source: Infer from keywords:
  * bank/account → bank
  * hand/cash/pocket → in_hand
  * easypaisa → easypaisa
  * jazzcash → jazzcash
  * Default → in_hand
- IsFreezed: Look for "freeze", "freezed", "locked", "reserve" → true, otherwise false
- BankName: If source is bank, extract bank name mentioned

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

      let parsedData: ParsedMoneyData;
      try {
        parsedData = parseAIResponse(result);
      } catch (parseError) {
        console.warn('AI response parsing failed, using defaults:', parseError);
        parsedData = {};
      }

      const draft: EditableMoney = {
        amount:
          parsedData.amount && parsedData.amount > 0 ? parsedData.amount : 0,
        source: SOURCE_OPTIONS.includes(parsedData.source)
          ? parsedData.source
          : 'in_hand',
        isFreezed: parsedData.isFreezed === true,
        bankName: parsedData.bankName || '',
        selectedBank: '',
      };

      setEditableMoney(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate money addition draft. Please try again.';

      setError(
        `AI parsing failed: ${errorMessage}. You can edit the fields below.`
      );

      const fallbackDraft: EditableMoney = {
        amount: 0,
        source: 'in_hand',
        isFreezed: false,
        bankName: '',
        selectedBank: '',
      };
      setEditableMoney(fallbackDraft);
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  useEffect(() => {
    if (open && rawText.trim() && !editableMoney && !loading) {
      generateDraft();
    }
  }, [open, rawText, editableMoney, loading, generateDraft]);

  useEffect(() => {
    if (!open) {
      setEditableMoney(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleInputChange = (
    field: keyof EditableMoney,
    value: number | TransactionSource | boolean | string
  ) => {
    setEditableMoney((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value,
      };
    });

    // Reset bank selection when source changes
    if (field === 'source' && value !== 'bank') {
      setEditableMoney((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          selectedBank: '',
          bankName: '',
        };
      });
    }
  };

  const handleConfirmSave = async () => {
    if (!editableMoney) {
      setError('Missing money data.');
      return;
    }

    if (!editableMoney.amount || editableMoney.amount <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }

    if (
      !editableMoney.isFreezed &&
      editableMoney.source === 'bank' &&
      !editableMoney.selectedBank
    ) {
      setError('Please select a bank.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sourceToSave: TransactionSource = editableMoney.isFreezed
        ? 'in_hand' // dummy fallback
        : editableMoney.source;

      let bankId: string | undefined;
      let bankName: string | undefined;

      if (!editableMoney.isFreezed && editableMoney.source === 'bank') {
        bankId = editableMoney.selectedBank;
        bankName =
          banks.find((b) => b.id === editableMoney.selectedBank)?.name ||
          editableMoney.bankName;
        if (!bankId || !bankName) {
          setError('Please select a valid bank.');
          setLoading(false);
          return;
        }
      }

      await onSave(
        Number(editableMoney.amount),
        sourceToSave,
        editableMoney.isFreezed,
        bankId,
        bankName
      );

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('moneyAdded'));
      }

      if (onMoneyAdded) {
        onMoneyAdded();
      }

      onClose();
    } catch (error) {
      console.error('Error saving money:', error);
      setError('Failed to save money. Please try again.');
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
          Edit Add Money Draft
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading && !editableMoney && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            py={4}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Analyzing your input and generating money addition...
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

        {editableMoney && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Amount (Rs) *"
              type="number"
              value={editableMoney.amount || ''}
              onChange={(e) =>
                handleInputChange('amount', Number(e.target.value) || 0)
              }
              required
              variant="outlined"
              size="medium"
              placeholder="0"
            />

            <FormControl
              fullWidth
              size="medium"
              disabled={editableMoney.isFreezed}
            >
              <InputLabel>Source</InputLabel>
              <Select
                value={editableMoney.source || 'in_hand'}
                onChange={(e) => handleInputChange('source', e.target.value)}
                label="Source"
              >
                {SOURCE_OPTIONS.map((mode) => (
                  <MenuItem key={mode} value={mode}>
                    {mode}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {!editableMoney.isFreezed && editableMoney.source === 'bank' && (
              <FormControl fullWidth size="medium">
                <InputLabel>Select Bank</InputLabel>
                <Select
                  value={editableMoney.selectedBank || ''}
                  onChange={(e) =>
                    handleInputChange('selectedBank', e.target.value)
                  }
                  label="Bank"
                >
                  {banks.map((bank) => (
                    <MenuItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Box display="flex" alignItems="center">
              <Checkbox
                checked={editableMoney.isFreezed || false}
                onChange={(e) =>
                  handleInputChange('isFreezed', e.target.checked)
                }
                size="small"
              />
              <Typography variant="body2">Add to Freezed balance</Typography>
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
            !editableMoney?.amount ||
            editableMoney?.amount <= 0 ||
            (!editableMoney.isFreezed &&
              editableMoney.source === 'bank' &&
              !editableMoney.selectedBank)
          }
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
            },
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Add Money'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
