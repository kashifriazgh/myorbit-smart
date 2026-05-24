'use client';
import React, { useState } from 'react';
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
import AddIncomeModal from './utilsCompos/addIncomeModal';
import { useIncomeSources } from '@/app/lib/context/IncomeSourcesContext';
import MarkAsReceivedDialog from './MarkAsReceivedDialog';
import RescheduleDialog from './RescheduleDialog';
import DeleteConfirmModal from '../global/DeleteConfirmModal';
import DeleteIcon from '@mui/icons-material/Delete';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReceiptIcon from '@mui/icons-material/Receipt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BusinessIcon from '@mui/icons-material/Business';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import PaymentsIcon from '@mui/icons-material/Payments';
import InfoIcon from '@mui/icons-material/Info';
import {
  Card,
  CardContent,
  IconButton,
  Avatar,
  Chip,
  Tooltip,
  Divider,
} from '@mui/material';

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<IncomeSource | null>(
    null
  );
  const [actionLoading, setActionLoading] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  // Helper function to calculate days between dates
  const getDaysDifference = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0); // Reset time to start of day

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };



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
    bankId?: string,
    customPaymentHeadId?: string
  ) => {
    if (!selectedIncome) return;
    setActionLoading(true);
    try {
      await markAsReceived(
        selectedIncome,
        updateMainFund,
        fundSource,
        bankId,
        customPaymentHeadId
      );
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

  const onClickDelete = (src: IncomeSource) => {
    setSelectedIncome(src);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedIncome?.id) return;
    setDeleteLoading(true);
    try {
      await deleteIncomeSource(selectedIncome.id);
      setDeleteDialogOpen(false);
      setSelectedIncome(null);
    } catch (err) {
      console.error('Error deleting income:', err);
    } finally {
      setDeleteLoading(false);
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
        maxWidth: 700,
        mx: 'auto',
        my: 4,
        p: { xs: 2, sm: 4 },
        borderRadius: 4,
        bgcolor: 'transparent', // Let the parent container handle background
      }}
    >


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

      {displayedSources.map((src) => {
        const isDark = theme.mode === 'dark';
        const daysDiff = src.effectiveFromDate ? getDaysDifference(src.effectiveFromDate instanceof Date ? src.effectiveFromDate : src.effectiveFromDate.toDate()) : null;

        // Category icons mapping
        const getCategoryIcon = (category?: string) => {
          const cat = category?.toLowerCase() || '';
          if (cat.includes('salary') || cat.includes('job')) return <BusinessIcon />;
          if (cat.includes('rent')) return <HomeWorkIcon />;
          if (cat.includes('investment') || cat.includes('stock')) return <TrendingUpIcon />;
          if (cat.includes('freelance') || cat.includes('side')) return <PaymentsIcon />;
          return <ReceiptIcon />;
        };

        const getCategoryColor = (category?: string) => {
          const cat = category?.toLowerCase() || '';
          if (cat.includes('salary')) return '#3b82f6';
          if (cat.includes('rent')) return '#10b981';
          if (cat.includes('investment')) return '#8b5cf6';
          if (cat.includes('freelance')) return '#f59e0b';
          return '#64748b';
        };

        return (
          <Card
            key={src.id}
            elevation={isDark ? 0 : 2}
            sx={{
              my: 2.5,
              borderRadius: 3,
              overflow: 'hidden',
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: isDark ? '0 20px 25px -5px rgba(0, 0, 0, 0.5)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                borderColor: isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.2)',
              },
            }}
          >
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      sx={{
                        bgcolor: `${getCategoryColor(src.category)}15`,
                        color: getCategoryColor(src.category),
                        width: 48,
                        height: 48,
                        borderRadius: 2
                      }}
                    >
                      {getCategoryIcon(src.category)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="800" sx={{ lineHeight: 1.2 }}>
                        {src.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <Chip
                          label={src.category || 'Other'}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '10px',
                            fontWeight: 700,
                            bgcolor: `${getCategoryColor(src.category)}10`,
                            color: getCategoryColor(src.category),
                            border: `1px solid ${getCategoryColor(src.category)}30`
                          }}
                        />
                        • {src.frequency}
                      </Typography>
                    </Box>
                  </Stack>

                  <Box sx={{ textAlign: 'right' }}>
                    <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {updatingAmountId === src.id && (
                        <CircularProgress size={16} sx={{ mr: 1 }} />
                      )}
                      <TextField
                        type="text"
                        variant="standard"
                        value={
                          editingAmounts[src.id!] !== undefined
                            ? editingAmounts[src.id!].toString()
                            : src.amount.toString()
                        }
                        size="small"
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            const newAmount = value === '' ? 0 : parseFloat(value) || 0;
                            setEditingAmounts((prev) => ({ ...prev, [src.id!]: newAmount }));
                          }
                        }}
                        onBlur={async () => {
                          if (!src.id) return;
                          const finalAmount = editingAmounts[src.id] !== undefined ? editingAmounts[src.id] : src.amount;
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
                        onFocus={(e) => e.target.select()}
                        InputProps={{
                          disableUnderline: true,
                          style: {
                            textAlign: 'right',
                            fontWeight: '900',
                            color: isDark ? '#60a5fa' : '#2563eb',
                            fontSize: '1.25rem',
                            padding: 0,
                          }
                        }}
                        sx={{
                          '& input': { textAlign: 'right', p: 0 }
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      PKR
                    </Typography>
                  </Box>
                </Stack>

                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {src.expectedDate && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1.5,
                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`
                      }}
                    >
                      <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" fontWeight="600" color="text.secondary">
                        {src.expectedDate instanceof Date
                          ? src.expectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : src.expectedDate?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || 'N/A'}
                      </Typography>
                    </Box>
                  )}

                  {src.isReceived ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <CheckCircleIcon sx={{ fontSize: 14, color: '#10b981' }} />
                      <Typography variant="caption" fontWeight="700" sx={{ color: '#10b981' }}>Received</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                      <InfoIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                      <Typography variant="caption" fontWeight="700" sx={{ color: '#f59e0b' }}>Pending</Typography>
                    </Box>
                  )}

                  {daysDiff !== null && daysDiff > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <TrendingUpIcon sx={{ fontSize: 14, color: '#3b82f6' }} />
                      <Typography variant="caption" fontWeight="700" sx={{ color: '#3b82f6' }}>In {daysDiff}d</Typography>
                    </Box>
                  )}
                </Box>

                {src.notes && (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 2,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      fontStyle: 'italic',
                      borderLeft: '3px solid #cbd5e1'
                    }}
                  >
                    &quot;{src.notes}&quot;
                  </Typography>
                )}
              </Box>

              <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />

              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  p: 1,
                  bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fafafa',
                  justifyContent: 'flex-end'
                }}
              >
                {!src.isReceived && (
                  <>
                    <Tooltip title="Mark as Received">
                      <IconButton
                        size="small"
                        onClick={() => onClickMark(src)}
                        disabled={actionLoading}
                        sx={{ color: '#10b981', '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' } }}
                      >
                        {actionLoading && selectedIncome?.id === src.id ? <CircularProgress size={20} /> : <CheckCircleIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reschedule">
                      <IconButton
                        size="small"
                        onClick={() => onClickReschedule(src)}
                        disabled={rescheduleLoading}
                        sx={{ color: '#6366f1', '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.1)' } }}
                      >
                        {rescheduleLoading && selectedIncome?.id === src.id ? <CircularProgress size={20} /> : <CalendarTodayIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </>
                )}
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={() => onClickDelete(src)}
                    disabled={deleteLoading}
                    sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                  >
                    {deleteLoading && selectedIncome?.id === src.id ? <CircularProgress size={20} /> : <DeleteIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Stack>
            </CardContent>
          </Card>
        );
      })}

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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        itemLabel="income source"
      />

      {/* Add Income Modal */}
      <AddIncomeModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        userId={userId}
        onAdded={() => { }} // Context will handle the update automatically
      />
    </Box>
  );
}
