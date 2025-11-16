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
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { Close as CloseIcon } from '@mui/icons-material';
// import { ShoppingListItem } from '@/app/lib/interface';

// import moment from 'moment';

interface Props {
  open: boolean;
  onClose: () => void;
  rawText: string;
  onShoppingItemCreated?: () => void;
}

interface EditableShoppingItem {
  title: string;
  qty: string;
  proposedPrice: number;
  icon: string;
}

interface ParsedShoppingData {
  title?: string;
  qty?: string;
  proposedPrice?: number;
  icon?: string;
}

export default function ShoppingDraftModal({
  open,
  onClose,
  rawText,
  onShoppingItemCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [editableItem, setEditableItem] = useState<EditableShoppingItem | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  const parseAIResponse = (result: string): ParsedShoppingData => {
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
      setError('Please enter some text to generate a shopping item draft.');
      return;
    }

    setLoading(true);
    setError(null);

    const prompt = `
You are a productivity assistant. Analyze the following user input and extract shopping list item information. Return ONLY a valid JSON object with the following structure. Do not include any explanation, markdown code blocks, or additional text - just the raw JSON object:

{
  "title": "string (required, extract item name from text)",
  "qty": "string (optional, extract quantity like '6 x bars', '2 kg', '3 pieces', default '1')",
  "proposedPrice": number (extract price/budget amount from text, default 0 if not found),
  "icon": "string (optional, suggest appropriate emoji based on item type, default '🛒')"
}

Guidelines for extraction:
- Title: Extract the item name (e.g., "Wooden Bars", "Milk", "Bananas")
- Qty: Extract quantity mentioned (e.g., "6 x bars", "2 kg", "3 pieces", "1 bottle")
- ProposedPrice: Extract numbers mentioned with price context, default 0
- Icon: Suggest emoji based on item type (fruits, vegetables, dairy, meat, bakery, etc.)

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

      let parsedData: ParsedShoppingData;
      try {
        parsedData = parseAIResponse(result);
      } catch (parseError) {
        console.warn('AI response parsing failed, using defaults:', parseError);
        parsedData = {};
      }

      const draft: EditableShoppingItem = {
        title: parsedData.title || rawText.substring(0, 50) || 'Untitled Item',
        qty: parsedData.qty || '1',
        proposedPrice:
          parsedData.proposedPrice && parsedData.proposedPrice > 0
            ? parsedData.proposedPrice
            : 0,
        icon: parsedData.icon || '🛒',
      };

      setEditableItem(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to generate shopping item draft. Please try again.';

      setError(
        `AI parsing failed: ${errorMessage}. You can edit the fields below.`
      );

      const fallbackDraft: EditableShoppingItem = {
        title: rawText.substring(0, 50) || 'Untitled Item',
        qty: '1',
        proposedPrice: 0,
        icon: '🛒',
      };
      setEditableItem(fallbackDraft);
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  useEffect(() => {
    if (open && rawText.trim() && !editableItem && !loading) {
      generateDraft();
    }
  }, [open, rawText, editableItem, loading, generateDraft]);

  useEffect(() => {
    if (!open) {
      setEditableItem(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleInputChange = (
    field: keyof EditableShoppingItem,
    value: string | number
  ) => {
    setEditableItem((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleConfirmSave = async () => {
    if (!editableItem || !user) {
      setError('Missing item data or user information.');
      return;
    }

    if (!editableItem.title?.trim()) {
      setError('Title is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // const currentMonth = moment().format('YYYY-MM');
      // const newItem: Omit<ShoppingListItem, 'id'> = {
      //   userId: user.uid,
      //   title: editableItem.title.trim(),
      //   qty: editableItem.qty || '1',
      //   proposedPrice: editableItem.proposedPrice || 0,
      //   icon: editableItem.icon || '🛒',
      //   purchased: false,
      //   purchasedPrice: 0,
      //   month: currentMonth,
      //   createdAt: new Date(),
      //   updatedAt: new Date(),
      // };

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shoppingItemCreated'));
      }

      if (onShoppingItemCreated) {
        onShoppingItemCreated();
      }

      onClose();
    } catch (error) {
      console.error('Error saving shopping item:', error);
      setError('Failed to save shopping item. Please try again.');
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
          Edit Shopping Item Draft
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {loading && !editableItem && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap={2}
            py={4}
          >
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Analyzing your input and generating shopping item...
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

        {editableItem && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  fontSize: '3rem',
                  p: 2,
                  border: '2px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  backgroundColor: 'background.paper',
                  textAlign: 'center',
                  minWidth: 80,
                }}
              >
                {editableItem.icon || '🛒'}
              </Box>
              <TextField
                fullWidth
                label="Icon Emoji"
                value={editableItem.icon || '🛒'}
                onChange={(e) => handleInputChange('icon', e.target.value)}
                variant="outlined"
                size="medium"
                placeholder="🛒"
              />
            </Box>

            <TextField
              fullWidth
              label="Item Title *"
              value={editableItem.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              variant="outlined"
              size="medium"
              placeholder="e.g. Wooden Bars"
            />

            <TextField
              fullWidth
              label="Quantity"
              value={editableItem.qty || ''}
              onChange={(e) => handleInputChange('qty', e.target.value)}
              variant="outlined"
              size="medium"
              placeholder="e.g. 6 x bars"
            />

            <TextField
              fullWidth
              label="Proposed Price (Rs)"
              type="number"
              value={editableItem.proposedPrice || ''}
              onChange={(e) =>
                handleInputChange('proposedPrice', Number(e.target.value) || 0)
              }
              variant="outlined"
              size="medium"
              placeholder="0"
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>Rs</Typography>,
              }}
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
          disabled={loading || !editableItem?.title?.trim()}
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#2563eb',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1d4ed8',
            },
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Save Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
