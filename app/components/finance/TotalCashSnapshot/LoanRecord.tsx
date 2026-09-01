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
  InputAdornment,
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
import PersonIcon from '@mui/icons-material/Person';
import DateIcon from '@mui/icons-material/CalendarMonth';
import BankIcon from '@mui/icons-material/AccountBalance';
import WalletIcon from '@mui/icons-material/Wallet';
import NoteIcon from '@mui/icons-material/Description';
import SwapIcon from '@mui/icons-material/SwapHoriz';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/AddCircle';
import WarningIcon from '@mui/icons-material/WarningAmber';
import Link from 'next/link';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { formatCurrency } from '@/app/lib/utilts';
import { getSourceKey } from '../TotalCashSnapshot';

interface Props {
  onAddMoney?: (
    amount: number,
    source: TransactionSource,
    isFreezed: boolean,
    bankId?: string,
    bankName?: string,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string,
    note?: string,
    holderName?: string
  ) => Promise<void>;
  onSuccess?: () => void;
  snapshot: TotalCashSnapshot;
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export default function LoanDialog({ onAddMoney, onSuccess, snapshot, externalOpen, onExternalClose }: Props) {
  const { user } = useAuth();
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';
  const [showModal, setShowModal] = useState(false);

  // loan form state
  const [amount, setAmount] = useState<number | ''>('');
  const [loanType, setLoanType] = useState<'borrow' | 'lend' | null>(null);
  const [dueDate, setDueDate] = useState<string>('');
  const [note, setNote] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);

  // Category state (UI helpers for step-2)
  const [fromCategory, setFromCategory] = useState<'outside' | 'my_account'>('outside');
  const [toCategory, setToCategory] = useState<'outside' | 'immediate_expended' | 'my_account'>('my_account');

  // Source state (From)
  const [fromType, setFromType] = useState<'outside' | TransactionSource>('outside');
  const [fromBankId, setFromBankId] = useState('');
  const [fromCustomId, setFromCustomId] = useState('');
  const [fromHolder, setFromHolder] = useState('Unassigned');
  const [newFromHolderName, setNewFromHolderName] = useState('');
  const [lenderName, setLenderName] = useState('');

  // Destination state (To)
  const [toType, setToType] = useState<'outside' | 'immediate_expended' | TransactionSource>('in_hand');
  const [toBankId, setToBankId] = useState('');
  const [toCustomId, setToCustomId] = useState('');
  const [toHolder, setToHolder] = useState('Unassigned');
  const [newToHolderName, setNewToHolderName] = useState('');
  const [borrowerName, setBorrowerName] = useState('');

  // error, loading
  const [error, setError] = useState('');
  const [localSaving, setLocalSaving] = useState(false);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [insufficientFunds, setInsufficientFunds] = useState(false);

  // Reset all fields when loan type changes (or back button pressed)
  const handleLoanTypeChange = (type: 'borrow' | 'lend' | null) => {
    setLoanType(type);
    setError('');
    setInsufficientFunds(false);
    if (type === 'borrow') {
      setFromCategory('outside');
      setFromType('outside');
      setToCategory('my_account');
      setToType('in_hand');
    } else if (type === 'lend') {
      setFromCategory('my_account');
      setFromType('in_hand');
      setToCategory('outside');
      setToType('outside');
    } else {
      setFromCategory('outside');
      setFromType('outside');
      setToCategory('my_account');
      setToType('in_hand');
    }
    setLenderName('');
    setBorrowerName('');
    setFromBankId('');
    setFromCustomId('');
    setFromHolder('Unassigned');
    setNewFromHolderName('');
    setToBankId('');
    setToCustomId('');
    setToHolder('Unassigned');
    setNewToHolderName('');
  };

  // Sync with external open state from FAB
  useEffect(() => {
    if (externalOpen !== undefined) {
      setShowModal(externalOpen);
      if (externalOpen) {
        // reset to type-selection screen when opened externally
        handleLoanTypeChange(null);
        setAmount('');
        setDueDate('');
        setNote('');
      }
    }
  }, [externalOpen]);

