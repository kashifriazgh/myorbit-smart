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
  LinearProgress,
  Modal,
  IconButton,
  Tooltip,
} from '@mui/material';
import { ExpandLess, ExpandMore, Event } from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Expenditure, TransactionSource } from '@/app/lib/interface';
import ExpenditureChart from './ChartViewByCategories';
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

  const groupedByType: Record<'one-time' | 'recurring', Expenditure[]> = {
    'one-time': [],
    recurring: [],
  };
  expenditures.forEach((e) => groupedByType[e.type].push(e));

  const isDark = theme?.mode === 'dark';
  const categoryWiseData = useMemo(() => {
    const result: Record<string, number> = {};
    expenditures.forEach((exp) => {
      const cat = exp.category || 'Uncategorized';
      result[cat] = (result[cat] || 0) + exp.amount;
    });
    return Object.entries(result).map(([name, value]) => ({ name, value }));
  }, [expenditures]);

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
        maxWidth: 600,
        mx: 'auto',
        my: 4,
        p: 4,
        boxShadow: 6,
        borderRadius: 3,
        bgcolor: isDark ? '#1e293b' : '#fff',
      }}
    >
      <Typography variant="h5" fontWeight="bold" mb={2}>
        Expenditures
      </Typography>

      <ExpenditureChart data={categoryWiseData} />

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
            {groupedByType[group].map((exp) => (
              <Box
                key={exp.id}
                sx={{
                  my: 2,
                  p: 2,
                  borderLeft: `4px solid ${isDark ? '#4ade80' : '#22c55e'}`,
                  borderRadius: 2,
                  backgroundColor: isDark ? '#1e293b' : '#f9fafb',
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={1}
                >
                  <Typography fontWeight="bold">{exp.title}</Typography>
                  <Box sx={{ minWidth: 100 }}>
                    <TextField
                      type="text"
                      variant="standard"
                      value={
                        editingAmounts[exp.id!] !== undefined
                          ? editingAmounts[exp.id!].toString()
                          : exp.amount.toString()
                      }
                      size="small"
                      placeholder="0"
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow empty string, numbers, and decimal point
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          const newAmount =
                            value === '' ? 0 : parseFloat(value) || 0;
                          setEditingAmounts((prev) => ({
                            ...prev,
                            [exp.id!]: newAmount,
                          }));
                        }
                      }}
                      onBlur={() => {
                        if (exp.id) {
                          const finalAmount =
                            editingAmounts[exp.id] !== undefined
                              ? editingAmounts[exp.id]
                              : exp.amount;
                          setAmountUpdatingId(exp.id);
                          updateExpenditureAmount(exp.id, finalAmount).finally(
                            () => {
                              setAmountUpdatingId(null);
                              setEditingAmounts((prev) => {
                                const newState = { ...prev };
                                delete newState[exp.id!];
                                return newState;
                              });
                            }
                          );
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
                          color: '#16a34a',
                          fontSize: '14px',
                        },
                      }}
                      sx={{
                        '& .MuiInput-underline:before': {
                          borderBottomColor: 'rgba(22, 163, 74, 0.3)',
                        },
                        '& .MuiInput-underline:hover:before': {
                          borderBottomColor: 'rgba(22, 163, 74, 0.5)',
                        },
                        '& .MuiInput-underline:after': {
                          borderBottomColor: '#16a34a',
                        },
                      }}
                    />
                    {amountUpdatingId === exp.id && (
                      <LinearProgress sx={{ mt: 0.5 }} />
                    )}
                  </Box>
                </Stack>
                <Typography variant="body2" mt={0.5}>
                  {exp.category && `Category: ${exp.category}`} ·{' '}
                  {exp.frequency}
                </Typography>
                {exp.dueDate && (
                  <Typography variant="body2" color="error" fontWeight="bold">
                    Due Date:{' '}
                    {exp.dueDate instanceof Date
                      ? exp.dueDate.toLocaleDateString()
                      : ''}
                  </Typography>
                )}
                <Typography variant="body2" mt={0.5}>
                  {exp.isPaid ? '✅ Paid' : '❌ Not Paid'}
                </Typography>

                {/* Payment Count */}
                {exp.paymentHistory && exp.paymentHistory.length > 0 && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    💰 {exp.paymentHistory.length} payment
                    {exp.paymentHistory.length > 1 ? 's' : ''} made
                  </Typography>
                )}
                {exp.notes && (
                  <>
                    <Button
                      size="small"
                      onClick={() => setNotesOpen(!notesOpen)}
                      startIcon={notesOpen ? <ExpandLess /> : <ExpandMore />}
                    >
                      Notes
                    </Button>
                    <Collapse in={notesOpen}>
                      <Typography variant="body2" mt={1} color="text.secondary">
                        📝 {exp.notes}
                      </Typography>
                    </Collapse>
                  </>
                )}
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={() => exp.id && setDeleteId(exp.id)}
                  >
                    Delete
                  </Button>
                  {!exp.isPaid && (
                    <Button
                      variant="outlined"
                      size="small"
                      color="primary"
                      onClick={() => openMarkPaidDialog(exp)}
                      disabled={actionLoading}
                    >
                      {updatingPaidId === exp.id ? (
                        <CircularProgress size={18} />
                      ) : (
                        'Mark as Paid'
                      )}
                    </Button>
                  )}
                  <Tooltip title="Reschedule">
                    <IconButton
                      size="small"
                      onClick={() => handleReschedule(exp)}
                      sx={{
                        color: '#f59e0b',
                        border: '1px solid #f59e0b',
                        borderRadius: 1,
                      }}
                    >
                      <Event fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            ))}
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
        onAdded={() => {}} // Context will handle the update automatically
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
