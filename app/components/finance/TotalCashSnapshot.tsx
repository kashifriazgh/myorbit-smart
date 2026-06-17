'use client';

import { Box, Typography, CircularProgress, IconButton, Tooltip, Fab } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HistoryIcon from '@mui/icons-material/History';
import { useEffect, useRef, useState } from 'react';
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

/** Compute the amount the user actually owns (excluding sources owned by others) */
function computeOwnedAmount(snapshot: TotalCashSnapshot): number {
  let owned = 0;
  const { sources, sourceOwnership } = snapshot;

  const isOwned = (key: string) => {
    const o = sourceOwnership?.[key];
    return !o || o.hasOwnThisMoney !== false;
  };

  // in_hand, easypaisa, jazzcash, other
  const simpleKeys: (keyof typeof sources)[] = ['in_hand', 'easypaisa', 'jazzcash', 'other'];
  for (const k of simpleKeys) {
    if (isOwned(k as string)) {
      owned += (sources[k] as number) ?? 0;
    }
  }

  // bank
  for (const [bankName, bankAmt] of Object.entries(sources.bank || {})) {
    if (isOwned(`bank:${bankName}`)) owned += bankAmt;
  }

  // custom
  for (const [customName, customAmt] of Object.entries(sources.custom || {})) {
    if (isOwned(`custom:${customName}`)) owned += customAmt;
  }

  return owned;
}

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
  const [showTotal, setShowTotal] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  // Dialog open states driven by FAB
  const [openAdd, setOpenAdd] = useState(false);
  const [openDeduct, setOpenDeduct] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openLoan, setOpenLoan] = useState(false);

  const fabRef = useRef<HTMLDivElement>(null);

  const currency = 'PKR';

  // Close FAB on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const fetchSnapshot = async () => {
      setLoading(true);
      const docRef = doc(db, 'totalCashSnapshots', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as TotalCashSnapshot;

        let normalizedBank: Record<string, number> = {};
        if (typeof data.sources.bank === 'number') {
          normalizedBank = { Default: data.sources.bank };
        } else {
          normalizedBank = data.sources.bank || {};
        }

        let normalizedCustom: Record<string, number> = {};
        if (typeof data.sources.custom === 'number') {
          normalizedCustom = { Default: data.sources.custom };
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
            bank: {},
            easypaisa: 0,
            jazzcash: 0,
            other: 0,
            custom: {},
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
      source: isFreezed ? 'other' : source,
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
      if (amount > newFreeze) {
        alert(`Not enough balance in Freezed funds`);
        setSaving(false);
        return;
      }
      newFreeze -= amount;
      newTotal -= amount;
    } else {
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
          const updatedHolders = [...holders];
          updatedHolders[holderIdx] = {
            ...updatedHolders[holderIdx],
            amount: holderAmt - amount,
          };
          updatedHeldBy[key] = updatedHolders;
        } else {
          const sumHolders = holders.reduce((sum, h) => sum + h.amount, 0);
          const unassignedAmt = current - sumHolders;
          if (amount > unassignedAmt) {
            alert(`Not enough unassigned balance (Available: ${unassignedAmt})`);
            setSaving(false);
            return;
          }
        }
      }

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
          const newHolders = [...fromHolders];
          newHolders[idx] = { ...newHolders[idx], amount: holderAmt - amount };
          updatedHeldBy[fromKey] = newHolders;
        } else {
          const sumHolders = fromHolders.reduce((sum, h) => sum + h.amount, 0);
          const unassignedAmt = fromSourceBalance - sumHolders;
          if (amount > unassignedAmt) {
            alert(`Not enough unassigned balance (Available: ${unassignedAmt})`);
            setSaving(false);
            return;
          }
        }
      }

      if (fromSource === 'bank' && fromBankName) {
        updatedSources.bank[fromBankName] -= amount;
      } else if (fromSource === 'custom' && fromCustomName) {
        updatedSources.custom[fromCustomName] -= amount;
      } else {
        (updatedSources[fromSource] as number) -= amount;
      }

      if (targetSource === 'bank' && targetBankName) {
        updatedSources.bank[targetBankName] = (updatedSources.bank[targetBankName] ?? 0) + amount;
      } else if (targetSource === 'custom' && targetCustomName) {
        updatedSources.custom[targetCustomName] = (updatedSources.custom[targetCustomName] ?? 0) + amount;
      } else {
        (updatedSources[targetSource] as number) = ((updatedSources[targetSource] as number) ?? 0) + amount;
      }

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

  const totalDisplay = snapshot?.totalAmount || 0;
  const ownedDisplay = snapshot ? computeOwnedAmount(snapshot) : 0;

  if (loading || !theme || !snapshot) {
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  const fabActions = [
    {
      icon: <AddCircleOutlineIcon />,
      label: 'Add Money',
      color: '#22c55e',
      onClick: () => { setFabOpen(false); setOpenAdd(true); },
    },
    {
      icon: <RemoveCircleOutlineIcon />,
      label: 'Deduct',
      color: '#ef4444',
      onClick: () => { setFabOpen(false); setOpenDeduct(true); },
    },
    {
      icon: <SwapHorizIcon />,
      label: 'Transfer',
      color: '#3b82f6',
      onClick: () => { setFabOpen(false); setOpenTransfer(true); },
    },
    {
      icon: <ReceiptLongIcon />,
      label: 'Loan Record',
      color: '#a855f7',
      onClick: () => { setFabOpen(false); setOpenLoan(true); },
    },
    {
      icon: <HistoryIcon />,
      label: 'History',
      color: '#f59e0b',
      onClick: () => { setFabOpen(false); setShowTransactionHistory(true); },
    },
  ];

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, position: 'relative' }}>
      {/* Header row with inline action trigger */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight="bold">
          Your Money
        </Typography>

        {/* Compact inline FAB trigger */}
        <Box
          ref={fabRef}
          sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1 }}
        >
          {/* Action buttons fan-out (absolute, right-aligned above trigger) */}
          <Box
            sx={{
              position: 'absolute',
              right: 0,
              top: '110%',
              pt: 1,
              zIndex: 1200,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 1,
              pointerEvents: fabOpen ? 'auto' : 'none',
            }}
          >
            {fabActions.map((action, i) => (
              <Box
                key={action.label}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flexDirection: 'row',
                  opacity: fabOpen ? 1 : 0,
                  transform: fabOpen
                    ? 'translateX(0) scale(1)'
                    : `translateX(20px) scale(0.85)`,
                  transition: `opacity 0.2s ease ${fabOpen ? i * 0.05 : (fabActions.length - 1 - i) * 0.03}s, transform 0.2s cubic-bezier(.34,1.56,.64,1) ${fabOpen ? i * 0.05 : 0}s`,
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{
                    px: 1.2,
                    py: 0.45,
                    borderRadius: 99,
                    bgcolor: action.color,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    fontSize: '0.72rem',
                    boxShadow: `0 2px 8px ${action.color}55`,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={action.onClick}
                >
                  {action.label}
                </Typography>
                <Fab
                  size="small"
                  onClick={action.onClick}
                  sx={{
                    bgcolor: action.color,
                    color: '#fff',
                    boxShadow: `0 4px 14px ${action.color}66`,
                    '&:hover': {
                      bgcolor: action.color,
                      filter: 'brightness(1.1)',
                    },
                    width: 38,
                    height: 38,
                    minHeight: 'unset',
                    flexShrink: 0,
                  }}
                >
                  {action.icon}
                </Fab>
              </Box>
            ))}
          </Box>

          {/* Main trigger button */}
          <Tooltip title={fabOpen ? 'Close actions' : 'Actions'} placement="left">
            <Fab
              size="small"
              color="primary"
              onClick={() => setFabOpen((p) => !p)}
              sx={{
                width: 38,
                height: 38,
                minHeight: 'unset',
                boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1)',
                transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
              }}
            >
              {fabOpen ? <CloseIcon fontSize="small" /> : <AddIcon fontSize="small" />}
            </Fab>
          </Tooltip>
        </Box>
      </Box>

      {/* Two-card display */}
      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        {/* Owned Card */}
        <Box
          flex={1}
          minWidth={140}
          borderRadius={3}
          p={2.5}
          sx={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.10) 100%)'
              : 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
            border: `1px solid ${isDark ? 'rgba(139,92,246,0.25)' : '#ddd6fe'}`,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: isDark ? '#a78bfa' : '#7c3aed',
              display: 'block',
              mb: 0.5,
            }}
          >
            I Own
          </Typography>
          <Typography variant="h5" fontWeight="900" color={isDark ? '#c4b5fd' : '#5b21b6'}>
            {formatCurrency(ownedDisplay, currency)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block' }}>
            Excluding others&apos; funds
          </Typography>
        </Box>

        {/* Total Card */}
        <Box
          flex={1}
          minWidth={140}
          borderRadius={3}
          p={2.5}
          sx={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(20,184,166,0.18) 0%, rgba(6,182,212,0.10) 100%)'
              : 'linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%)',
            border: `1px solid ${isDark ? 'rgba(20,184,166,0.25)' : '#99f6e4'}`,
          }}
        >
          <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                color: isDark ? '#2dd4bf' : '#0f766e',
              }}
            >
              Overall Total
            </Typography>
            <IconButton size="small" onClick={() => setShowTotal((p) => !p)} sx={{ p: 0.2 }}>
              {showTotal ? (
                <VisibilityOff sx={{ fontSize: 14, color: isDark ? '#5eead4' : '#0f766e' }} />
              ) : (
                <Visibility sx={{ fontSize: 14, color: isDark ? '#5eead4' : '#0f766e' }} />
              )}
            </IconButton>
          </Box>
          <Typography variant="h5" fontWeight="900" color={isDark ? '#5eead4' : '#0f766e'}>
            {showTotal ? formatCurrency(totalDisplay, currency) : '•••••••'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block' }}>
            All sources combined
          </Typography>
        </Box>
      </Box>

      <AccountBreakdown
        snapshot={snapshot}
        currency={currency}
        isDark={isDark}
        userId={userId}
        onUpdateSnapshot={(updated) => setSnapshot(updated)}
      />

      {/* Dialog components controlled by FAB */}
      <AddMoney
        onSave={handleAddMoney}
        saving={saving}
        snapshot={snapshot}
        externalOpen={openAdd}
        onExternalClose={() => setOpenAdd(false)}
      />
      <DeductMoney
        snapshot={snapshot}
        onDeduct={handleDeductMoney}
        saving={saving}
        externalOpen={openDeduct}
        onExternalClose={() => setOpenDeduct(false)}
      />
      <TransferFunds
        onTransfer={handleTransferHolders}
        saving={saving}
        snapshot={snapshot}
        externalOpen={openTransfer}
        onExternalClose={() => setOpenTransfer(false)}
      />
      <LoanDialog
        onAddMoney={handleAddMoney}
        snapshot={snapshot}
        externalOpen={openLoan}
        onExternalClose={() => setOpenLoan(false)}
      />


      {/* See Transaction History */}
      <Box mt={3} mb={2} display="flex" justifyContent="center">
        <Box
          component="button"
          onClick={() => setShowTransactionHistory(true)}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 3,
            py: 1,
            borderRadius: 99,
            border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}`,
            bgcolor: 'transparent',
            cursor: 'pointer',
            color: isDark ? '#94a3b8' : '#64748b',
            fontWeight: 700,
            fontSize: '0.8rem',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
            '&:hover': {
              borderColor: 'primary.main',
              color: 'primary.main',
              bgcolor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)',
            },
          }}
        >
          <HistoryIcon sx={{ fontSize: 16 }} />
          See Transaction History
        </Box>
      </Box>

      <TransactionHistory
        open={showTransactionHistory}
        onClose={() => setShowTransactionHistory(false)}
        userId={userId}
      />
    </Box>
  );
}
