'use client';
import React, { useEffect, useMemo, useState } from 'react';
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
} from '@mui/material';
import {
  doc,
  getDoc,
  addDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  collection,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import {
  IncomeSource,
  TransactionSource,
  Bank,
  TotalCashSnapshot,
} from '@/app/lib/interface';
import ChartViewByCategory from './ChartViewByCategories';
import { useAuth } from '@/app/lib/context/userContext';
import AddIncomeModal from './utilsCompos/addIncomeModal';
import {
  fetchIncomeSources,
  fetchBanks,
  addNewBank,
  updateIncomeAmount,
  deleteIncomeSource,
  shouldResetReceived, // ✅ imported reset helper
} from '@/app/lib/functions/incomeSources';

export default function IncomeSourceComponent({ userId }: { userId: string }) {
  const { theme } = useCustomTheme();
  const { user } = useAuth();

  const [sources, setSources] = useState<
    (IncomeSource & { isHiding?: boolean })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [updatingAmountId, setUpdatingAmountId] = useState<string | null>(null);

  // Confirm dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<IncomeSource | null>(
    null
  );
  const [actionLoading, setActionLoading] = useState(false);

  const SOURCE_OPTIONS: TransactionSource[] = [
    'bank',
    'in_hand',
    'easypaisa',
    'jazzcash',
    'other',
  ];
  const [incomeSourceForMainFund, setIncomeSourceForMainFund] =
    useState<TransactionSource>('in_hand');

  // Bank state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [newBankName, setNewBankName] = useState('');

  const [availableFunds, setAvailableFunds] = useState(0);
  const [sourceBalanceWarning, setSourceBalanceWarning] = useState(false);

  useEffect(() => {
    async function load() {
      const incomeData = await fetchIncomeSources(userId);

      // ✅ Reset recurring incomes if needed
      const normalized = incomeData.map((src) => {
        if (shouldResetReceived(src)) {
          return { ...src, isReceived: false };
        }
        return src;
      });

      setSources(normalized);
      setLoading(false);

      if (user) {
        const bankData = await fetchBanks(user.uid);
        setBanks(bankData);
      }
    }
    load();
  }, [userId, user]);

  const handleAddBank = async () => {
    if (!user || !newBankName.trim()) return;
    const newBank = await addNewBank(user.uid, newBankName);
    setBanks((prev) => [...prev, newBank]);
    setSelectedBank(newBank.id!);
    setNewBankName('');
  };

  // Filtered sources for display
  const displayedSources = sources
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

  const onClickMark = async (src: IncomeSource) => {
    setSelectedIncome(src);
    setIncomeSourceForMainFund('in_hand');
    setSelectedBank('');

    try {
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const available = data.sources?.['in_hand'] || 0;
        setAvailableFunds(available);
        setSourceBalanceWarning(available < 0);
      } else {
        setAvailableFunds(0);
        setSourceBalanceWarning(true);
      }
    } catch (err) {
      console.error('Error fetching snapshot:', err);
      setAvailableFunds(0);
      setSourceBalanceWarning(true);
    }

    setConfirmDialogOpen(true);
  };

  const markAsReceived = async (src: IncomeSource, updateMainFund: boolean) => {
    try {
      // Create payment record for history
      const currentPayment = {
        date: new Date(),
        amount: src.amount,
      };

      // Get current payment history or initialize empty array
      const currentSrc = sources.find((s) => s.id === src.id);
      const existingHistory = currentSrc?.paymentHistory || [];

      await updateDoc(doc(db, 'incomeSources', src.id!), {
        isReceived: true,
        lastReceivedDate: serverTimestamp(), // ✅ track last time received
        paymentHistory: [...existingHistory, currentPayment],
        updatedAt: serverTimestamp(),
      });

      if (updateMainFund) {
        let bankId: string | undefined;
        let bankName: string | undefined;

        if (incomeSourceForMainFund === 'bank' && selectedBank) {
          const bank = banks.find((b) => b.id === selectedBank);
          bankId = bank?.id;
          bankName = bank?.name;
        }

        await addDoc(collection(db, 'cashTransactions'), {
          userId,
          amount: src.amount,
          type: 'add',
          source: incomeSourceForMainFund,
          category: 'income',
          note: `Income received: ${src.title}`,
          bankId: bankId || null,
          BankName: bankName || null,
          createdAt: serverTimestamp(),
        });

        const docRef = doc(db, 'totalCashSnapshots', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as TotalCashSnapshot;
          const updatedSources = { ...data.sources };

          if (incomeSourceForMainFund === 'bank' && bankName) {
            updatedSources.bank[bankName] =
              (updatedSources.bank[bankName] || 0) + src.amount;
          } else if (incomeSourceForMainFund !== 'bank') {
            updatedSources[incomeSourceForMainFund] =
              (updatedSources[incomeSourceForMainFund] as number) + src.amount;
          }

          await setDoc(docRef, {
            ...data,
            sources: updatedSources,
            totalAmount: data.totalAmount + src.amount,
            updatedAt: serverTimestamp(),
          });
        }
      }

      if (src.type === 'one-time') {
        setSources((prev) =>
          prev.map((i) => (i.id === src.id ? { ...i, isHiding: true } : i))
        );
        setTimeout(
          () =>
            setSources((prev) =>
              prev.filter((i) => !(i.id === src.id && i.type === 'one-time'))
            ),
          300
        );
      } else {
        setSources((prev) =>
          prev.map((i) =>
            i.id === src.id
              ? {
                  ...i,
                  isReceived: true,
                  lastReceivedDate: new Date(),
                  paymentHistory: [
                    ...(i.paymentHistory || []),
                    { date: new Date(), amount: src.amount },
                  ],
                }
              : i
          )
        );
      }
    } catch (err) {
      console.error('Error marking received:', err);
    }
  };

  const handleConfirmYes = async () => {
    if (!selectedIncome) return;
    setActionLoading(true);
    await markAsReceived(selectedIncome, true);
    setActionLoading(false);
    setConfirmDialogOpen(false);
    setSelectedIncome(null);
  };

  const handleConfirmNo = async () => {
    if (!selectedIncome) return;
    setActionLoading(true);
    await markAsReceived(selectedIncome, false);
    setActionLoading(false);
    setConfirmDialogOpen(false);
    setSelectedIncome(null);
  };

  const handleDelete = async (src: IncomeSource) => {
    setSources((prev) =>
      prev.map((i) => (i.id === src.id ? { ...i, isHiding: true } : i))
    );
    setTimeout(async () => {
      try {
        if (src.id) await deleteIncomeSource(src.id);
      } catch (err) {
        console.error('Error deleting income:', err);
      }
      setSources((prev) => prev.filter((i) => i.id !== src.id));
    }, 300);
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
            opacity: src.isHiding ? 0 : 1,
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
                type="number"
                variant="standard"
                value={src.amount}
                size="small"
                onChange={(e) => {
                  const newAmt = Number(e.target.value);
                  setSources((prev) =>
                    prev.map((i) =>
                      i.id === src.id ? { ...i, amount: newAmt } : i
                    )
                  );
                }}
                onBlur={async () => {
                  if (!src.id) return;
                  setUpdatingAmountId(src.id);
                  try {
                    await updateIncomeAmount(src.id, src.amount);
                  } catch (err) {
                    console.error('Error updating amount:', err);
                  } finally {
                    setUpdatingAmountId(null);
                  }
                }}
                inputProps={{
                  style: {
                    maxWidth: 80,
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#2563eb',
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

          <Button
            variant="outlined"
            size="small"
            color="error"
            sx={{ mt: 1, mr: 1 }}
            onClick={() => handleDelete(src)}
          >
            Delete
          </Button>

          {!src.isReceived && (
            <Button
              variant="outlined"
              size="small"
              color="primary"
              sx={{ mt: 1 }}
              onClick={() => onClickMark(src)}
              disabled={actionLoading}
            >
              {actionLoading && selectedIncome?.id === src.id ? (
                <CircularProgress size={18} />
              ) : (
                'Mark as Received'
              )}
            </Button>
          )}
        </Box>
      ))}

      {/* Confirm Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Add to main fund?</DialogTitle>
        <DialogContent>
          <Typography>
            Do you want to add the amount{' '}
            <strong>Rs {selectedIncome?.amount}</strong> from{' '}
            <em>{selectedIncome?.title}</em> to your main fund?
          </Typography>

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Source in Fund</InputLabel>
            <Select
              value={incomeSourceForMainFund}
              onChange={(e) =>
                setIncomeSourceForMainFund(e.target.value as TransactionSource)
              }
            >
              {SOURCE_OPTIONS.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {incomeSourceForMainFund === 'bank' && (
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Bank</InputLabel>
                <Select
                  value={selectedBank}
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
            Available in <strong>{incomeSourceForMainFund}</strong>
            {incomeSourceForMainFund === 'bank' &&
              selectedBank &&
              ` (${banks.find((b) => b.id === selectedBank)?.name})`}
            : Rs {availableFunds.toLocaleString()}
          </Typography>

          {sourceBalanceWarning && (
            <Typography mt={1} color="error" fontWeight="bold" fontSize={13}>
              ⚠️ This source previously had negative or no balance.
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
              actionLoading ||
              (incomeSourceForMainFund === 'bank' && !selectedBank)
            }
          >
            {actionLoading ? <CircularProgress size={18} /> : 'Yes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Income Modal */}
      <AddIncomeModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        userId={userId}
        onAdded={(income) => setSources((prev) => [...prev, income])}
      />
    </Box>
  );
}
