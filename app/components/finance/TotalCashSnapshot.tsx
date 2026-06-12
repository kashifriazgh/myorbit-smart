'use client';

import { Box, Typography, CircularProgress, IconButton, Button } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
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
import TransactionHistory from './TotalCashSnapshot/TransactionHistory';
import TransferFunds from './TotalCashSnapshot/TransferFunds';

export const getSourceKey = (
  source: TransactionSource,
  bankName?: string | null,
  customPaymentHeadName?: string | null
): string => {
  if (source === 'bank' && bankName) return `bank:${bankName}`;
  if (source === 'custom' && customPaymentHeadName) return `custom:${customPaymentHeadName}`;
  return source;
};

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
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);

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
          heldBy: data.heldBy || {},
          sourceOwnership: data.sourceOwnership || {},
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
          heldBy: {},
          sourceOwnership: {},
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
    customPaymentHeadName?: string,
    note?: string,
    holderName?: string
  ) => {
    setSaving(true);

    const txn: Omit<CashTransaction, 'id'> = {
      userId,
      amount,
      type: isFreezed ? 'freeze_transfer' : 'add',
      source: isFreezed ? 'other' : source, // Use 'other' for freeze transfers
      category: 'manual',
      note: note || (isFreezed ? 'Freezed addition' : 'Manual addition'),
      createdAt: serverTimestamp() as Timestamp,
      holderName: holderName || null,
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

    const updatedHeldBy = snapshot?.heldBy ? { ...snapshot.heldBy } : {};

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

      if (holderName && holderName !== 'Unassigned' && holderName !== 'Self') {
        const key = getSourceKey(source, bankName, customPaymentHeadName);
        const holders = [...(updatedHeldBy[key] || [])];
        const idx = holders.findIndex((h) => h.holderName === holderName);
        if (idx > -1) {
          holders[idx] = {
            ...holders[idx],
            amount: holders[idx].amount + amount,
          };
        } else {
          holders.push({ holderName, amount });
        }
        updatedHeldBy[key] = holders;
      }
    }

    const updatedSnapshot: TotalCashSnapshot = {
      ...snapshot!,
      sources: updatedSources,
      heldBy: updatedHeldBy,
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
    customPaymentHeadName?: string,
    note?: string,
    holderName?: string
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

    const updatedHeldBy = data.heldBy ? { ...data.heldBy } : {};

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
      const key = getSourceKey(source, bankName, customPaymentHeadName);
      let current = 0;
      if (source === 'bank' && bankName) {
        current = updatedSources.bank[bankName] ?? 0;
      } else if (source === 'custom' && customPaymentHeadName) {
        current = updatedSources.custom[customPaymentHeadName] ?? 0;
      } else if (source !== 'bank' && source !== 'custom') {
        current = (updatedSources[source] as number) ?? 0;
      }

      if (amount > current) {
        alert(`Not enough balance in ${source}${bankName ? ` (${bankName})` : ''}${customPaymentHeadName ? ` (${customPaymentHeadName})` : ''}`);
        setSaving(false);
        return;
      }

      // Check holder specific balance
      const holders = updatedHeldBy[key] || [];
      if (holders.length > 0) {
        if (holderName && holderName !== 'Unassigned' && holderName !== 'Self') {
          const holderIdx = holders.findIndex((h) => h.holderName === holderName);
          const holderAmt = holderIdx > -1 ? holders[holderIdx].amount : 0;
          if (amount > holderAmt) {
            alert(`Not enough balance for holder: ${holderName} (Available: ${holderAmt})`);
            setSaving(false);
            return;
          }
          // Deduct from holder
          const updatedHolders = [...holders];
          updatedHolders[holderIdx] = {
            ...updatedHolders[holderIdx],
            amount: holderAmt - amount,
          };
          updatedHeldBy[key] = updatedHolders;
        } else {
          // Deducting from Unassigned / Self
          const sumHolders = holders.reduce((sum, h) => sum + h.amount, 0);
          const unassignedAmt = current - sumHolders;
          if (amount > unassignedAmt) {
            alert(`Not enough unassigned balance (Available: ${unassignedAmt})`);
            setSaving(false);
            return;
          }
        }
      }

      // Deduct from source head
      if (source === 'bank' && bankName) {
        updatedSources.bank[bankName] = current - amount;
      } else if (source === 'custom' && customPaymentHeadName) {
        updatedSources.custom[customPaymentHeadName] = current - amount;
      } else if (source !== 'bank' && source !== 'custom') {
        updatedSources[source] = current - amount;
      }
      newTotal -= amount;
    }

    const updatedSnapshot: TotalCashSnapshot = {
      ...data,
      sources: updatedSources,
      heldBy: updatedHeldBy,
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
      note: note || (fromFreeze ? 'Deducted from Freezed' : 'Manual deduction'),
      bankId: bankId || null,
      BankName: bankName || null,
      customPaymentHeadId: customPaymentHeadId || null,
      customPaymentHeadName: customPaymentHeadName || null,
      holderName: holderName || null,
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
    customPaymentHeadName?: string,
    note?: string,
    fromHolderName?: string
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

    const updatedHeldBy = data.heldBy ? { ...data.heldBy } : {};
    const key = getSourceKey(fromSource, bankName, customPaymentHeadName);
    const holders = updatedHeldBy[key] || [];
    if (holders.length > 0) {
      if (fromHolderName && fromHolderName !== 'Unassigned' && fromHolderName !== 'Self') {
        const holderIdx = holders.findIndex((h) => h.holderName === fromHolderName);
        const holderAmt = holderIdx > -1 ? holders[holderIdx].amount : 0;
        if (amount > holderAmt) {
          alert(`Not enough balance for holder: ${fromHolderName} (Available: ${holderAmt})`);
          setSaving(false);
          return;
        }
        const updatedHolders = [...holders];
        updatedHolders[holderIdx] = {
          ...updatedHolders[holderIdx],
          amount: holderAmt - amount,
        };
        updatedHeldBy[key] = updatedHolders;
      } else {
        const sumHolders = holders.reduce((sum, h) => sum + h.amount, 0);
        const unassignedAmt = sourceBalance - sumHolders;
        if (amount > unassignedAmt) {
          alert(`Not enough unassigned balance (Available: ${unassignedAmt})`);
          setSaving(false);
          return;
        }
      }
    }

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
      heldBy: updatedHeldBy,
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
      note: note || 'Transferred to Freezed',
      bankId: bankId || null,
      BankName: bankName || null,
      customPaymentHeadId: customPaymentHeadId || null,
      customPaymentHeadName: customPaymentHeadName || null,
      fromHolderName: fromHolderName || null,
      createdAt: serverTimestamp(),
    });

    setSnapshot(updatedSnapshot);
    setSaving(false);
  };

  const handleTransferHolders = async (
    amount: number,
    fromSource: TransactionSource,
    fromBankName?: string,
    fromCustomName?: string,
    fromHolder?: string,
    toSource?: TransactionSource,
    toBankName?: string,
    toCustomName?: string,
    toHolder?: string,
    note?: string
  ) => {
    setSaving(true);
    try {
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
      const updatedHeldBy = data.heldBy ? { ...data.heldBy } : {};

      const fromKey = getSourceKey(fromSource, fromBankName, fromCustomName);
      const targetSource = toSource || fromSource;
      const targetBankName = toBankName || fromBankName;
      const targetCustomName = toCustomName || fromCustomName;
      const toKey = getSourceKey(targetSource, targetBankName, targetCustomName);

      // Check balance of source
      let fromSourceBalance = 0;
      if (fromSource === 'bank' && fromBankName) {
        fromSourceBalance = updatedSources.bank[fromBankName] ?? 0;
      } else if (fromSource === 'custom' && fromCustomName) {
        fromSourceBalance = updatedSources.custom[fromCustomName] ?? 0;
      } else {
        fromSourceBalance = (updatedSources[fromSource] as number) ?? 0;
      }

      if (amount > fromSourceBalance) {
        alert(`Not enough balance in source`);
        setSaving(false);
        return;
      }

      // Check holder specific balance
      const fromHolders = updatedHeldBy[fromKey] || [];
      if (fromHolders.length > 0) {
        if (fromHolder && fromHolder !== 'Unassigned' && fromHolder !== 'Self') {
          const idx = fromHolders.findIndex(h => h.holderName === fromHolder);
          const holderAmt = idx > -1 ? fromHolders[idx].amount : 0;
          if (amount > holderAmt) {
            alert(`Not enough balance for holder: ${fromHolder}`);
            setSaving(false);
            return;
          }
          // Deduct from holder
          const newHolders = [...fromHolders];
          newHolders[idx] = { ...newHolders[idx], amount: holderAmt - amount };
          updatedHeldBy[fromKey] = newHolders;
        } else {
          // Deduct from unassigned
          const sumHolders = fromHolders.reduce((sum, h) => sum + h.amount, 0);
          const unassignedAmt = fromSourceBalance - sumHolders;
          if (amount > unassignedAmt) {
            alert(`Not enough unassigned balance (Available: ${unassignedAmt})`);
            setSaving(false);
            return;
          }
        }
      }

      // Perform deduction from source head
      if (fromSource === 'bank' && fromBankName) {
        updatedSources.bank[fromBankName] -= amount;
      } else if (fromSource === 'custom' && fromCustomName) {
        updatedSources.custom[fromCustomName] -= amount;
      } else {
        (updatedSources[fromSource] as number) -= amount;
      }

      // Perform addition to target source head
      if (targetSource === 'bank' && targetBankName) {
        updatedSources.bank[targetBankName] = (updatedSources.bank[targetBankName] ?? 0) + amount;
      } else if (targetSource === 'custom' && targetCustomName) {
        updatedSources.custom[targetCustomName] = (updatedSources.custom[targetCustomName] ?? 0) + amount;
      } else {
        (updatedSources[targetSource] as number) = ((updatedSources[targetSource] as number) ?? 0) + amount;
      }

      // Add to target holder
      if (toHolder && toHolder !== 'Unassigned' && toHolder !== 'Self') {
        const toHolders = [...(updatedHeldBy[toKey] || [])];
        const idx = toHolders.findIndex(h => h.holderName === toHolder);
        if (idx > -1) {
          toHolders[idx] = { ...toHolders[idx], amount: toHolders[idx].amount + amount };
        } else {
          toHolders.push({ holderName: toHolder, amount });
        }
        updatedHeldBy[toKey] = toHolders;
      }

      // If source heads changed, update total amount accordingly (in case of transfer between different source heads, total balance remains same)
      let newTotalAmount = 0;
      Object.entries(updatedSources).forEach(([name, val]) => {
        if (name === 'bank' || name === 'custom') {
          Object.values(val as Record<string, number>).forEach(v => { newTotalAmount += v; });
        } else {
          newTotalAmount += val as number;
        }
      });

      const updatedSnapshot: TotalCashSnapshot = {
        ...data,
        sources: updatedSources,
        heldBy: updatedHeldBy,
        totalAmount: newTotalAmount,
        updatedAt: new Date(),
      };

      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);

      // Save transfer transaction
      await addDoc(collection(db, 'cashTransactions'), {
        userId,
        amount,
        type: 'transfer',
        source: fromSource,
        category: 'transfer',
        note: note || `Transferred ${amount} from ${fromHolder || 'Self'} (${fromSource}) to ${toHolder || 'Self'} (${targetSource})`,
        fromHolderName: fromHolder || null,
        toHolderName: toHolder || null,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
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
        userId={userId}
        onUpdateSnapshot={(updated) => setSnapshot(updated)}
      />

      <Box mt={2} display="flex" gap={1} flexWrap="wrap">
        <AddMoney onSave={handleAddMoney} saving={saving} snapshot={snapshot} />
        <DeductMoney
          snapshot={snapshot}
          onDeduct={handleDeductMoney}
          saving={saving}
        />
        <FreezeTransfer onFreeze={handleFreezeTransfer} saving={saving} snapshot={snapshot} />
        <LoanDialog onAddMoney={handleAddMoney} snapshot={snapshot} />
        <TransferFunds onTransfer={handleTransferHolders} saving={saving} snapshot={snapshot} />
      </Box>


      <Box mt={3} display="flex" justifyContent="center">
        <Button
          variant="outlined"
          onClick={() => setShowTransactionHistory(true)}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
          }}
        >
          See Transaction History
        </Button>
      </Box>

      <TransactionHistory
        open={showTransactionHistory}
        onClose={() => setShowTransactionHistory(false)}
        userId={userId}
      />
    </Box>
  );
}
