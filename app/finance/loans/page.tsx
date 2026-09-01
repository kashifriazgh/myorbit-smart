'use client';

import {
  Box,
  Typography,
  Button,
  Container,
  Card,
  CardContent,
  Chip,
  Stack,
  Skeleton,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Tooltip,
  Fade,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import {
  LoanRecord,
  TransactionSource,
  TotalCashSnapshot,
  CashTransaction,
  Bank,
  CustomPaymentHead,
} from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
  setDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import PaymentIcon from '@mui/icons-material/Payment';
import LockIcon from '@mui/icons-material/LockOutlined';
import LoginIcon from '@mui/icons-material/Login';
import WalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import LoanDialog from '@/app/components/finance/TotalCashSnapshot/LoanRecord';

export default function LoanRecordsPage() {
  const { user, loading: authLoading } = useAuth();
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';
  const [loading, setLoading] = useState(true);
  const [activeLoans, setActiveLoans] = useState<LoanRecord[]>([]);
  const [settledLoans, setSettledLoans] = useState<LoanRecord[]>([]);
  const [totals, setTotals] = useState({ toPay: 0, toReceive: 0 });
  const [snapshot, setSnapshot] = useState<TotalCashSnapshot>({
    userId: user?.uid || '',
    sources: {
      in_hand: 0,
      bank: {},
      easypaisa: 0,
      jazzcash: 0,
      other: 0,
      custom: {},
    },
    heldBy: {},
    totalAmount: 0,
    freezeAmount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(null);
  const [updateAmount, setUpdateAmount] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('in_hand');
  const [selectedHolder, setSelectedHolder] = useState<string>('Unassigned');

  const fetchLoans = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'loans'), where('userId', '==', user.uid));

      const snap = await getDocs(q);

      const loans: LoanRecord[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<LoanRecord, 'id'>),
      }));

      const outstanding = loans.filter((l) => !l.isSettled);
      const settled = loans.filter((l) => l.isSettled);

      setActiveLoans(outstanding);
      setSettledLoans(settled);

      const toPay = outstanding
        .filter((l) => l.type === 'borrow')
        .reduce((sum, l) => sum + ((l.amount ?? 0) - (l.paidAmount ?? 0)), 0);

      const toReceive = outstanding
        .filter((l) => l.type === 'lend')
        .reduce((sum, l) => sum + ((l.amount ?? 0) - (l.paidAmount ?? 0)), 0);

      setTotals({ toPay, toReceive });
    } catch (err) {
      console.error('Error fetching loans:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchLoans();
    }
  }, [user, authLoading, fetchLoans]);

  useEffect(() => {
    const fetchSnapshot = async () => {
      if (!user) return;
      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as TotalCashSnapshot;
        setSnapshot({
          ...data,
          sources: {
            in_hand: data.sources.in_hand ?? 0,
            bank:
              typeof data.sources.bank === 'number'
                ? { Default: data.sources.bank }
                : data.sources.bank || {},
            easypaisa: data.sources.easypaisa ?? 0,
            jazzcash: data.sources.jazzcash ?? 0,
            other: data.sources.other ?? 0,
            custom:
              typeof data.sources.custom === 'number'
                ? { Default: data.sources.custom }
                : data.sources.custom || {},
          },
          heldBy: data.heldBy || {},
        });
      } else {
        const initialSnapshot: TotalCashSnapshot = {
          userId: user.uid,
          sources: {
            in_hand: 0,
            bank: {},
            easypaisa: 0,
            jazzcash: 0,
            other: 0,
            custom: {},
          },
          heldBy: {},
          totalAmount: 0,
          freezeAmount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await setDoc(docRef, initialSnapshot);
        setSnapshot(initialSnapshot);
      }
    };

    fetchSnapshot();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchBanks = async () => {
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched: Bank[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bank, 'id'>) }));
      setBanks(fetched);
    };
    const fetchCustom = async () => {
      const q = query(collection(db, 'customPaymentHeads'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const heads: CustomPaymentHead[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomPaymentHead, 'id'>) }));
      setCustomPaymentHeads(heads);
    };
    fetchBanks();
    fetchCustom();
  }, [user]);

  const handleAddMoney = async (
    amount: number,
    source: TransactionSource,
    isFreezed: boolean,
    bankId?: string,
    bankName?: string,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string,
    note?: string,
  ) => {
    if (!user) return;

    const txn: Omit<CashTransaction, 'id'> = {
      userId: user.uid,
      amount,
      type: isFreezed ? 'freeze_transfer' : 'add',
      source: isFreezed ? 'other' : source,
      category: 'manual',
      note: note || (isFreezed ? 'Freezed addition' : 'Manual addition'),
      createdAt: serverTimestamp() as Timestamp,
    };
    if (bankId && !isFreezed) txn.bankId = bankId;
    if (bankName && !isFreezed) txn.BankName = bankName;
    if (customPaymentHeadId && !isFreezed)
      txn.customPaymentHeadId = customPaymentHeadId;
    if (customPaymentHeadName && !isFreezed)
      txn.customPaymentHeadName = customPaymentHeadName;

    await addDoc(collection(db, 'cashTransactions'), txn);

    const docRef = doc(db, 'totalCashSnapshots', user.uid);
    const docSnap = await getDoc(docRef);
    const data: TotalCashSnapshot = docSnap.exists()
      ? (docSnap.data() as TotalCashSnapshot)
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
          heldBy: {},
          totalAmount: 0,
          freezeAmount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

    const updatedSources: TotalCashSnapshot['sources'] = {
      in_hand: data.sources.in_hand ?? 0,
      bank: data.sources.bank ?? {},
      easypaisa: data.sources.easypaisa ?? 0,
      jazzcash: data.sources.jazzcash ?? 0,
      other: data.sources.other ?? 0,
      custom: data.sources.custom ?? {},
    };

    if (!isFreezed) {
      if (source === 'bank' && bankName) {
        updatedSources.bank[bankName] =
          (updatedSources.bank[bankName] ?? 0) + amount;
      } else if (source === 'custom' && customPaymentHeadName) {
        updatedSources.custom[customPaymentHeadName] =
          (updatedSources.custom[customPaymentHeadName] ?? 0) + amount;
      } else if (source !== 'bank' && source !== 'custom') {
        updatedSources[source] =
          ((updatedSources[source] as number) ?? 0) + amount;
      }
    }

    const updatedSnapshot: TotalCashSnapshot = {
      ...data,
      sources: updatedSources,
      freezeAmount: isFreezed
        ? (data.freezeAmount || 0) + amount
        : data.freezeAmount || 0,
      totalAmount: (data.totalAmount || 0) + amount,
      updatedAt: new Date(),
    };

    await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
  };

  const handleDelete = async () => {
    if (!selectedLoan?.id) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'loans', selectedLoan.id));
      setDeleteDialogOpen(false);
      setSelectedLoan(null);
      fetchLoans();
    } catch (err) {
      console.error('Error deleting loan:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenProgressDialog = async (loan: LoanRecord) => {
    setSelectedLoan(loan);
    setUpdateAmount(loan.paidAmount ? loan.paidAmount.toString() : '0');

    // Determine default source
    let defaultSource = 'in_hand';
    let defaultHolder = 'Unassigned';

    const loanData = (loan as unknown) as Record<string, string>;
    let fromSrc = loanData.fromSource;
    let toSrc = loanData.toSource;
    let fromSrcBankId = loanData.fromSourceBankId;
    let toSrcBankId = loanData.toSourceBankId;
    let fromSrcCustomId = loanData.fromSourceCustomId;
    let toSrcCustomId = loanData.toSourceCustomId;
    let fromSrcHolder = loanData.fromSourceHolder;
    let toSrcHolder = loanData.toSourceHolder;

    // For older loans, fetch from transaction history
    if (!fromSrc && !toSrc) {
      try {
        const q = query(
          collection(db, 'cashTransactions'),
          where('referenceId', '==', loan.id)
        );
        const snap = await getDocs(q);
        const txns = snap.docs.map(doc => doc.data());

        if (loan.type === 'borrow') {
          // Borrow loan means we received money: type === 'add'
          const addTxn = txns.find(t => t.type === 'add');
          if (addTxn) {
            toSrc = addTxn.source;
            toSrcBankId = addTxn.bankId;
            toSrcCustomId = addTxn.customPaymentHeadId;
            toSrcHolder = addTxn.holderName;
          }
        } else if (loan.type === 'lend') {
          // Lend loan means we paid money out: type === 'deduct'
          const deductTxn = txns.find(t => t.type === 'deduct');
          if (deductTxn) {
            fromSrc = deductTxn.source;
            fromSrcBankId = deductTxn.bankId;
            fromSrcCustomId = deductTxn.customPaymentHeadId;
            fromSrcHolder = deductTxn.holderName;
          }
        }
      } catch (err) {
        console.error('Error fetching old transactions:', err);
      }
    }

    if (loan.type === 'lend') {
      if (fromSrc && fromSrc !== 'outside') {
        if (fromSrc === 'bank') {
          const bank = banks.find((b) => b.id === fromSrcBankId || b.name === fromSrc);
          if (bank) defaultSource = `bank:${bank.name}`;
        } else if (fromSrc === 'custom') {
          const custom = customPaymentHeads.find((c) => c.id === fromSrcCustomId || c.name === fromSrc);
          if (custom) defaultSource = `custom:${custom.name}`;
        } else {
          defaultSource = fromSrc;
        }
      }
      if (fromSrcHolder) {
        defaultHolder = fromSrcHolder;
      }
    } else if (loan.type === 'borrow') {
      if (toSrc && toSrc !== 'outside' && toSrc !== 'immediate_expended') {
        if (toSrc === 'bank') {
          const bank = banks.find((b) => b.id === toSrcBankId || b.name === toSrc);
          if (bank) defaultSource = `bank:${bank.name}`;
        } else if (toSrc === 'custom') {
          const custom = customPaymentHeads.find((c) => c.id === toSrcCustomId || c.name === toSrc);
          if (custom) defaultSource = `custom:${custom.name}`;
        } else {
          defaultSource = toSrc;
        }
      }
      if (toSrcHolder) {
        defaultHolder = toSrcHolder;
      }
    }

    setSelectedSource(defaultSource);
    setSelectedHolder(defaultHolder);
    setProgressDialogOpen(true);
  };

  const handleUpdateProgress = async () => {
    alert("Update Progress button clicked! Selected Loan ID: " + selectedLoan?.id + ", Amount entered: " + updateAmount);
    if (!selectedLoan?.id || !updateAmount || !user) {
      alert("Missing required fields. loanId: " + selectedLoan?.id + ", amount: " + updateAmount + ", user: " + !!user);
      return;
    }
    const paidValue = parseFloat(updateAmount);
    if (isNaN(paidValue) || paidValue < 0) {
      alert("Invalid paid value entered: " + updateAmount);
      return;
    }

    setActionLoading(true);
    try {
      const isSettled = paidValue >= selectedLoan.amount;
      const delta = paidValue - (selectedLoan.paidAmount || 0);

      alert("Computed delta: " + delta + ", isSettled: " + isSettled);

      if (delta !== 0) {
        alert("Fetching cash snapshot for user: " + user.uid);
        const docRef = doc(db, 'totalCashSnapshots', user.uid);
        const docSnap = await getDoc(docRef);
        alert("Snapshot fetched. Document exists: " + docSnap.exists());
        
        const snapshotData = docSnap.exists()
          ? (docSnap.data() as TotalCashSnapshot)
          : {
              userId: user.uid,
              sources: { in_hand: 0, bank: {}, easypaisa: 0, jazzcash: 0, other: 0, custom: {} },
              heldBy: {},
              totalAmount: 0,
              freezeAmount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

        const snapshotSources = snapshotData.sources || { in_hand: 0, bank: {}, easypaisa: 0, jazzcash: 0, other: 0, custom: {} };

        const normalizedBank = typeof snapshotSources.bank === 'number'
          ? { Default: snapshotSources.bank }
          : snapshotSources.bank || {};

        const normalizedCustom = typeof snapshotSources.custom === 'number'
          ? { Default: snapshotSources.custom }
          : snapshotSources.custom || {};

        const updatedSources: TotalCashSnapshot['sources'] = {
          in_hand: snapshotSources.in_hand ?? 0,
          bank: normalizedBank,
          easypaisa: snapshotSources.easypaisa ?? 0,
          jazzcash: snapshotSources.jazzcash ?? 0,
          other: snapshotSources.other ?? 0,
          custom: normalizedCustom,
        };

        const updatedHeldBy = snapshotData.heldBy ? { ...snapshotData.heldBy } : {};
        let newTotal = snapshotData.totalAmount ?? 0;

        const [sourceType, subName] = selectedSource.split(':');
        const sourceKey = sourceType === 'bank' ? `bank:${subName}` : sourceType === 'custom' ? `custom:${subName}` : sourceType;
        const holderToSave = selectedHolder === 'Unassigned' ? null : selectedHolder;

        alert("Modifying balances for account type: " + sourceType + ", sub-account: " + subName);

        if (selectedLoan.type === 'borrow') {
          if (sourceType === 'bank' && subName) {
            updatedSources.bank[subName] = (updatedSources.bank[subName] ?? 0) - delta;
          } else if (sourceType === 'custom' && subName) {
            updatedSources.custom[subName] = (updatedSources.custom[subName] ?? 0) - delta;
          } else {
            (updatedSources[sourceType] as number) = ((updatedSources[sourceType] as number) ?? 0) - delta;
          }
          newTotal -= delta;

          if (holderToSave) {
            const holders = [...(updatedHeldBy[sourceKey] || [])];
            const idx = holders.findIndex((h) => h.holderName === holderToSave);
            if (idx > -1) {
              holders[idx] = {
                ...holders[idx],
                amount: Math.max(0, holders[idx].amount - delta),
              };
              updatedHeldBy[sourceKey] = holders;
            }
          }
        } else if (selectedLoan.type === 'lend') {
          if (sourceType === 'bank' && subName) {
            updatedSources.bank[subName] = (updatedSources.bank[subName] ?? 0) + delta;
          } else if (sourceType === 'custom' && subName) {
            updatedSources.custom[subName] = (updatedSources.custom[subName] ?? 0) + delta;
          } else {
            (updatedSources[sourceType] as number) = ((updatedSources[sourceType] as number) ?? 0) + delta;
          }
          newTotal += delta;

          if (holderToSave) {
            const holders = [...(updatedHeldBy[sourceKey] || [])];
            const idx = holders.findIndex((h) => h.holderName === holderToSave);
            if (idx > -1) {
              holders[idx] = {
                ...holders[idx],
                amount: Math.max(0, holders[idx].amount + delta),
              };
            } else {
              holders.push({ holderName: holderToSave, amount: delta });
            }
            updatedHeldBy[sourceKey] = holders;
          }
        }

        const updatedSnapshot: TotalCashSnapshot = {
          ...snapshotData,
          sources: updatedSources,
          heldBy: updatedHeldBy,
          totalAmount: newTotal,
        };

        alert("Saving updated cash snapshot document...");
        await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
        setSnapshot(updatedSnapshot);
        alert("Cash snapshot saved successfully.");

        const bankId = sourceType === 'bank' ? (banks.find(b => b.name === subName)?.id || null) : null;
        const customHeadId = sourceType === 'custom' ? (customPaymentHeads.find(c => c.name === subName)?.id || null) : null;

        const txnType = delta > 0
          ? (selectedLoan.type === 'borrow' ? 'deduct' : 'add')
          : (selectedLoan.type === 'borrow' ? 'add' : 'deduct');

        const absDelta = Math.abs(delta);

        let txnNote = '';
        if (selectedLoan.type === 'borrow') {
          txnNote = delta > 0
            ? `Loan Repayment to ${selectedLoan.counterparty}`
            : `Loan Repayment Revision to ${selectedLoan.counterparty}`;
        } else {
          txnNote = delta > 0
            ? `Loan Recovery from ${selectedLoan.counterparty}`
            : `Loan Recovery Revision from ${selectedLoan.counterparty}`;
        }

        alert("Adding cash transaction audit record...");
        await addDoc(collection(db, 'cashTransactions'), {
          userId: user.uid,
          amount: absDelta,
          type: txnType,
          source: sourceType,
          category: 'loan',
          note: txnNote,
          referenceId: selectedLoan.id,
          holderName: holderToSave || null,
          ...(sourceType === 'bank' ? { bankId: bankId || null, BankName: subName || null } : {}),
          ...(sourceType === 'custom' ? { customPaymentHeadId: customHeadId || null, customPaymentHeadName: subName || null } : {}),
          createdAt: serverTimestamp(),
        });
        alert("Audit record added successfully.");
      }

      alert("Updating loan record status...");
      await updateDoc(doc(db, 'loans', selectedLoan.id), {
        paidAmount: paidValue,
        isSettled,
        updatedAt: new Date(),
      });
      alert("Loan record updated successfully.");

      setProgressDialogOpen(false);
      setSelectedLoan(null);
      setUpdateAmount('');
      fetchLoans();
    } catch (err: unknown) {
      console.error('Error updating progress:', err);
      alert('Error updating progress: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Source options for settlement selection
  const sourceOptions: { value: string; label: string }[] = [];
  sourceOptions.push({ value: 'in_hand', label: '💵 Cash in Hand' });
  sourceOptions.push({ value: 'easypaisa', label: '📱 EasyPaisa' });
  sourceOptions.push({ value: 'jazzcash', label: '📱 JazzCash' });
  sourceOptions.push({ value: 'other', label: '💼 Other' });

  if (snapshot?.sources?.bank) {
    Object.keys(snapshot.sources.bank).forEach((bName) => {
      sourceOptions.push({ value: `bank:${bName}`, label: `🏦 Bank: ${bName}` });
    });
  }

  if (snapshot?.sources?.custom) {
    Object.keys(snapshot.sources.custom).forEach((cName) => {
      sourceOptions.push({ value: `custom:${cName}`, label: `🗂️ Wallet: ${cName}` });
    });
  }

  // Get current selected source's holders
  const [sourceType, subName] = selectedSource.split(':');
  const sourceKey = sourceType === 'bank' ? `bank:${subName}` : sourceType === 'custom' ? `custom:${subName}` : sourceType;
  const currentHolders = snapshot?.heldBy?.[sourceKey] || [];

  // Validation logic
  const getValidationError = () => {
    if (!selectedLoan || !updateAmount) return null;
    const paidValue = parseFloat(updateAmount);
    if (isNaN(paidValue) || paidValue < 0) return "Please enter a valid amount.";
    const delta = paidValue - (selectedLoan.paidAmount || 0);
    if (delta === 0) return null;

    // Check lock
    const isLocked = snapshot?.sourceOwnership?.[sourceKey]?.isLocked;
    if (isLocked) {
      return "The selected source is locked. Unlock it in Account Breakdown to use it.";
    }

    // Get available balance
    let available = 0;
    if (sourceType === 'bank' && subName) {
      available = snapshot.sources.bank?.[subName] ?? 0;
    } else if (sourceType === 'custom' && subName) {
      available = snapshot.sources.custom?.[subName] ?? 0;
    } else if (sourceType !== 'bank' && sourceType !== 'custom') {
      available = (snapshot.sources[sourceType] as number) ?? 0;
    }

    // Determine deduction amount
    let deductAmt = 0;
    if (selectedLoan.type === 'borrow' && delta > 0) {
      deductAmt = delta;
    } else if (selectedLoan.type === 'lend' && delta < 0) {
      deductAmt = Math.abs(delta);
    }

    if (deductAmt > 0) {
      const holders = snapshot.heldBy?.[sourceKey] || [];
      if (holders.length > 0) {
        if (selectedHolder && selectedHolder !== 'Unassigned') {
          const holderAmt = holders.find(h => h.holderName === selectedHolder)?.amount || 0;
          if (deductAmt > holderAmt) {
            return `Insufficient balance for holder ${selectedHolder} (Available: ₨${holderAmt.toLocaleString()})`;
          }
        } else {
          const holdersSum = holders.reduce((s, h) => s + h.amount, 0);
          const unassigned = available - holdersSum;
          if (deductAmt > unassigned) {
            return `Insufficient unassigned balance (Available: ₨${unassigned.toLocaleString()})`;
          }
        }
      } else {
        if (deductAmt > available) {
          return `Insufficient balance in ${selectedSource.replace('bank:', 'Bank (').replace('custom:', 'Wallet (') + (selectedSource.includes(':') ? ')' : '')} (Available: ₨${available.toLocaleString()})`;
        }
      }
    }
    return null;
  };

  const validationError = getValidationError();

  if (authLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
        <Skeleton
          variant="circular"
          width={60}
          height={60}
          sx={{ mx: 'auto', mb: 2 }}
        />
        <Skeleton
          variant="rectangular"
          width="100%"
          height={200}
          sx={{ borderRadius: 4 }}
        />
      </Container>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 10 }}>
        <Fade in={true}>
          <Card
            sx={{
              borderRadius: 6,
              textAlign: 'center',
              p: 4,
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                color: '#3b82f6',
                mx: 'auto',
                mb: 3,
              }}
            >
              <LockIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h5" fontWeight="900" mb={1}>
              Authentication Required
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={4}>
              Please sign in to your account to view and manage your loan
              records securely.
            </Typography>
            <Link href="/auth/signin" passHref>
              <Button
                variant="contained"
                size="large"
                startIcon={<LoginIcon />}
                fullWidth
                sx={{
                  borderRadius: 3,
                  py: 1.5,
                  fontWeight: 800,
                  textTransform: 'none',
                }}
              >
                Sign In Now
              </Button>
            </Link>
          </Card>
        </Fade>
      </Container>
    );
  }

  const formatDate = (date?: Date | Timestamp | null): string => {
    if (!date) return 'N/A';
    if (date instanceof Date) return date.toLocaleDateString();
    if (date instanceof Timestamp) return date.toDate().toLocaleDateString();
    return 'N/A';
  };

  return (
    <Container
      maxWidth="md"
      sx={{
        mt: 4,
        mb: 4,
        py: 4,
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#f1f5f9' : '#000000',
        borderRadius: isDark ? '16px' : '0px',
        minHeight: '100vh',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Link href="/finance" passHref>
            <Button
              startIcon={<ArrowBackIcon />}
              variant="outlined"
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Back
            </Button>
          </Link>
          <Typography variant="h4" fontWeight="bold">
            Loan Records
          </Typography>
        </Box>
        <LoanDialog
          snapshot={snapshot}
          onAddMoney={handleAddMoney}
          onSuccess={fetchLoans}
        />
      </Box>

      {/* Totals Summary */}
      {loading ? (
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Skeleton
            variant="rectangular"
            width="100%"
            height={100}
            sx={{ borderRadius: 4 }}
          />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <Card
            sx={{
              flex: 1,
              minWidth: 200,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
              color: 'white',
              boxShadow: '0 10px 15px -3px rgba(245, 124, 0, 0.3)',
            }}
          >
            <CardContent>
              <Typography
                variant="body2"
                sx={{ opacity: 0.9, fontWeight: 700 }}
              >
                Total To Pay Back
              </Typography>
              <Typography variant="h4" fontWeight="900">
                ₨{totals.toPay.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>

          <Card
            sx={{
              flex: 1,
              minWidth: 200,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
              color: 'white',
              boxShadow: '0 10px 15px -3px rgba(56, 142, 60, 0.3)',
            }}
          >
            <CardContent>
              <Typography
                variant="body2"
                sx={{ opacity: 0.9, fontWeight: 700 }}
              >
                Total To Receive
              </Typography>
              <Typography variant="h4" fontWeight="900">
                ₨{totals.toReceive.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Active Loans */}
      <Box sx={{ mb: 6 }}>
        <Typography
          variant="h6"
          fontWeight="bold"
          mb={2}
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <WalletIcon sx={{ color: '#3b82f6' }} /> Active Loans (
          {activeLoans.length})
        </Typography>

        {loading ? (
          <Stack spacing={2}>
            {[1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                height={100}
                sx={{ borderRadius: 4 }}
              />
            ))}
          </Stack>
        ) : activeLoans.length === 0 ? (
          <Card
            sx={{
              borderRadius: 4,
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
              border: '1px dashed #cbd5e1',
            }}
          >
            <CardContent>
              <Typography
                color="text.secondary"
                textAlign="center"
                py={4}
                fontWeight="600"
              >
                No active loans found.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {activeLoans.map((loan) => {
              const paid = loan.paidAmount || 0;
              const progress = Math.min((paid / loan.amount) * 100, 100);

              return (
                <Card
                  key={loan.id}
                  elevation={0}
                  sx={{
                    borderRadius: 4,
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`,
                    backgroundColor: isDark
                      ? loan.type === 'borrow'
                        ? 'rgba(255, 152, 0, 0.05)'
                        : 'rgba(76, 175, 80, 0.05)'
                      : loan.type === 'borrow'
                        ? '#fff3e0'
                        : '#f0fdf4',
                    position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: isDark
                        ? '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                        : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      borderColor:
                        loan.type === 'borrow' ? '#ff9800' : '#4caf50',
                    },
                  }}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 2,
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            mb: 1,
                          }}
                        >
                          <Typography variant="h6" fontWeight="900">
                            {loan.counterparty}
                          </Typography>
                          <Chip
                            label={loan.type === 'borrow' ? 'Borrow' : 'Lend'}
                            size="small"
                            sx={{
                              fontWeight: 800,
                              bgcolor:
                                loan.type === 'borrow' ? '#ff9800' : '#4caf50',
                              color: 'white',
                              fontSize: '0.7rem',
                            }}
                          />
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          fontWeight="700"
                        >
                          {loan.type === 'borrow' ? 'RECEIVED FROM' : 'LENT TO'}{' '}
                          • DUE: {formatDate(loan.dueDate)}
                        </Typography>
                        {loan.note && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            mt={1}
                            sx={{ fontStyle: 'italic', opacity: 0.8 }}
                          >
                            &quot;{loan.note}&quot;
                          </Typography>
                        )}

                        <Box sx={{ mt: 3, mb: 1 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              mb: 1,
                            }}
                          >
                            <Typography
                              variant="caption"
                              fontWeight="800"
                              color="text.secondary"
                            >
                              PROGRESS: ₨{paid.toLocaleString()} / ₨
                              {loan.amount.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" fontWeight="900">
                              {Math.round(progress)}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              bgcolor: isDark
                                ? 'rgba(0,0,0,0.2)'
                                : 'rgba(0,0,0,0.05)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                bgcolor:
                                  loan.type === 'borrow'
                                    ? '#ff9800'
                                    : '#4caf50',
                              },
                            }}
                          />
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 1.5,
                        }}
                      >
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="h5" fontWeight="900">
                            ₨{(loan.amount - paid).toLocaleString()}
                          </Typography>
                          <Typography
                            variant="caption"
                            fontWeight="800"
                            color="text.secondary"
                          >
                            REMAINING
                          </Typography>
                        </Box>

                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Update Progress / Settle">
                            <IconButton
                              onClick={() => {
                                handleOpenProgressDialog(loan);
                              }}
                              sx={{
                                bgcolor: isDark ? '#1e293b' : '#ffffff',
                                boxShadow: 2,
                                '&:hover': {
                                  bgcolor: '#3b82f6',
                                  color: 'white',
                                },
                              }}
                            >
                              <PaymentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Record">
                            <IconButton
                              color="error"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setDeleteDialogOpen(true);
                              }}
                              sx={{
                                bgcolor: isDark ? '#1e293b' : '#ffffff',
                                boxShadow: 2,
                                '&:hover': {
                                  bgcolor: '#ef4444',
                                  color: 'white',
                                },
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Settled Loans */}
      {settledLoans.length > 0 && (
        <Box>
          <Typography
            variant="h6"
            fontWeight="bold"
            mb={2}
            sx={{ opacity: 0.6 }}
          >
            Settled Loans ({settledLoans.length})
          </Typography>
          <Stack spacing={2}>
            {settledLoans.map((loan) => (
              <Card
                key={loan.id}
                elevation={0}
                sx={{
                  opacity: 0.8,
                  borderRadius: 4,
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.02)'
                    : '#f8fafc',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`,
                }}
              >
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight="800">
                        {loan.counterparty}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight="700"
                      >
                        {loan.type === 'borrow' ? 'BORROWED' : 'LENT'} • SETTLED
                        ON {formatDate(loan.updatedAt || loan.dueDate)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography
                          variant="subtitle1"
                          fontWeight="900"
                          sx={{ textDecoration: 'line-through', opacity: 0.5 }}
                        >
                          ₨{loan.amount?.toLocaleString()}
                        </Typography>
                        <Chip
                          label="SETTLED"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.6rem',
                            fontWeight: 900,
                            bgcolor: '#94a3b8',
                            color: 'white',
                          }}
                        />
                      </Box>
                      <Tooltip title="Delete Record">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setSelectedLoan(loan);
                            setDeleteDialogOpen(true);
                          }}
                          sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* Update Progress Dialog */}
      <Dialog
        open={progressDialogOpen}
        onClose={() => !actionLoading && setProgressDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 5 } }}
      >
        <DialogTitle sx={{ fontWeight: '900', pt: 3 }}>
          Update Loan Progress
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}
          >
            <Typography variant="body2" color="text.secondary" fontWeight="600">
              Enter the total amount that has been{' '}
              {selectedLoan?.type === 'borrow' ? 'repaid' : 'recovered'} to
              date.
            </Typography>
            <Box
              sx={{
                p: 2,
                bgcolor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                borderRadius: 3,
                border: '1px solid #3b82f6',
              }}
            >
              <Typography
                variant="caption"
                color="primary"
                fontWeight="800"
                display="block"
                mb={0.5}
              >
                ORIGINAL LOAN AMOUNT
              </Typography>
              <Typography variant="h5" fontWeight="900" color="primary">
                ₨{selectedLoan?.amount.toLocaleString()}
              </Typography>
            </Box>
            <TextField
              fullWidth
              label="Total Paid Amount"
              type="number"
              value={updateAmount}
              onChange={(e) => setUpdateAmount(e.target.value)}
              placeholder="0.00"
              InputProps={{
                startAdornment: (
                  <Typography sx={{ mr: 1, fontWeight: 900 }}>₨</Typography>
                ),
              }}
              disabled={actionLoading}
              autoFocus
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />

            {/* Source Selection */}
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel>Source Account</InputLabel>
              <Select
                value={selectedSource}
                label="Source Account"
                disabled={actionLoading}
                onChange={(e) => {
                  setSelectedSource(e.target.value);
                  setSelectedHolder('Unassigned');
                }}
              >
                {sourceOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Holder Selection (conditional) */}
            {currentHolders.length > 0 && (
              <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                <InputLabel>Assign to Holder</InputLabel>
                <Select
                  value={selectedHolder}
                  label="Assign to Holder"
                  disabled={actionLoading}
                  onChange={(e) => setSelectedHolder(e.target.value)}
                >
                  <MenuItem value="Unassigned">Self</MenuItem>
                  {currentHolders.map((h) => (
                    <MenuItem key={h.holderName} value={h.holderName}>
                      {h.holderName} (₨{h.amount.toLocaleString()})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Validation Error Banner */}
            <Collapse in={!!validationError}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(239, 68, 68, 0.08)',
                  border: '1.5px solid rgba(239, 68, 68, 0.25)',
                }}
              >
                <Typography color="error" variant="caption" fontWeight="bold">
                  ⚠️ {validationError}
                </Typography>
              </Box>
            </Collapse>

            {selectedLoan &&
              parseFloat(updateAmount) >= selectedLoan.amount && !validationError && (
                <Chip
                  label="This will mark the loan as Settled"
                  color="success"
                  size="small"
                  sx={{ alignSelf: 'flex-start', fontWeight: 800 }}
                />
              )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => setProgressDialogOpen(false)}
            disabled={actionLoading}
            sx={{ fontWeight: 800 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateProgress}
            disabled={
              actionLoading ||
              !updateAmount ||
              isNaN(parseFloat(updateAmount)) ||
              !!validationError
            }
            sx={{
              borderRadius: 3,
              px: 4,
              fontWeight: 900,
              textTransform: 'none',
            }}
          >
            {actionLoading ? 'Updating...' : 'Update Progress'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !actionLoading && setDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 5 } }}
      >
        <DialogTitle sx={{ fontWeight: '900', pt: 3 }}>
          Delete Record?
        </DialogTitle>
        <DialogContent>
          <Typography fontWeight="600" color="text.secondary">
            Are you sure you want to permanently delete this loan record? This
            action cannot be reversed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={actionLoading}
            sx={{ fontWeight: 800 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={actionLoading}
            sx={{
              borderRadius: 3,
              px: 4,
              fontWeight: 900,
              textTransform: 'none',
            }}
          >
            {actionLoading ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