  // fetch banks
  useEffect(() => {
    if (!user) return;
    const fetchBanks = async () => {
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched: Bank[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bank, 'id'>) }));
      setBanks(fetched);
    };
    fetchBanks();
  }, [user]);

  // fetch custom payment heads
  useEffect(() => {
    if (!user) return;
    const fetchCustom = async () => {
      const q = query(collection(db, 'customPaymentHeads'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const heads: CustomPaymentHead[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomPaymentHead, 'id'>) }));
      setCustomPaymentHeads(heads);
    };
    fetchCustom();
  }, [user]);

  // reset error when inputs change
  useEffect(() => {
    setError('');
    setInsufficientFunds(false);
  }, [amount, fromType, fromBankId, fromCustomId, toType, toBankId, toCustomId, loanType]);

  const handleQuickAdd = async () => {
    if (!onAddMoney || !amount || amount <= 0 || fromType === 'outside') return;
    setQuickAddLoading(true);
    try {
      const bank = fromType === 'bank' ? banks.find(b => b.id === fromBankId) : undefined;
      const customHead = fromType === 'custom' ? customPaymentHeads.find(c => c.id === fromCustomId) : undefined;
      const holderToSave = fromHolder === 'new' ? newFromHolderName.trim() : (fromHolder === 'Unassigned' ? undefined : fromHolder);
      await onAddMoney(
        Number(amount), fromType, false,
        bank?.id, bank?.name, customHead?.id, customHead?.name,
        `Quick top-up for loan from ${lenderName || 'Source'}`,
        holderToSave
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
    if (!user || !amount || amount <= 0 || !loanType) {
      setError('Please enter a valid amount.');
      return;
    }
    if (fromCategory === 'outside' && loanType === 'borrow' && !lenderName.trim()) {
      setError("Please enter the lender's name.");
      return;
    }
    if (fromType === 'bank' && !fromBankId) { setError('Please select the source bank.'); return; }
    if (fromType === 'custom' && !fromCustomId) { setError('Please select the source custom wallet.'); return; }
    if (fromType !== 'outside' && fromHolder === 'new' && !newFromHolderName.trim()) { setError('Please enter the new person name.'); return; }
    if (toCategory === 'outside' && loanType === 'lend' && !borrowerName.trim()) {
      setError("Please enter the borrower's name.");
      return;
    }
    if (toType === 'bank' && !toBankId) { setError('Please select the destination bank.'); return; }
    if (toType === 'custom' && !toCustomId) { setError('Please select the destination custom wallet.'); return; }
    if (toType !== 'outside' && toType !== 'immediate_expended' && toHolder === 'new' && !newToHolderName.trim()) { setError('Please enter the new person name.'); return; }
    if (isFromLocked) {
      setError('The selected source is locked. Unlock it in Account Breakdown to record this loan.');
      return;
    }

    setError('');

    try {
      setLocalSaving(true);

      const fromBank = fromType === 'bank' ? banks.find(b => b.id === fromBankId) : undefined;
      const fromCustom = fromType === 'custom' ? customPaymentHeads.find(c => c.id === fromCustomId) : undefined;
      const toBank = toType === 'bank' ? banks.find(b => b.id === toBankId) : undefined;
      const toCustom = toType === 'custom' ? customPaymentHeads.find(c => c.id === toCustomId) : undefined;

      const fromHolderToSave = fromHolder === 'new' ? newFromHolderName.trim() : (fromHolder === 'Unassigned' ? undefined : fromHolder);
      const toHolderToSave = toHolder === 'new' ? newToHolderName.trim() : (toHolder === 'Unassigned' ? undefined : toHolder);

      // Determine display names
      let lenderDispName = 'Outside';
      if (fromType === 'outside') {
        lenderDispName = lenderName.trim() || 'Outside Lender';
      } else if (fromType === 'bank' && fromBank) {
        lenderDispName = `Bank (${fromBank.name})`;
      } else if (fromType === 'custom' && fromCustom) {
        lenderDispName = `Wallet (${fromCustom.name})`;
      } else {
        lenderDispName = fromType.replace('_', ' ');
      }

      let borrowerDispName = 'Outside';
      if (toType === 'outside') {
        borrowerDispName = borrowerName.trim() || 'Outside Borrower';
      } else if (toType === 'immediate_expended') {
        borrowerDispName = 'Spent Immediately';
      } else if (toType === 'bank' && toBank) {
        borrowerDispName = `Bank (${toBank.name})`;
      } else if (toType === 'custom' && toCustom) {
        borrowerDispName = `Wallet (${toCustom.name})`;
      } else {
        borrowerDispName = toType.replace('_', ' ');
      }

      const counterparty = loanType === 'borrow' ? lenderDispName : borrowerDispName;

      const record: Omit<LoanRecord, 'id' | 'createdAt'> & {
        fromSource: string; fromSourceName: string;
        fromSourceBankId?: string | null; fromSourceCustomId?: string | null; fromSourceHolder?: string | null;
        toSource: string; toSourceName: string;
        toSourceBankId?: string | null; toSourceCustomId?: string | null; toSourceHolder?: string | null;
      } = {
        userId: user.uid,
        amount: Number(amount),
        type: loanType,
        counterparty,
        // Fix: use null instead of undefined to avoid Firestore error
        dueDate: dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
        note: note.trim(),
        isSettled: false,
        fromSource: fromType,
        fromSourceName: lenderDispName,
        fromSourceBankId: fromType === 'bank' ? fromBankId : null,
        fromSourceCustomId: fromType === 'custom' ? fromCustomId : null,
        fromSourceHolder: fromHolderToSave || null,
        toSource: toType,
        toSourceName: borrowerDispName,
        toSourceBankId: toType === 'bank' ? toBankId : null,
        toSourceCustomId: toType === 'custom' ? toCustomId : null,
        toSourceHolder: toHolderToSave || null,
      };

      // fetch snapshot
      const snapshotRef = doc(db, 'totalCashSnapshots', user.uid);
      const snapshotSnap = await getDoc(snapshotRef);
      const dbSnapshot: TotalCashSnapshot = snapshotSnap.exists()
        ? (snapshotSnap.data() as TotalCashSnapshot)
        : {
            userId: user.uid,
            sources: { in_hand: 0, bank: {}, easypaisa: 0, jazzcash: 0, other: 0, custom: {} },
            heldBy: {}, totalAmount: 0, freezeAmount: 0,
            createdAt: new Date(), updatedAt: new Date(),
          };

      if (typeof dbSnapshot.sources.bank === 'number') dbSnapshot.sources.bank = { Default: dbSnapshot.sources.bank };
      if (typeof dbSnapshot.sources.custom === 'number') dbSnapshot.sources.custom = { Default: dbSnapshot.sources.custom };
      if (!dbSnapshot.sources.custom) dbSnapshot.sources.custom = {};
      if (!dbSnapshot.heldBy) dbSnapshot.heldBy = {};

      const updatedSources = { ...dbSnapshot.sources };
      const updatedHeldBy = { ...dbSnapshot.heldBy };
      let newTotal = dbSnapshot.totalAmount;

      // 1. Check balance & Deduct from source if existing source
      if (fromType !== 'outside') {
        const fromKey = getSourceKey(fromType, fromBank?.name, fromCustom?.name);
        const fromAvailableAmt =
          fromType === 'bank' && fromBank?.name
            ? (updatedSources.bank[fromBank.name] ?? 0)
            : fromType === 'custom' && fromCustom?.name
              ? (updatedSources.custom[fromCustom.name] ?? 0)
              : ((updatedSources[fromType] as number) ?? 0);

        const fromHolders = updatedHeldBy[fromKey] || [];
        if (fromHolders.length > 0) {
          const holdersSum = fromHolders.reduce((s, h) => s + h.amount, 0);
          const unassignedAmt = fromAvailableAmt - holdersSum;
          if (!fromHolderToSave) {
            if (amount > unassignedAmt) {
              setInsufficientFunds(true);
              throw new Error(`Insufficient unassigned balance in ${fromType.replace('_', ' ')}`);
            }
          } else {
            const holderAmt = fromHolders.find(h => h.holderName === fromHolderToSave)?.amount || 0;
            if (amount > holderAmt) {
              setInsufficientFunds(true);
              throw new Error(`Insufficient balance for: ${fromHolderToSave}`);
            }
          }
        } else {
          if (amount > fromAvailableAmt) {
            setInsufficientFunds(true);
            throw new Error(`Insufficient balance in ${fromType.replace('_', ' ')}${fromBank?.name ? ` (${fromBank.name})` : ''}`);
          }
        }

        // Perform deduction
        if (fromType === 'bank' && fromBank?.name) {
          updatedSources.bank[fromBank.name] -= amount;
        } else if (fromType === 'custom' && fromCustom?.name) {
          updatedSources.custom[fromCustom.name] -= amount;
        } else {
          (updatedSources[fromType] as number) -= amount;
        }
        newTotal -= amount;

        if (fromHolderToSave) {
          const holders = [...fromHolders];
          const idx = holders.findIndex((h) => h.holderName === fromHolderToSave);
          if (idx > -1) {
            holders[idx] = { ...holders[idx], amount: Math.max(0, holders[idx].amount - amount) };
            updatedHeldBy[fromKey] = holders;
          }
        }
      }

      // 2. Add to destination if existing source
      if (toType !== 'outside' && toType !== 'immediate_expended') {
        const toKey = getSourceKey(toType, toBank?.name, toCustom?.name);
        const toHolders = updatedHeldBy[toKey] || [];

        if (toType === 'bank' && toBank?.name) {
          updatedSources.bank[toBank.name] = (updatedSources.bank[toBank.name] ?? 0) + amount;
        } else if (toType === 'custom' && toCustom?.name) {
          updatedSources.custom[toCustom.name] = (updatedSources.custom[toCustom.name] ?? 0) + amount;
        } else {
          (updatedSources[toType] as number) = ((updatedSources[toType] as number) ?? 0) + amount;
        }
        newTotal += amount;

        if (toHolderToSave) {
          const holders = [...toHolders];
          const idx = holders.findIndex((h) => h.holderName === toHolderToSave);
          if (idx > -1) {
            holders[idx] = { ...holders[idx], amount: holders[idx].amount + amount };
          } else {
            holders.push({ holderName: toHolderToSave, amount });
          }
          updatedHeldBy[toKey] = holders;
        }
      }

      // create loan doc
      const loanRef = await addDoc(collection(db, 'loans'), {
        ...record,
        createdAt: serverTimestamp(),
      });

      // Deduction transaction
      if (fromType !== 'outside') {
        await addDoc(collection(db, 'cashTransactions'), {
          userId: user.uid, amount: record.amount, type: 'deduct', source: fromType,
          category: 'loan',
          note: note.trim() || `Loan Source Deduction - ${counterparty}`,
          referenceId: loanRef.id, createdAt: serverTimestamp(),
          holderName: fromHolderToSave || null,
          ...(fromBank?.id ? { bankId: fromBank.id, BankName: fromBank.name } : {}),
          ...(fromCustom?.id ? { customPaymentHeadId: fromCustom.id, customPaymentHeadName: fromCustom.name } : {}),
        });
      }

      // Addition transaction
      if (toType !== 'outside' && toType !== 'immediate_expended') {
        await addDoc(collection(db, 'cashTransactions'), {
          userId: user.uid, amount: record.amount, type: 'add', source: toType,
          category: 'loan',
          note: note.trim() || `Loan Deposit - ${counterparty}`,
          referenceId: loanRef.id, createdAt: serverTimestamp(),
          holderName: toHolderToSave || null,
          ...(toBank?.id ? { bankId: toBank.id, BankName: toBank.name } : {}),
          ...(toCustom?.id ? { customPaymentHeadId: toCustom.id, customPaymentHeadName: toCustom.name } : {}),
        });
      }

      // If borrowed from outside and spent immediately, still log a transaction event
      if (fromType === 'outside' && toType === 'immediate_expended') {
        await addDoc(collection(db, 'cashTransactions'), {
          userId: user.uid, amount: record.amount, type: 'add', source: 'other',
          category: 'loan',
          note: note.trim() || `Borrow - ${counterparty} (Spent Immediately)`,
          referenceId: loanRef.id, createdAt: serverTimestamp(),
        });
      }

      // update snapshot
      await updateDoc(snapshotRef, {
        sources: updatedSources, heldBy: updatedHeldBy,
        totalAmount: newTotal, updatedAt: serverTimestamp(),
      });

      // reset
      setAmount(''); setDueDate(''); setNote('');
      setLenderName(''); setBorrowerName('');
      setFromType('outside'); setToType('in_hand');
      setFromBankId(''); setFromCustomId(''); setToBankId(''); setToCustomId('');
      setFromHolder('Unassigned'); setNewFromHolderName('');
      setToHolder('Unassigned'); setNewToHolderName('');
      setLoanType(null); setFromCategory('outside'); setToCategory('my_account');
      setShowModal(false);
      onExternalClose?.();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLocalSaving(false);
    }
  };

  // Get source label for insufficient-funds button
  const getSourceLabel = () => {
    if (fromType === 'bank') { const b = banks.find(b => b.id === fromBankId); return b ? `Bank (${b.name})` : 'Bank'; }
    if (fromType === 'custom') { const h = customPaymentHeads.find(c => c.id === fromCustomId); return h ? h.name : 'Custom Wallet'; }
    return fromType.replace('_', ' ');
  };

  // Balance & holders for rendering
  let fromAvailable = 0;
  if (fromType !== 'outside') {
    if (fromType === 'bank' && fromBankId) {
      const bName = banks.find((b) => b.id === fromBankId)?.name;
      fromAvailable = bName ? snapshot.sources.bank?.[bName] ?? 0 : 0;
    } else if (fromType === 'custom' && fromCustomId) {
      const cName = customPaymentHeads.find((c) => c.id === fromCustomId)?.name;
      fromAvailable = cName ? snapshot.sources.custom?.[cName] ?? 0 : 0;
    } else if (fromType !== 'bank' && fromType !== 'custom') {
      fromAvailable = (snapshot.sources[fromType] as number) ?? 0;
    }
  }

  const fromBankName = banks.find((b) => b.id === fromBankId)?.name;
  const fromCustomName = customPaymentHeads.find((c) => c.id === fromCustomId)?.name;
  const fromSourceKey = fromType !== 'outside'
    ? getSourceKey(fromType as import('@/app/lib/interface').TransactionSource, fromBankName, fromCustomName)
    : '';
  const isFromLocked = fromType !== 'outside' && snapshot.sourceOwnership?.[fromSourceKey]?.isLocked;
  const fromExistingHolders = fromType !== 'outside' ? (snapshot.heldBy?.[fromSourceKey] || []) : [];

  const toBankName = banks.find((b) => b.id === toBankId)?.name;
  const toCustomName = customPaymentHeads.find((c) => c.id === toCustomId)?.name;
  const toSourceKey = (toType !== 'outside' && toType !== 'immediate_expended')
    ? getSourceKey(toType as import('@/app/lib/interface').TransactionSource, toBankName, toCustomName)
    : '';
  const toExistingHolders = (toType !== 'outside' && toType !== 'immediate_expended') ? (snapshot.heldBy?.[toSourceKey] || []) : [];

  const handleClose = () => {
    if (localSaving) return;
    setShowModal(false);
    onExternalClose?.();
    setLoanType(null);
    setFromCategory('outside');
    setToCategory('my_account');
  };

  // Reusable account type selector options — must be an array (not Fragment) for MUI Select
  const accountMenuItems = [
    <MenuItem key="in_hand" value="in_hand">💵 Cash in Hand</MenuItem>,
    <MenuItem key="bank" value="bank">🏦 Bank Account</MenuItem>,
    <MenuItem key="easypaisa" value="easypaisa">📱 EasyPaisa</MenuItem>,
    <MenuItem key="jazzcash" value="jazzcash">📱 JazzCash</MenuItem>,
    <MenuItem key="other" value="other">💼 Other</MenuItem>,
    <MenuItem key="custom" value="custom">🗂️ Custom Wallet</MenuItem>,
  ];

  const headerGradient = loanType === 'borrow'
    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    : loanType === 'lend'
      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      : 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)';

  return (
    <>
      <Dialog
        open={showModal}
        onClose={handleClose}
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
        {/* ── Dialog Header ── */}
        <Box sx={{
          background: headerGradient,
          p: 2.5,
          color: 'white',
          position: 'relative',
          transition: 'background 0.4s ease',
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {loanType !== null && (
              <IconButton
                onClick={() => handleLoanTypeChange(null)}
                size="small"
                sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            )}
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', width: 36, height: 36 }}>
              <SwapIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="900" sx={{ lineHeight: 1.2 }}>
                {loanType === 'borrow' ? 'Borrow Money' : loanType === 'lend' ? 'Lend Money' : 'Record a Loan'}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>
                {loanType === null
                  ? 'What kind of transaction is this?'
                  : loanType === 'borrow'
                    ? 'Someone gives you money to pay back later'
                    : 'You give money to someone to receive back later'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', right: 12, top: 12 }}>
            <Link href="/finance/loans" passHref>
              <IconButton
                size="small"
                onClick={() => setShowModal(false)}
                title="View All Loan Records"
                sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.15)' } }}
              >
                <ArrowForwardIcon fontSize="small" />
              </IconButton>
            </Link>
            <IconButton
              onClick={handleClose}
              size="small"
              sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        {/* ── STEP 1: Type Selection ── */}
        {loanType === null && (
          <DialogContent sx={{ px: 3, py: 3 }}>
            <Stack spacing={2.5}>
              <Typography variant="body2" color="text.secondary" fontWeight={600} textAlign="center">
                Choose what you want to record:
              </Typography>

              <Stack direction="row" spacing={2}>
                {/* Borrow Card */}
                <Box
                  onClick={() => handleLoanTypeChange('borrow')}
                  sx={{
                    flex: 1, p: 2.5, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
                    border: `2px solid ${isDark ? 'rgba(245,158,11,0.3)' : '#fde68a'}`,
                    bgcolor: isDark ? 'rgba(245,158,11,0.07)' : '#fffbeb',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      border: '2px solid #f59e0b',
                      transform: 'translateY(-3px)',
                      boxShadow: '0 8px 20px rgba(245,158,11,0.2)',
                    },
                  }}
                >
                  <Typography fontSize="2.2rem" mb={0.5}>🤲</Typography>
                  <Typography fontWeight={900} fontSize="1.05rem" color="#d97706">Borrow</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mt={0.5}>
                    Someone gives you money
                  </Typography>
                </Box>

                {/* Lend Card */}
                <Box
                  onClick={() => handleLoanTypeChange('lend')}
                  sx={{
                    flex: 1, p: 2.5, borderRadius: 3, cursor: 'pointer', textAlign: 'center',
                    border: `2px solid ${isDark ? 'rgba(16,185,129,0.3)' : '#a7f3d0'}`,
                    bgcolor: isDark ? 'rgba(16,185,129,0.07)' : '#ecfdf5',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      border: '2px solid #10b981',
                      transform: 'translateY(-3px)',
                      boxShadow: '0 8px 20px rgba(16,185,129,0.2)',
                    },
                  }}
                >
                  <Typography fontSize="2.2rem" mb={0.5}>🤝</Typography>
                  <Typography fontWeight={900} fontSize="1.05rem" color="#059669">Lend</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mt={0.5}>
                    You give money to someone
                  </Typography>
                </Box>
              </Stack>

              <Box sx={{ textAlign: 'center', pt: 0.5 }}>
                <Link href="/finance/loans" passHref>
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 13 }} />}
                    onClick={() => setShowModal(false)}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}
                  >
                    View existing loan records
                  </Button>
                </Link>
              </Box>
            </Stack>
          </DialogContent>
        )}

        {/* ── STEP 2: Form (shown after type selected) ── */}
        {loanType !== null && (
          <>
            <DialogContent sx={{ px: 3, py: 2.5 }}>
              <Stack spacing={2}>

                {/* Amount */}
                <TextField
                  fullWidth size="small"
                  label="Amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'text.secondary' }}>PKR</Typography>
                      </InputAdornment>
                    ),
                  }}
                  placeholder="0.00"
                  autoFocus
                />

                {/* ══ BORROW FORM ══ */}
                {loanType === 'borrow' && (
                  <>
                    {/* FROM — who gave the money */}
                    <Box>
                      <Typography variant="caption" fontWeight={800} color="text.secondary"
                        sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Who gave you this money?
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        {[
                          { val: 'outside', label: 'Outside Person', emoji: '👤' },
                          { val: 'my_account', label: 'My Own Account', emoji: '🏦' },
                        ].map((opt) => (
                          <Box
                            key={opt.val}
                            onClick={() => {
                              setFromCategory(opt.val as 'outside' | 'my_account');
                              setFromType(opt.val === 'outside' ? 'outside' : 'in_hand');
                              setFromBankId(''); setFromCustomId(''); setFromHolder('Unassigned'); setNewFromHolderName(''); setLenderName('');
                            }}
                            sx={{
                              flex: 1, p: 1.5, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                              border: `2px solid ${fromCategory === opt.val ? '#f59e0b' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                              bgcolor: fromCategory === opt.val ? (isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb') : 'transparent',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Typography fontSize="1.3rem">{opt.emoji}</Typography>
                            <Typography variant="caption" fontWeight={700} display="block">{opt.label}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>

                    {/* Outside — Lender name */}
                    {fromCategory === 'outside' && (
                      <TextField
                        fullWidth size="small"
                        label="Lender's Name"
                        value={lenderName}
                        onChange={(e) => setLenderName(e.target.value)}
                        placeholder="e.g. Uncle Ali, a friend, XYZ Bank"
                        InputProps={{ startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> }}
                      />
                    )}

                    {/* My account — pickers */}
                    {fromCategory === 'my_account' && (
                      <Stack spacing={1.5}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Account Type</InputLabel>
                          <Select value={fromType} label="Account Type"
                            onChange={(e) => { setFromType(e.target.value as TransactionSource); setFromBankId(''); setFromCustomId(''); setFromHolder('Unassigned'); }}>
                            {accountMenuItems}
                          </Select>
                        </FormControl>
                        {fromType === 'bank' && (
                          <FormControl fullWidth size="small">
                            <InputLabel>Select Bank</InputLabel>
                            <Select value={fromBankId} label="Select Bank" startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}
                              onChange={(e) => { setFromBankId(e.target.value); setFromHolder('Unassigned'); }}>
                              {banks.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                            </Select>
                          </FormControl>
                        )}
                        {fromType === 'custom' && (
                          <FormControl fullWidth size="small">
                            <InputLabel>Select Custom Wallet</InputLabel>
                            <Select value={fromCustomId} label="Select Custom Wallet" startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}
                              onChange={(e) => { setFromCustomId(e.target.value); setFromHolder('Unassigned'); }}>
                              {customPaymentHeads.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                            </Select>
                          </FormControl>
                        )}
                        {fromExistingHolders.length > 0 && (
                          <FormControl fullWidth size="small">
                            <InputLabel>Paid by (optional)</InputLabel>
                            <Select value={fromHolder} label="Paid by (optional)" onChange={(e) => setFromHolder(e.target.value)}>
                              <MenuItem value="Unassigned">Self ({formatCurrency(fromAvailable - fromExistingHolders.reduce((s, h) => s + h.amount, 0), 'PKR')})</MenuItem>
                              {fromExistingHolders.map((h) => <MenuItem key={h.holderName} value={h.holderName}>{h.holderName} ({formatCurrency(h.amount, 'PKR')})</MenuItem>)}
                              <MenuItem value="new"><em>+ Add new person</em></MenuItem>
                            </Select>
                          </FormControl>
                        )}
                        {fromHolder === 'new' && (
                          <TextField fullWidth size="small" label="New Person Name" value={newFromHolderName} onChange={(e) => setNewFromHolderName(e.target.value)} placeholder="e.g. Ali" />
                        )}
                        {isFromLocked && (
                          <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="error.main" fontWeight="bold">
                              🔒 This source is locked. Unlock it in Account Breakdown to use it.
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    )}

                    {/* TO — where money went */}
                    <Box>
                      <Typography variant="caption" fontWeight={800} color="text.secondary"
                        sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Where did this money go?
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {[
                          { val: 'my_account', label: 'My Account', emoji: '🏦' },
                          { val: 'immediate_expended', label: 'Spent Right Away', emoji: '💸' },
                          { val: 'outside', label: 'Outside Entity', emoji: '🏢' },
                        ].map((opt) => (
                          <Box
                            key={opt.val}
                            onClick={() => {
                              setToCategory(opt.val as typeof toCategory);
                              if (opt.val === 'immediate_expended') setToType('immediate_expended');
                              else if (opt.val === 'outside') setToType('outside');
                              else setToType('in_hand');
                              setToBankId(''); setToCustomId(''); setToHolder('Unassigned'); setNewToHolderName(''); setBorrowerName('');
                            }}
                            sx={{
                              flex: '1 1 28%', p: 1.2, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                              border: `2px solid ${toCategory === opt.val ? '#0ea5e9' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                              bgcolor: toCategory === opt.val ? (isDark ? 'rgba(14,165,233,0.1)' : '#f0f9ff') : 'transparent',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Typography fontSize="1.1rem">{opt.emoji}</Typography>
                            <Typography variant="caption" fontWeight={700} display="block" sx={{ fontSize: '0.68rem' }}>{opt.label}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>

                    {/* Spent Immediately notice */}
                    {toCategory === 'immediate_expended' && (
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: isDark ? 'rgba(239,68,68,0.07)' : '#fef2f2', border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : '#fee2e2'}` }}>
                        <Typography variant="caption" color="error" fontWeight={700}>
                          💸 This money was spent immediately — it will not be added to your wallet balance.
                        </Typography>
                      </Box>
                    )}

                    {/* Outside entity note */}
                    {toCategory === 'outside' && (
                      <TextField fullWidth size="small" label="Where did it go? (optional)" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="e.g. Shop name, person"
                        InputProps={{ startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> }} />
                    )}

                    {/* My Account — destination pickers */}
                    {toCategory === 'my_account' && (
                      <Stack spacing={1.5}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Deposit Into</InputLabel>
                          <Select value={toType} label="Deposit Into"
                            onChange={(e) => { setToType(e.target.value as TransactionSource); setToBankId(''); setToCustomId(''); setToHolder('Unassigned'); }}>
                            {accountMenuItems}
                          </Select>
                        </FormControl>
                        {toType === 'bank' && (
                          <FormControl fullWidth size="small">
                            <InputLabel>Select Bank</InputLabel>
                            <Select value={toBankId} label="Select Bank" startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}
                              onChange={(e) => { setToBankId(e.target.value); setToHolder('Unassigned'); }}>
                              {banks.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                            </Select>
                          </FormControl>
                        )}
                        {toType === 'custom' && (
                          <FormControl fullWidth size="small">
                            <InputLabel>Select Custom Wallet</InputLabel>
                            <Select value={toCustomId} label="Select Custom Wallet" startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}
                              onChange={(e) => { setToCustomId(e.target.value); setToHolder('Unassigned'); }}>
                              {customPaymentHeads.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                            </Select>
                          </FormControl>
                        )}
                        {toExistingHolders.length > 0 && (
                          <FormControl fullWidth size="small">
                            <InputLabel>For person (optional)</InputLabel>
                            <Select value={toHolder} label="For person (optional)" onChange={(e) => setToHolder(e.target.value)}>
                              <MenuItem value="Unassigned">Self</MenuItem>
                              {toExistingHolders.map((h) => <MenuItem key={h.holderName} value={h.holderName}>{h.holderName}</MenuItem>)}
                              <MenuItem value="new"><em>+ Add new person</em></MenuItem>
                            </Select>
                          </FormControl>
                        )}
                        {toHolder === 'new' && (
                          <TextField fullWidth size="small" label="New Person Name" value={newToHolderName} onChange={(e) => setNewToHolderName(e.target.value)} placeholder="e.g. Ali" />
                        )}
                      </Stack>
                    )}
                  </>
                )}

                {/* ══ LEND FORM ══ */}
                {loanType === 'lend' && (
                  <>
                    {/* FROM — where money came from */}
                    <Box>
                      <Typography variant="caption" fontWeight={800} color="text.secondary"
                        sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Where is this money coming from?
                      </Typography>
                      <Stack spacing={1.5}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Account Type</InputLabel>
                          <Select value={fromType} label="Account Type"
                            onChange={(e) => { setFromType(e.target.value as TransactionSource); setFromBankId(''); setFromCustomId(''); setFromHolder('Unassigned'); }}>
                            {accountMenuItems}
                          </Select>
                        </FormControl>
                        {fromType === 'bank' && (
                          <FormControl fullWidth size="small">
                            <InputLabel>Select Bank</InputLabel>
                            <Select value={fromBankId} label="Select Bank" startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}
                              onChange={(e) => { setFromBankId(e.target.value); setFromHolder('Unassigned'); }}>
                              {banks.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                            </Select>
                          </FormControl>
                        )}
                        {fromType === 'custom' && (
                          <FormControl fullWidth size="small">
                            <InputLabel>Select Custom Wallet</InputLabel>
                            <Select value={fromCustomId} label="Select Custom Wallet" startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}
                              onChange={(e) => { setFromCustomId(e.target.value); setFromHolder('Unassigned'); }}>
                              {customPaymentHeads.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                            </Select>
                          </FormControl>
                        )}
                        {fromExistingHolders.length > 0 && (
                          <FormControl fullWidth size="small">
                            <InputLabel>Deduct from person (optional)</InputLabel>
                            <Select value={fromHolder} label="Deduct from person (optional)" onChange={(e) => setFromHolder(e.target.value)}>
                              <MenuItem value="Unassigned">Self ({formatCurrency(fromAvailable - fromExistingHolders.reduce((s, h) => s + h.amount, 0), 'PKR')})</MenuItem>
                              {fromExistingHolders.map((h) => <MenuItem key={h.holderName} value={h.holderName}>{h.holderName} ({formatCurrency(h.amount, 'PKR')})</MenuItem>)}
                              <MenuItem value="new"><em>+ Add new person</em></MenuItem>
                            </Select>
                          </FormControl>
                        )}
                        {fromHolder === 'new' && (
                          <TextField fullWidth size="small" label="New Person Name" value={newFromHolderName} onChange={(e) => setNewFromHolderName(e.target.value)} placeholder="e.g. Ali" />
                        )}
                        {isFromLocked && (
                          <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="error.main" fontWeight="bold">
                              🔒 This source is locked. Unlock it in Account Breakdown to use it.
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    </Box>

                    {/* TO — who gets the money */}
                    <Box>
                      <Typography variant="caption" fontWeight={800} color="text.secondary"
                        sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Who are you giving this money to?
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        {[
                          { val: 'outside', label: 'Outside Person', emoji: '👤' },
                          { val: 'my_account', label: 'My Own Account', emoji: '🏦' },
                        ].map((opt) => (
                          <Box
                            key={opt.val}
                            onClick={() => {
                              setToCategory(opt.val as 'outside' | 'my_account');
                              setToType(opt.val === 'outside' ? 'outside' : 'in_hand');
                              setToBankId(''); setToCustomId(''); setToHolder('Unassigned'); setNewToHolderName(''); setBorrowerName('');
                            }}
                            sx={{
                              flex: 1, p: 1.5, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                              border: `2px solid ${toCategory === opt.val ? '#10b981' : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                              bgcolor: toCategory === opt.val ? (isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5') : 'transparent',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Typography fontSize="1.3rem">{opt.emoji}</Typography>
                            <Typography variant="caption" fontWeight={700} display="block">{opt.label}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>

                    {/* Borrower name */}
                    {toCategory === 'outside' && (
                      <TextField fullWidth size="small" label="Borrower's Name" value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="e.g. Ahmed, a friend"
                        InputProps={{ startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> }} />
                    )}

                    {/* To account details */}
                    {toCategory === 'my_account' && (
                      <Stack spacing={1.5}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Deposit Into</InputLabel>
                          <Select value={toType} label="Deposit Into"
                            onChange={(e) => { setToType(e.target.value as TransactionSource); setToBankId(''); setToCustomId(''); setToHolder('Unassigned'); }}>
                            {accountMenuItems}
                          </Select>
                        </FormControl>
                        {toType === 'bank' && (
                          <FormControl fullWidth size="small">
                            <InputLabel>Select Bank</InputLabel>
                            <Select value={toBankId} label="Select Bank" startAdornment={<BankIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}
                              onChange={(e) => { setToBankId(e.target.value); setToHolder('Unassigned'); }}>
                              {banks.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                            </Select>
                          </FormControl>
                        )}
                        {toType === 'custom' && (
                          <FormControl fullWidth size="small">
                            <InputLabel>Select Custom Wallet</InputLabel>
                            <Select value={toCustomId} label="Select Custom Wallet" startAdornment={<WalletIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />}
                              onChange={(e) => { setToCustomId(e.target.value); setToHolder('Unassigned'); }}>
                              {customPaymentHeads.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                            </Select>
                          </FormControl>
                        )}
                        {toExistingHolders.length > 0 && (
                          <FormControl fullWidth size="small">
                            <InputLabel>For person (optional)</InputLabel>
                            <Select value={toHolder} label="For person (optional)" onChange={(e) => setToHolder(e.target.value)}>
                              <MenuItem value="Unassigned">Self</MenuItem>
                              {toExistingHolders.map((h) => <MenuItem key={h.holderName} value={h.holderName}>{h.holderName}</MenuItem>)}
                              <MenuItem value="new"><em>+ Add new person</em></MenuItem>
                            </Select>
                          </FormControl>
                        )}
                        {toHolder === 'new' && (
                          <TextField fullWidth size="small" label="New Person Name" value={newToHolderName} onChange={(e) => setNewToHolderName(e.target.value)} placeholder="e.g. Ali" />
                        )}
                      </Stack>
                    )}
                  </>
                )}

                {/* ── Due Date & Note (shared) ── */}
                <TextField
                  fullWidth size="small"
                  type="date"
                  label="Due Date (optional)"
                  InputLabelProps={{ shrink: true }}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  InputProps={{ startAdornment: <DateIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} /> }}
                />

                <TextField
                  fullWidth size="small"
                  label="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. For rent, borrowed for groceries…"
                  multiline rows={2}
                  InputProps={{ startAdornment: <NoteIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18, mt: 0.5, alignSelf: 'flex-start' }} /> }}
                />

                {/* Error & quick-add button */}
                <Collapse in={!!error || insufficientFunds}>
                  <Box sx={{
                    p: 1.5, borderRadius: 2,
                    bgcolor: insufficientFunds ? (isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2') : 'transparent',
                    border: insufficientFunds ? `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : '#fee2e2'}` : 'none',
                  }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <WarningIcon color="error" sx={{ fontSize: 18 }} />
                        <Typography color="error" variant="caption" fontWeight="bold">{error}</Typography>
                      </Stack>
                      {insufficientFunds && onAddMoney && fromType !== 'outside' && (
                        <Button
                          variant="contained" color="error" size="small" fullWidth
                          onClick={handleQuickAdd} disabled={quickAddLoading}
                          startIcon={quickAddLoading ? <CircularProgress size={14} color="inherit" /> : <AddIcon />}
                          sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 1.5, boxShadow: 'none' }}
                        >
                          {quickAddLoading ? 'Adding Funds...' : `Add ${formatCurrency(Number(amount), 'PKR')} to ${getSourceLabel()}`}
                        </Button>
                      )}
                    </Stack>
                  </Box>
                </Collapse>

              </Stack>
            </DialogContent>

            <DialogActions sx={{
              px: 3, py: 2,
              bgcolor: isDark ? 'rgba(255,255,255,0.01)' : '#fafafa',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0'}`,
            }}>
              <Button onClick={handleClose} sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'none' }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={
                  localSaving || quickAddLoading || !amount || !!isFromLocked ||
                  (fromType === 'bank' && !fromBankId) ||
                  (fromType === 'custom' && !fromCustomId) ||
                  (fromType !== 'outside' && fromHolder === 'new' && !newFromHolderName.trim()) ||
                  (toType === 'bank' && !toBankId) ||
                  (toType === 'custom' && !toCustomId) ||
                  (toType !== 'outside' && toType !== 'immediate_expended' && toHolder === 'new' && !newToHolderName.trim()) ||
                  (fromCategory === 'outside' && loanType === 'borrow' && !lenderName.trim()) ||
                  (toCategory === 'outside' && loanType === 'lend' && !borrowerName.trim())
                }
                sx={{
                  borderRadius: 2, fontWeight: 800, px: 3.5, textTransform: 'none',
                  bgcolor: loanType === 'borrow' ? '#f59e0b' : '#10b981',
                  boxShadow: loanType === 'borrow' ? '0 4px 14px rgba(245,158,11,0.35)' : '0 4px 14px rgba(16,185,129,0.35)',
                  '&:hover': { bgcolor: loanType === 'borrow' ? '#d97706' : '#059669' },
                }}
              >
                {localSaving
                  ? <CircularProgress size={20} color="inherit" />
                  : `Save ${loanType === 'borrow' ? 'Borrow' : 'Lend'} Record`}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}
