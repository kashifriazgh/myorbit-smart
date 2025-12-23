'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  TextField,
  CircularProgress,
} from '@mui/material';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import {
  IncomeSource,
  TransactionSource,
  Bank,
  TotalCashSnapshot,
  CustomPaymentHead,
} from '@/app/lib/interface';

interface MarkAsReceivedDialogProps {
  open: boolean;
  onClose: () => void;
  income: IncomeSource | null;
  banks: Bank[];
  onConfirm: (
    updateMainFund: boolean,
    fundSource?: TransactionSource,
    bankId?: string,
    customPaymentHeadId?: string
  ) => Promise<void>;
  onAddBank?: (bankName: string) => Promise<Bank>;
  loading?: boolean;
}

const SOURCE_OPTIONS: TransactionSource[] = [
  'bank',
  'in_hand',
  'easypaisa',
  'jazzcash',
  'other',
  'custom',
];

export default function MarkAsReceivedDialog({
  open,
  onClose,
  income,
  banks,
  onConfirm,
  onAddBank,
  loading = false,
}: MarkAsReceivedDialogProps) {
  const [incomeSourceForMainFund, setIncomeSourceForMainFund] =
    useState<TransactionSource>('in_hand');
  const [selectedBank, setSelectedBank] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [selectedCustomPaymentHead, setSelectedCustomPaymentHead] =
    useState('');
  const [newCustomPaymentHeadName, setNewCustomPaymentHeadName] =
    useState('');
  const [availableFunds, setAvailableFunds] = useState(0);
  const [sourceBalanceWarning, setSourceBalanceWarning] = useState(false);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [addingBank, setAddingBank] = useState(false);
  const [addingCustomPaymentHead, setAddingCustomPaymentHead] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<TotalCashSnapshot | null>(null);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<
    CustomPaymentHead[]
  >([]);

  const updateAvailableFunds = useCallback(
    (
      snapshotData: TotalCashSnapshot,
      source: TransactionSource,
      bankId?: string,
      customPaymentHeadId?: string
    ) => {
      if (!snapshotData?.sources) {
        setAvailableFunds(0);
        setSourceBalanceWarning(true);
        return;
      }

      let available = 0;

      if (source === 'bank' && bankId) {
        const bank = banks.find((b) => b.id === bankId);
        const bankName = bank?.name;
        if (bankName) {
          available = snapshotData.sources.bank?.[bankName] || 0;
          console.log(`Bank ${bankName} available: ${available}`);
        }
      } else if (source === 'custom' && customPaymentHeadId) {
        const customName = customPaymentHeads.find(
          (c) => c.id === customPaymentHeadId
        )?.name;
        if (customName) {
          available = snapshotData.sources.custom?.[customName] || 0;
          console.log(`Custom ${customName} available: ${available}`);
        }
      } else if (source !== 'bank') {
        const val = snapshotData.sources[source];
        available = typeof val === 'number' ? val : 0;
        console.log(`${source} available: ${available}`);
      }

      setAvailableFunds(available);
      setSourceBalanceWarning(available < 0);
    },
    [banks, customPaymentHeads]
  );

  const fetchAvailableFunds = useCallback(async () => {
    if (!income?.userId) return;

    setFetchingBalance(true);
    try {
      const docRef = doc(db, 'totalCashSnapshots', income.userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as TotalCashSnapshot;
        setSnapshot(data);
        updateAvailableFunds(
          data,
          incomeSourceForMainFund,
          selectedBank,
          selectedCustomPaymentHead
        );
      } else {
        setSnapshot(null);
        setAvailableFunds(0);
        setSourceBalanceWarning(true);
      }
    } catch (err) {
      console.error('Error fetching snapshot:', err);
      setSnapshot(null);
      setAvailableFunds(0);
      setSourceBalanceWarning(true);
    } finally {
      setFetchingBalance(false);
    }
  }, [
    income?.userId,
    incomeSourceForMainFund,
    selectedBank,
    selectedCustomPaymentHead,
    updateAvailableFunds,
  ]);

  useEffect(() => {
    if (!income?.userId) return;
    const fetchCustomHeads = async () => {
      const q = query(
        collection(db, 'customPaymentHeads'),
        where('userId', '==', income.userId)
      );
      const snap = await getDocs(q);
      const fetched: CustomPaymentHead[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<CustomPaymentHead, 'id'>),
      }));
      setCustomPaymentHeads(fetched);
    };
    fetchCustomHeads();
  }, [income?.userId]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open && income) {
      setIncomeSourceForMainFund('in_hand');
      setSelectedBank('');
      setNewBankName('');
      setSelectedCustomPaymentHead('');
      setNewCustomPaymentHeadName('');
      setBankError(null);
      fetchAvailableFunds();
    }
  }, [open, income, fetchAvailableFunds]);

  // Update available funds when fund source changes
  useEffect(() => {
    if (snapshot) {
      updateAvailableFunds(
        snapshot,
        incomeSourceForMainFund,
        selectedBank,
        selectedCustomPaymentHead
      );
    }
  }, [
    incomeSourceForMainFund,
    selectedBank,
    selectedCustomPaymentHead,
    snapshot,
    updateAvailableFunds,
  ]);

  const handleConfirmYes = async () => {
    await onConfirm(
      true,
      incomeSourceForMainFund,
      selectedBank,
      selectedCustomPaymentHead
    );
  };

  const handleConfirmNo = async () => {
    await onConfirm(false);
  };

  const handleAddBank = async () => {
    if (!newBankName.trim() || !onAddBank) return;

    setAddingBank(true);
    setBankError(null);
    try {
      const newBank = await onAddBank(newBankName.trim());
      setSelectedBank(newBank.id!);
      setNewBankName('');
      // Update available funds for the new bank (will be 0 initially)
      if (snapshot) {
        updateAvailableFunds(snapshot, incomeSourceForMainFund, newBank.id!);
      }
    } catch (error) {
      console.error('Error adding bank:', error);
      setBankError('Failed to add bank. Please try again.');
    } finally {
      setAddingBank(false);
    }
  };

  const handleAddCustomPaymentHead = async () => {
    if (!income?.userId || !newCustomPaymentHeadName.trim()) return;
    setAddingCustomPaymentHead(true);
    try {
      const docRef = await addDoc(collection(db, 'customPaymentHeads'), {
        userId: income.userId,
        name: newCustomPaymentHeadName.trim(),
        createdAt: new Date(),
      });
      const newHead: CustomPaymentHead = {
        id: docRef.id,
        userId: income.userId,
        name: newCustomPaymentHeadName.trim(),
        createdAt: new Date(),
      };
      setCustomPaymentHeads((prev) => [...prev, newHead]);
      setSelectedCustomPaymentHead(newHead.id!);
      setNewCustomPaymentHeadName('');
    } catch (error) {
      console.error('Error adding custom payment head:', error);
    } finally {
      setAddingCustomPaymentHead(false);
    }
  };

  if (!income) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add to main fund?</DialogTitle>
      <DialogContent>
        <Typography>
          Do you want to add the amount <strong>Rs {income.amount}</strong> from{' '}
          <em>{income.title}</em> to your main fund?
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
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newBankName.trim() && !addingBank) {
                  handleAddBank();
                }
              }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddBank}
              disabled={!newBankName.trim() || addingBank}
            >
              {addingBank ? <CircularProgress size={16} /> : 'Add Bank'}
            </Button>
          </Stack>
        )}

        {incomeSourceForMainFund === 'custom' && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Payment Head</InputLabel>
              <Select
                value={selectedCustomPaymentHead}
                onChange={(e) => setSelectedCustomPaymentHead(e.target.value)}
              >
                {customPaymentHeads.map((head) => (
                  <MenuItem key={head.id} value={head.id}>
                    {head.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="New Payment Head"
              size="small"
              value={newCustomPaymentHeadName}
              onChange={(e) => setNewCustomPaymentHeadName(e.target.value)}
              onKeyPress={(e) => {
                if (
                  e.key === 'Enter' &&
                  newCustomPaymentHeadName.trim() &&
                  !addingCustomPaymentHead
                ) {
                  handleAddCustomPaymentHead();
                }
              }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddCustomPaymentHead}
              disabled={!newCustomPaymentHeadName.trim() || addingCustomPaymentHead}
            >
              {addingCustomPaymentHead ? (
                <CircularProgress size={16} />
              ) : (
                'Add Payment Head'
              )}
            </Button>
          </Stack>
        )}

        {bankError && (
          <Typography mt={1} color="error" fontSize={13}>
            {bankError}
          </Typography>
        )}

        {fetchingBalance ? (
          <CircularProgress size={16} sx={{ mt: 1 }} />
        ) : (
          <Typography mt={1} fontSize={14}>
            Available in <strong>{incomeSourceForMainFund}</strong>
            {incomeSourceForMainFund === 'bank' &&
              selectedBank &&
              ` (${banks.find((b) => b.id === selectedBank)?.name})`}
            {incomeSourceForMainFund === 'custom' &&
              selectedCustomPaymentHead &&
              ` (${
                customPaymentHeads.find((c) => c.id === selectedCustomPaymentHead)
                  ?.name
              })`}
            : Rs {availableFunds.toLocaleString()}
          </Typography>
        )}

        {sourceBalanceWarning && (
          <Typography mt={1} color="error" fontWeight="bold" fontSize={13}>
            ⚠️ This source previously had negative or no balance.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleConfirmNo} disabled={loading}>
          No
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirmYes}
          disabled={
            loading ||
            (incomeSourceForMainFund === 'bank' && !selectedBank) ||
            (incomeSourceForMainFund === 'custom' && !selectedCustomPaymentHead)
          }
        >
          {loading ? <CircularProgress size={18} /> : 'Yes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
