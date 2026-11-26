'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  UserCircle2,
  PlusCircle,
  MinusCircle,
  ChevronRight,
  RefreshCw,
  History,
  ArrowRightLeft,
  X,
  Settings,
} from 'lucide-react';
import { db } from '@/app/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import {
  TotalCashSnapshot,
  TransactionSource,
  Bank,
  CustomPaymentHead,
  LoanRecord,
  Liability,
  WalletAllocation,
  WalletType,
  FundOwnershipState,
  FinancialEventType,
  PlannedExpense,
  Expenditure,
} from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';

// Child components & Modals
import AddMoney from './TotalCashSnapshot/AddMoney';
import TransferFunds from './TotalCashSnapshot/TransferFunds';
import LoanDialog from './TotalCashSnapshot/LoanRecord';
import LiabilityDialog from './TotalCashSnapshot/LiabilityDialog';
import TransactionHistory from './TotalCashSnapshot/TransactionHistory';
import CreateWalletModal from './TotalCashSnapshot/CreateWalletModal';
import WalletDetailsModal from './TotalCashSnapshot/WalletDetailsModal';
import FinancialOverview, { type FinancialOverviewData } from './TotalCashSnapshot/FinancialOverview';
import MonthlyMoneyOverview from './TotalCashSnapshot/MonthlyMoneyOverview';
import ExpenseAnalytics, {
  mapExpenseCategoryToId,
  type ExpenseAnalyticsItem,
} from './TotalCashSnapshot/ExpenseAnalytics';
import QuickExpense, { type QuickExpensePayload } from './TotalCashSnapshot/QuickExpense';
import { BudgetStartDayModal } from './BudgetStartDayPicker';
import { useBudgetStartDay } from '@/app/lib/finance/useBudgetStartDay';
import { getBudgetCycle } from '@/app/lib/finance/budgetCycle';

export const getSourceKey = (
  source: TransactionSource,
  bankName?: string | null,
  customPaymentHeadName?: string | null
): string => {
  if (source === 'bank' && bankName) return `bank:${bankName}`;
  if (source === 'custom' && customPaymentHeadName) return `custom:${customPaymentHeadName}`;
  return source;
};

/**
 * Keep a wallet's `sourceOwnership[walletKey].allocations` and `reservedAmount`
 * in sync whenever money is deducted (delta < 0) or added/returned (delta > 0)
 * by a loan, settlement, or transfer.
 */
export function applyWalletAllocationDelta(
  sourceOwnership: TotalCashSnapshot['sourceOwnership'] | undefined,
  walletKey: string,
  delta: number,
  envelopeId?: string | null,
  envelopeName?: string | null
): TotalCashSnapshot['sourceOwnership'] {
  const nextOwnership = { ...(sourceOwnership || {}) };
  const existing = nextOwnership[walletKey];
  if (!existing || !existing.allocations || existing.allocations.length === 0 || delta === 0) {
    return nextOwnership;
  }

  const targetIdx = (() => {
    if (envelopeId) {
      const byId = existing.allocations!.findIndex((a) => a.id === envelopeId);
      if (byId >= 0) return byId;
    }
    if (envelopeName) {
      const byName = existing.allocations!.findIndex(
        (a) => (a.purpose || '').toLowerCase() === envelopeName.toLowerCase()
      );
      if (byName >= 0) return byName;
    }
    const defIdx = existing.allocations!.findIndex((a) => a.id.startsWith('default_'));
    return defIdx >= 0 ? defIdx : 0;
  })();

  const updatedAllocs = existing.allocations.map((alloc, idx) => {
    if (idx !== targetIdx) return alloc;
    const prevAmt = Number(alloc.amount) || 0;
    const nextAmt = Math.max(0, prevAmt + delta);
    const isReservedAlloc =
      alloc.availabilityStatus === 'reserved' ||
      (alloc.owner || '').toLowerCase() === 'reserved';
    const nextReserved = isReservedAlloc
      ? nextAmt
      : delta < 0
      ? Math.min(nextAmt, Math.max(0, (Number(alloc.reservedAmount) || 0) + delta))
      : Math.min(nextAmt, Number(alloc.reservedAmount) || 0);
    return {
      ...alloc,
      amount: nextAmt,
      reservedAmount: nextReserved,
    };
  });

  const nextTotalReserved = updatedAllocs.reduce(
    (sum, a) => sum + (Number(a.reservedAmount) || 0),
    0
  );

  nextOwnership[walletKey] = {
    ...existing,
    allocations: updatedAllocs,
    reservedAmount: nextTotalReserved,
  };

  return nextOwnership;
}

/**
 * Apply an incoming deposit with an explicit ownership state
 * ('spendable' | 'reserved' | 'savings' | 'amanat') to `sourceOwnership[walletKey]`.
 */
