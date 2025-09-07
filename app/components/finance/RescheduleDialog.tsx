'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  CircularProgress,
} from '@mui/material';
import { IncomeSource } from '@/app/lib/interface';
import { Timestamp } from 'firebase/firestore';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface RescheduleDialogProps {
  open: boolean;
  onClose: () => void;
  income: IncomeSource | null;
  onConfirm: (newDate: Date) => Promise<void>;
  loading?: boolean;
}

export default function RescheduleDialog({
  open,
  onClose,
  income,
  onConfirm,
  loading = false,
}: RescheduleDialogProps) {
  const [newDate, setNewDate] = useState<Date | null>(null);

  useEffect(() => {
    if (open && income) {
      let date: Date;

      try {
        if (income.expectedDate instanceof Date) {
          date = income.expectedDate;
        } else if (income.expectedDate instanceof Timestamp) {
          date = income.expectedDate.toDate();
        } else if (income.expectedDate) {
          // Handle other date formats
          const parsedDate = new Date(income.expectedDate);
          date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
        } else {
          date = new Date();
        }
      } catch (error) {
        console.error(
          'Error parsing expectedDate:',
          error,
          income.expectedDate
        );
        date = new Date();
      }

      setNewDate(date);
    }
  }, [open, income]);

  const handleConfirm = async () => {
    if (newDate) {
      await onConfirm(newDate);
    }
  };

  if (!income || !income.id) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reschedule Income</DialogTitle>
      <DialogContent>
        <Typography mb={2}>
          Reschedule <strong>{income.title}</strong> to a new date:
        </Typography>

        <DatePicker
          selected={newDate}
          onChange={(date: Date | null) => setNewDate(date)}
          minDate={new Date()}
          dateFormat="yyyy-MM-dd"
          withPortal
          popperContainer={({ children }) => (
            <div style={{ zIndex: 9999, position: 'relative' }}>{children}</div>
          )}
          customInput={
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              label="New Expected Date"
            />
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!newDate || loading}
        >
          {loading ? (
            <CircularProgress size={20} sx={{ color: 'white' }} />
          ) : (
            'Save'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
