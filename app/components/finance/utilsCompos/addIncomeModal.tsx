'use client';
import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Collapse,
  IconButton,
  Checkbox,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { INCOME_CATEGORIES } from '@/app/lib/constant';
import { IncomeSource } from '@/app/lib/interface';
import { saveIncomeSource } from '@/app/lib/functions/incomeSources';

export default function AddIncomeModal({
  open,
  onClose,
  onAdded,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (income: IncomeSource & { id: string }) => void;
  userId: string;
}) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [type, setType] = useState<'one-time' | 'recurring'>('one-time');
  const [frequency, setFrequency] = useState<
    'monthly' | 'weekly' | 'daily' | 'one_time'
  >('one_time');
  const [category, setCategory] = useState('');
  const [expectedDate, setExpectedDate] = useState<Date | null>(new Date());
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(null);
  const [isReceived, setIsReceived] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: IncomeSource = {
        userId,
        title,
        amount: Number(amount),
        type,
        frequency,
        category,
        isReceived,
        notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (type === 'one-time') {
        payload.expectedDate = expectedDate || new Date();
      } else if (type === 'recurring') {
        if (frequency === 'weekly') {
          payload.dayOfWeek = dayOfWeek ?? 0;
        }
        if (frequency === 'monthly') {
          payload.dayOfMonth = dayOfMonth ?? 1;
        }
      }

      const id = await saveIncomeSource(payload);
      onAdded({ ...payload, id });
      onClose();

      // Reset form
      setTitle('');
      setAmount('');
      setCategory('');
      setType('one-time');
      setFrequency('one_time');
      setExpectedDate(new Date());
      setDayOfWeek(null);
      setDayOfMonth(null);
      setIsReceived(false);
      setNotes('');
      setNotesOpen(false);
    } catch (err) {
      console.error('Error saving income:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Add Income</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Title"
          margin="dense"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextField
          fullWidth
          label="Amount"
          type="number"
          margin="dense"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />

        <Stack direction="row" spacing={2}>
          <FormControl fullWidth margin="dense">
            <InputLabel>Type</InputLabel>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <MenuItem value="one-time">One-time</MenuItem>
              <MenuItem value="recurring">Recurring</MenuItem>
            </Select>
          </FormControl>

          {type === 'recurring' && (
            <FormControl fullWidth margin="dense">
              <InputLabel>Frequency</InputLabel>
              <Select
                value={frequency}
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
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2">Due Date</Typography>
            <DatePicker
              selected={expectedDate}
              onChange={(date: Date | null) => setExpectedDate(date)}
              dateFormat="yyyy-MM-dd"
              className="custom-datepicker"
              placeholderText="Select due date"
            />
          </Box>
        )}

        {type === 'recurring' && frequency === 'weekly' && (
          <FormControl fullWidth margin="dense">
            <InputLabel>Day of Week</InputLabel>
            <Select
              value={dayOfWeek ?? ''}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
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
          <FormControl fullWidth margin="dense">
            <InputLabel>Day of Month</InputLabel>
            <Select
              value={dayOfMonth ?? ''}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                <MenuItem key={day} value={day}>
                  {day}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl fullWidth margin="dense">
          <InputLabel>Category</InputLabel>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {INCOME_CATEGORIES.map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ mt: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ cursor: 'pointer' }}
            onClick={() => setNotesOpen(!notesOpen)}
          >
            <Typography>Notes</Typography>
            <IconButton size="small">
              <ExpandMoreIcon
                sx={{
                  transform: notesOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </IconButton>
          </Stack>
          <Collapse in={notesOpen}>
            <TextField
              fullWidth
              multiline
              rows={3}
              margin="dense"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Collapse>
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              checked={isReceived}
              onChange={(e) => setIsReceived(e.target.checked)}
            />
          }
          label="Mark as received now"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={saving || !title || !amount}
          onClick={handleSave}
        >
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