export function applyDepositFundState(
  sourceOwnership: TotalCashSnapshot['sourceOwnership'] | undefined,
  walletKey: string,
  walletDisplayName: string,
  previousBalance: number,
  depositAmount: number,
  fundState: FundOwnershipState = 'spendable',
  opts?: {
    allocationLabel?: string;
    amanatOwnerName?: string;
    envelopeId?: string;
    envelopeName?: string;
  }
): TotalCashSnapshot['sourceOwnership'] {
  const nextOwnership = { ...(sourceOwnership || {}) };
  if (depositAmount <= 0) return nextOwnership;

  const existing = nextOwnership[walletKey];
  const existingAllocs = existing?.allocations ? [...existing.allocations] : [];

  // If a specific existing envelope was chosen, deposit directly into that envelope
  if (opts?.envelopeId && existingAllocs.length > 0) {
    const targetIdx = existingAllocs.findIndex((a) => a.id === opts.envelopeId);
    if (targetIdx >= 0) {
      const target = existingAllocs[targetIdx];
      const nextAmt = (Number(target.amount) || 0) + depositAmount;
      const isNonSpendable =
        fundState !== 'spendable' ||
        target.fundState === 'reserved' ||
        target.fundState === 'savings' ||
        target.fundState === 'amanat' ||
        target.availabilityStatus === 'reserved' ||
        target.availabilityStatus === 'savings' ||
        target.availabilityStatus === 'external';
      existingAllocs[targetIdx] = {
        ...target,
        amount: nextAmt,
        reservedAmount: isNonSpendable ? nextAmt : Number(target.reservedAmount) || 0,
      };

      const nextTotalReserved = existingAllocs.reduce(
        (sum, a) => sum + (Number(a.reservedAmount) || 0),
        0
      );
      nextOwnership[walletKey] = {
        ...existing,
        allocations: existingAllocs,
        reservedAmount: nextTotalReserved,
      };
      return nextOwnership;
    }
  }

  // Simple spendable deposit into a wallet with no envelopes yet and already owned/spendable
  if (
    fundState === 'spendable' &&
    existingAllocs.length === 0 &&
    (existing?.hasOwnThisMoney ?? true) &&
    (Number(existing?.reservedAmount) || 0) === 0
  ) {
    return nextOwnership;
  }

  // Seed a default allocation for the existing balance if allocations didn't exist yet
  if (existingAllocs.length === 0) {
    const prevBal = Math.max(0, Number(previousBalance) || 0);
    const prevOwn = existing?.hasOwnThisMoney ?? true;
    const prevRes = Number(existing?.reservedAmount) || 0;
    const prevState: FundOwnershipState = !prevOwn
      ? 'amanat'
      : existing?.fundState
      ? existing.fundState
      : prevBal > 0 && prevRes >= prevBal
      ? 'reserved'
      : 'spendable';
    existingAllocs.push({
      id: `default_${walletKey}`,
      owner:
        prevState === 'amanat'
          ? existing?.ownerName || 'Amanat'
          : prevState === 'reserved'
          ? 'Reserved'
          : prevState === 'savings'
          ? 'Savings'
          : 'You',
      amount: prevBal,
      purpose: walletDisplayName,
      reservedAmount: prevState === 'spendable' ? Math.min(prevBal, prevRes) : prevBal,
      availabilityStatus:
        prevState === 'amanat'
          ? 'external'
          : prevState === 'reserved'
          ? 'reserved'
          : prevState === 'savings'
          ? 'savings'
          : 'available',
      fundState: prevState,
    });
  }

  if (fundState === 'spendable') {
    const defIdx = existingAllocs.findIndex(
      (a) =>
        a.id.startsWith('default_') &&
        (a.fundState === 'spendable' ||
          (!a.fundState &&
            a.availabilityStatus !== 'reserved' &&
            a.availabilityStatus !== 'savings' &&
            a.availabilityStatus !== 'external' &&
            (a.owner.toLowerCase() === 'you' || a.owner.toLowerCase() === 'self')))
    );
    const spendIdx =
      defIdx >= 0
        ? defIdx
        : existingAllocs.findIndex(
            (a) =>
              a.fundState === 'spendable' ||
              (!a.fundState &&
                a.availabilityStatus === 'available' &&
                (a.owner.toLowerCase() === 'you' || a.owner.toLowerCase() === 'self'))
          );
    if (spendIdx >= 0) {
      const target = existingAllocs[spendIdx];
      existingAllocs[spendIdx] = {
        ...target,
        amount: (Number(target.amount) || 0) + depositAmount,
        fundState: 'spendable',
        availabilityStatus: 'available',
      };
    } else {
      existingAllocs.push({
        id: `env_${Date.now()}`,
        owner: 'You',
        amount: depositAmount,
        purpose: opts?.allocationLabel?.trim() || 'Spendable',
        reservedAmount: 0,
        availabilityStatus: 'available',
        fundState: 'spendable',
      });
    }
  } else if (fundState === 'reserved') {
    const label = opts?.allocationLabel?.trim() || 'Reserved';
    const matchIdx = existingAllocs.findIndex(
      (a) =>
        (a.fundState === 'reserved' ||
          a.availabilityStatus === 'reserved' ||
          a.owner.toLowerCase() === 'reserved') &&
        (a.purpose || '').trim().toLowerCase() === label.toLowerCase()
    );
    if (matchIdx >= 0) {
      const target = existingAllocs[matchIdx];
      const nextAmt = (Number(target.amount) || 0) + depositAmount;
      existingAllocs[matchIdx] = {
        ...target,
        amount: nextAmt,
        reservedAmount: nextAmt,
        owner: 'Reserved',
        availabilityStatus: 'reserved',
        fundState: 'reserved',
      };
    } else {
      existingAllocs.push({
        id: `env_${Date.now()}`,
        owner: 'Reserved',
        amount: depositAmount,
        purpose: label,
        reservedAmount: depositAmount,
        availabilityStatus: 'reserved',
        fundState: 'reserved',
      });
    }
  } else if (fundState === 'savings') {
    const label = opts?.allocationLabel?.trim() || 'Savings';
    const matchIdx = existingAllocs.findIndex(
      (a) =>
        (a.fundState === 'savings' ||
          a.availabilityStatus === 'savings' ||
          a.owner.toLowerCase() === 'savings') &&
        (a.purpose || '').trim().toLowerCase() === label.toLowerCase()
    );
    if (matchIdx >= 0) {
      const target = existingAllocs[matchIdx];
      const nextAmt = (Number(target.amount) || 0) + depositAmount;
      existingAllocs[matchIdx] = {
        ...target,
        amount: nextAmt,
        reservedAmount: nextAmt,
        owner: 'Savings',
        availabilityStatus: 'savings',
        fundState: 'savings',
      };
    } else {
      existingAllocs.push({
        id: `env_${Date.now()}`,
        owner: 'Savings',
        amount: depositAmount,
        purpose: label,
        reservedAmount: depositAmount,
        availabilityStatus: 'savings',
        fundState: 'savings',
      });
    }
  } else if (fundState === 'amanat') {
    const ownerName = opts?.amanatOwnerName?.trim() || 'Amanat';
    const label = opts?.allocationLabel?.trim() || `Amanat (${ownerName})`;
    const matchIdx = existingAllocs.findIndex(
      (a) =>
        (a.fundState === 'amanat' || a.availabilityStatus === 'external') &&
        a.owner.trim().toLowerCase() === ownerName.toLowerCase() &&
        (a.purpose || '').trim().toLowerCase() === label.toLowerCase()
    );
    if (matchIdx >= 0) {
      const target = existingAllocs[matchIdx];
      const nextAmt = (Number(target.amount) || 0) + depositAmount;
      existingAllocs[matchIdx] = {
        ...target,
        amount: nextAmt,
        reservedAmount: nextAmt,
        owner: ownerName,
        availabilityStatus: 'external',
        fundState: 'amanat',
      };
    } else {
      existingAllocs.push({
        id: `env_${Date.now()}`,
        owner: ownerName,
        amount: depositAmount,
        purpose: label,
        reservedAmount: depositAmount,
        availabilityStatus: 'external',
        fundState: 'amanat',
      });
    }
  }

  const nextTotalReserved = existingAllocs.reduce(
    (sum, a) => sum + (Number(a.reservedAmount) || 0),
    0
  );
  const hasOwnedFunds = existingAllocs.some(
    (a) =>
      (Number(a.amount) || 0) > 0 &&
      a.fundState !== 'amanat' &&
      a.availabilityStatus !== 'external'
  );

  nextOwnership[walletKey] = {
    ...(existing || { hasOwnThisMoney: hasOwnedFunds }),
    hasOwnThisMoney: hasOwnedFunds || Boolean(existing?.hasOwnThisMoney),
    allocations: existingAllocs,
    reservedAmount: nextTotalReserved,
  };

  return nextOwnership;
}

/** Compute the overall total recorded money across all non-virtual wallets */
export function computeTotalAmount(snapshot: TotalCashSnapshot): number {
  let total = 0;
  const { sources, sourceOwnership } = snapshot;
  if (!sources) return 0;

  for (const [key, val] of Object.entries(sources)) {
    if (key === 'bank' && typeof val === 'object' && val !== null) {
      for (const [bName, bAmt] of Object.entries(val as Record<string, number>)) {
        const fullKey = `bank:${bName}`;
        const isBackedVirtual = Boolean(sourceOwnership?.[fullKey]?.parentWalletKey);
        if (!isBackedVirtual && typeof bAmt === 'number') total += bAmt;
      }
    } else if (key === 'custom' && typeof val === 'object' && val !== null) {
      for (const [cName, cAmt] of Object.entries(val as Record<string, number>)) {
        const fullKey = `custom:${cName}`;
        const isBackedVirtual = Boolean(sourceOwnership?.[fullKey]?.parentWalletKey);
        if (!isBackedVirtual && typeof cAmt === 'number') total += cAmt;
      }
    } else if (typeof val === 'number') {
      const isBackedVirtual = Boolean(sourceOwnership?.[key]?.parentWalletKey);
      if (!isBackedVirtual) total += val;
    }
  }
  return total;
}

/** Compute the amount available to spend */
export function computeAvailableToSpend(snapshot: TotalCashSnapshot): number {
  let available = 0;
  const { sources, sourceOwnership } = snapshot;
  if (!sources) return 0;

  const calculateWalletSpendable = (key: string, grossAmount: number, isCustom = false) => {
    const o = sourceOwnership?.[key];
    if (!o) return isCustom ? 0 : grossAmount;

    // Security lock: completely restricts operations
    if (o.isLocked) return 0;

    // Check multi-allocations if defined
    const allocations = o.allocations;
    if (allocations && allocations.length > 0) {
      let allocSpendable = 0;
      allocations.forEach((a) => {
        if (a.isLocked) return;
        if (
          a.fundState === 'reserved' ||
          a.fundState === 'savings' ||
          a.fundState === 'amanat' ||
          a.availabilityStatus === 'reserved' ||
          a.availabilityStatus === 'savings' ||
          a.availabilityStatus === 'external'
        ) {
          return;
        }
        const ownerLower = (a.owner || '').trim().toLowerCase();
        const isSelf = ownerLower === 'you' || ownerLower === 'self';
        if (a.fundState === 'spendable' || isSelf) {
          const usable = Math.max(0, a.amount - (a.reservedAmount || 0));
          allocSpendable += usable;
        }
      });
      return allocSpendable;
    }

    // Single ownership check
    const isOwn = typeof o.hasOwnThisMoney === 'boolean' ? o.hasOwnThisMoney : !isCustom;
    if (!isOwn) return 0;

    // Deduct reserved amount
    const reserved = Number(o.reservedAmount) || 0;
    return Math.max(0, grossAmount - reserved);
  };

  for (const [key, val] of Object.entries(sources)) {
    if (key === 'bank' && typeof val === 'object' && val !== null) {
      for (const [bankName, bankAmt] of Object.entries(val as Record<string, number>)) {
        const fullKey = `bank:${bankName}`;
        const isBackedVirtual = Boolean(sourceOwnership?.[fullKey]?.parentWalletKey);
        if (!isBackedVirtual) available += calculateWalletSpendable(fullKey, bankAmt, false);
      }
    } else if (key === 'custom' && typeof val === 'object' && val !== null) {
      for (const [customName, customAmt] of Object.entries(val as Record<string, number>)) {
        const fullKey = `custom:${customName}`;
        const isBackedVirtual = Boolean(sourceOwnership?.[fullKey]?.parentWalletKey);
        if (!isBackedVirtual) available += calculateWalletSpendable(fullKey, customAmt, true);
      }
    } else if (typeof val === 'number') {
      const isBackedVirtual = Boolean(sourceOwnership?.[key]?.parentWalletKey);
      if (!isBackedVirtual) available += calculateWalletSpendable(key, val, false);
    }
  }

  return available;
}

