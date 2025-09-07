'use client';
import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  CircularProgress,
  Stack,
} from '@mui/material';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { IncomeSource, TransactionSource } from '@/app/lib/interface';
import ChartViewByCategory from './ChartViewByCategories';
import AddIncomeModal from './utilsCompos/addIncomeModal';
import { useIncomeSources } from '@/app/lib/context/IncomeSourcesContext';
import MarkAsReceivedDialog from './MarkAsReceivedDialog';
import RescheduleDialog from './RescheduleDialog';

export default function IncomeSourceComponent({ userId }: { userId: string }) {
  const { theme } = useCustomTheme();
  const {
    incomeSources,
    banks,
    loading,
    markAsReceived,
    rescheduleIncome,
    updateIncomeAmount,
    deleteIncomeSource,
    addNewBank,
  } = useIncomeSources();

  const [openModal, setOpenModal] = useState(false);
  const [updatingAmountId, setUpdatingAmountId] = useState<string | null>(null);
  const [editingAmounts, setEditingAmounts] = useState<Record<string, number>>(
    {}
  );

  // Dialog states
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<IncomeSource | null>(
    null
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Filtered sources for display
  const displayedSources = incomeSources
    .filter((src) =>
      src.type === 'recurring'
        ? true
        : src.type === 'one-time' && !src.isReceived
    )
    .sort((a, b) => {
      const dateA =
        a.expectedDate instanceof Date ? a.expectedDate.getTime() : 0;
      const dateB =
        b.expectedDate instanceof Date ? b.expectedDate.getTime() : 0;
      return dateA - dateB;
    });

  const totalAmount = displayedSources.reduce(
    (sum, src) => sum + src.amount,
    0
  );

  const categoryChartData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    displayedSources.forEach((src) => {
      const cat = src.category || 'Uncategorized';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + src.amount);
    });
    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [displayedSources]);

  const onClickMark = (src: IncomeSource) => {
    setSelectedIncome(src);
    setConfirmDialogOpen(true);
  };

  const onClickReschedule = (src: IncomeSource) => {
    setSelectedIncome(src);
    setRescheduleDialogOpen(true);
  };

  const handleMarkAsReceived = async (
    updateMainFund: boolean,
    fundSource?: TransactionSource,
    bankId?: string
  ) => {
    if (!selectedIncome) return;
    setActionLoading(true);
    try {
      await markAsReceived(selectedIncome, updateMainFund, fundSource, bankId);
      setConfirmDialogOpen(false);
      setSelectedIncome(null);
    } catch (error) {
      console.error('Error marking as received:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async (newDate: Date) => {
    if (!selectedIncome?.id) return;
    setRescheduleLoading(true);
    try {
      await rescheduleIncome(selectedIncome.id, newDate);
      setRescheduleDialogOpen(false);
      setSelectedIncome(null);
    } catch (error) {
      console.error('Error rescheduling:', error);
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handleDelete = async (src: IncomeSource) => {
    try {
      if (src.id) await deleteIncomeSource(src.id);
    } catch (err) {
      console.error('Error deleting income:', err);
    }
  };

  if (!theme || loading)
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );

  return (
    <Box
      sx={{
        maxWidth: 600,
        mx: 'auto',
        my: 4,
        p: 4,
        boxShadow: 6,
        borderRadius: 3,
        bgcolor: theme.mode === 'dark' ? '#1e293b' : '#fff',
      }}
    >
      <ChartViewByCategory data={categoryChartData} />

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h5" fontWeight="bold">
          Income Sources
        </Typography>
        <Button variant="contained" onClick={() => setOpenModal(true)}>
          + Add Income
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Total ({displayedSources.length}) – Rs {totalAmount.toLocaleString()}
      </Typography>

      {displayedSources.map((src) => (
        <Box
          key={src.id}
          sx={{
            my: 2,
            p: 2,
            borderLeft: '4px solid #3b82f6',
            borderRadius: 2,
            backgroundColor: theme.mode === 'dark' ? '#1e293b' : '#f9fafb',
            opacity: 1,
            transition: 'opacity 0.3s ease',
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
          >
            <Typography fontWeight="bold">{src.title}</Typography>
            <Box sx={{ position: 'relative' }}>
              <TextField
                type="text"
                variant="standard"
                value={
                  editingAmounts[src.id!] !== undefined
                    ? editingAmounts[src.id!].toString()
                    : src.amount.toString()
                }
                size="small"
                placeholder="0"
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty string, numbers, and decimal point
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    const newAmount = value === '' ? 0 : parseFloat(value) || 0;
                    setEditingAmounts((prev) => ({
                      ...prev,
                      [src.id!]: newAmount,
                    }));
                  }
                }}
                onBlur={async () => {
                  if (!src.id) return;
                  const finalAmount =
                    editingAmounts[src.id] !== undefined
                      ? editingAmounts[src.id]
                      : src.amount;
                  setUpdatingAmountId(src.id);
                  try {
                    await updateIncomeAmount(src.id, finalAmount);
                    setEditingAmounts((prev) => {
                      const newState = { ...prev };
                      delete newState[src.id!];
                      return newState;
                    });
                  } catch (err) {
                    console.error('Error updating amount:', err);
                  } finally {
                    setUpdatingAmountId(null);
                  }
                }}
                onFocus={(e) => {
                  // Select all text when focused for easy editing
                  e.target.select();
                }}
                inputProps={{
                  style: {
                    maxWidth: 100,
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#2563eb',
                    fontSize: '14px',
                  },
                }}
                sx={{
                  '& .MuiInput-underline:before': {
                    borderBottomColor: 'rgba(59, 130, 246, 0.3)',
                  },
                  '& .MuiInput-underline:hover:before': {
                    borderBottomColor: 'rgba(59, 130, 246, 0.5)',
                  },
                  '& .MuiInput-underline:after': {
                    borderBottomColor: '#3b82f6',
                  },
                }}
              />
              {updatingAmountId === src.id && (
                <CircularProgress
                  size={16}
                  sx={{
                    position: 'absolute',
                    right: -24,
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                />
              )}
            </Box>
          </Stack>
          <Typography variant="body2" mt={0.5}>
            {src.category} · {src.frequency}
          </Typography>
          {src.expectedDate && (
            <Typography variant="body2" color="text.secondary">
              Expected:{' '}
              {src.expectedDate instanceof Date
                ? src.expectedDate.toLocaleDateString()
                : src.expectedDate?.toDate?.()?.toLocaleDateString() ||
                  'Invalid date'}
            </Typography>
          )}
          <Typography variant="body2" mt={0.5}>
            {src.isReceived ? '✅ Received' : '❌ Not Received'}
          </Typography>

          {/* Payment Count */}
          {src.paymentHistory && src.paymentHistory.length > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              💰 {src.paymentHistory.length} payment
              {src.paymentHistory.length > 1 ? 's' : ''} received
            </Typography>
          )}
          {src.notes && (
            <Typography variant="body2" mt={1} color="text.secondary">
              📝 {src.notes}
            </Typography>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              size="small"
              color="error"
              onClick={() => handleDelete(src)}
            >
              Delete
            </Button>

            {!src.isReceived && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  color="primary"
                  onClick={() => onClickMark(src)}
                  disabled={actionLoading}
                >
                  {actionLoading && selectedIncome?.id === src.id ? (
                    <CircularProgress size={18} />
                  ) : (
                    'Mark as Received'
                  )}
                </Button>

                <Button
                  variant="outlined"
                  size="small"
                  color="secondary"
                  onClick={() => onClickReschedule(src)}
                  disabled={rescheduleLoading}
                >
                  {rescheduleLoading && selectedIncome?.id === src.id ? (
                    <CircularProgress size={18} />
                  ) : (
                    'Reschedule'
                  )}
                </Button>
              </>
            )}
          </Stack>
        </Box>
      ))}

      {/* Mark as Received Dialog */}
      <MarkAsReceivedDialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        income={selectedIncome}
        banks={banks}
        onConfirm={handleMarkAsReceived}
        onAddBank={addNewBank}
        loading={actionLoading}
      />

      {/* Reschedule Dialog */}
      <RescheduleDialog
        open={rescheduleDialogOpen}
        onClose={() => setRescheduleDialogOpen(false)}
        income={selectedIncome}
        onConfirm={handleReschedule}
        loading={rescheduleLoading}
      />

      {/* Add Income Modal */}
      <AddIncomeModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        userId={userId}
        onAdded={() => {}} // Context will handle the update automatically
      />
    </Box>
  );
}
