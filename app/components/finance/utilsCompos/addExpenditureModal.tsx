'use client';
import React, { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Stack,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { EXPENSE_CATEGORIES } from '@/app/lib/constant';
import { Expenditure } from '@/app/lib/interface';
import { useAuth } from '@/app/lib/context/userContext';
import { db } from '@/app/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export default function AddExpenditureDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (exp: Expenditure & { id: string }) => void;
}) {
  const { user } = useAuth();
  const userId = user.uid;

  // ---- Form state ----
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'one-time' | 'recurring'>('one-time');
  const [frequency, setFrequency] = useState<
    'monthly' | 'weekly' | 'daily' | 'one_time'
  >('one_time');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(new Date());
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  // ---- Reset form ----
  const resetForm = () => {
    setTitle('');
    setAmount('');
    setType('one-time');
    setFrequency('one_time');
    setCategory('');
    setIsPaid(false);
    setNotes('');
    setDueDate(new Date());
    setDayOfWeek(null);
    setDayOfMonth(null);
  };

  // ---- Local Firestore save ----
  const handleSaveExpense = async (expense: Expenditure): Promise<string> => {
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'expenditures'), {
        ...expense,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return ref.id;
    } finally {
      setSaving(false);
    }
  };

  // ---- Save button handler ----
  const handleSave = async () => {
    if (!title || !amount) return;

    const payload: Expenditure = {
      userId,
      title,
      amount: Number(amount),
      type,
      frequency,
      category,
      isPaid,
      notes,
      createdAt: new Date(), // local timestamps for UI
      updatedAt: new Date(),
    };

    if (type === 'one-time') {
      payload.dueDate = dueDate ?? new Date();
    } else if (type === 'recurring') {
      if (frequency === 'weekly') {
        payload.dayOfWeek = dayOfWeek ?? 0;
      }
      if (frequency === 'monthly') {
        payload.dayOfMonth = dayOfMonth ?? 1;
      }
    }

    try {
      const id = await handleSaveExpense(payload);
      onAdded({ ...payload, id });
      resetForm();
      onClose();
    } catch (e) {
      console.error('Error saving expenditure:', e);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Add Expenditure</DialogTitle>
      <DialogContent>
        <TextField
          label="Title"
          fullWidth
          size="small"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          margin="normal"
        />
        <TextField
          label="Amount"
          fullWidth
          size="small"
          type="number"
          value={amount}
          onChange={(e) =>
            setAmount(e.target.value === '' ? '' : Number(e.target.value))
          }
          margin="normal"
        />

        <Stack direction="row" spacing={2} mt={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              label="Type"
              onChange={(e) => setType(e.target.value)}
            >
              <MenuItem value="one-time">One-time</MenuItem>
              <MenuItem value="recurring">Recurring</MenuItem>
            </Select>
          </FormControl>
          {type === 'recurring' && (
            <FormControl fullWidth size="small">
              <InputLabel>Frequency</InputLabel>
              <Select
                value={frequency}
                label="Frequency"
                onChange={(e) => setFrequency(e.target.value)}
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </FormControl>
          )}
        </Stack>

        {/* Conditional Date/Day Inputs */}
        {type === 'one-time' && (
          <Box mt={2}>
            <Typography variant="body2" fontWeight={600} mb={0.5} color="error">
              Due Date
            </Typography>
            <DatePicker
              selected={dueDate}
              onChange={(date: Date | null) => setDueDate(date)}
              className="w-full border px-3 py-2 rounded-md text-sm"
            />
          </Box>
        )}

        {type === 'recurring' && frequency === 'weekly' && (
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Day of Week</InputLabel>
            <Select
              value={dayOfWeek ?? ''}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              label="Day of Week"
            >
              {[
                'Sunday',
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
              ].map((day, idx) => (
                <MenuItem key={idx} value={idx}>
                  {day}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {type === 'recurring' && frequency === 'monthly' && (
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Day of Month</InputLabel>
            <Select
              value={dayOfMonth ?? ''}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
              label="Day of Month"
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                <MenuItem key={day} value={day}>
                  {day}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl fullWidth margin="normal" size="small">
          <InputLabel>Category</InputLabel>
          <Select
            value={category}
            label="Category"
            onChange={(e) => setCategory(e.target.value)}
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Notes"
          fullWidth
          size="small"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          margin="normal"
          multiline
          rows={3}
        />

        <Box display="flex" alignItems="center" mt={2}>
          <Checkbox
            checked={isPaid}
            onChange={(e) => setIsPaid(e.target.checked)}
          />
          <Typography>Mark as Paid</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={
            saving ||
            !title ||
            !amount ||
            !category ||
            (type === 'one-time' && !dueDate) ||
            (type === 'recurring' &&
              frequency === 'weekly' &&
              dayOfWeek === null) ||
            (type === 'recurring' &&
              frequency === 'monthly' &&
              dayOfMonth === null)
          }
        >
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
