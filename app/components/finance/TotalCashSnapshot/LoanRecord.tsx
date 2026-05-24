'use client';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  CircularProgress,
  Box,
  Fade,
  Stack,
  Avatar,
  IconButton,
  Collapse,
} from '@mui/material';
import { useEffect, useState } from 'react';
import {
  TransactionSource,
  Bank,
  LoanRecord,
  TotalCashSnapshot,
  CustomPaymentHead,
} from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  getDocs,
} from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import CloseIcon from '@mui/icons-material/Close';
import MoneyIcon from '@mui/icons-material/AttachMoney';
import PersonIcon from '@mui/icons-material/Person';
import DateIcon from '@mui/icons-material/CalendarMonth';
import BankIcon from '@mui/icons-material/AccountBalance';
import WalletIcon from '@mui/icons-material/Wallet';
import PaymentsIcon from '@mui/icons-material/Payments';
import NoteIcon from '@mui/icons-material/Description';
import SwapIcon from '@mui/icons-material/SwapHoriz';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/AddCircle';
import WarningIcon from '@mui/icons-material/WarningAmber';
import Link from 'next/link';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { formatCurrency } from '@/app/lib/utilts';

const SOURCE_OPTIONS: TransactionSource[] = [
  'bank',
  'in_hand',
  'easypaisa',
  'jazzcash',
  'other',
  'custom',
];

interface Props {
  onAddMoney?: (
    amount: number,
    source: TransactionSource,
    isFreezed: boolean,
    bankId?: string,
    bankName?: string,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string,
    note?: string
  ) => Promise<void>;
  onSuccess?: () => void;
}

