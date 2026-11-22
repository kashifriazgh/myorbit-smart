'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { db } from '@/app/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import type {
  TotalCashSnapshot,
  TransactionSource,
  Bank,
  CustomPaymentHead,
  WalletAllocation,
  WalletType,
  FinancialEventType,
} from '@/app/lib/interface';
import { computeTotalAmount, computeAvailableToSpend, type WalletItem } from '@/app/components/finance/TotalCashSnapshot';
import CreateWalletModal from '@/app/components/finance/TotalCashSnapshot/CreateWalletModal';
import WalletsGrid from '@/app/components/finance/TotalCashSnapshot/WalletsGrid';
import SmartWalletDetailDialog, {
  type WalletDeleteOptions,
} from '@/app/components/finance/TotalCashSnapshot/SmartWalletDetailDialog';
import TransferFunds from '@/app/components/finance/TotalCashSnapshot/TransferFunds';

const money = (amount: number) => `Rs. ${Number(amount || 0).toLocaleString('en-PK')}`;

export default function WalletsPage() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [snapshot, setSnapshot] = useState<TotalCashSnapshot | null>(null);
  const [banksList, setBanksList] = useState<Bank[]>([]);
  const [customHeadsList, setCustomHeadsList] = useState<CustomPaymentHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balancesVisible, setBalancesVisible] = useState(true);

  // Filters
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

  // Pre-selected wallet for Transfer
  const [openTransfer, setOpenTransfer] = useState(false);
  const [transferFromSource, setTransferFromSource] = useState<TransactionSource | undefined>(undefined);
  const [transferFromBankName, setTransferFromBankName] = useState<string | undefined>(undefined);

  const amountDisplay = (val: number) => (balancesVisible ? money(val) : 'Rs. •••••');

  useEffect(() => {
    if (!user?.uid) return;

    const unsubBanks = onSnapshot(
      query(collection(db, 'banks'), where('userId', '==', user.uid)),
      (snap) => {
        setBanksList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bank, 'id'>) })));
      }
    );

    const unsubHeads = onSnapshot(
      query(collection(db, 'customPaymentHeads'), where('userId', '==', user.uid)),
      (snap) => {
        setCustomHeadsList(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomPaymentHead, 'id'>) }))
        );
      }
    );

    const docRef = doc(db, 'totalCashSnapshots', user.uid);
    const unsubSnap = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as TotalCashSnapshot;
        setSnapshot({
          ...data,
          sources: {
            in_hand: data.sources?.in_hand ?? 0,
            easypaisa: data.sources?.easypaisa ?? 0,
            jazzcash: data.sources?.jazzcash ?? 0,
            other: data.sources?.other ?? 0,
            bank: data.sources?.bank || {},
            custom: data.sources?.custom || {},
          },
          sourceOwnership: data.sourceOwnership || {},
          heldBy: data.heldBy || {},
        });
      }
      setLoading(false);
    });

    return () => {
      unsubBanks();
      unsubHeads();
      unsubSnap();
    };
  }, [user?.uid]);

  // Construct Wallets list
  const walletsList: WalletItem[] = useMemo(() => {
    if (!snapshot || !snapshot.sources) return [];
    const list: WalletItem[] = [];

    const getOwnerInfo = (key: string, isCustom = false) => {
      const o = snapshot.sourceOwnership?.[key];
      const isLocked = o?.isLocked ?? false;
      const hasOwn = o && typeof o.hasOwnThisMoney === 'boolean' ? o.hasOwnThisMoney : !isCustom;
      const ownerName = hasOwn ? 'You' : o?.ownerName || 'Someone else';
      const reservedAmount = Number(o?.reservedAmount) || 0;
      const purpose = o?.purpose;
      const allocations = o?.allocations;
      const isVirtual = Boolean(o?.isVirtual || o?.parentWalletKey);
      const parentWalletKey = o?.parentWalletKey;
      const color = o?.color;
      return {
        owner: ownerName,
        hasOwnThisMoney: hasOwn,
        isLocked,
        reservedAmount,
        purpose,
        allocations,
        isVirtual,
        parentWalletKey,
        color,
      };
    };

    // 1. Built-in
    const ihInfo = getOwnerInfo('in_hand', false);
    list.push({
      id: 'in_hand',
      sourceType: 'in_hand',
      name: 'Cash in Hand',
      walletType: 'cash',
      category: 'built-in',
      owner: ihInfo.owner,
      hasOwnThisMoney: ihInfo.hasOwnThisMoney,
      isLocked: ihInfo.isLocked,
      reservedAmount: ihInfo.reservedAmount,
      purpose: ihInfo.purpose || 'Daily cash expenses',
      allocations: ihInfo.allocations,
      amount: snapshot.sources.in_hand ?? 0,
      initial: '💵',
      color: ihInfo.color || '#15803d',
      subtitle: ihInfo.isLocked ? 'Cash · Locked 🔒' : 'Cash Wallet',
    });

    const epInfo = getOwnerInfo('easypaisa', false);
    list.push({
      id: 'easypaisa',
      sourceType: 'easypaisa',
      name: 'Easypaisa',
      walletType: 'mobile_wallet',
      category: 'built-in',
      owner: epInfo.owner,
      hasOwnThisMoney: epInfo.hasOwnThisMoney,
      isLocked: epInfo.isLocked,
      reservedAmount: epInfo.reservedAmount,
      purpose: epInfo.purpose,
      allocations: epInfo.allocations,
      amount: snapshot.sources.easypaisa ?? 0,
      initial: '📱',
      color: epInfo.color || '#16a34a',
      subtitle: epInfo.isLocked ? 'Mobile Wallet · Locked 🔒' : 'Mobile Wallet',
    });

    const jcInfo = getOwnerInfo('jazzcash', false);
    list.push({
      id: 'jazzcash',
      sourceType: 'jazzcash',
      name: 'JazzCash',
      walletType: 'mobile_wallet',
      category: 'built-in',
      owner: jcInfo.owner,
      hasOwnThisMoney: jcInfo.hasOwnThisMoney,
      isLocked: jcInfo.isLocked,
      reservedAmount: jcInfo.reservedAmount,
      purpose: jcInfo.purpose,
      allocations: jcInfo.allocations,
      amount: snapshot.sources.jazzcash ?? 0,
      initial: '📱',
      color: jcInfo.color || '#dc2626',
      subtitle: jcInfo.isLocked ? 'Mobile Wallet · Locked 🔒' : 'Mobile Wallet',
    });

    const psInfo = getOwnerInfo('other', false);
    list.push({
      id: 'other',
      sourceType: 'other',
      name: 'Personal Spending',
      walletType: 'cash',
      category: 'built-in',
      owner: psInfo.owner,
      hasOwnThisMoney: psInfo.hasOwnThisMoney,
      isLocked: psInfo.isLocked,
      reservedAmount: psInfo.reservedAmount,
      purpose: psInfo.purpose,
      allocations: psInfo.allocations,
      amount: snapshot.sources.other ?? 0,
      initial: '💼',
      color: psInfo.color || '#0d9488',
      subtitle: psInfo.isLocked ? 'Personal · Locked 🔒' : 'Spending Wallet',
    });

    // 2. Bank Wallets
    const bankNames = new Set<string>();
    if (snapshot.sources.bank && typeof snapshot.sources.bank === 'object') {
      Object.keys(snapshot.sources.bank).forEach((b) => bankNames.add(b));
    }
    banksList.forEach((b) => bankNames.add(b.name));

    Array.from(bankNames).sort().forEach((bName) => {
      const key = `bank:${bName}`;
      const bInfo = getOwnerInfo(key, false);
      const amt = snapshot.sources.bank?.[bName] ?? 0;
      list.push({
        id: key,
        sourceType: 'bank',
        name: bName,
        walletType: 'bank',
        bankName: bName,
        category: 'bank',
        owner: bInfo.owner,
        hasOwnThisMoney: bInfo.hasOwnThisMoney,
        isLocked: bInfo.isLocked,
        isVirtual: bInfo.isVirtual,
        parentWalletKey: bInfo.parentWalletKey,
        reservedAmount: bInfo.reservedAmount,
        purpose: bInfo.purpose,
        allocations: bInfo.allocations,
        amount: amt,
        initial: '🏦',
        color: bInfo.color || '#2563eb',
        subtitle: bInfo.isLocked ? 'Bank · Locked 🔒' : 'Bank Account',
      });
    });

    // 3. Custom / Virtual
    const customNames = new Set<string>();
    if (snapshot.sources.custom && typeof snapshot.sources.custom === 'object') {
      Object.keys(snapshot.sources.custom).forEach((c) => customNames.add(c));
    }
    customHeadsList.forEach((c) => customNames.add(c.name));

    Array.from(customNames).sort().forEach((cName) => {
      const key = `custom:${cName}`;
      const cInfo = getOwnerInfo(key, true);
      const amt = snapshot.sources.custom?.[cName] ?? 0;
      const wType: WalletType = cInfo.isVirtual ? 'virtual' : 'cash';

      list.push({
        id: key,
        sourceType: 'custom',
        name: cName,
        walletType: wType,
        customName: cName,
        category: 'custom',
        owner: cInfo.owner,
        hasOwnThisMoney: cInfo.hasOwnThisMoney,
        isLocked: cInfo.isLocked,
        isVirtual: cInfo.isVirtual,
        parentWalletKey: cInfo.parentWalletKey,
        reservedAmount: cInfo.reservedAmount,
        purpose: cInfo.purpose,
        allocations: cInfo.allocations,
        amount: amt,
        initial: cInfo.isVirtual ? '🎯' : '🗂️',
        color: cInfo.color || (cInfo.isVirtual ? '#8b5cf6' : '#d97706'),
        subtitle: cInfo.isLocked
          ? 'Locked 🔒'
          : cInfo.isVirtual
          ? 'Virtual Bucket'
          : cInfo.owner !== 'You'
          ? `Owner: ${cInfo.owner}`
          : 'Custom Wallet',
      });
    });

    return list;
  }, [snapshot, banksList, customHeadsList]);

  // Filtered wallets
  const filteredWallets = useMemo(() => {
    return walletsList.filter((w) => {
      if (selectedType !== 'all' && w.walletType !== selectedType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          w.name.toLowerCase().includes(q) ||
          w.owner.toLowerCase().includes(q) ||
          (w.purpose || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [walletsList, selectedType, searchQuery]);

  const totalMoney = snapshot ? computeTotalAmount(snapshot) : 0;
  const availableSpendable = snapshot ? computeAvailableToSpend(snapshot) : 0;
  const reservedOrOther = Math.max(0, totalMoney - availableSpendable);

  // Pre-selected action triggers
  const triggerTransferForWallet = (wallet: WalletItem) => {
    setTransferFromSource(wallet.sourceType);
    setTransferFromBankName(wallet.bankName);
    setOpenTransfer(true);
  };

  // ── Handler: Add Money ──────────────────────────────────────
  const handleAddMoney = async (
    amount: number,
    source: TransactionSource,
    isFreezed: boolean,
    bankId?: string,
    bankName?: string,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string,
    note?: string,
    holderName?: string,
    meta?: {
      eventType?: FinancialEventType;
      sourceIncomeType?: string;
      expenseCategory?: string;
      subCategory?: string;
    }
  ) => {
    if (!snapshot || !user?.uid) return;
    setSaving(true);
    try {
      const updatedSources: TotalCashSnapshot['sources'] = {
        in_hand: snapshot.sources.in_hand ?? 0,
        bank: { ...(snapshot.sources.bank || {}) },
        easypaisa: snapshot.sources.easypaisa ?? 0,
        jazzcash: snapshot.sources.jazzcash ?? 0,
        other: snapshot.sources.other ?? 0,
        custom: { ...(snapshot.sources.custom || {}) },
      };

      let newWalletBalance = 0;
      if (source === 'bank' && bankName) {
        newWalletBalance = (updatedSources.bank[bankName] ?? 0) + amount;
        updatedSources.bank[bankName] = newWalletBalance;
      } else if (source === 'custom' && customPaymentHeadName) {
        newWalletBalance = (updatedSources.custom[customPaymentHeadName] ?? 0) + amount;
        updatedSources.custom[customPaymentHeadName] = newWalletBalance;
      } else if (source !== 'bank' && source !== 'custom') {
        newWalletBalance = (updatedSources[source] as number) + amount;
        (updatedSources[source] as number) = newWalletBalance;
      }

      const newTotal = computeTotalAmount({
        ...snapshot,
        sources: updatedSources,
      });

      await addDoc(collection(db, 'cashTransactions'), {
        userId: user.uid,
        amount,
        type: 'add',
        source,
        category: 'income',
        eventType: meta?.eventType || 'income',
        sourceIncomeType: meta?.sourceIncomeType || null,
        walletName: bankName || customPaymentHeadName || source,
        balanceAfter: newWalletBalance,
        balanceSnapshot: newTotal,
        note: note || meta?.sourceIncomeType || 'Money added',
        BankName: bankName || null,
        customPaymentHeadName: customPaymentHeadName || null,
        holderName: holderName || null,
        createdAt: serverTimestamp(),
      });

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sources: updatedSources,
        totalAmount: newTotal,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);
    } catch (err) {
      console.error('Add money failed:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // ── Handler: Deduct / Spend Money ───────────────────────────
  const handleDeductMoney = async (
    amount: number,
    source: TransactionSource,
    bankId?: string,
    bankName?: string,
    _fromFreeze: boolean = false,
    customPaymentHeadId?: string,
    customPaymentHeadName?: string,
    note?: string,
    holderName?: string,
    meta?: {
      eventType?: FinancialEventType;
      expenseCategory?: string;
      subCategory?: string;
    }
  ) => {
    if (!snapshot || !user?.uid) return;
    setSaving(true);
    try {
      const updatedSources: TotalCashSnapshot['sources'] = {
        in_hand: snapshot.sources.in_hand ?? 0,
        bank: { ...(snapshot.sources.bank || {}) },
        easypaisa: snapshot.sources.easypaisa ?? 0,
        jazzcash: snapshot.sources.jazzcash ?? 0,
        other: snapshot.sources.other ?? 0,
        custom: { ...(snapshot.sources.custom || {}) },
      };

      let newWalletBalance = 0;
      if (source === 'bank' && bankName) {
        newWalletBalance = Math.max(0, (updatedSources.bank[bankName] ?? 0) - amount);
        updatedSources.bank[bankName] = newWalletBalance;
      } else if (source === 'custom' && customPaymentHeadName) {
        newWalletBalance = Math.max(0, (updatedSources.custom[customPaymentHeadName] ?? 0) - amount);
        updatedSources.custom[customPaymentHeadName] = newWalletBalance;
      } else if (source !== 'bank' && source !== 'custom') {
        newWalletBalance = Math.max(0, (updatedSources[source] as number) - amount);
        (updatedSources[source] as number) = newWalletBalance;
      }

      const newTotal = computeTotalAmount({
        ...snapshot,
        sources: updatedSources,
      });

      await addDoc(collection(db, 'cashTransactions'), {
        userId: user.uid,
        amount,
        type: 'deduct',
        source,
        category: 'expenditure',
        eventType: 'expense',
        expenseCategory: meta?.expenseCategory || 'General Expense',
        subCategory: meta?.subCategory || null,
        walletName: bankName || customPaymentHeadName || source,
        balanceAfter: newWalletBalance,
        balanceSnapshot: newTotal,
        note: note || meta?.expenseCategory || 'Expense deduction',
        BankName: bankName || null,
        customPaymentHeadName: customPaymentHeadName || null,
        holderName: holderName || null,
        createdAt: serverTimestamp(),
      });

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sources: updatedSources,
        totalAmount: newTotal,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);
    } catch (err) {
      console.error('Deduct money failed:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // ── Handler: Transfer Funds ─────────────────────────────────
  const handleTransferFunds = async (
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
    if (!snapshot || !user?.uid) return;
    setSaving(true);
    try {
      const updatedSources = { ...snapshot.sources };
      const targetSource = toSource || fromSource;
      const targetBankName = toBankName || fromBankName;
      const targetCustomName = toCustomName || fromCustomName;

      let fromRemaining = 0;
      if (fromSource === 'bank' && fromBankName) {
        fromRemaining = (updatedSources.bank[fromBankName] ?? 0) - amount;
        updatedSources.bank[fromBankName] = fromRemaining;
      } else if (fromSource === 'custom' && fromCustomName) {
        fromRemaining = (updatedSources.custom[fromCustomName] ?? 0) - amount;
        updatedSources.custom[fromCustomName] = fromRemaining;
      } else {
        fromRemaining = ((updatedSources[fromSource] as number) ?? 0) - amount;
        (updatedSources[fromSource] as number) = fromRemaining;
      }

      let toNewBal = 0;
      if (targetSource === 'bank' && targetBankName) {
        toNewBal = (updatedSources.bank[targetBankName] ?? 0) + amount;
        updatedSources.bank[targetBankName] = toNewBal;
      } else if (targetSource === 'custom' && targetCustomName) {
        toNewBal = (updatedSources.custom[targetCustomName] ?? 0) + amount;
        updatedSources.custom[targetCustomName] = toNewBal;
      } else {
        toNewBal = ((updatedSources[targetSource] as number) ?? 0) + amount;
        (updatedSources[targetSource] as number) = toNewBal;
      }

      await addDoc(collection(db, 'cashTransactions'), {
        userId: user.uid,
        amount,
        type: 'transfer',
        source: fromSource,
        category: 'transfer',
        eventType: 'transfer',
        balanceAfter: fromRemaining,
        note:
          note ||
          `Transfer: ${fromBankName || fromCustomName || fromSource} ➔ ${
            targetBankName || targetCustomName || targetSource
          }`,
        BankName: fromBankName || null,
        customPaymentHeadName: fromCustomName || null,
        fromHolderName: fromHolder || null,
        toHolderName: toHolder || null,
        createdAt: serverTimestamp(),
      });

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sources: updatedSources,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);
    } catch (err) {
      console.error('Transfer failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Handler: Toggle Wallet Security Lock ────────────────────
  const handleToggleLockWallet = async (walletId: string, currentLock: boolean) => {
    if (!snapshot || !user?.uid) return;
    try {
      const existing = snapshot.sourceOwnership?.[walletId];
      const updatedOwnership = {
        ...(snapshot.sourceOwnership || {}),
        [walletId]: {
          hasOwnThisMoney: existing?.hasOwnThisMoney ?? true,
          ...(existing || {}),
          isLocked: !currentLock,
        },
      };

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sourceOwnership: updatedOwnership,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);
    } catch (e) {
      console.error('Lock toggle failed:', e);
    }
  };

  // ── Handler: Update Allocations & Reservations in Wallet ─────
  const handleUpdateWalletSettings = async (
    walletId: string,
    allocations: WalletAllocation[],
    reservedAmount: number,
    ownerName: string,
    hasOwnThisMoney: boolean
  ) => {
    if (!snapshot || !user?.uid) return;
    try {
      const updatedOwnership = {
        ...(snapshot.sourceOwnership || {}),
        [walletId]: {
          ...(snapshot.sourceOwnership?.[walletId] || {}),
          hasOwnThisMoney,
          ownerName: hasOwnThisMoney ? '' : ownerName,
          reservedAmount,
          allocations,
        },
      };

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sourceOwnership: updatedOwnership,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);
    } catch (e) {
      console.error('Update allocations failed:', e);
    }
  };

  // ── Handler: Delete Custom / Bank Wallet (with graceful balance handling) ──
  const handleDeleteWallet = async (walletId: string, options?: WalletDeleteOptions) => {
    if (!snapshot || !user?.uid) return;
    try {
      const updatedSources: TotalCashSnapshot['sources'] = {
        in_hand: snapshot.sources.in_hand ?? 0,
        easypaisa: snapshot.sources.easypaisa ?? 0,
        jazzcash: snapshot.sources.jazzcash ?? 0,
        other: snapshot.sources.other ?? 0,
        bank: { ...(snapshot.sources.bank || {}) },
        custom: { ...(snapshot.sources.custom || {}) },
      };

      const isBank = walletId.startsWith('bank:');
      const isCustom = walletId.startsWith('custom:');
      const walletName = isBank
        ? walletId.replace('bank:', '')
        : isCustom
        ? walletId.replace('custom:', '')
        : walletId;

      const closingAmount = isBank
        ? updatedSources.bank[walletName] ?? 0
        : isCustom
        ? updatedSources.custom[walletName] ?? 0
        : 0;

      // 1. Handle remaining balance gracefully before removing the wallet
      if (closingAmount > 0 && options?.resolution === 'transfer' && options.destinationWalletId) {
        const destId = options.destinationWalletId;
        let destLabel = destId;

        if (destId.startsWith('bank:')) {
          const destBank = destId.replace('bank:', '');
          updatedSources.bank[destBank] = (updatedSources.bank[destBank] ?? 0) + closingAmount;
          destLabel = destBank;
        } else if (destId.startsWith('custom:')) {
          const destCustom = destId.replace('custom:', '');
          updatedSources.custom[destCustom] =
            (updatedSources.custom[destCustom] ?? 0) + closingAmount;
          destLabel = destCustom;
        } else if (
          destId === 'in_hand' ||
          destId === 'easypaisa' ||
          destId === 'jazzcash' ||
          destId === 'other'
        ) {
          updatedSources[destId] = (updatedSources[destId] ?? 0) + closingAmount;
        }

        await addDoc(collection(db, 'cashTransactions'), {
          userId: user.uid,
          amount: closingAmount,
          type: 'transfer',
          source: isBank ? 'bank' : 'custom',
          category: 'transfer',
          eventType: 'transfer',
          walletName,
          balanceAfter: 0,
          note: `Wallet closure transfer: ${walletName} ➔ ${destLabel}`,
          BankName: isBank ? walletName : null,
          customPaymentHeadName: isCustom ? walletName : null,
          createdAt: serverTimestamp(),
        });
      } else if (closingAmount > 0 && options?.resolution === 'adjustment') {
        await addDoc(collection(db, 'cashTransactions'), {
          userId: user.uid,
          amount: closingAmount,
          type: 'deduct',
          source: isBank ? 'bank' : 'custom',
          category: 'manual',
          eventType: 'balance_adjustment',
          walletName,
          balanceAfter: 0,
          note: options.note || `Balance adjustment on closing wallet: ${walletName}`,
          BankName: isBank ? walletName : null,
          customPaymentHeadName: isCustom ? walletName : null,
          createdAt: serverTimestamp(),
        });
      }

      // 2. Remove wallet from snapshot sources, ownership, and heldBy
      if (isBank) {
        delete updatedSources.bank[walletName];
      } else if (isCustom) {
        delete updatedSources.custom[walletName];
      }

      const updatedOwnership = { ...(snapshot.sourceOwnership || {}) };
      delete updatedOwnership[walletId];

      const updatedHeldBy = { ...(snapshot.heldBy || {}) };
      delete updatedHeldBy[walletId];

      // 3. Recompute totalAmount directly from remaining wallets
      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sources: updatedSources,
        sourceOwnership: updatedOwnership,
        heldBy: updatedHeldBy,
        totalAmount: computeTotalAmount({
          ...snapshot,
          sources: updatedSources,
          sourceOwnership: updatedOwnership,
        }),
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', user.uid);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);

      // 4. Delete matching document(s) from `banks` or `customPaymentHeads` so it doesn't reappear
      if (isBank) {
        const matchingBanks = banksList.filter((b) => b.name === walletName && b.id);
        await Promise.all(matchingBanks.map((b) => deleteDoc(doc(db, 'banks', b.id!))));
      } else if (isCustom) {
        const matchingHeads = customHeadsList.filter((c) => c.name === walletName && c.id);
        await Promise.all(
          matchingHeads.map((c) => deleteDoc(doc(db, 'customPaymentHeads', c.id!)))
        );
      }

      setActiveWalletId(null);
    } catch (e) {
      console.error('Delete wallet failed:', e);
      throw e;
    }
  };

  return (
    <div
      className={`min-h-screen antialiased font-sans pb-16 transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pt-6 sm:px-6 lg:px-8">
        {/* Header with Back button */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/finance"
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-900 border-slate-700/70 text-slate-400 hover:text-white hover:border-slate-600'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 shadow-xs'
              }`}
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1
                className={`text-2xl font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Wallets &amp; Accounts
              </h1>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Manage all stores of funds, ownership &amp; envelopes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus size={15} />
            <span>New Wallet</span>
          </button>
        </header>

        {/* Balance Overview Card */}
        <section
          className={`rounded-3xl border p-5 sm:p-6 mb-5 transition-colors ${
            isDark
              ? 'bg-slate-900 border-slate-700/70 shadow-xl'
              : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            >
              Total Balance Across Wallets
            </span>
            <button
              type="button"
              onClick={() => setBalancesVisible((v) => !v)}
              aria-label={balancesVisible ? 'Hide balances' : 'Show balances'}
              className={`p-1.5 rounded-full transition cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/10'
                  : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {balancesVisible ? <Eye size={17} /> : <EyeOff size={17} />}
            </button>
          </div>
          <p
            className={`mt-1 text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            {amountDisplay(totalMoney)}
          </p>

          <div
            className={`mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-xs ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <div
              className={`rounded-2xl p-3 ${
                isDark
                  ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'bg-emerald-50 ring-1 ring-emerald-200'
              }`}
            >
              <span className={`block text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Spendable
              </span>
              <span
                className={`mt-0.5 block font-bold text-lg tabular-nums ${
                  isDark ? 'text-emerald-400' : 'text-emerald-700'
                }`}
              >
                {amountDisplay(availableSpendable)}
              </span>
            </div>
            <div
              className={`rounded-2xl p-3 ${
                isDark
                  ? 'bg-slate-800/80 border border-slate-700/60'
                  : 'bg-slate-50 border border-slate-200/80'
              }`}
            >
              <span className={`block text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Reserved / Other
              </span>
              <span
                className={`mt-0.5 block font-bold text-lg tabular-nums ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                {amountDisplay(reservedOrOther)}
              </span>
            </div>
          </div>
        </section>

        {/* Search & Type Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search
              size={15}
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${
                isDark ? 'text-slate-400' : 'text-slate-400'
              }`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wallet name, owner, or purpose…"
              className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:border-blue-500 ${
                isDark
                  ? 'bg-slate-900 border-slate-700/70 text-white placeholder-slate-400'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
            {['all', 'cash', 'bank', 'mobile_wallet', 'virtual'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedType(t)}
                className={`px-3 py-2 rounded-xl capitalize font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  selectedType === t
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDark
                    ? 'bg-slate-900 text-slate-300 hover:text-white border border-slate-700/70'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {t === 'all' ? 'All Wallets' : t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Wallets Grid */}
        <div className="flex-1">
          {loading ? (
            <div
              className={`rounded-[28px] border p-5 ${
                isDark
                  ? 'border-slate-700/70 bg-slate-900'
                  : 'border-slate-200 bg-white shadow-sm'
              }`}
            >
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    className={`rounded-3xl p-4 space-y-4 ${
                      isDark ? 'bg-slate-800/80' : 'bg-slate-50'
                    }`}
                  >
                    <div
                      className={`h-12 w-12 rounded-2xl animate-pulse ${
                        isDark ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                    <div className="space-y-2">
                      <div
                        className={`h-4 w-32 rounded animate-pulse ${
                          isDark ? 'bg-slate-700' : 'bg-slate-200'
                        }`}
                      />
                      <div
                        className={`h-3 w-24 rounded animate-pulse ${
                          isDark ? 'bg-slate-700' : 'bg-slate-200'
                        }`}
                      />
                    </div>
                    <div
                      className={`h-7 w-28 rounded animate-pulse ${
                        isDark ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : filteredWallets.length === 0 ? (
            <div
              className={`py-14 text-center text-xs rounded-3xl border ${
                isDark
                  ? 'bg-slate-900 border-slate-700/70 text-slate-400'
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              No wallets found. Tap &quot;New Wallet&quot; to add one.
            </div>
          ) : (
            <WalletsGrid
              wallets={filteredWallets}
              totalBalance={totalMoney}
              balancesVisible={balancesVisible}
              isDark={isDark}
              onWalletClick={(w) => setActiveWalletId(w.id)}
              onMenuClick={(w) => setActiveWalletId(w.id)}
            />
          )}
        </div>
      </div>

      {/* ── Modals with exact wallet pre-selection ─────────────── */}
      <CreateWalletModal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        onSave={async (wData) => {
          if (!snapshot || !user?.uid) return;
          setSaving(true);
          try {
            const isBank = wData.walletType === 'bank';
            const cleanName = wData.name.trim();
            const initAmt = wData.openingBalance || 0;

            const collectionName = isBank ? 'banks' : 'customPaymentHeads';
            await addDoc(collection(db, collectionName), {
              userId: user.uid,
              name: cleanName,
              createdAt: serverTimestamp(),
            });

            const updatedSources = { ...snapshot.sources };
            if (isBank) {
              updatedSources.bank = { ...(updatedSources.bank || {}), [cleanName]: initAmt };
            } else {
              updatedSources.custom = { ...(updatedSources.custom || {}), [cleanName]: initAmt };
            }

            const key = isBank ? `bank:${cleanName}` : `custom:${cleanName}`;
            const hasOwnThisMoney = wData.initialOwner.toLowerCase() === 'you';

            const ownershipEntry: NonNullable<TotalCashSnapshot['sourceOwnership']>[string] = {
              hasOwnThisMoney,
              ownerName: hasOwnThisMoney ? '' : wData.initialOwner,
              isLocked: wData.isLocked,
              isVirtual: wData.isVirtual,
              reservedAmount: wData.isReserved
                ? initAmt
                : wData.allocations?.reduce((acc, a) => acc + (a.reservedAmount || 0), 0) || 0,
              color: wData.color,
              ...(wData.parentWalletKey ? { parentWalletKey: wData.parentWalletKey } : {}),
              ...(wData.purpose ? { purpose: wData.purpose } : {}),
              ...(wData.notes ? { notes: wData.notes } : {}),
              ...(wData.allocations && wData.allocations.length > 0
                ? { allocations: wData.allocations }
                : {}),
            };

            const updatedOwnership = {
              ...(snapshot.sourceOwnership || {}),
              [key]: ownershipEntry,
            };

            let newTotal = snapshot.totalAmount || 0;
            if (initAmt > 0 && !wData.isVirtual) newTotal += initAmt;

            if (initAmt > 0) {
              await addDoc(collection(db, 'cashTransactions'), {
                userId: user.uid,
                amount: initAmt,
                type: 'add',
                source: isBank ? 'bank' : 'custom',
                category: 'manual',
                eventType: 'opening_balance',
                walletName: cleanName,
                walletType: wData.walletType,
                balanceAfter: initAmt,
                note: `Opening balance for ${cleanName}`,
                BankName: isBank ? cleanName : null,
                customPaymentHeadName: !isBank ? cleanName : null,
                createdAt: serverTimestamp(),
              });
            }

            const updatedSnapshot: TotalCashSnapshot = {
              ...snapshot,
              sources: updatedSources,
              sourceOwnership: updatedOwnership,
              totalAmount: newTotal,
              updatedAt: new Date(),
            };

            const docRef = doc(db, 'totalCashSnapshots', user.uid);
            await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
            setSnapshot(updatedSnapshot);
            setOpenCreateModal(false);
          } catch (e) {
            console.error('Create wallet error:', e);
          } finally {
            setSaving(false);
          }
        }}
        saving={saving}
        existingWallets={walletsList.map((w) => ({ id: w.id, name: w.name, type: w.walletType }))}
      />

      <SmartWalletDetailDialog
        open={Boolean(activeWalletId)}
        onClose={() => setActiveWalletId(null)}
        wallets={walletsList}
        activeWalletId={activeWalletId}
        onSelectWallet={(wId) => setActiveWalletId(wId)}
        isDark={isDark}
        onAddMoney={async (w, amt, note) => {
          await handleAddMoney(
            amt,
            w.sourceType,
            false,
            undefined,
            w.bankName,
            undefined,
            w.customName,
            note || `Added to ${w.name}`,
            undefined,
            { eventType: 'income', sourceIncomeType: 'Wallet Deposit' }
          );
        }}
        onSpendMoney={async (w, amt, note) => {
          await handleDeductMoney(
            amt,
            w.sourceType,
            undefined,
            w.bankName,
            false,
            undefined,
            w.customName,
            note || `Spent from ${w.name}`,
            undefined,
            { eventType: 'expense', expenseCategory: 'General Expense' }
          );
        }}
        onTransfer={(w) => triggerTransferForWallet(w)}
        onToggleLock={handleToggleLockWallet}
        onUpdateAllocations={handleUpdateWalletSettings}
        onDeleteWallet={handleDeleteWallet}
      />

      {/* Transfer with preselected source wallet */}
      <TransferFunds
        externalOpen={openTransfer}
        onExternalClose={() => {
          setOpenTransfer(false);
          setTransferFromSource(undefined);
          setTransferFromBankName(undefined);
        }}
        initialFromSource={transferFromSource}
        initialFromBankName={transferFromBankName}
        onTransfer={handleTransferFunds}
        saving={saving}
        snapshot={snapshot}
      />
    </div>
  );
}