/** Partition non-virtual funds into Spendable, Reserved, Savings allocation, and Amanat */
function computeOverviewBreakdown(snapshot: TotalCashSnapshot): FinancialOverviewData {
  let spendable = 0;
  let reserved = 0;
  let savings = 0;
  let amanat = 0;

  const { sources, sourceOwnership } = snapshot;
  const savingsRegex = /saving|emergency|goal|fund|invest/i;

  const classifyWallet = (key: string, label: string, grossAmount: number, isCustom = false) => {
    if (!grossAmount || grossAmount <= 0) return;
    const o = sourceOwnership?.[key];
    const isSavingsWallet = savingsRegex.test(`${o?.purpose || ''} ${label}`);

    if (o?.allocations && o.allocations.length > 0) {
      let allocatedTotal = 0;
      o.allocations.forEach((a) => {
        const aAmt = Number(a.amount) || 0;
        if (aAmt <= 0) return;
        allocatedTotal += aAmt;

        const ownerLower = (a.owner || '').trim().toLowerCase();
        const isSelf = ownerLower === 'you' || ownerLower === 'self' || ownerLower === '';
        const isSavingsAlloc = isSavingsWallet || savingsRegex.test(a.purpose || '');

        // 1. Respect explicit 4-state fundState / availabilityStatus first
        if (a.fundState === 'amanat' || a.availabilityStatus === 'external') {
          amanat += aAmt;
          return;
        }
        if (
          a.fundState === 'savings' ||
          a.availabilityStatus === 'savings' ||
          ownerLower === 'savings'
        ) {
          savings += aAmt;
          return;
        }
        if (
          a.fundState === 'reserved' ||
          a.availabilityStatus === 'reserved' ||
          ownerLower === 'reserved'
        ) {
          reserved += aAmt;
          return;
        }
        if (a.fundState === 'spendable') {
          if (o.isLocked || a.isLocked) reserved += aAmt;
          else spendable += aAmt;
          return;
        }

        // 2. Fallback for legacy allocations without explicit fundState
        if (!isSelf) {
          amanat += aAmt;
        } else if (o.isLocked || a.isLocked) {
          if (isSavingsAlloc) savings += aAmt;
          else reserved += aAmt;
        } else {
          const res = Math.min(aAmt, Number(a.reservedAmount) || 0);
          const usable = Math.max(0, aAmt - res);
          if (res > 0) {
            if (isSavingsAlloc) savings += res;
            else reserved += res;
          }
          spendable += usable;
        }
      });

      const remainder = Math.max(0, grossAmount - allocatedTotal);
      if (remainder > 0) {
        if (o.isLocked) {
          if (isSavingsWallet) savings += remainder;
          else reserved += remainder;
        } else {
          spendable += remainder;
        }
      }
      return;
    }

    const isOwn = o ? (typeof o.hasOwnThisMoney === 'boolean' ? o.hasOwnThisMoney : !isCustom) : !isCustom;
    if (!isOwn) {
      amanat += grossAmount;
      return;
    }

    if (o?.isLocked) {
      if (isSavingsWallet) savings += grossAmount;
      else reserved += grossAmount;
      return;
    }

    const res = Math.min(grossAmount, Number(o?.reservedAmount) || 0);
    const usable = Math.max(0, grossAmount - res);
    if (res > 0) {
      if (isSavingsWallet) savings += res;
      else reserved += res;
    }
    spendable += usable;
  };

  if (sources) {
    for (const [key, val] of Object.entries(sources)) {
      if (key === 'bank' && typeof val === 'object' && val !== null) {
        for (const [bankName, bankAmt] of Object.entries(val as Record<string, number>)) {
          const fullKey = `bank:${bankName}`;
          const isBackedVirtual = Boolean(sourceOwnership?.[fullKey]?.parentWalletKey);
          if (!isBackedVirtual && typeof bankAmt === 'number') classifyWallet(fullKey, bankName, bankAmt, false);
        }
      } else if (key === 'custom' && typeof val === 'object' && val !== null) {
        for (const [customName, customAmt] of Object.entries(val as Record<string, number>)) {
          const fullKey = `custom:${customName}`;
          const isBackedVirtual = Boolean(sourceOwnership?.[fullKey]?.parentWalletKey);
          if (!isBackedVirtual && typeof customAmt === 'number') classifyWallet(fullKey, customName, customAmt, true);
        }
      } else if (typeof val === 'number') {
        const isBackedVirtual = Boolean(sourceOwnership?.[key]?.parentWalletKey);
        if (!isBackedVirtual) classifyWallet(key, key, val, false);
      }
    }
  }

  const total = spendable + reserved + savings + amanat;

  return {
    total,
    items: [
      {
        key: 'spendable',
        label: 'Spendable',
        amount: spendable,
        bar: 'bg-green-500',
        dot: 'bg-green-500',
        text: 'text-green-400',
        tint: 'bg-green-500/10',
        ring: 'ring-green-500/40',
      },
      {
        key: 'reserved',
        label: 'Reserved',
        amount: reserved,
        bar: 'bg-blue-600',
        dot: 'bg-blue-500',
        text: 'text-blue-400',
        tint: 'bg-blue-500/10',
        ring: 'ring-blue-500/40',
      },
      {
        key: 'savings',
        label: 'Savings allocation',
        amount: savings,
        bar: 'bg-amber-500',
        dot: 'bg-amber-500',
        text: 'text-amber-400',
        tint: 'bg-amber-500/10',
        ring: 'ring-amber-500/40',
      },
      {
        key: 'amanat',
        label: 'Amanat',
        amount: amanat,
        bar: 'bg-slate-400',
        dot: 'bg-slate-400',
        text: 'text-slate-300',
        tint: 'bg-slate-400/10',
        ring: 'ring-slate-400/40',
      },
    ],
  };
}

export interface WalletItem {
  id: string;
  sourceType: TransactionSource;
  name: string;
  walletType: WalletType;
  bankName?: string;
  customName?: string;
  category: 'built-in' | 'bank' | 'custom';
  owner: string;
  holderName?: string;
  hasOwnThisMoney: boolean;
  isLocked: boolean;
  isVirtual?: boolean;
  parentWalletKey?: string;
  reservedAmount?: number;
  purpose?: string;
  allocations?: WalletAllocation[];
  amount: number;
  initial: string;
  color: string;
  subtitle: string;
}