export default function LoanDialog({ onAddMoney, onSuccess }: Props) {
  const { user } = useAuth();
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';
  const [showModal, setShowModal] = useState(false);

  // loan form state
  const [amount, setAmount] = useState<number | ''>('');
  const [loanType, setLoanType] = useState<'borrow' | 'lend'>('borrow');
  const [counterparty, setCounterparty] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [source, setSource] = useState<TransactionSource>('in_hand');
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedCustomPaymentHead, setSelectedCustomPaymentHead] =
    useState('');
  const [note, setNote] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<
    CustomPaymentHead[]
  >([]);

  // error, loading
  const [error, setError] = useState('');
  const [localSaving, setLocalSaving] = useState(false);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [insufficientFunds, setInsufficientFunds] = useState(false);

  // fetch banks
  useEffect(() => {
    if (!user) return;
    const fetchBanks = async () => {
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched: Bank[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Bank, 'id'>),
      }));
      setBanks(fetched);
    };
    fetchBanks();
  }, [user]);

  // fetch custom payment heads
  useEffect(() => {
    if (!user) return;
    const fetchCustom = async () => {
      const q = query(
        collection(db, 'customPaymentHeads'),
        where('userId', '==', user.uid),
      );
      const snap = await getDocs(q);
      const heads: CustomPaymentHead[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<CustomPaymentHead, 'id'>),
      }));
      setCustomPaymentHeads(heads);
    };
    fetchCustom();
  }, [user]);

  // reset error when inputs change
  useEffect(() => {
    setError('');
    setInsufficientFunds(false);
  }, [amount, source, selectedBank, selectedCustomPaymentHead, loanType]);

  const handleQuickAdd = async () => {
    if (!onAddMoney || !amount || amount <= 0) return;
    setQuickAddLoading(true);
    try {
      const bank = source === 'bank' ? banks.find(b => b.id === selectedBank) : undefined;
      const customHead = source === 'custom' ? customPaymentHeads.find(c => c.id === selectedCustomPaymentHead) : undefined;
      
      await onAddMoney(
        Number(amount),
        source,
        false,
        bank?.id,
        bank?.name,
        customHead?.id,
        customHead?.name,
        `Quick top-up for loan to ${counterparty}`
      );
      setInsufficientFunds(false);
      setError('');
    } catch {
      setError('Failed to add money. Please try manually.');
    } finally {
      setQuickAddLoading(false);
    }
  };

  // validate and create loan
  const handleCreate = async () => {
    if (!user || !amount || amount <= 0 || !counterparty.trim()) {
      setError('Please fill all required fields.');
      return;
    }
    if (!dueDate) {
      setError('Due date is required.');
      return;
    }
    if (source === 'bank' && !selectedBank) {
      setError('Please select a bank.');
      return;
    }
    if (source === 'custom' && !selectedCustomPaymentHead) {
      setError('Please select a payment head.');
      return;
    }

    const bank =
      source === 'bank' ? banks.find((b) => b.id === selectedBank) : undefined;
    const customName =
      source === 'custom'
        ? customPaymentHeads.find((c) => c.id === selectedCustomPaymentHead)
            ?.name || ''
        : '';
    setError('');

    try {
      setLocalSaving(true);

      const record: Omit<LoanRecord, 'id' | 'createdAt'> = {
        userId: user.uid,
        amount: Number(amount),
        type: loanType,
        counterparty: counterparty.trim(),
        dueDate: Timestamp.fromDate(new Date(dueDate)),
        note: note.trim(),
        isSettled: false,
      };

      // fetch snapshot
      const snapshotRef = doc(db, 'totalCashSnapshots', user.uid);
      const snapshotSnap = await getDoc(snapshotRef);
      const snapshot: TotalCashSnapshot = snapshotSnap.exists()
        ? (snapshotSnap.data() as TotalCashSnapshot)
        : {
            userId: user.uid,
            sources: {
              in_hand: 0,
              bank: {},
              easypaisa: 0,
              jazzcash: 0,
              other: 0,
              custom: {},
            },
            totalAmount: 0,
            freezeAmount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

      // normalize bank/custom objects
      if (typeof snapshot.sources.bank === 'number')
        snapshot.sources.bank = { Default: snapshot.sources.bank };
      if (typeof snapshot.sources.custom === 'number')
        snapshot.sources.custom = { Default: snapshot.sources.custom };
      if (!snapshot.sources.custom) snapshot.sources.custom = {};

      // check available balance
      if (loanType === 'lend') {
        const available =
          source === 'bank' && bank?.name
            ? (snapshot.sources.bank?.[bank.name] ?? 0)
            : source === 'custom' && customName
              ? (snapshot.sources.custom?.[customName] ?? 0)
              : ((snapshot.sources[source] as number) ?? 0);
        if (amount > available) {
          setInsufficientFunds(true);
          throw new Error(
            `Insufficient balance in ${source}${
              bank?.name ? ` (${bank.name})` : ''
            }`,
          );
        }
      }

      // create loan
      const loanRef = await addDoc(collection(db, 'loans'), {
        ...record,
        createdAt: serverTimestamp(),
      });
      // create transaction
      await addDoc(collection(db, 'cashTransactions'), {
        userId: user.uid,
        amount: record.amount,
        type: loanType === 'lend' ? 'deduct' : 'add',
        source,
        category: 'loan',
        note: note.trim() || `Loan ${loanType} - ${counterparty}`,
        referenceId: loanRef.id,
        createdAt: serverTimestamp(),
        ...(bank?.id ? { bankId: bank.id } : {}),
        ...(bank?.name ? { bankName: bank.name } : {}),
        ...(source === 'custom' && selectedCustomPaymentHead
          ? {
              customPaymentHeadId: selectedCustomPaymentHead,
              customPaymentHeadName:
                customPaymentHeads.find(
                  (c) => c.id === selectedCustomPaymentHead,
                )?.name || '',
            }
          : {}),
      });

      // update snapshot
      const updatedSources = { ...snapshot.sources };
      if (loanType === 'lend') {
        if (source === 'bank' && bank?.name) {
          updatedSources.bank[bank.name] -= amount;
        } else if (source === 'custom' && selectedCustomPaymentHead) {
          const customName =
            customPaymentHeads.find((c) => c.id === selectedCustomPaymentHead)
              ?.name || '';
          if (customName) {
            updatedSources.custom[customName] =
              (updatedSources.custom[customName] || 0) - amount;
          }
        } else {
          (updatedSources[source] as number) -= amount;
        }
        snapshot.totalAmount -= amount;
      } else {
        if (source === 'bank' && bank?.name) {
          updatedSources.bank[bank.name] += amount;
        } else if (source === 'custom' && selectedCustomPaymentHead) {
          const customName =
            customPaymentHeads.find((c) => c.id === selectedCustomPaymentHead)
              ?.name || '';
          if (customName) {
            updatedSources.custom[customName] =
              (updatedSources.custom[customName] || 0) + amount;
          }
        } else {
          (updatedSources[source] as number) += amount;
        }
        snapshot.totalAmount += amount;
      }
      await updateDoc(snapshotRef, {
        sources: updatedSources,
        totalAmount: snapshot.totalAmount,
        updatedAt: serverTimestamp(),
      });

      // reset
      setAmount('');
      setCounterparty('');
      setDueDate('');
      setSource('in_hand');
      setSelectedBank('');
      setLoanType('borrow');
      setNote('');
      setShowModal(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLocalSaving(false);
    }
  };

  const getSourceLabel = () => {
    if (source === 'bank') {
      const bank = banks.find(b => b.id === selectedBank);
      return bank ? `Bank (${bank.name})` : 'Bank';
    }
    if (source === 'custom') {
      const head = customPaymentHeads.find(c => c.id === selectedCustomPaymentHead);
      return head ? head.name : 'Custom Head';
    }
    return source.replace('_', ' ');
  };

  return (
    <>
      <Button
        variant="outlined"
        sx={{
          borderRadius: 2,
          fontWeight: 700,
          textTransform: 'none',
          borderColor: isDark ? 'rgba(14, 165, 233, 0.5)' : '#0ea5e9',
          color: isDark ? '#7dd3fc' : '#0369a1',
          bgcolor: isDark ? 'rgba(14, 165, 233, 0.05)' : 'rgba(14, 165, 233, 0.05)',
          '&:hover': {
            bgcolor: isDark ? 'rgba(14, 165, 233, 0.1)' : 'rgba(14, 165, 233, 0.1)',
            borderColor: '#0ea5e9'
          }
        }}
        onClick={() => setShowModal(true)}
        startIcon={<SwapIcon sx={{ fontSize: 18 }} />}
      >
        Outstanding Loan
      </Button>

      <Dialog
        open={showModal}
        onClose={() => !localSaving && setShowModal(false)}
        fullWidth
        maxWidth="xs"
        TransitionComponent={Fade}
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
          }
        }}
      >
        <Box sx={{
          background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
          p: 3,
          color: 'white',
          position: 'relative'
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              <SwapIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>
                Outstanding Loan
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 600 }}>
                Record new borrow or lend transaction
              </Typography>
            </Box>
          </Stack>
          <IconButton
            onClick={() => setShowModal(false)}
            sx={{
              position: 'absolute',
              right: 12,
              top: 12,
              color: 'white',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent sx={{ px: 3, py: 3 }}>
          <Stack spacing={2.5}>
            {/* View Records Link */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f0f9ff',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e0f2fe'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" fontWeight="700" color="text.secondary">
                ALL LOAN RECORDS
              </Typography>
              <Link href="/finance/loans" passHref>
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                  onClick={() => setShowModal(false)}
                  sx={{ textTransform: 'none', fontWeight: 800, fontSize: '0.75rem' }}
                >
                  View History
                </Button>
              </Link>
            </Box>

            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value === '' ? '' : Number(e.target.value))
              }
              InputProps={{
                startAdornment: <MoneyIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
              }}
              placeholder="0.00"
            />

            <FormControl fullWidth>
              <InputLabel>Loan Type</InputLabel>
              <Select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value as 'borrow' | 'lend')}
                label="Loan Type"
                startAdornment={<SwapIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
              >
                <MenuItem value="borrow">Borrow (Receive Money)</MenuItem>
                <MenuItem value="lend">Lend (Give Money)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label={loanType === 'borrow' ? "Lender Name" : "Borrower Name"}
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="e.g. John Doe"
              InputProps={{
                startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
              }}
            />

            <TextField
              fullWidth
              type="date"
              label="Expected Due Date"
              InputLabelProps={{ shrink: true }}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputProps={{
                startAdornment: <DateIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
              }}
            />

            <FormControl fullWidth>
              <InputLabel>Cash Source</InputLabel>
              <Select
                value={source}
                onChange={(e) => {
                  const val = e.target.value as TransactionSource;
                  setSource(val);
                  setSelectedBank('');
                  setSelectedCustomPaymentHead('');
                }}
                label="Cash Source"
                startAdornment={<PaymentsIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
              >
                {SOURCE_OPTIONS.map((mode) => (
                  <MenuItem key={mode} value={mode} sx={{ textTransform: 'capitalize' }}>
                    {mode.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {source === 'bank' && (
              <FormControl fullWidth>
                <InputLabel>Select Bank</InputLabel>
                <Select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  label="Select Bank"
                  startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
                >
                  {banks.map((bank) => (
                    <MenuItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {source === 'custom' && (
              <FormControl fullWidth>
                <InputLabel>Select Payment Head</InputLabel>
                <Select
                  value={selectedCustomPaymentHead}
                  onChange={(e) => setSelectedCustomPaymentHead(e.target.value)}
                  label="Select Payment Head"
                  startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
                >
                  {customPaymentHeads.map((head) => (
                    <MenuItem key={head.id} value={head.id}>
                      {head.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              fullWidth
              label="Note / Remark"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. For project expenses"
              size="small"
              multiline
              rows={2}
              InputProps={{
                startAdornment: <NoteIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20, mt: 1, alignSelf: 'flex-start' }} />,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            <Collapse in={!!error || insufficientFunds}>
              <Box sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: insufficientFunds ? (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2') : 'transparent',
                border: insufficientFunds ? `1px solid ${isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2'}` : 'none'
              }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <WarningIcon color="error" sx={{ fontSize: 20 }} />
                    <Typography color="error" variant="caption" fontWeight="bold">
                      {error}
                    </Typography>
                  </Stack>
                  
                  {insufficientFunds && onAddMoney && (
                    <Button
                      variant="contained"
                      color="error"
                      size="small"
                      fullWidth
                      onClick={handleQuickAdd}
                      disabled={quickAddLoading}
                      startIcon={quickAddLoading ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 800,
                        borderRadius: 1.5,
                        boxShadow: 'none'
                      }}
                    >
                      {quickAddLoading ? 'Adding Funds...' : `Add ${formatCurrency(Number(amount), 'PKR')} to ${getSourceLabel()}`}
                    </Button>
                  )}
                </Stack>
              </Box>
            </Collapse>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 3, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fcfcfc', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <Button onClick={() => setShowModal(false)} sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreate}
            disabled={
              localSaving ||
              quickAddLoading ||
              (source === 'bank' && !selectedBank) ||
              (source === 'custom' && !selectedCustomPaymentHead) ||
              !amount || !counterparty.trim() || !dueDate
            }
            sx={{
              borderRadius: 2,
              fontWeight: 800,
              px: 4,
              bgcolor: '#0ea5e9',
              boxShadow: '0 4px 14px 0 rgba(14, 165, 233, 0.39)',
              textTransform: 'none',
              '&:hover': { bgcolor: '#0369a1' }
            }}
          >
            {localSaving ? <CircularProgress size={20} color="inherit" /> : 'Record Loan'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
