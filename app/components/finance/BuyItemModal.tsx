'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  useTheme,
  Stack,
  Alert,
} from '@mui/material';
import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { BuyItem } from '@/app/lib/interface';
import { useAuth } from '@/app/lib/context/userContext';

const PRIORITIES = ['optional', 'needed', 'urgent'] as const;

type BuyItemEntry = {
  userId: string;
  title: string;
  estimatedPrice: number;
  purchasedPrice?: number;
  isPurchased: boolean;
  priority?: 'optional' | 'needed' | 'urgent';
  notes?: string;
};

export default function BuyItemModal({
  open,
  onClose,
  onItemCreated,
}: {
  open: boolean;
  onClose: () => void;
  onItemCreated?: (item: BuyItem) => void;
}) {
  const theme = useTheme();
  const { user } = useAuth();

  const [planTitle, setPlanTitle] = useState('');
  const [budgetLimit, setBudgetLimit] = useState<number | ''>('');

  const [items, setItems] = useState<BuyItemEntry[]>([]);

  // Fields for new item
  const [itemTitle, setItemTitle] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState<number | ''>('');
  const [priority, setPriority] = useState<BuyItemEntry['priority']>('needed');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const totalEstimate = items.reduce((sum, i) => sum + i.estimatedPrice, 0);

  const handleAddItem = () => {
    setError('');
    if (!itemTitle || estimatedPrice === '') {
      setError('Please enter both title and estimated price');
      return;
    }

    if (
      typeof budgetLimit === 'number' &&
      totalEstimate + Number(estimatedPrice) > budgetLimit
    ) {
      setError(
        `Cannot add this item. Total exceeds your budget of Rs ${(
          budgetLimit || 0
        ).toLocaleString()}`
      );

      return;
    }

    const newItem: BuyItemEntry = {
      userId: user.uid,
      title: itemTitle,
      estimatedPrice: Number(estimatedPrice),
      isPurchased: false,
      priority,
      notes,
    };

    setItems((prev) => [...prev, newItem]);

    // Reset item fields
    setItemTitle('');
    setEstimatedPrice('');
    setPriority('needed');
    setNotes('');
  };

  const handleSavePlan = async () => {
    if (!planTitle || items.length === 0 || !user) return;

    const now = new Date();
    const newPlan: BuyItem = {
      userId: user.uid,
      title: planTitle,
      items,
      archived: false,
      pinned: false,
      sharedWith: [],
      createdAt: now,
      updatedAt: now,
      budgetLimit: budgetLimit === '' ? undefined : Number(budgetLimit), // ✅ Add here
    };

    const docRef = await addDoc(collection(db, 'buyItems'), {
      ...newPlan,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (onItemCreated) {
      onItemCreated({ ...newPlan, id: docRef.id });
    }

    // Reset
    setPlanTitle('');
    setBudgetLimit('');
    setItems([]);
    setItemTitle('');
    setEstimatedPrice('');
    setPriority('needed');
    setNotes('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Create Shopping Plan</DialogTitle>
      <DialogContent>
        {/* Plan Title & Budget */}
        <TextField
          label="Plan Title"
          fullWidth
          value={planTitle}
          onChange={(e) => setPlanTitle(e.target.value)}
          margin="normal"
        />
        <TextField
          label="Budget Limit (Rs)"
          fullWidth
          type="number"
          value={budgetLimit}
          onChange={(e) =>
            setBudgetLimit(e.target.value === '' ? '' : Number(e.target.value))
          }
          margin="normal"
        />

        {/* New Item */}
        <Typography mt={3} fontWeight="bold">
          Add Item
        </Typography>

        <TextField
          label="Item Title"
          fullWidth
          value={itemTitle}
          onChange={(e) => setItemTitle(e.target.value)}
          margin="normal"
        />

        <TextField
          label="Estimated Price"
          fullWidth
          type="number"
          value={estimatedPrice}
          onChange={(e) =>
            setEstimatedPrice(
              e.target.value === '' ? '' : Number(e.target.value)
            )
          }
          margin="normal"
        />

        <FormControl fullWidth margin="normal">
          <InputLabel>Priority</InputLabel>
          <Select
            value={priority}
            label="Priority"
            onChange={(e) =>
              setPriority(e.target.value as BuyItemEntry['priority'])
            }
          >
            {PRIORITIES.map((p) => (
              <MenuItem key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Notes (optional)"
          fullWidth
          multiline
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          margin="normal"
        />

        <Box mt={1}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleAddItem}
            disabled={estimatedPrice === '' || itemTitle === ''}
          >
            + Add Item
          </Button>
        </Box>

        {/* Error */}
        {error && (
          <Box mt={2}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {/* Items List */}
        {items.length > 0 && (
          <Box mt={4}>
            <Typography variant="subtitle2" gutterBottom>
              Items in This Plan ({items.length}) — Estimated Total:{' '}
              <strong>Rs {Number(totalEstimate || 0).toLocaleString()}</strong>
            </Typography>
            <Stack spacing={1}>
              {items.map((item, idx) => (
                <Box
                  key={idx}
                  p={1.5}
                  bgcolor={
                    theme.palette.mode === 'dark' ? '#1f2937' : '#f3f4f6'
                  }
                  borderRadius={2}
                >
                  <Typography fontWeight="bold">
                    {item.title ?? 'Untitled'} – Rs{' '}
                    {(item.estimatedPrice || 0).toLocaleString()}
                  </Typography>

                  <Typography fontSize="0.85rem" color="text.secondary">
                    Priority: {item.priority}
                    {item.notes && ` • 📝 ${item.notes}`}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSavePlan}
          variant="contained"
          color="success"
          disabled={!planTitle || items.length === 0}
        >
          Save Plan
        </Button>
      </DialogActions>
    </Dialog>
  );
}