export default function TotalCashSnapshotComponent({
  userId,
  onProfile = () => {},
}: {
  userId: string;
  onProfile?: () => void;
}) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const [snapshot, setSnapshot] = useState<TotalCashSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balancesVisible, setBalancesVisible] = useState(true);

  // Dialog open states
  const [openAdd, setOpenAdd] = useState(false);
  const [moneyDialogMode, setMoneyDialogMode] = useState<'add' | 'deduct'>('add');
  const [preselectedWalletId, setPreselectedWalletId] = useState<string>('');

  const [openTransfer, setOpenTransfer] = useState(false);
  const [transferFromSource, setTransferFromSource] = useState<TransactionSource | undefined>(undefined);
  const [transferFromBankName, setTransferFromBankName] = useState<string | undefined>(undefined);

  const [openLoan, setOpenLoan] = useState(false);
  const [openLiability, setOpenLiability] = useState(false);
  const [loanDetailModal, setLoanDetailModal] = useState<'pay' | 'receive' | null>(null);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [openBudgetSettings, setOpenBudgetSettings] = useState(false);
  const {
    startDay: budgetStartDay,
    saving: savingBudgetStartDay,
    updateStartDay: updateBudgetStartDay,
  } = useBudgetStartDay(userId);
  const activeBudgetCycle = useMemo(() => getBudgetCycle(budgetStartDay), [budgetStartDay]);

  // Wallet creation & details modals
  const [openCreateWalletModal, setOpenCreateWalletModal] = useState(false);
  const [activeWalletModal, setActiveWalletModal] = useState<WalletItem | null>(null);

  // Collections data
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [banksList, setBanksList] = useState<Bank[]>([]);
  const [customHeadsList, setCustomHeadsList] = useState<CustomPaymentHead[]>([]);

  // Income & Expenses data
  const [monthlyIncomeTotal, setMonthlyIncomeTotal] = useState(0);
  const [analyticsExpenses, setAnalyticsExpenses] = useState<ExpenseAnalyticsItem[]>([]);

  // Sync state
  const [refreshing, setRefreshing] = useState(false);

  const triggerRefresh = () => {
    try {
      localStorage.removeItem(`finance_cache_${userId}`);
    } catch {}
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  // Bootstrap from cache & Firestore subscriptions
  useEffect(() => {
    if (!userId) return;

    try {
      const cachedRaw = localStorage.getItem(`finance_cache_${userId}`);
      if (cachedRaw) {
        const cache = JSON.parse(cachedRaw);
        if (cache.snapshot) {
          setSnapshot(cache.snapshot);
          setLoans(cache.loans || []);
          setLiabilities(cache.liabilities || []);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn('Cache load failed:', e);
    }

    const unsubLoans = onSnapshot(
      query(collection(db, 'loans'), where('userId', '==', userId)),
      (snap) => {
        setLoans(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LoanRecord, 'id'>) })));
      }
    );

    const unsubLiabilities = onSnapshot(
      query(collection(db, 'liabilities'), where('userId', '==', userId)),
      (snap) => {
        setLiabilities(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Liability, 'id'>) })));
      }
    );

    const unsubBanks = onSnapshot(
      query(collection(db, 'banks'), where('userId', '==', userId)),
      (snap) => {
        setBanksList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bank, 'id'>) })));
      }
    );

    const unsubHeads = onSnapshot(
      query(collection(db, 'customPaymentHeads'), where('userId', '==', userId)),
      (snap) => {
        setCustomHeadsList(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomPaymentHead, 'id'>) }))
        );
      }
    );

    const docRef = doc(db, 'totalCashSnapshots', userId);
    const unsubSnap = onSnapshot(docRef, async (docSnap) => {
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
      setRefreshing(false);
    });

    // ── Fetch all incomes & convert to monthly ─────────────────
    const unsubIncome = onSnapshot(
      query(collection(db, 'incomeSources'), where('userId', '==', userId)),
      (snap) => {
        let monthlySum = 0;
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth();

        snap.forEach((d) => {
          const inc = d.data();
          const amt = Number(inc.currentAmount || inc.amount || inc.initialAmount || 0);
          const freq = inc.frequency || 'monthly';
          const type = inc.type;

          if (freq === 'monthly') {
            monthlySum += amt;
          } else if (freq === 'weekly') {
            monthlySum += amt * 4.33;
          } else if (freq === 'daily') {
            monthlySum += amt * 30;
          } else if (freq === 'yearly') {
            monthlySum += amt / 12;
          } else if (freq === 'one_time' || type === 'one-time') {
            // Check if expected in current month
            if (inc.expectedDate) {
              const dObj =
                inc.expectedDate instanceof Timestamp
                  ? inc.expectedDate.toDate()
                  : new Date(inc.expectedDate as string | number | Date);
              if (dObj.getFullYear() === curYear && dObj.getMonth() === curMonth) {
                monthlySum += amt;
              }
            } else {
              monthlySum += amt;
            }
          } else {
            // default fallback to monthly
            monthlySum += amt;
          }
        });

        setMonthlyIncomeTotal(Math.round(monthlySum));
      }
    );

    // ── Fetch all expenses (recurring & one-time for current month + analytics) ──
    const fetchExpensesMonthly = async () => {
      const analyticsList: ExpenseAnalyticsItem[] = [];
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();

      // 1. From plannedExpenses
      try {
        const snapPlanned = await getDocs(query(collection(db, 'plannedExpenses'), where('userId', '==', userId)));
        snapPlanned.forEach((d) => {
          const p = d.data() as PlannedExpense;
          const baseAmt = p.expectedAmount || 0;
          let monthAmt = 0;
          if (p.recurrence === 'monthly') {
            monthAmt = baseAmt;
          } else if (p.recurrence === 'weekly') {
            monthAmt = baseAmt * 4.33;
          } else if (p.recurrence === 'yearly') {
            monthAmt = baseAmt / 12;
          } else if (p.dueDate) {
            const dDate = p.dueDate instanceof Timestamp ? p.dueDate.toDate() : new Date(p.dueDate);
            if (!isNaN(dDate.getTime()) && dDate.getFullYear() === curYear && dDate.getMonth() === curMonth) {
              monthAmt = baseAmt;
            }
          } else {
            monthAmt = baseAmt;
          }

          if (monthAmt > 0) {
            const paid =
              p.paymentStatus === 'paid'
                ? monthAmt
                : Math.min(monthAmt, Number(p.actualPaidAmount) || 0);
            analyticsList.push({
              id: d.id,
              title: p.title,
              categoryId: mapExpenseCategoryToId(p.category),
              amount: Math.round(monthAmt),
              paidAmount: Math.round(paid),
              paid: p.paymentStatus === 'paid',
            });
          }
        });
      } catch (e) {
        console.warn('Error fetching plannedExpenses for summary:', e);
      }

      // 2. From expenditures
      try {
        const snapExp = await getDocs(query(collection(db, 'expenditures'), where('userId', '==', userId)));
        snapExp.forEach((d) => {
          const e = d.data() as Expenditure;
          const baseAmt = e.amount || 0;
          let monthAmt = 0;
          if (e.type === 'recurring') {
            if (e.frequency === 'monthly') monthAmt = baseAmt;
            else if (e.frequency === 'weekly') monthAmt = baseAmt * 4.33;
            else if (e.frequency === 'daily') monthAmt = baseAmt * 30;
          } else if (e.dueDate) {
            const dObj = e.dueDate instanceof Timestamp ? e.dueDate.toDate() : new Date(e.dueDate);
            if (dObj.getFullYear() === curYear && dObj.getMonth() === curMonth) {
              monthAmt = baseAmt;
            }
          }

          if (monthAmt > 0) {
            analyticsList.push({
              id: `exp_${d.id}`,
              title: e.title,
              categoryId: mapExpenseCategoryToId(e.category),
              amount: Math.round(monthAmt),
              paidAmount: e.isPaid ? Math.round(monthAmt) : 0,
              paid: Boolean(e.isPaid),
            });
          }
        });
      } catch (e) {
        console.warn('Error fetching expenditures for summary:', e);
      }

      setAnalyticsExpenses(analyticsList);
    };

    fetchExpensesMonthly();

    return () => {
      unsubLoans();
      unsubLiabilities();
      unsubBanks();
      unsubHeads();
      unsubSnap();
      unsubIncome();
    };
  }, [userId]);

  // Construct Wallets list
  const walletsList: WalletItem[] = useMemo(() => {
    if (!snapshot || !snapshot.sources) return [];
    const list: WalletItem[] = [];

    const getOwnerInfo = (key: string, isCustom = false) => {
      const o = snapshot.sourceOwnership?.[key];
      const isLocked = o?.isLocked ?? false;
      const hasOwn = o && typeof o.hasOwnThisMoney === 'boolean' ? o.hasOwnThisMoney : !isCustom;
      const ownerName = hasOwn ? 'You' : o?.ownerName || 'Someone else';
      const holderName = o?.holderName;
      const reservedAmount = Number(o?.reservedAmount) || 0;
      const purpose = o?.purpose;
      const allocations = o?.allocations;
      const isVirtual = Boolean(o?.isVirtual || o?.parentWalletKey);
      const parentWalletKey = o?.parentWalletKey;
      const color = o?.color;
      return {
        owner: ownerName,
        holderName,
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

    // Built-in
    const ihInfo = getOwnerInfo('in_hand', false);
    list.push({
      id: 'in_hand',
      sourceType: 'in_hand',
      name: 'Cash in Hand',
      walletType: 'cash',
      category: 'built-in',
      owner: ihInfo.owner,
      holderName: ihInfo.holderName,
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
      holderName: epInfo.holderName,
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
      holderName: jcInfo.holderName,
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
      holderName: psInfo.holderName,
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

    // Bank Wallets
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
        holderName: bInfo.holderName,
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

    // Custom / Virtual Wallets
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
        holderName: cInfo.holderName,
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

  // Totals calculations
  const overviewData = useMemo(
    () => (snapshot ? computeOverviewBreakdown(snapshot) : undefined),
    [snapshot]
  );

  // Quick summary loans/debts data
  const loanMetrics = useMemo(() => {
    let toPay = 0;
    let toReceive = 0;
    loans.forEach((l) => {
      if (!l.isSettled) {
        const rem = (l.amount || 0) - (l.paidAmount || 0);
        if (l.type === 'borrow') toPay += rem;
        else if (l.type === 'lend') toReceive += rem;
      }
    });
    liabilities.forEach((l) => {
      if (l.status !== 'settled') {
        if (l.type === 'borrowed') toPay += l.amount;
        else if (l.type === 'lend') toReceive += l.amount;
      }
    });
    return { toPay, toReceive };
  }, [loans, liabilities]);

  // Build spendable wallet + envelope options (only sources with actual spendable > 0)
  const spendableWalletsForQuickAdd = useMemo(() => {
    const opts: {
      optionId: string;
      walletKey: string;
      label: string;
      envelopeId?: string | null;
      envelopeName?: string | null;
      spendable: number;
    }[] = [];

    walletsList.forEach((w) => {
      if (w.isLocked || w.parentWalletKey) return;
      const ownership = snapshot?.sourceOwnership?.[w.id];

      if (w.allocations && w.allocations.length > 0) {
        let allocatedSum = 0;
        w.allocations.forEach((a) => {
          const amt = Number(a.amount) || 0;
          allocatedSum += amt;
          if (a.isLocked) return;
          if (
            a.fundState === 'reserved' ||
            a.fundState === 'savings' ||
            a.fundState === 'amanat' ||
            a.availabilityStatus === 'reserved' ||
            a.availabilityStatus === 'savings' ||
            a.availabilityStatus === 'external'
          ) {
            return;
          }
          const ownerLower = (a.owner || '').trim().toLowerCase();
          const isSelf = ownerLower === 'you' || ownerLower === 'self' || ownerLower === '';
          if (a.fundState === 'spendable' || isSelf) {
            const usable = Math.max(0, amt - (Number(a.reservedAmount) || 0));
            if (usable > 0) {
              opts.push({
                optionId: `${w.id}::${a.id}`,
                walletKey: w.id,
                label: w.name,
                envelopeId: a.id,
                envelopeName: a.purpose || 'Spendable',
                spendable: usable,
              });
            }
          }
        });

        const remainder = Math.max(0, w.amount - allocatedSum);
        if (
          remainder > 0 &&
          w.hasOwnThisMoney &&
          ownership?.fundState !== 'reserved' &&
          ownership?.fundState !== 'savings' &&
          ownership?.fundState !== 'amanat'
        ) {
          opts.push({
            optionId: `${w.id}::remainder`,
            walletKey: w.id,
            label: w.name,
            envelopeId: null,
            envelopeName: null,
            spendable: remainder,
          });
        }
        return;
      }

      if (
        !w.hasOwnThisMoney ||
        ownership?.fundState === 'reserved' ||
        ownership?.fundState === 'savings' ||
        ownership?.fundState === 'amanat'
      ) {
        return;
      }

      const usable = Math.max(0, w.amount - (Number(w.reservedAmount) || 0));
      if (usable > 0) {
        opts.push({
          optionId: w.id,
          walletKey: w.id,
          label: w.name,
          envelopeId: null,
          envelopeName: null,
          spendable: usable,
        });
      }
    });

    return opts;
  }, [walletsList, snapshot]);

  // Instant Quick Expense handler: marks paid in plannedExpenses, deducts Spendable wallet/envelope immediately
  const handleQuickAddExpense = async ({
    amount,
    title,
    category,
    walletKey,
    envelopeId,
    envelopeName,
    createdAt,
  }: QuickExpensePayload) => {
    if (!snapshot || !userId || amount <= 0) return;

    const targetKey = walletKey;
    const targetWallet = walletsList.find((w) => w.id === targetKey);
    const targetLabel = targetWallet?.name || 'Cash in Hand';

    const updatedSources: TotalCashSnapshot['sources'] = {
      ...snapshot.sources,
      bank: { ...(snapshot.sources.bank || {}) },
      custom: { ...(snapshot.sources.custom || {}) },
    };

    let sourceType: TransactionSource = 'in_hand';
    let bankName: string | null = null;
    let customName: string | null = null;
    let newWalletBalance = 0;

    if (targetKey.startsWith('bank:')) {
      sourceType = 'bank';
      bankName = targetKey.slice(5);
      const prev = Number(updatedSources.bank[bankName] || 0);
      newWalletBalance = Math.max(0, prev - amount);
      updatedSources.bank[bankName] = newWalletBalance;
    } else if (targetKey.startsWith('custom:')) {
      sourceType = 'custom';
      customName = targetKey.slice(7);
      const prev = Number(updatedSources.custom[customName] || 0);
      newWalletBalance = Math.max(0, prev - amount);
      updatedSources.custom[customName] = newWalletBalance;
    } else if (
      targetKey === 'in_hand' ||
      targetKey === 'easypaisa' ||
      targetKey === 'jazzcash' ||
      targetKey === 'other'
    ) {
      sourceType = targetKey;
      const prev = Number(updatedSources[targetKey] || 0);
      newWalletBalance = Math.max(0, prev - amount);
      updatedSources[targetKey] = newWalletBalance;
    }

    const updatedOwnership = applyWalletAllocationDelta(
      snapshot.sourceOwnership,
      targetKey,
      -amount,
      envelopeId,
      envelopeName
    );

    const nextSnapshot: TotalCashSnapshot = {
      ...snapshot,
      sources: updatedSources,
      sourceOwnership: updatedOwnership,
      totalAmount: computeTotalAmount({
        ...snapshot,
        sources: updatedSources,
        sourceOwnership: updatedOwnership,
      }),
      updatedAt: createdAt,
    };

    const y = createdAt.getFullYear();
    const m = String(createdAt.getMonth() + 1).padStart(2, '0');
    const d = String(createdAt.getDate()).padStart(2, '0');
    const todayISO = `${y}-${m}-${d}`;
    const optimisticId = `quick_${Date.now()}`;

    // Optimistically update Spendable & Expense Analytics immediately
    setSnapshot(nextSnapshot);
    setAnalyticsExpenses((prev) => [
      {
        id: optimisticId,
        title,
        categoryId: mapExpenseCategoryToId(category),
        amount,
        paidAmount: amount,
        paid: true,
      },
      ...prev,
    ]);

    // Persist to Firestore in parallel
    await Promise.all([
      setDoc(doc(db, 'totalCashSnapshots', userId), {
        ...nextSnapshot,
        updatedAt: serverTimestamp(),
      }),
      addDoc(collection(db, 'plannedExpenses'), {
        userId,
        title,
        category,
        expectedAmount: amount,
        actualPaidAmount: amount,
        dueDate: todayISO,
        paymentStatus: 'paid',
        recurrence: 'one_time',
        frequency: 'one_time',
        expenseType: 'one_time',
        walletId: targetKey,
        walletName: targetLabel,
        createdAt: serverTimestamp(),
      }),
      addDoc(collection(db, 'cashTransactions'), {
        userId,
        amount,
        type: 'deduct',
        source: sourceType,
        category: 'expenditure',
        eventType: 'expense',
        expenseCategory: category,
        walletName: targetLabel,
        BankName: bankName,
        customPaymentHeadName: customName,
        note: title,
        balanceAfter: newWalletBalance,
        createdAt: serverTimestamp(),
      }),
    ]);
  };

  // ── Pre-selected action triggers ───────────────────────────
  const openAddMoneyForWallet = (wId: string) => {
    setPreselectedWalletId(wId);
    setMoneyDialogMode('add');
    setOpenAdd(true);
  };

  const openSpendMoneyForWallet = (wId: string) => {
    setPreselectedWalletId(wId);
    setMoneyDialogMode('deduct');
    setOpenAdd(true);
  };

  const openTransferForWallet = (wId: string) => {
    const w = walletsList.find((item) => item.id === wId);
    if (w) {
      setTransferFromSource(w.sourceType);
      setTransferFromBankName(w.bankName);
    }
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
      fundState?: FundOwnershipState;
      allocationLabel?: string;
      amanatOwnerName?: string;
      envelopeId?: string;
      envelopeName?: string;
    }
  ) => {
    if (!snapshot || !userId) return;
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

      let prevWalletBalance = 0;
      let newWalletBalance = 0;
      if (source === 'bank' && bankName) {
        prevWalletBalance = updatedSources.bank[bankName] ?? 0;
        newWalletBalance = prevWalletBalance + amount;
        updatedSources.bank[bankName] = newWalletBalance;
      } else if (source === 'custom' && customPaymentHeadName) {
        prevWalletBalance = updatedSources.custom[customPaymentHeadName] ?? 0;
        newWalletBalance = prevWalletBalance + amount;
        updatedSources.custom[customPaymentHeadName] = newWalletBalance;
      } else if (source !== 'bank' && source !== 'custom') {
        prevWalletBalance = Number(updatedSources[source]) || 0;
        newWalletBalance = prevWalletBalance + amount;
        (updatedSources[source] as number) = newWalletBalance;
      }

      const walletKey = getSourceKey(source, bankName, customPaymentHeadName);
      const walletDisplayName =
        bankName ||
        customPaymentHeadName ||
        (source === 'in_hand'
          ? 'Cash in Hand'
          : source === 'easypaisa'
          ? 'Easypaisa'
          : source === 'jazzcash'
          ? 'JazzCash'
          : 'Personal Spending');

      const updatedOwnership = applyDepositFundState(
        snapshot.sourceOwnership,
        walletKey,
        walletDisplayName,
        prevWalletBalance,
        amount,
        meta?.fundState || 'spendable',
        {
          allocationLabel: meta?.allocationLabel,
          amanatOwnerName: meta?.amanatOwnerName || holderName,
          envelopeId: meta?.envelopeId,
          envelopeName: meta?.envelopeName,
        }
      );

      const newTotal = computeTotalAmount({
        ...snapshot,
        sources: updatedSources,
        sourceOwnership: updatedOwnership,
      });

      await addDoc(collection(db, 'cashTransactions'), {
        userId,
        amount,
        type: 'add',
        source,
        category: 'income',
        eventType: meta?.eventType || 'income',
        sourceIncomeType: meta?.sourceIncomeType || null,
        fundState: meta?.fundState || 'spendable',
        walletName: bankName || customPaymentHeadName || source,
        envelopeId: meta?.envelopeId || null,
        envelopeName: meta?.envelopeName || null,
        balanceAfter: newWalletBalance,
        balanceSnapshot: newTotal,
        note:
          note ||
          (meta?.envelopeName ? `Added to ${meta.envelopeName}` : meta?.allocationLabel) ||
          meta?.sourceIncomeType ||
          'Money added',
        BankName: bankName || null,
        customPaymentHeadName: customPaymentHeadName || null,
        holderName: meta?.amanatOwnerName || holderName || null,
        createdAt: serverTimestamp(),
      });

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sources: updatedSources,
        sourceOwnership: updatedOwnership,
        totalAmount: newTotal,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', userId);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);
    } catch (err) {
      console.error('Add money failed:', err);
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
      envelopeId?: string;
      envelopeName?: string;
    }
  ) => {
    if (!snapshot || !userId) return;
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

      // If an envelope was selected, deduct from that specific envelope allocation too
      let updatedOwnership = snapshot.sourceOwnership;
      if (meta?.envelopeId && snapshot.sourceOwnership) {
        const walletKey = getSourceKey(source, bankName, customPaymentHeadName);
        const existingOwner = snapshot.sourceOwnership[walletKey];
        if (existingOwner?.allocations && existingOwner.allocations.length > 0) {
          const nextAllocs = existingOwner.allocations.map((alloc) => {
            if (alloc.id !== meta.envelopeId) return alloc;
            const nextAmt = Math.max(0, (Number(alloc.amount) || 0) - amount);
            const nextRes = Math.min(nextAmt, Math.max(0, (Number(alloc.reservedAmount) || 0) - amount));
            return {
              ...alloc,
              amount: nextAmt,
              reservedAmount: alloc.availabilityStatus === 'reserved' ? nextAmt : nextRes,
            };
          });
          const nextTotalReserved = nextAllocs.reduce(
            (sum, a) => sum + (Number(a.reservedAmount) || 0),
            0
          );
          updatedOwnership = {
            ...snapshot.sourceOwnership,
            [walletKey]: {
              ...existingOwner,
              allocations: nextAllocs,
              reservedAmount: nextTotalReserved,
            },
          };
        }
      }

      const newTotal = computeTotalAmount({
        ...snapshot,
        sources: updatedSources,
        sourceOwnership: updatedOwnership,
      });

      const resolvedNote =
        note ||
        (meta?.envelopeName
          ? `${meta?.expenseCategory || 'Expense'} (${meta.envelopeName})`
          : meta?.expenseCategory || 'Expense deduction');

      await addDoc(collection(db, 'cashTransactions'), {
        userId,
        amount,
        type: 'deduct',
        source,
        category: 'expenditure',
        eventType: 'expense',
        expenseCategory: meta?.expenseCategory || 'General Expense',
        subCategory: meta?.subCategory || null,
        walletName: bankName || customPaymentHeadName || source,
        envelopeId: meta?.envelopeId || null,
        envelopeName: meta?.envelopeName || null,
        balanceAfter: newWalletBalance,
        balanceSnapshot: newTotal,
        note: resolvedNote,
        BankName: bankName || null,
        customPaymentHeadName: customPaymentHeadName || null,
        holderName: holderName || null,
        createdAt: serverTimestamp(),
      });

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sources: updatedSources,
        sourceOwnership: updatedOwnership,
        totalAmount: newTotal,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', userId);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);
    } catch (err) {
      console.error('Deduct money failed:', err);
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
    note?: string,
    meta?: {
      fromEnvelopeId?: string;
      fromEnvelopeName?: string;
      fromFundState?: FundOwnershipState;
      toEnvelopeId?: string;
      toEnvelopeName?: string;
      toFundState?: FundOwnershipState;
    }
  ) => {
    if (!snapshot || !userId) return;
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
      const targetSource = toSource || fromSource;
      const targetBankName = toSource ? toBankName : fromBankName;
      const targetCustomName = toSource ? toCustomName : fromCustomName;

      let fromRemaining = 0;
      if (fromSource === 'bank' && fromBankName) {
        fromRemaining = Math.max(0, (updatedSources.bank[fromBankName] ?? 0) - amount);
        updatedSources.bank[fromBankName] = fromRemaining;
      } else if (fromSource === 'custom' && fromCustomName) {
        fromRemaining = Math.max(0, (updatedSources.custom[fromCustomName] ?? 0) - amount);
        updatedSources.custom[fromCustomName] = fromRemaining;
      } else if (fromSource !== 'bank' && fromSource !== 'custom') {
        fromRemaining = Math.max(0, ((updatedSources[fromSource] as number) ?? 0) - amount);
        (updatedSources[fromSource] as number) = fromRemaining;
      }

      let toPrevBal = 0;
      let toNewBal = 0;
      if (targetSource === 'bank' && targetBankName) {
        toPrevBal = updatedSources.bank[targetBankName] ?? 0;
        toNewBal = toPrevBal + amount;
        updatedSources.bank[targetBankName] = toNewBal;
      } else if (targetSource === 'custom' && targetCustomName) {
        toPrevBal = updatedSources.custom[targetCustomName] ?? 0;
        toNewBal = toPrevBal + amount;
        updatedSources.custom[targetCustomName] = toNewBal;
      } else if (targetSource !== 'bank' && targetSource !== 'custom') {
        toPrevBal = (updatedSources[targetSource] as number) ?? 0;
        toNewBal = toPrevBal + amount;
        (updatedSources[targetSource] as number) = toNewBal;
      }

      const fromKey = getSourceKey(fromSource, fromBankName, fromCustomName);
      const toKey = getSourceKey(targetSource, targetBankName, targetCustomName);
      const toDisplayName =
        targetBankName ||
        targetCustomName ||
        (targetSource === 'in_hand'
          ? 'Cash in Hand'
          : targetSource === 'easypaisa'
          ? 'Easypaisa'
          : targetSource === 'jazzcash'
          ? 'JazzCash'
          : 'Personal Spending');

      // 1. Deduct from source wallet envelope allocation
      let updatedOwnership = applyWalletAllocationDelta(
        snapshot.sourceOwnership,
        fromKey,
        -amount,
        meta?.fromEnvelopeId,
        meta?.fromEnvelopeName
      );

      // 2. Credit destination wallet envelope allocation
      if (meta?.toEnvelopeId) {
        updatedOwnership = applyDepositFundState(
          updatedOwnership,
          toKey,
          toDisplayName,
          toPrevBal,
          amount,
          meta?.toFundState || 'spendable',
          {
            envelopeId: meta.toEnvelopeId,
            envelopeName: meta.toEnvelopeName,
          }
        );
      } else {
        updatedOwnership = applyWalletAllocationDelta(
          updatedOwnership,
          toKey,
          amount
        );
      }

      const newTotal = computeTotalAmount({
        ...snapshot,
        sources: updatedSources,
        sourceOwnership: updatedOwnership,
      });

      await addDoc(collection(db, 'cashTransactions'), {
        userId,
        amount,
        type: 'transfer',
        source: fromSource,
        category: 'transfer',
        eventType: 'transfer',
        balanceAfter: fromRemaining,
        balanceSnapshot: newTotal,
        fromEnvelopeId: meta?.fromEnvelopeId || null,
        fromEnvelopeName: meta?.fromEnvelopeName || null,
        toEnvelopeId: meta?.toEnvelopeId || null,
        toEnvelopeName: meta?.toEnvelopeName || null,
        note:
          note ||
          `Transfer: ${fromBankName || fromCustomName || fromSource}${
            meta?.fromEnvelopeName ? ` (${meta.fromEnvelopeName})` : ''
          } ➔ ${targetBankName || targetCustomName || targetSource}${
            meta?.toEnvelopeName ? ` (${meta.toEnvelopeName})` : ''
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
        sourceOwnership: updatedOwnership,
        totalAmount: newTotal,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', userId);
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
    if (!snapshot || !userId) return;
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

      const docRef = doc(db, 'totalCashSnapshots', userId);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);

      if (activeWalletModal && activeWalletModal.id === walletId) {
        setActiveWalletModal({ ...activeWalletModal, isLocked: !currentLock });
      }
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
    hasOwnThisMoney: boolean,
    walletHolderName?: string
  ) => {
    if (!snapshot || !userId) return;
    try {
      const existing = snapshot.sourceOwnership?.[walletId];
      const nextHolderName =
        walletHolderName !== undefined ? walletHolderName : existing?.holderName;
      const updatedOwnership = {
        ...(snapshot.sourceOwnership || {}),
        [walletId]: {
          ...(existing || {}),
          hasOwnThisMoney,
          ownerName: hasOwnThisMoney ? '' : ownerName,
          ...(nextHolderName !== undefined ? { holderName: nextHolderName } : {}),
          reservedAmount,
          allocations,
        },
      };

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sourceOwnership: updatedOwnership,
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', userId);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);
      setActiveWalletModal(null);
    } catch (e) {
      console.error('Update allocations failed:', e);
    }
  };

  // ── Handler: Delete Custom / Bank Wallet ────────────────────
  const handleDeleteWallet = async (walletId: string) => {
    if (!snapshot || !userId) return;
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

      if (isBank) {
        delete updatedSources.bank[walletName];
      } else if (isCustom) {
        delete updatedSources.custom[walletName];
      }

      const updatedOwnership = { ...(snapshot.sourceOwnership || {}) };
      delete updatedOwnership[walletId];

      const updatedSnapshot: TotalCashSnapshot = {
        ...snapshot,
        sources: updatedSources,
        sourceOwnership: updatedOwnership,
        totalAmount: computeTotalAmount({
          ...snapshot,
          sources: updatedSources,
          sourceOwnership: updatedOwnership,
        }),
        updatedAt: new Date(),
      };

      const docRef = doc(db, 'totalCashSnapshots', userId);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      setSnapshot(updatedSnapshot);

      if (isBank) {
        const matchingBanks = banksList.filter((b) => b.name === walletName && b.id);
        await Promise.all(matchingBanks.map((b) => deleteDoc(doc(db, 'banks', b.id!))));
      } else if (isCustom) {
        const matchingHeads = customHeadsList.filter((c) => c.name === walletName && c.id);
        await Promise.all(
          matchingHeads.map((c) => deleteDoc(doc(db, 'customPaymentHeads', c.id!)))
        );
      }

      setActiveWalletModal(null);
    } catch (e) {
      console.error('Delete wallet failed:', e);
    }
  };

  if (loading || !snapshot) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-20 ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        <RefreshCw size={24} className="animate-spin text-blue-500 mb-2" />
        <span className="text-xs">Loading financial overview…</span>
      </div>
    );
  }

  return (
    <div
      className={`antialiased font-sans pb-28 sm:pb-16 transition-colors ${
        isDark ? 'bg-transparent text-white' : 'bg-transparent text-slate-900'
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col px-0 pt-1">
        {/* ── Top Header ────────────────────────────────────────── */}
        <header className="mb-3.5 flex items-start justify-between px-1">
          <div>
            <h1
              className={`text-2xl font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              MyOrbit
            </h1>
            <p className={`mt-0.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Your financial overview
              {budgetStartDay !== 1 && (
                <span className="ml-1.5 text-xs opacity-80">
                  • {activeBudgetCycle.label} ({activeBudgetCycle.rangeLabel})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpenBudgetSettings(true)}
              aria-label="Budget month start settings"
              title={`Month starts on day ${budgetStartDay}`}
              className={`rounded-full p-2 transition-all cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Settings size={18} strokeWidth={2} />
            </button>
            <button
              onClick={triggerRefresh}
              aria-label="Refresh financial data"
              className={`rounded-full p-2 transition-all cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              } ${refreshing ? 'animate-spin text-blue-500' : ''}`}
              title="Sync latest live data"
            >
              <RefreshCw size={18} strokeWidth={2} />
            </button>
            <button
              aria-label="Open profile"
              onClick={onProfile}
              className={`rounded-full p-2 transition-all cursor-pointer ${
                isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <UserCircle2 size={24} strokeWidth={1.9} />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col gap-3.5">
          {/* ── Quick Paid Expense Bar ── */}
          <QuickExpense
            onAdd={handleQuickAddExpense}
            spendableWallets={spendableWalletsForQuickAdd}
            isDark={isDark}
          />

          {/* ── Row 1: Financial Overview (Left 50%) + Expense Analytics (Right 50%) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="h-full"
            >
              <FinancialOverview
                data={overviewData}
                illustrative={false}
                balancesVisible={balancesVisible}
                onToggleBalancesVisible={() => setBalancesVisible((v) => !v)}
                isDark={isDark}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.06, ease: 'easeOut' }}
              className="h-full"
            >
              <ExpenseAnalytics
                expenses={analyticsExpenses}
                income={monthlyIncomeTotal}
                heroCount={3}
                topCount={5}
                balancesVisible={balancesVisible}
                isDark={isDark}
              />
            </motion.div>
          </div>

          {/* ── Row 2: Income & Loans (Left) + Upcoming Expenses & Quick Actions (Right) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.12, ease: 'easeOut' }}
            >
              <MonthlyMoneyOverview
                data={{
                  income: monthlyIncomeTotal,
                  liabilities: loanMetrics.toPay,
                  receivables: loanMetrics.toReceive,
                }}
                balancesVisible={balancesVisible}
                onPayBackClick={() => setLoanDetailModal('pay')}
                onGetBackClick={() => setLoanDetailModal('receive')}
                isDark={isDark}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.18, ease: 'easeOut' }}
              className="flex flex-col gap-3.5"
            >
              {/* ── Set Budget / Budget Allocation Creative Card ─── */}
              <Link
                href="/finance/budget"
                className={`group relative flex items-center justify-between overflow-hidden rounded-3xl border px-4 sm:px-5 py-4 transition-all duration-300 hover:scale-[1.01] cursor-pointer ${
                  isDark
                    ? 'border-teal-500/25 bg-[#1f2430] text-white shadow-xl hover:border-teal-400/50'
                    : 'border-teal-200/80 bg-white text-slate-900 shadow-sm hover:border-teal-300 hover:shadow-md'
                }`}
              >
                {/* Decorative corner bubbles */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full transition-transform duration-500 group-hover:scale-110 ${
                    isDark ? 'bg-teal-500/15' : 'bg-teal-200/60'
                  }`}
                />
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute -bottom-10 right-8 h-24 w-24 rounded-full transition-transform duration-500 group-hover:scale-110 ${
                    isDark ? 'bg-cyan-500/15' : 'bg-emerald-200/50'
                  }`}
                />
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute right-24 top-3 h-2.5 w-2.5 rounded-full ${
                    isDark ? 'bg-amber-400/35' : 'bg-amber-400/60'
                  }`}
                />

                <div className="relative z-10 flex items-center gap-4 min-w-0">
                  {/* Custom colored SVG Budget Pie Icon */}
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset transition-transform duration-300 group-hover:scale-105 ${
                      isDark
                        ? 'bg-teal-500/15 ring-teal-400/30'
                        : 'bg-white ring-teal-200 shadow-2xs'
                    }`}
                  >
                    <svg
                      width="30"
                      height="30"
                      viewBox="0 0 36 36"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="budgetMainGrad" x1="6" y1="6" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#14B8A6" />
                          <stop offset="1" stopColor="#0D9488" />
                        </linearGradient>
                        <linearGradient id="budgetSliceGrad" x1="18" y1="5" x2="31" y2="18" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#FBBF24" />
                          <stop offset="1" stopColor="#F59E0B" />
                        </linearGradient>
                      </defs>
                      <circle cx="17" cy="19" r="11.5" fill="url(#budgetMainGrad)" />
                      <path
                        d="M19.5 6.5C25.3 6.9 29.9 11.5 30.3 17.3H19.5V6.5Z"
                        fill="url(#budgetSliceGrad)"
                      />
                      <circle cx="17" cy="19" r="4.5" fill={isDark ? '#1f2430' : '#ffffff'} />
                    </svg>
                  </div>

                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-base font-bold tracking-tight ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        Set Monthly Budget
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isDark
                            ? 'bg-teal-500/20 text-teal-300'
                            : 'bg-teal-100 text-teal-700'
                        }`}
                      >
                        Planner
                      </span>
                    </div>
                    <span className={`block text-xs mt-0.5 truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      Allocate income across expenses &amp; wallets
                    </span>
                  </div>
                </div>

                <div
                  className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300 group-hover:translate-x-0.5 ${
                    isDark
                      ? 'border-teal-400/25 bg-teal-500/15 text-teal-300 group-hover:bg-teal-500/25'
                      : 'border-teal-200 bg-white/90 text-teal-700 shadow-xs group-hover:bg-teal-50'
                  }`}
                >
                  <ChevronRight size={18} />
                </div>
              </Link>

              {/* ── Transaction History Dedicated Button ────────── */}
              <button
                type="button"
                onClick={() => setShowTransactionHistory(true)}
                className={`w-full flex items-center justify-between p-4 rounded-3xl border transition-all cursor-pointer group shadow-sm ${
                  isDark
                    ? 'bg-[#1f2430] border-white/10 hover:border-blue-500/40 hover:bg-[#262c3b] text-slate-300 hover:text-white'
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                      isDark
                        ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                        : 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}
                  >
                    <History size={18} />
                  </div>
                  <div className="text-left">
                    <span
                      className={`text-sm font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}
                    >
                      See Transaction History
                    </span>
                    <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Search, filter &amp; view historical balance snapshots
                    </span>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className={`transition-colors ${
                    isDark
                      ? 'text-slate-500 group-hover:text-blue-400'
                      : 'text-slate-400 group-hover:text-blue-600'
                  }`}
                />
              </button>
            </motion.div>
          </div>
        </main>

        {/* ── Floating Bottom Action Bar ────────────────────────── */}
        <div
          className={`sticky bottom-20 sm:bottom-6 mt-6 mx-auto w-full max-w-lg z-30 flex items-center justify-between gap-2 p-2 backdrop-blur-md border rounded-2xl ${
            isDark
              ? 'bg-[#1f2430]/95 border-white/10 shadow-2xl'
              : 'bg-white/95 border-slate-200 shadow-lg'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setPreselectedWalletId('');
              setMoneyDialogMode('add');
              setOpenAdd(true);
            }}
            className="flex-1 py-2.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            <PlusCircle size={16} />
            <span>Add</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPreselectedWalletId('');
              setMoneyDialogMode('deduct');
              setOpenAdd(true);
            }}
            className="flex-1 py-2.5 px-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            <MinusCircle size={16} />
            <span>Spend</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTransferFromSource(undefined);
              setTransferFromBankName(undefined);
              setOpenTransfer(true);
            }}
            className="flex-1 py-2.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            <ArrowRightLeft size={16} />
            <span>Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTransactionHistory(true)}
            className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title="Transaction History & Audit"
          >
            <History size={17} />
          </button>
        </div>
      </div>

      {/* ════════════════════ MODALS ════════════════════ */}

      {/* Add / Deduct Money Modal with preselected wallet */}
      <AddMoney
        externalOpen={openAdd}
        onOpenCreateWallet={() => setOpenCreateWalletModal(true)}
        onExternalClose={() => {
          setOpenAdd(false);
          setPreselectedWalletId('');
        }}
        defaultMode={moneyDialogMode}
        preselectedWalletId={preselectedWalletId}
        onSave={handleAddMoney}
        onDeduct={handleDeductMoney}
        saving={saving}
        snapshot={snapshot}
      />

      {/* Transfer Funds Modal with preselected from wallet */}
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

      {/* Loan Record Modal */}
      <LoanDialog
        snapshot={snapshot}
        externalOpen={openLoan}
        onExternalClose={() => setOpenLoan(false)}
        onAddMoney={handleAddMoney}
      />

      {/* Liability Modal */}
      <LiabilityDialog
        open={openLiability}
        onClose={() => setOpenLiability(false)}
        snapshot={snapshot}
      />

      {/* Transaction History Modal */}
      <TransactionHistory
        open={showTransactionHistory}
        onClose={() => setShowTransactionHistory(false)}
        userId={userId}
      />

      {/* Create Wallet Modal */}
      <CreateWalletModal
        open={openCreateWalletModal}
        onClose={() => setOpenCreateWalletModal(false)}
        onSave={async (wData) => {
          if (!snapshot || !userId) return;
          setSaving(true);
          try {
            const isBank = wData.walletType === 'bank';
            const cleanName = wData.name.trim();
            const initAmt = wData.openingBalance || 0;

            const collectionName = isBank ? 'banks' : 'customPaymentHeads';
            await addDoc(collection(db, collectionName), {
              userId,
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
              ...(wData.holderName ? { holderName: wData.holderName } : {}),
              isLocked: wData.isLocked,
              isVirtual: wData.isVirtual,
              fundState:
                !hasOwnThisMoney || wData.fundClassification === 'amanat'
                  ? 'amanat'
                  : wData.fundClassification === 'long_term_saving'
                  ? 'savings'
                  : wData.fundClassification === 'reserved' || wData.isReserved
                  ? 'reserved'
                  : 'spendable',
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

            const newTotal = computeTotalAmount({
              ...snapshot,
              sources: updatedSources,
              sourceOwnership: updatedOwnership,
            });

            if (initAmt > 0) {
              await addDoc(collection(db, 'cashTransactions'), {
                userId,
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

            const docRef = doc(db, 'totalCashSnapshots', userId);
            await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
            setSnapshot(updatedSnapshot);
            setOpenCreateWalletModal(false);
          } catch (e) {
            console.error('Create wallet error:', e);
          } finally {
            setSaving(false);
          }
        }}
        saving={saving}
        existingWallets={walletsList.map((w) => ({
          id: w.id,
          name: w.name,
          type: w.walletType,
        }))}
      />

      {/* Budget Month Start Day Settings Modal */}
      <BudgetStartDayModal
        open={openBudgetSettings}
        onClose={() => setOpenBudgetSettings(false)}
        currentDay={budgetStartDay}
        onSave={updateBudgetStartDay}
        saving={savingBudgetStartDay}
        isDark={isDark}
      />

      {/* Redesigned Wallet Details Modal */}
      <WalletDetailsModal
        open={Boolean(activeWalletModal)}
        onClose={() => setActiveWalletModal(null)}
        wallet={activeWalletModal}
        onAddMoney={(wId) => openAddMoneyForWallet(wId)}
        onSpendMoney={(wId) => openSpendMoneyForWallet(wId)}
        onTransfer={(wId) => openTransferForWallet(wId)}
        onToggleLock={handleToggleLockWallet}
        onUpdateAllocations={handleUpdateWalletSettings}
        onDeleteWallet={handleDeleteWallet}
        userId={userId}
      />

      {/* Loan Details Modal (shown when clicking homepage Loan cards) */}
      {loanDetailModal && (() => {
        const isPay = loanDetailModal === 'pay';
        const partyRows: {
          id: string;
          partyName: string;
          remaining: number;
          total: number;
          paid: number;
          dueDateStr?: string;
          note?: string;
        }[] = [];

        loans.forEach((l) => {
          if (l.isSettled) return;
          if ((isPay && l.type === 'borrow') || (!isPay && l.type === 'lend')) {
            const total = Number(l.amount) || 0;
            const paid = Number(l.paidAmount) || 0;
            const remaining = Math.max(0, total - paid);
            if (remaining <= 0) return;
            const d = l.dueDate
              ? l.dueDate instanceof Timestamp
                ? l.dueDate.toDate()
                : new Date(l.dueDate)
              : null;
            partyRows.push({
              id: `loan_${l.id || partyRows.length}`,
              partyName: l.counterparty || (isPay ? 'Unnamed Lender' : 'Unnamed Borrower'),
              remaining,
              total,
              paid,
              dueDateStr:
                d && !Number.isNaN(d.getTime())
                  ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : undefined,
              note: l.note || l.notes,
            });
          }
        });

        liabilities.forEach((l) => {
          if (l.status === 'settled') return;
          if ((isPay && l.type === 'borrowed') || (!isPay && l.type === 'lend')) {
            const remaining = Number(l.amount) || 0;
            if (remaining <= 0) return;
            const d = l.dueDate
              ? l.dueDate instanceof Timestamp
                ? l.dueDate.toDate()
                : new Date(l.dueDate)
              : null;
            partyRows.push({
              id: `liab_${l.id || partyRows.length}`,
              partyName: l.personName || (isPay ? 'Unnamed Lender' : 'Unnamed Borrower'),
              remaining,
              total: remaining,
              paid: 0,
              dueDateStr:
                d && !Number.isNaN(d.getTime())
                  ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : undefined,
              note: l.description,
            });
          }
        });

        const totalShown = partyRows.reduce((s, r) => s + r.remaining, 0);

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
            onClick={() => setLoanDetailModal(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
                isDark
                  ? 'bg-[#181c24] border-white/10 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Header */}
              <div
                className={`flex items-center justify-between px-4 sm:px-5 py-4 border-b ${
                  isDark ? 'border-white/10' : 'border-slate-200'
                }`}
              >
                <div>
                  <h3 className="text-base font-bold tracking-tight">
                    {isPay ? 'To Pay Back (Borrowed)' : 'To Get Back (Lent)'}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {partyRows.length} active {partyRows.length === 1 ? 'party' : 'parties'} • Total{' '}
                    <span className={isPay ? 'text-red-500 font-semibold' : 'text-blue-500 font-semibold'}>
                      {balancesVisible
                        ? `Rs. ${Math.round(totalShown).toLocaleString('en-PK')}`
                        : 'Rs. •••••'}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLoanDetailModal(null)}
                  className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                  aria-label="Close loan details"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Switcher Tabs */}
              <div className="px-4 sm:px-5 pt-3">
                <div
                  className={`grid grid-cols-2 gap-1.5 p-1 rounded-2xl ${
                    isDark ? 'bg-white/5' : 'bg-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setLoanDetailModal('pay')}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isPay
                        ? 'bg-red-500 text-white shadow-sm'
                        : isDark
                        ? 'text-slate-300 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    To Pay Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoanDetailModal('receive')}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      !isPay
                        ? 'bg-blue-600 text-white shadow-sm'
                        : isDark
                        ? 'text-slate-300 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    To Get Back
                  </button>
                </div>
              </div>

              {/* Parties List */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
                {partyRows.length === 0 ? (
                  <div
                    className={`rounded-2xl border p-6 text-center text-xs ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-slate-400'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    {isPay
                      ? 'You have no active borrowed loans to pay back.'
                      : 'No one currently owes you any lent loans.'}
                  </div>
                ) : (
                  partyRows.map((row) => (
                    <div
                      key={row.id}
                      className={`rounded-2xl border p-3.5 flex items-center justify-between gap-3 ${
                        isDark
                          ? 'bg-[#1f2430] border-white/10'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{row.partyName}</p>
                        <div
                          className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          <span>{isPay ? 'Borrowed from' : 'Lent to'}</span>
                          {row.dueDateStr && <span>• Due {row.dueDateStr}</span>}
                          {row.paid > 0 && (
                            <span>
                              • Paid Rs. {Math.round(row.paid).toLocaleString('en-PK')} of Rs.{' '}
                              {Math.round(row.total).toLocaleString('en-PK')}
                            </span>
                          )}
                        </div>
                        {row.note && (
                          <p
                            className={`mt-1 text-xs line-clamp-2 ${
                              isDark ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            {row.note}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 text-sm sm:text-base font-extrabold tabular-nums ${
                          isPay
                            ? isDark
                              ? 'text-red-400'
                              : 'text-red-600'
                            : isDark
                            ? 'text-blue-400'
                            : 'text-blue-600'
                        }`}
                      >
                        {balancesVisible
                          ? `Rs. ${Math.round(row.remaining).toLocaleString('en-PK')}`
                          : 'Rs. •••••'}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Actions */}
              <div
                className={`px-4 sm:px-5 py-3.5 border-t flex items-center justify-between gap-2 ${
                  isDark ? 'border-white/10 bg-[#141820]' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setLoanDetailModal(null);
                    setOpenLoan(true);
                  }}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/15 text-slate-200'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  + Add Loan
                </button>
                <Link
                  href="/finance/loans"
                  onClick={() => setLoanDetailModal(null)}
                  className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  Manage All Loans
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
