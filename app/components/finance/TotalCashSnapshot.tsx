'use client';

import { Box, Typography, CircularProgress, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  TotalCashSnapshot,
  TransactionSource,
  Bank,
  CashTransaction,
} from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { formatCurrency } from '@/app/lib/utilts';
import AccountBreakdown from './TotalCashSnapshot/AccountBreakdown';
import FreezeTransfer from './TotalCashSnapshot/FreezeTransfer';
import AddMoney from './TotalCashSnapshot/AddMoney';
import DeductMoney from './TotalCashSnapshot/DeductMoney';
import LoanDialog from './TotalCashSnapshot/LoanRecord';

export default function TotalCashSnapshotComponent({
  userId,
}: {
  userId: string;
  banks?: Bank[];
}) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [snapshot, setSnapshot] = useState<TotalCashSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFreeze, setShowFreeze] = useState(false);

  const currency = 'PKR';

  useEffect(() => {
    const fetchSnapshot = async () => {
      setLoading(true);
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as TotalCashSnapshot;

        // 🔥 normalize bank field
        let normalizedBank: Record<string, number> = {};
        if (typeof data.sources.bank === 'number') {
          normalizedBank = { Default: data.sources.bank }; // migrate old number into object
        } else {
          normalizedBank = data.sources.bank || {};
        }

        // 🔥 normalize custom field
        let normalizedCustom: Record<string, number> = {};
        if (typeof data.sources.custom === 'number') {
          normalizedCustom = { Default: data.sources.custom }; // migrate old number into object
        } else {
          normalizedCustom = data.sources.custom || {};
        }

        setSnapshot({
          ...data,
          sources: {
            ...data.sources,
            bank: normalizedBank,
            custom: normalizedCustom,
          },
        });
      } else {
        const initial: TotalCashSnapshot = {
          userId,
          sources: {
            in_hand: 0,
            bank: {}, // 👈 always object now
            easypaisa: 0,
            jazzcash: 0,
            other: 0,
            custom: {}, // 👈 always object now
          },
          totalAmount: 0,
          freezeAmount: 0,
          updatedAt: new Date(),
          createdAt: new Date(),
        };
        await setDoc(docRef, initial);
        setSnapshot(initial);
      }
      setLoading(false);
    };
    fetchSnapshot();
  }, [userId]);

  const handleAddMoney = async (
    amount: number,
    source: TransactionSource,
    isFreezed: boolean,
    bankId?: string,
    bankName?: string,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string
  ) => {
    setSaving(true);

    const txn: Omit<CashTransaction, 'id'> = {
      userId,
      amount,
      type: isFreezed ? 'freeze_transfer' : 'add',
      source: isFreezed ? 'other' : source, // Use 'other' for freeze transfers
      category: 'manual',
      note: isFreezed ? 'Freezed addition' : 'Manual addition',
      createdAt: serverTimestamp() as Timestamp,
    };

    if (bankId && !isFreezed) txn.bankId = bankId;
    if (bankName && !isFreezed) txn.BankName = bankName;
    if (customPaymentHeadId && !isFreezed) txn.customPaymentHeadId = customPaymentHeadId;
    if (customPaymentHeadName && !isFreezed) txn.customPaymentHeadName = customPaymentHeadName;

    await addDoc(collection(db, 'cashTransactions'), txn);

    const docRef = doc(db, 'totalCashSnapshots', userId);

    const updatedSources: TotalCashSnapshot['sources'] = {
      in_hand: snapshot?.sources.in_hand ?? 0,
      bank: snapshot?.sources.bank ?? {},
      easypaisa: snapshot?.sources.easypaisa ?? 0,
      jazzcash: snapshot?.sources.jazzcash ?? 0,
      other: snapshot?.sources.other ?? 0,
      custom: snapshot?.sources.custom ?? {},
    };

    // ✅ Only update sources if NOT freezed
    if (!isFreezed) {
      if (source === 'bank' && bankName) {
        updatedSources.bank[bankName] =
          (updatedSources.bank[bankName] ?? 0) + amount;
      } else if (source === 'custom' && customPaymentHeadName) {
        updatedSources.custom[customPaymentHeadName] =
          (updatedSources.custom[customPaymentHeadName] ?? 0) + amount;
      } else if (source !== 'bank' && source !== 'custom') {
        updatedSources[source] = (updatedSources[source] ?? 0) + amount;
      }
    }

    const updatedSnapshot: TotalCashSnapshot = {
      ...snapshot!,
      sources: updatedSources,
      freezeAmount: isFreezed
        ? (snapshot?.freezeAmount || 0) + amount
        : snapshot?.freezeAmount || 0,
      totalAmount: (snapshot?.totalAmount || 0) + amount,
      updatedAt: new Date(),
    };

    await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
    setSnapshot(updatedSnapshot);
    setSaving(false);
  };

  const handleDeductMoney = async (
    amount: number,
    source: TransactionSource,
    bankId?: string,
    bankName?: string,
    fromFreeze: boolean = false,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string
  ) => {
    setSaving(true);

    const docRef = doc(db, 'totalCashSnapshots', userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      setSaving(false);
      return;
    }

    const data = docSnap.data() as TotalCashSnapshot;

    const updatedSources: TotalCashSnapshot['sources'] = {
      in_hand: data.sources.in_hand ?? 0,
      bank: data.sources.bank ?? {},
      easypaisa: data.sources.easypaisa ?? 0,
      jazzcash: data.sources.jazzcash ?? 0,
      other: data.sources.other ?? 0,
      custom: data.sources.custom ?? {},
    };

    let newFreeze = data.freezeAmount ?? 0;
    let newTotal = data.totalAmount ?? 0;

    if (fromFreeze) {
      // ✅ Deduct directly from freezeAmount
      if (amount > newFreeze) {
        alert(`Not enough balance in Freezed funds`);
        setSaving(false);
        return;
      }
      newFreeze -= amount;
      newTotal -= amount;
    } else {
      // ✅ Deduct from normal sources
      if (source === 'bank' && bankName) {
        const current = updatedSources.bank[bankName] ?? 0;
        if (amount > current) {
          alert(`Not enough balance in Bank: ${bankName}`);
          setSaving(false);
          return;
        }
        updatedSources.bank[bankName] = current - amount;
      } else if (source === 'custom' && customPaymentHeadName) {
        const current = updatedSources.custom[customPaymentHeadName] ?? 0;
        if (amount > current) {
          alert(`Not enough balance in ${customPaymentHeadName}`);
          setSaving(false);
          return;
        }
        updatedSources.custom[customPaymentHeadName] = current - amount;
      } else if (source !== 'bank' && source !== 'custom') {
        const current = (updatedSources[source] as number) ?? 0;
        if (amount > current) {
          alert(`Not enough balance in ${source}`);
          setSaving(false);
          return;
        }
        updatedSources[source] = current - amount;
      }
      newTotal -= amount;
    }

    const updatedSnapshot: TotalCashSnapshot = {
      ...data,
      sources: updatedSources,
      freezeAmount: newFreeze,
      totalAmount: newTotal,
      updatedAt: new Date(),
    };

    await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });

    // ✅ Store full transaction record
    await addDoc(collection(db, 'cashTransactions'), {
      userId,
      amount,
      type: 'deduct',
      source,
      fromFreeze,
      category: fromFreeze ? 'freeze' : 'manual',
      note: fromFreeze ? 'Deducted from Freezed' : 'Manual deduction',
      bankId: bankId || null,
      BankName: bankName || null,
      customPaymentHeadId: customPaymentHeadId || null,
      customPaymentHeadName: customPaymentHeadName || null,
      createdAt: serverTimestamp(),
    });

    setSnapshot(updatedSnapshot);
    setSaving(false);
  };

  const handleFreezeTransfer = async (
    amount: number,
    fromSource: TransactionSource,
    bankId?: string,
    bankName?: string,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string
  ) => {
    setSaving(true);

    let sourceBalance = 0;
    if (fromSource === 'bank' && bankName) {
      sourceBalance = snapshot?.sources.bank?.[bankName] ?? 0;
    } else if (fromSource === 'custom' && customPaymentHeadName) {
      sourceBalance = snapshot?.sources.custom?.[customPaymentHeadName] ?? 0;
    } else {
      sourceBalance = (snapshot?.sources[fromSource] as number) ?? 0;
    }

    if (amount > sourceBalance) {
      alert(
        `Not enough balance in ${fromSource}${bankName ? ` (${bankName})` : ''}${customPaymentHeadName ? ` (${customPaymentHeadName})` : ''}`
      );
      setSaving(false);
      return;
    }

    const docRef = doc(db, 'totalCashSnapshots', userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      setSaving(false);
      return;
    }

    const data = docSnap.data() as TotalCashSnapshot;

    const updatedSources: TotalCashSnapshot['sources'] = {
      in_hand: data.sources.in_hand ?? 0,
      bank: data.sources.bank ?? {},
      easypaisa: data.sources.easypaisa ?? 0,
      jazzcash: data.sources.jazzcash ?? 0,
      other: data.sources.other ?? 0,
      custom: data.sources.custom ?? {},
    };

    if (fromSource === 'bank' && bankName) {
      updatedSources.bank[bankName] =
        (updatedSources.bank[bankName] ?? 0) - amount;
    } else if (fromSource === 'custom' && customPaymentHeadName) {
      updatedSources.custom[customPaymentHeadName] =
        (updatedSources.custom[customPaymentHeadName] ?? 0) - amount;
    } else if (fromSource !== 'bank' && fromSource !== 'custom') {
      updatedSources[fromSource] = (updatedSources[fromSource] ?? 0) - amount;
    }

    const updatedSnapshot: TotalCashSnapshot = {
      ...data,
      sources: updatedSources,
      freezeAmount: (data.freezeAmount || 0) + amount,
      updatedAt: new Date(),
    };

    await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
    await addDoc(collection(db, 'cashTransactions'), {
      userId,
      amount,
      type: 'freeze_transfer',
      source: fromSource,
      category: 'freeze',
      note: 'Transferred to Freezed',
      bankId: bankId || null,
      BankName: bankName || null,
      customPaymentHeadId: customPaymentHeadId || null,
      customPaymentHeadName: customPaymentHeadName || null,
      createdAt: serverTimestamp(),
    });

    setSnapshot(updatedSnapshot);
    setSaving(false);
  };

  const freezeDisplay = snapshot?.freezeAmount || 0;
  const totalDisplay = snapshot?.totalAmount || 0;
  const available = totalDisplay - freezeDisplay;

  if (loading || !theme || !snapshot) {
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h6" fontWeight="bold" mb={1}>
        You have
      </Typography>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography color="text.secondary">
          Freezed:{' '}
          {showFreeze ? formatCurrency(freezeDisplay, currency) : '•••••••'}
        </Typography>
        <IconButton size="small" onClick={() => setShowFreeze((p) => !p)}>
          {showFreeze ? (
            <VisibilityOff fontSize="small" />
          ) : (
            <Visibility fontSize="small" />
          )}
        </IconButton>
      </Box>

      <Typography variant="h4" fontWeight="bold">
        {formatCurrency(available, currency)}
      </Typography>

      <AccountBreakdown
        snapshot={snapshot}
        currency={currency}
        isDark={isDark}
      />

      <Box mt={2} display="flex" gap={1} flexWrap="wrap">
        <AddMoney onSave={handleAddMoney} saving={saving} />
        <DeductMoney
          snapshot={snapshot}
          onDeduct={handleDeductMoney}
          saving={saving}
        />
        <FreezeTransfer onFreeze={handleFreezeTransfer} saving={saving} />
        <LoanDialog />
      </Box>
    </Box>
  );
}
