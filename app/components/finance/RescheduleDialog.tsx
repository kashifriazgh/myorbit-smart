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
  Box,
} from '@mui/material';
import { IncomeSource } from '@/app/lib/interface';
import { Timestamp } from 'firebase/firestore';
import { useCustomTheme } from '@/app/lib/context/themeContext';
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
  const { theme } = useCustomTheme();
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          margin: 0,
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        },
      }}
    >
      <DialogTitle
        sx={{
          color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        }}
      >
        Reschedule Income
      </DialogTitle>
      <DialogContent>
        <Typography
          mb={2}
          sx={{
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
          }}
        >
          Reschedule <strong>{income.title}</strong> to a new date:
        </Typography>

        <Box
          sx={{
            '& .react-datepicker-wrapper': { width: '100%' },
            '& .react-datepicker__input-container input': {
              width: '100%',
              padding: '12px',
              border:
                theme?.mode === 'dark'
                  ? '2px solid #475569'
                  : '2px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
              '&:focus': {
                borderColor: theme?.mode === 'dark' ? '#64748b' : '#3b82f6',
                outline: 'none',
              },
              '&::placeholder': {
                color: theme?.mode === 'dark' ? '#94a3b8' : '#666666',
              },
            },
          }}
        >
          <DatePicker
            selected={newDate}
            onChange={(date: Date | null) => setNewDate(date)}
            minDate={new Date()}
            dateFormat="yyyy-MM-dd"
            withPortal
            popperContainer={({ children }) => (
              <div style={{ zIndex: 9999, position: 'relative' }}>
                {children}
              </div>
            )}
            customInput={
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                label="New Expected Date"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor:
                      theme?.mode === 'dark' ? '#334155' : '#ffffff',
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                    '& fieldset': {
                      borderColor:
                        theme?.mode === 'dark' ? '#475569' : '#d1d5db',
                    },
                    '&:hover fieldset': {
                      borderColor:
                        theme?.mode === 'dark' ? '#64748b' : '#9ca3af',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor:
                        theme?.mode === 'dark' ? '#64748b' : '#3b82f6',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                    '&.Mui-focused': {
                      color: theme?.mode === 'dark' ? '#cbd5e1' : '#3b82f6',
                    },
                  },
                }}
              />
            }
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{
            color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#475569' : '#f3f4f6',
            },
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!newDate || loading}
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#3b82f6' : '#1976d2',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#2563eb' : '#1565c0',
            },
            '&:disabled': {
              backgroundColor: theme?.mode === 'dark' ? '#475569' : '#e5e7eb',
              color: theme?.mode === 'dark' ? '#94a3b8' : '#9ca3af',
            },
          }}
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
