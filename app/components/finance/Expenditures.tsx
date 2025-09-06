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
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  query,
  where,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Expenditure, Bank, TotalCashSnapshot } from '@/app/lib/interface';
import ExpenditureChart from './ChartViewByCategories';
import { useAuth } from '@/app/lib/context/userContext';
import AddExpenditureDialog from './utilsCompos/addExpenditureModal';
import {
  handleDeleteExpense,
  handleAmountUpdate,
} from '@/app/lib/functions/expenditures';

type TransactionSource =
  | 'bank'
  | 'in_hand'
  | 'easypaisa'
  | 'jazzcash'
  | 'other';

export default function ExpendituresComponent({ userId }: { userId: string }) {
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [newBankName, setNewBankName] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [availableFunds, setAvailableFunds] = useState(0);
  const [insufficientFunds, setInsufficientFunds] = useState(false);

  const [notesOpen, setNotesOpen] = useState(false);
  const [amountUpdatingId, setAmountUpdatingId] = useState<string | null>(null);

  // Helper function to check if recurring expense should be reset
  const shouldResetPaidStatus = (exp: Expenditure): boolean => {
    if (exp.type !== 'recurring' || !exp.isPaid || !exp.lastPaidDate) {
      return false;
    }

    const lastPaid =
      exp.lastPaidDate instanceof Date
        ? exp.lastPaidDate
        : exp.lastPaidDate.toDate();
    const today = new Date();
    const daysDiff = Math.floor(
      (today.getTime() - lastPaid.getTime()) / (1000 * 60 * 60 * 24)
    );

    switch (exp.frequency) {
      case 'daily':
        return daysDiff >= 1;
      case 'weekly':
        return daysDiff >= 7;
      case 'monthly':
        return daysDiff >= 30; // Approximate month
      default:
        return false;
    }
  };

  // Helper function to reset paid status for recurring expenses
  const resetRecurringExpenses = async () => {
    const expensesToReset = expenditures.filter(shouldResetPaidStatus);

    for (const exp of expensesToReset) {
      if (exp.id) {
        try {
          await updateDoc(doc(db, 'expenditures', exp.id), {
            isPaid: false,
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          console.error('Error resetting expense:', error);
        }
      }
    }

    // Update local state
    setExpenditures((prev) =>
      prev.map((exp) =>
        shouldResetPaidStatus(exp) ? { ...exp, isPaid: false } : exp
      )
    );
  };

  // ---- Fetch data ----
  useEffect(() => {
    const fetchExpenditures = async () => {
      const snap = await getDocs(collection(db, 'expenditures'));
      const docs = snap.docs
        .map((d) => {
          const data = d.data() as Expenditure;
          return {
            ...data,
            id: d.id,
            createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
            dueDate: data.dueDate
              ? (data.dueDate as Timestamp).toDate()
              : undefined,
          };
        })
        .filter((e) => e.userId === userId)
        .filter((e) => {
          if (e.type === 'recurring') return true;
          if (e.type === 'one-time' && !e.isPaid) return true;
          return false;
        })
        .sort((a, b) => {
          const dateA = a.dueDate?.getTime() ?? 0;
          const dateB = b.dueDate?.getTime() ?? 0;
          return dateA - dateB;
        });

      setExpenditures(docs);
      setLoading(false);

      // Reset recurring expenses that should be available again
      setTimeout(() => {
        resetRecurringExpenses();
      }, 1000);
    };

    const fetchBanksForUser = async () => {
      if (!user) return;
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched: Bank[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Bank, 'id'>),
      }));
      setBanks(fetched);
    };

    fetchExpenditures();
    fetchBanksForUser();
  }, [userId, user]);

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
    if (!user || !newBankName.trim()) return;
    try {
      const res = await addDoc(collection(db, 'banks'), {
        userId: user.uid,
        name: newBankName.trim(),
        createdAt: serverTimestamp(),
      });
      const newBank: Bank = {
        id: res.id,
        name: newBankName.trim(),
        userId: user.uid,
      } as Bank;
      setBanks((prev) => [...prev, newBank]);
      setSelectedBank(res.id);
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

      // 1) Update the expenditure as paid with payment history
      const currentPayment = {
        date: new Date(),
        amount: exp.amount,
      };

      // Get current payment history or initialize empty array
      const currentExp = expenditures.find((e) => e.id === exp.id);
      const existingHistory = currentExp?.paymentHistory || [];

      await updateDoc(doc(db, 'expenditures', exp.id!), {
        isPaid: true,
        lastPaidDate: serverTimestamp(),
        paymentHistory: [...existingHistory, currentPayment],
        updatedAt: serverTimestamp(),
      });

      // 2) Deduct from main fund (optional)
      if (deductFromFund) {
        let bankId: string | undefined;
        let bankName: string | undefined;

        if (deductionSource === 'bank' && selectedBank) {
          const bank = banks.find((b) => b.id === selectedBank);
          bankId = bank?.id;
          bankName = bank?.name;
        }

        // Log cash transaction
        await addDoc(collection(db, 'cashTransactions'), {
          userId,
          amount: exp.amount,
          type: 'deduct',
          source: deductionSource,
          category: 'expenditure',
          note: `Expense paid: ${exp.title}`,
          bankId: bankId || null,
          BankName: bankName || null,
          createdAt: serverTimestamp(),
        });

        // Update snapshot
        const snapRef = doc(db, 'totalCashSnapshots', userId);
        const snap = await getDoc(snapRef);

        if (snap.exists()) {
          const data = snap.data() as TotalCashSnapshot;
          const updatedSources = { ...data.sources };

          if (deductionSource === 'bank' && bankName) {
            updatedSources.bank = updatedSources.bank || {};
            updatedSources.bank[bankName] =
              (updatedSources.bank[bankName] || 0) - exp.amount;
          } else if (deductionSource !== 'bank') {
            if (deductionSource === 'in_hand') {
              updatedSources.in_hand = updatedSources.in_hand - exp.amount;
            } else if (deductionSource === 'easypaisa') {
              updatedSources.easypaisa = updatedSources.easypaisa - exp.amount;
            } else if (deductionSource === 'jazzcash') {
              updatedSources.jazzcash = updatedSources.jazzcash - exp.amount;
            } else if (deductionSource === 'other') {
              updatedSources.other = updatedSources.other - exp.amount;
            }
          }

          await setDoc(snapRef, {
            ...data,
            sources: updatedSources,
            totalAmount: (data.totalAmount || 0) - exp.amount,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // 3) Local UI update
      if (exp.type === 'one-time') {
        setExpenditures((prev) => prev.filter((e) => e.id !== exp.id));
      } else {
        setExpenditures((prev) =>
          prev.map((e) =>
            e.id === exp.id
              ? {
                  ...e,
                  isPaid: true,
                  lastPaidDate: new Date(),
                  paymentHistory: [
                    ...(e.paymentHistory || []),
                    { date: new Date(), amount: exp.amount },
                  ],
                }
              : e
          )
        );
      }
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
                      type="number"
                      variant="standard"
                      value={exp.amount}
                      size="small"
                      onChange={(e) => {
                        const newAmount = Number(e.target.value);
                        setExpenditures((prev) =>
                          prev.map((item) =>
                            item.id === exp.id
                              ? { ...item, amount: newAmount }
                              : item
                          )
                        );
                      }}
                      onBlur={() =>
                        exp.id &&
                        handleAmountUpdate(
                          exp.id,
                          exp.amount,
                          setAmountUpdatingId
                        )
                      }
                      inputProps={{
                        style: {
                          maxWidth: 80,
                          textAlign: 'right',
                          fontWeight: 'bold',
                          color: '#16a34a',
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
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  sx={{ mt: 1, mr: 1 }}
                  onClick={() => exp.id && setDeleteId(exp.id)}
                >
                  Delete
                </Button>
                {!exp.isPaid && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="primary"
                    sx={{ mt: 1 }}
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
            onClick={() =>
              handleDeleteExpense(
                deleteId!,
                setExpenditures,
                setDeleting,
                setDeleteId
              )
            }
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
        onAdded={(newExp) => setExpenditures((prev) => [...prev, newExp])}
      />
    </Box>
  );
}
