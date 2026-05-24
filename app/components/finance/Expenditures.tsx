'use client';

import {
  Box,
  Button,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  CircularProgress,
  Stack,
  Collapse,
  Modal,
  IconButton,
  Tooltip,
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Event from '@mui/icons-material/Event';
import Receipt from '@mui/icons-material/Receipt';
import ShoppingCart from '@mui/icons-material/ShoppingCart';
import DirectionsCar from '@mui/icons-material/DirectionsCar';
import Restaurant from '@mui/icons-material/Restaurant';
import LocalHospital from '@mui/icons-material/LocalHospital';
import HomeWork from '@mui/icons-material/HomeWork';
import Bolt from '@mui/icons-material/Bolt';
import Delete from '@mui/icons-material/Delete';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Info from '@mui/icons-material/Info';
import TrendingUp from '@mui/icons-material/TrendingUp';
import {
  Card,
  CardContent,
  Avatar,
  Chip,
  Divider,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Expenditure, TransactionSource } from '@/app/lib/interface';

// Note: user filtering is handled by ExpendituresProvider context using userId prop
import AddExpenditureDialog from './utilsCompos/addExpenditureModal';
import {
  useExpenditures,
  ExpendituresProvider,
} from '@/app/lib/context/ExpendituresContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { TotalCashSnapshot } from '@/app/lib/interface';

function ExpendituresComponent({ userId }: { userId: string }) {
  const { theme } = useCustomTheme();
  // Data filtering by user is handled in ExpendituresProvider context
  const {
    expenditures,
    banks,
    loading,
    markAsPaid,
    rescheduleExpenditure,
    updateExpenditureAmount,
    deleteExpenditure,
    addNewBank,
  } = useExpenditures();

  // form + modal state
  const [openModal, setOpenModal] = useState(false);

  // deletion + updates
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingPaidId, setUpdatingPaidId] = useState<string | null>(null);

  // --- Mark-as-Paid confirmation + main fund deduction ---
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedExpenditure, setSelectedExpenditure] =
    useState<Expenditure | null>(null);

  const SOURCE_OPTIONS: TransactionSource[] = [
    'bank',
    'in_hand',
    'easypaisa',
    'jazzcash',
    'other',
  ];
  const [deductionSource, setDeductionSource] =
    useState<TransactionSource>('in_hand');

  // bank-specific state
  const [selectedBank, setSelectedBank] = useState('');
  const [newBankName, setNewBankName] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [availableFunds, setAvailableFunds] = useState(0);
  const [insufficientFunds, setInsufficientFunds] = useState(false);

  const [notesOpen, setNotesOpen] = useState(false);
  const [amountUpdatingId, setAmountUpdatingId] = useState<string | null>(null);
  const [editingAmounts, setEditingAmounts] = useState<Record<string, number>>(
    {}
  );

  // reschedule state
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleItem, setRescheduleItem] = useState<Expenditure | null>(
    null
  );
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [reschedulingLoading, setReschedulingLoading] = useState(false);

  // ---- helpers ----
  const totalAmount = useMemo(
    () => expenditures.reduce((sum, e) => sum + e.amount, 0),
    [expenditures]
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

  const groupedByType: Record<'one-time' | 'recurring', Expenditure[]> = {
    'one-time': [],
    recurring: [],
  };
  expenditures.forEach((e) => groupedByType[e.type].push(e));

  const isDark = theme?.mode === 'dark';


  // ---- Available funds refresh ----
  const refreshAvailableFunds = async (
    source: TransactionSource,
    bankId?: string
  ) => {
    try {
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const snap = await getDoc(docRef);
      let available = 0;

      if (snap.exists()) {
        const data = snap.data() as TotalCashSnapshot;

        if (source === 'bank') {
          const bankName = banks.find((b) => b.id === bankId)?.name;
          if (bankName) {
            const bankMap = data.sources?.bank || {};
            available = bankMap[bankName] || 0;
          } else {
            available = 0;
          }
        } else {
          available = (data.sources?.[source] as number) || 0;
        }
      } else {
        available = 0;
      }

      setAvailableFunds(available);
      setInsufficientFunds(
        !!selectedExpenditure && available < selectedExpenditure.amount
      );
    } catch (e) {
      console.error('Error fetching available funds:', e);
      setAvailableFunds(0);
      setInsufficientFunds(true);
    }
  };

  // Refresh available funds whenever dialog opens / selection changes
  useEffect(() => {
    if (!confirmDialogOpen) return;
    if (deductionSource === 'bank') {
      refreshAvailableFunds('bank', selectedBank);
    } else {
      refreshAvailableFunds(deductionSource);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmDialogOpen, deductionSource, selectedBank]);

  // ---- Bank add ----
  const handleAddBank = async () => {
    if (!newBankName.trim()) return;
    try {
      const newBank = await addNewBank(newBankName.trim());
      setSelectedBank(newBank.id);
      setNewBankName('');
    } catch (e) {
      console.error('Error adding bank:', e);
    }
  };

  // ---- Mark as paid handlers ----
  const openMarkPaidDialog = async (exp: Expenditure) => {
    setSelectedExpenditure(exp);
    setDeductionSource('in_hand');
    setSelectedBank('');
    setConfirmDialogOpen(true);
  };

  const markExpensePaid = async (exp: Expenditure, deductFromFund: boolean) => {
    try {
      setUpdatingPaidId(exp.id!);
      await markAsPaid(exp, deductFromFund, deductionSource, selectedBank);
    } catch (e) {
      console.error('Error marking expense paid:', e);
    } finally {
      setUpdatingPaidId(null);
    }
  };

  const handleConfirmYes = async () => {
    if (!selectedExpenditure) return;
    setActionLoading(true);
    await markExpensePaid(selectedExpenditure, true);
    setActionLoading(false);
    setConfirmDialogOpen(false);
    setSelectedExpenditure(null);
  };

  const handleConfirmNo = async () => {
    if (!selectedExpenditure) return;
    setActionLoading(true);
    await markExpensePaid(selectedExpenditure, false);
    setActionLoading(false);
    setConfirmDialogOpen(false);
    setSelectedExpenditure(null);
  };

  // ---- Reschedule handlers ----
  const handleReschedule = (item: Expenditure) => {
    setRescheduleItem(item);
    const dueDate =
      item.dueDate instanceof Timestamp ? item.dueDate.toDate() : item.dueDate;
    setNewDueDate(dueDate || new Date());
    setRescheduleOpen(true);
  };

  const updateDueDate = async () => {
    if (!rescheduleItem || !newDueDate) return;
    setReschedulingLoading(true);
    try {
      await rescheduleExpenditure(rescheduleItem.id!, newDueDate);
      setRescheduleOpen(false);
      setRescheduleItem(null);
    } catch (err) {
      console.error('❌ Failed to reschedule expense:', err);
    } finally {
      setReschedulingLoading(false);
    }
  };

  // ---- Render ----
  if (!theme || loading) {
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 700,
        mx: 'auto',
        my: 4,
        p: { xs: 2, sm: 4 },
        borderRadius: 4,
        bgcolor: 'transparent',
      }}
    >
      <Typography variant="h5" fontWeight="bold" mb={2}>
        Expenditures
      </Typography>



      <Button
        variant="contained"
        onClick={() => setOpenModal(true)}
        sx={{ mt: 2 }}
      >
        + Add Expense
      </Button>

      <Typography variant="body2" color="text.secondary" mt={2} mb={2}>
        Total ({expenditures.length}) – Rs {totalAmount.toLocaleString()}
      </Typography>

      {/* --- LIST EXPENSES --- */}
      {(['one-time', 'recurring'] as const).map((group) =>
        groupedByType[group].length > 0 ? (
          <Box key={group} mb={3}>
            <Typography variant="h6" mb={1}>
              {group === 'one-time'
                ? 'One-Time Expenses'
                : 'Recurring Expenses'}
            </Typography>
            {groupedByType[group].map((exp) => {
              const daysDiff = exp.dueDate ? getDaysDifference(exp.dueDate instanceof Date ? exp.dueDate : exp.dueDate.toDate()) : null;

              const getCategoryIcon = (category?: string) => {
                const cat = category?.toLowerCase() || '';
                if (cat.includes('food') || cat.includes('restaurant')) return <Restaurant />;
                if (cat.includes('transport') || cat.includes('car') || cat.includes('travel')) return <DirectionsCar />;
                if (cat.includes('rent') || cat.includes('home')) return <HomeWork />;
                if (cat.includes('bill') || cat.includes('utility') || cat.includes('electricity')) return <Bolt />;
                if (cat.includes('health') || cat.includes('medical')) return <LocalHospital />;
                if (cat.includes('shop') || cat.includes('grocery')) return <ShoppingCart />;
                return <Receipt />;
              };

              const getCategoryColor = (category?: string) => {
                const cat = category?.toLowerCase() || '';
                if (cat.includes('food')) return '#f97316';
                if (cat.includes('transport')) return '#3b82f6';
                if (cat.includes('rent')) return '#8b5cf6';
                if (cat.includes('bill')) return '#eab308';
                if (cat.includes('health')) return '#ef4444';
                if (cat.includes('shop')) return '#ec4899';
                return '#64748b';
              };

              return (
                <Card
                  key={exp.id}
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
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.2)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 0 }}>
                    <Box sx={{ p: 2.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar
                            sx={{
                              bgcolor: `${getCategoryColor(exp.category)}15`,
                              color: getCategoryColor(exp.category),
                              width: 48,
                              height: 48,
                              borderRadius: 2
                            }}
                          >
                            {getCategoryIcon(exp.category)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="800" sx={{ lineHeight: 1.2 }}>
                              {exp.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <Chip
                                label={exp.category || 'Other'}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  bgcolor: `${getCategoryColor(exp.category)}10`,
                                  color: getCategoryColor(exp.category),
                                  border: `1px solid ${getCategoryColor(exp.category)}30`
                                }}
                              />
                              • {exp.frequency}
                            </Typography>
                          </Box>
                        </Stack>

                        <Box sx={{ textAlign: 'right' }}>
                          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            {amountUpdatingId === exp.id && (
                              <CircularProgress size={16} sx={{ mr: 1 }} />
                            )}
                            <TextField
                              type="text"
                              variant="standard"
                              value={
                                editingAmounts[exp.id!] !== undefined
                                  ? editingAmounts[exp.id!].toString()
                                  : exp.amount.toString()
                              }
                              size="small"
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                  const newAmount = value === '' ? 0 : parseFloat(value) || 0;
                                  setEditingAmounts((prev) => ({ ...prev, [exp.id!]: newAmount }));
                                }
                              }}
                              onBlur={() => {
                                if (exp.id) {
                                  const finalAmount = editingAmounts[exp.id] !== undefined ? editingAmounts[exp.id] : exp.amount;
                                  setAmountUpdatingId(exp.id);
                                  updateExpenditureAmount(exp.id, finalAmount).finally(() => {
                                    setAmountUpdatingId(null);
                                    setEditingAmounts((prev) => {
                                      const newState = { ...prev };
                                      delete newState[exp.id!];
                                      return newState;
                                    });
                                  });
                                }
                              }}
                              onFocus={(e) => e.target.select()}
                              InputProps={{
                                disableUnderline: true,
                                style: {
                                  textAlign: 'right',
                                  fontWeight: '900',
                                  color: isDark ? '#f87171' : '#ef4444',
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
                        {exp.dueDate && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 1.5,
                              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fef2f2',
                              border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2'}`
                            }}
                          >
                            <Event sx={{ fontSize: 14, color: '#ef4444' }} />
                            <Typography variant="caption" fontWeight="700" color="#ef4444">
                              {exp.dueDate instanceof Date
                                ? exp.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                : exp.dueDate?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || 'N/A'}
                            </Typography>
                          </Box>
                        )}

                        {exp.isPaid ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <CheckCircle sx={{ fontSize: 14, color: '#10b981' }} />
                            <Typography variant="caption" fontWeight="700" sx={{ color: '#10b981' }}>Paid</Typography>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderRadius: 1.5, bgcolor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <Info sx={{ fontSize: 14, color: '#ef4444' }} />
                            <Typography variant="caption" fontWeight="700" sx={{ color: '#ef4444' }}>Unpaid</Typography>
                          </Box>
                        )}

                        {daysDiff !== null && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 1.5,
                              bgcolor: daysDiff <= 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                              border: `1px solid ${daysDiff <= 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`
                            }}
                          >
                            <TrendingUp sx={{ fontSize: 14, color: daysDiff <= 0 ? '#ef4444' : '#3b82f6' }} />
                            <Typography variant="caption" fontWeight="700" sx={{ color: daysDiff <= 0 ? '#ef4444' : '#3b82f6' }}>
                              {daysDiff === 0 ? 'Due Today' : daysDiff < 0 ? `Overdue ${Math.abs(daysDiff)}d` : `In ${daysDiff}d`}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      {exp.notes && (
                        <Box sx={{ mt: 2 }}>
                          <Button
                            size="small"
                            onClick={() => setNotesOpen(!notesOpen)}
                            startIcon={notesOpen ? <ExpandLess /> : <ExpandMore />}
                            sx={{ fontSize: '10px', p: 0, minWidth: 'auto', color: 'text.secondary' }}
                          >
                            Notes
                          </Button>
                          <Collapse in={notesOpen}>
                            <Typography
                              variant="body2"
                              sx={{
                                mt: 1,
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                                color: 'text.secondary',
                                fontSize: '0.75rem',
                                fontStyle: 'italic',
                                borderLeft: '3px solid #cbd5e1'
                              }}
                            >
                              &quot;{exp.notes}&quot;
                            </Typography>
                          </Collapse>
                        </Box>
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
                      {!exp.isPaid && (
                        <>
                          <Tooltip title="Mark as Paid">
                            <IconButton
                              size="small"
                              onClick={() => openMarkPaidDialog(exp)}
                              disabled={actionLoading}
                              sx={{ color: '#10b981', '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' } }}
                            >
                              {updatingPaidId === exp.id ? <CircularProgress size={20} /> : <CheckCircle fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reschedule">
                            <IconButton
                              size="small"
                              onClick={() => handleReschedule(exp)}
                              disabled={reschedulingLoading}
                              sx={{ color: '#f59e0b', '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.1)' } }}
                            >
                              <Event fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => exp.id && setDeleteId(exp.id)}
                          disabled={deleting}
                          sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        ) : null
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this item?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button
            onClick={async () => {
              if (!deleteId) return;
              setDeleting(true);
              try {
                await deleteExpenditure(deleteId);
                setDeleteId(null);
              } catch (error) {
                console.error('Error deleting expenditure:', error);
              } finally {
                setDeleting(false);
              }
            }}
            color="error"
            disabled={deleting}
            variant="contained"
          >
            {deleting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark as Paid: Deduct from main fund? */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Deduct from main fund?</DialogTitle>
        <DialogContent>
          <Typography>
            Do you want to deduct{' '}
            <strong>Rs {selectedExpenditure?.amount}</strong> for{' '}
            <em>{selectedExpenditure?.title}</em> from your main fund?
          </Typography>

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Deduct From</InputLabel>
            <Select
              value={deductionSource}
              label="Deduct From"
              onChange={(e) =>
                setDeductionSource(e.target.value as TransactionSource)
              }
            >
              {SOURCE_OPTIONS.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {deductionSource === 'bank' && (
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Bank</InputLabel>
                <Select
                  value={selectedBank}
                  label="Bank"
                  onChange={(e) => setSelectedBank(e.target.value)}
                >
                  {banks.map((bank) => (
                    <MenuItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="New Bank"
                size="small"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddBank}
                disabled={!newBankName.trim()}
              >
                Add Bank
              </Button>
            </Stack>
          )}

          <Typography mt={1} fontSize={14}>
            Available in <strong>{deductionSource}</strong>
            {deductionSource === 'bank' &&
              selectedBank &&
              ` (${banks.find((b) => b.id === selectedBank)?.name})`}
            : Rs {availableFunds.toLocaleString()}
          </Typography>

          {insufficientFunds && (
            <Typography mt={1} color="error" fontWeight="bold" fontSize={13}>
              ⚠️ Not enough balance in the selected source. You can still mark
              as paid without deduction (press “No”).
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialogOpen(false)}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirmNo} disabled={actionLoading}>
            No
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmYes}
            disabled={
              actionLoading || (deductionSource === 'bank' && !selectedBank)
            }
          >
            {actionLoading ? <CircularProgress size={18} /> : 'Yes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Expenditure Modal */}
      <AddExpenditureDialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        onAdded={() => { }} // Context will handle the update automatically
      />

      {/* Reschedule Modal */}
      <Modal open={rescheduleOpen} onClose={() => setRescheduleOpen(false)}>
        <Box
          sx={{
            p: 3,
            backgroundColor: isDark ? '#1e293b' : '#fff',
            borderRadius: 2,
            width: 300,
            mx: 'auto',
            mt: '15%',
            boxShadow: 5,
          }}
        >
          <Typography fontWeight={600} mb={2}>
            Reschedule Payment
          </Typography>

          <DatePicker
            selected={newDueDate}
            onChange={(date: Date | null) => setNewDueDate(date)}
            minDate={new Date()}
            dateFormat="yyyy-MM-dd"
            customInput={
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                label="New Due Date"
              />
            }
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
            <Button onClick={() => setRescheduleOpen(false)}>Cancel</Button>
            <Button
              onClick={updateDueDate}
              variant="contained"
              disabled={!newDueDate || reschedulingLoading}
            >
              {reschedulingLoading ? (
                <CircularProgress size={20} sx={{ color: 'white' }} />
              ) : (
                'Save'
              )}
            </Button>
          </Stack>
        </Box>
      </Modal>
    </Box>
  );
}

export default function ExpendituresComponentWithProvider({
  userId,
}: {
  userId: string;
}) {
  return (
    <ExpendituresProvider userId={userId}>
      <ExpendituresComponent userId={userId} />
    </ExpendituresProvider>
  );
}
