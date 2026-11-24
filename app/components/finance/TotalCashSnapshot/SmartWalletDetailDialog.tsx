'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Check, Download, Lock, Plus, Trash2, Unlock, X } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import type {
  Expenditure,
  FundOwnershipState,
  LoanRecord,
  PlannedExpense,
  WalletAllocation as AppWalletAllocation,
} from '@/app/lib/interface';
import type { WalletItem } from '../TotalCashSnapshot';

const PALETTE = [
  'bg-indigo-600',
  'bg-rose-600',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-sky-600',
  'bg-fuchsia-600',
];
const DEFAULT_ENV_COLOR = 'bg-slate-600';

const formatRs = (n: number) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-US')}`;

const PATHS = {
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1 1 0 0 1 1 1v2" />
      <path d="M4 7.5V17a2 2 0 0 0 2 2h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5z" />
      <circle cx="15.5" cy="13.5" r="1" fill="currentColor" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  spend: <path d="M7 17L17 7M9 7h8v8" />,
  transfer: <path d="M5 8h13l-3-3M19 16H6l3 3" />,
  envelope: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>
  ),
};

function SvgIcon({
  name,
  className = 'h-5 w-5',
}: {
  name: keyof typeof PATHS;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

interface EnvelopeItem {
  id: string;
  name: string;
  balance: number;
  fundState: FundOwnershipState;
  ownerName: string | null; // person name when amanat, 'You' when spendable, null for reserved/savings
  color: string;
  isDefault?: boolean;
}

interface OwnerOption {
  name: string;
  color: string;
}

interface ImportableExpense {
  id: string;
  title: string;
  category: string;
  amount: number;
}

export interface WalletDeleteOptions {
  resolution: 'zero' | 'transfer' | 'adjustment';
  destinationWalletId?: string;
  note?: string;
}

interface SmartWalletDetailDialogProps {
  open: boolean;
  onClose: () => void;
  wallets: WalletItem[];
  activeWalletId: string | null;
  onSelectWallet: (walletId: string) => void;
  isDark: boolean;
  onAddMoney: (
    wallet: WalletItem,
    amount: number,
    note?: string,
    opts?: {
      fundState?: FundOwnershipState;
      allocationLabel?: string;
      amanatOwnerName?: string;
    }
  ) => Promise<void>;
  onSpendMoney: (wallet: WalletItem, amount: number, note?: string) => Promise<void>;
  onTransfer: (wallet: WalletItem) => void;
  onToggleLock: (walletId: string, currentLock: boolean) => Promise<void>;
  onUpdateAllocations: (
    walletId: string,
    allocations: AppWalletAllocation[],
    reservedAmount: number,
    ownerName: string,
    hasOwnThisMoney: boolean
  ) => Promise<void>;
  onDeleteWallet: (walletId: string, options: WalletDeleteOptions) => Promise<void>;
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: keyof typeof PATHS;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 text-sm font-semibold ring-1 ring-inset transition ${
        disabled
          ? 'opacity-35 cursor-not-allowed bg-slate-500/10 text-slate-400 ring-slate-500/20'
          : `cursor-pointer hover:scale-[1.02] active:scale-95 ${tone}`
      }`}
    >
      <SvgIcon name={icon} className="h-5 w-5" />
      {label}
    </button>
  );
}

function Chip({
  selected,
  color,
  isDark,
  children,
  onClick,
}: {
  selected: boolean;
  color: string;
  isDark: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 cursor-pointer ${
        selected
          ? isDark
            ? 'bg-white text-slate-900'
            : 'bg-slate-900 text-white'
          : isDark
          ? 'bg-white/10 text-slate-200 hover:bg-white/15'
          : 'bg-slate-200/80 text-slate-700 hover:bg-slate-200'
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {children}
    </button>
  );
}

export default function SmartWalletDetailDialog({
  open,
  onClose,
  wallets,
  activeWalletId,
  onSelectWallet,
  isDark,
  onAddMoney,
  onSpendMoney,
  onTransfer,
  onToggleLock,
  onUpdateAllocations,
  onDeleteWallet,
}: SmartWalletDetailDialogProps) {
  const { user } = useAuth();
  const wallet = useMemo(
    () => wallets.find((w) => w.id === activeWalletId) ?? null,
    [wallets, activeWalletId]
  );

  // Local interactive states
  const [envelopes, setEnvelopes] = useState<EnvelopeItem[]>([]);
  const [defaultFundState, setDefaultFundState] = useState<FundOwnershipState>('spendable');
  const [defaultOwnerName, setDefaultOwnerName] = useState<string | null>('You');
  const [customOwners, setCustomOwners] = useState<OwnerOption[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const [mode, setMode] = useState<'transfer' | 'owner' | 'delete' | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [addingEnv, setAddingEnv] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [addingOwner, setAddingOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Import Envelopes from Expenses state
  const [importingExpenses, setImportingExpenses] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [availableExpenses, setAvailableExpenses] = useState<ImportableExpense[]>([]);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [importError, setImportError] = useState('');

  // Active Loans linked to this wallet
  const [walletLoans, setWalletLoans] = useState<LoanRecord[]>([]);

  useEffect(() => {
    if (!open || !wallet || !user?.uid) {
      setWalletLoans([]);
      return;
    }
    let cancelled = false;
    const fetchWalletLoans = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'loans'), where('userId', '==', user.uid))
        );
        if (cancelled) return;
        const matched: LoanRecord[] = [];
        snap.forEach((d) => {
          const l = { id: d.id, ...(d.data() as Omit<LoanRecord, 'id'>) };
          if (l.isSettled) return;
          const matchesFrom =
            l.fromSourceKey === wallet.id ||
            (!l.fromSourceKey && l.fromSource === wallet.id) ||
            (wallet.bankName && l.fromSourceName === `Bank (${wallet.bankName})`) ||
            (wallet.customName && l.fromSourceName === `Wallet (${wallet.customName})`);
          const matchesTo =
            l.toSourceKey === wallet.id ||
            (!l.toSourceKey && l.toSource === wallet.id) ||
            (wallet.bankName && l.toSourceName === `Bank (${wallet.bankName})`) ||
            (wallet.customName && l.toSourceName === `Wallet (${wallet.customName})`);
          if (matchesFrom || matchesTo) {
            matched.push(l);
          }
        });
        setWalletLoans(matched);
      } catch (err) {
        console.warn('Failed to fetch wallet loans:', err);
      }
    };
    fetchWalletLoans();
    return () => {
      cancelled = true;
    };
  }, [open, wallet, user?.uid]);

  // Inline quick Add / Spend state
  const [quickAction, setQuickAction] = useState<'add' | 'spend' | null>(null);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [quickFundState, setQuickFundState] = useState<FundOwnershipState>('spendable');
  const [quickAmanatOwner, setQuickAmanatOwner] = useState('');
  const [quickError, setQuickError] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  // Graceful Wallet Closure / Delete flow state
  const [showDeleteFlow, setShowDeleteFlow] = useState(false);
  const [deleteChoice, setDeleteChoice] = useState<'transfer' | 'adjustment' | null>(null);
  const [deleteTargetWalletId, setDeleteTargetWalletId] = useState('');
  const [deleteNote, setDeleteNote] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingWallet, setDeletingWallet] = useState(false);

  // Sync envelopes & owners from the active wallet whenever wallet changes
  useEffect(() => {
    if (!wallet) return;
    const isWalletReserved =
      wallet.hasOwnThisMoney &&
      wallet.amount > 0 &&
      (wallet.reservedAmount || 0) >= wallet.amount;

    const parsedCustom: EnvelopeItem[] = [];
    const discoveredOwners: OwnerOption[] = [];

    const ensureOwner = (name: string) => {
      const clean = name.trim();
      const lower = clean.toLowerCase();
      if (!clean || lower === 'you' || lower === 'self' || lower === 'reserved' || lower === 'savings') {
        return;
      }
      if (!discoveredOwners.some((o) => o.name.toLowerCase() === lower)) {
        discoveredOwners.push({
          name: clean,
          color: PALETTE[discoveredOwners.length % PALETTE.length],
        });
      }
    };

    if (wallet.owner && wallet.owner !== 'You') {
      ensureOwner(wallet.owner);
    }

    let derivedDefaultState: FundOwnershipState = !wallet.hasOwnThisMoney
      ? 'amanat'
      : isWalletReserved
      ? 'reserved'
      : 'spendable';
    let derivedDefaultOwner: string | null =
      derivedDefaultState === 'spendable'
        ? 'You'
        : derivedDefaultState === 'amanat'
        ? wallet.owner || 'Amanat'
        : null;

    const resolveRowState = (a: AppWalletAllocation): { state: FundOwnershipState; ownerName: string | null } => {
      const ownerLower = (a.owner || '').trim().toLowerCase();
      if (a.fundState === 'amanat' || a.availabilityStatus === 'external') {
        const cleanOwner = a.owner && ownerLower !== 'you' && ownerLower !== 'reserved' && ownerLower !== 'savings' ? a.owner : 'Amanat';
        return { state: 'amanat', ownerName: cleanOwner };
      }
      if (a.fundState === 'savings' || a.availabilityStatus === 'savings' || ownerLower === 'savings') {
        return { state: 'savings', ownerName: null };
      }
      if (
        a.fundState === 'reserved' ||
        a.availabilityStatus === 'reserved' ||
        ownerLower === 'reserved' ||
        (a.reservedAmount !== undefined && a.reservedAmount >= a.amount && a.amount > 0 && (ownerLower === 'you' || ownerLower === 'self' || ownerLower === ''))
      ) {
        return { state: 'reserved', ownerName: null };
      }
      if (a.fundState === 'spendable' || ownerLower === 'you' || ownerLower === 'self' || ownerLower === '') {
        return { state: 'spendable', ownerName: 'You' };
      }
      return { state: 'amanat', ownerName: a.owner };
    };

    if (wallet.allocations && wallet.allocations.length > 0) {
      wallet.allocations.forEach((a, idx) => {
        const isDefaultRow =
          a.id.startsWith('default_') ||
          (a.purpose && a.purpose.toLowerCase() === wallet.name.toLowerCase());
        const resolved = resolveRowState(a);
        if (resolved.state === 'amanat' && resolved.ownerName) {
          ensureOwner(resolved.ownerName);
        }

        if (isDefaultRow) {
          derivedDefaultState = resolved.state;
          derivedDefaultOwner = resolved.ownerName;
        } else {
          parsedCustom.push({
            id: a.id || `env_${idx}`,
            name: a.purpose || `Envelope ${idx + 1}`,
            balance: Number(a.amount) || 0,
            fundState: resolved.state,
            ownerName: resolved.ownerName,
            color: PALETTE[parsedCustom.length % PALETTE.length],
          });
        }
      });
    }

    setDefaultFundState(derivedDefaultState);
    setDefaultOwnerName(derivedDefaultOwner);
    setEnvelopes(parsedCustom);
    setCustomOwners(discoveredOwners);
    setActiveEnvId(null);
    setMode(null);
    setAddingEnv(false);
    setAddingOwner(false);
    setImportingExpenses(false);
    setSelectedExpenseIds([]);
    setImportError('');
    setError('');
    setQuickAction(null);
    setQuickAmount('');
    setQuickNote('');
    setQuickFundState('spendable');
    setQuickAmanatOwner('');
    setQuickError('');
    setShowDeleteFlow(false);
    setDeleteChoice(null);
    setDeleteTargetWalletId('');
    setDeleteNote('');
    setDeleteError('');
  }, [wallet]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !wallet) return null;

  const walletBalance = wallet.amount || 0;
  const allocated = envelopes.reduce((s, e) => s + e.balance, 0);
  const defaultBalance = Math.max(0, walletBalance - allocated);

  // Default 1 envelope named as per wallet creation name
  const defaultEnvelope: EnvelopeItem = {
    id: 'default',
    name: wallet.name,
    balance: defaultBalance,
    fundState: defaultFundState,
    ownerName: defaultOwnerName,
    color: DEFAULT_ENV_COLOR,
    isDefault: true,
  };

  const items: EnvelopeItem[] = [defaultEnvelope, ...envelopes];

  const total = items.reduce((s, e) => s + e.balance, 0);
  const spendable = items
    .filter((e) => e.fundState === 'spendable')
    .reduce((s, e) => s + e.balance, 0);
  const reserved = items
    .filter((e) => e.fundState === 'reserved')
    .reduce((s, e) => s + e.balance, 0);
  const savingsAmt = items
    .filter((e) => e.fundState === 'savings')
    .reduce((s, e) => s + e.balance, 0);
  const amanatAmt = items
    .filter((e) => e.fundState === 'amanat')
    .reduce((s, e) => s + e.balance, 0);

  const active = items.find((e) => e.id === activeEnvId) ?? null;
  const others = items.filter((e) => e.id !== activeEnvId);

  const resetPanel = () => {
    setMode(null);
    setToId(null);
    setValue('');
    setAddingOwner(false);
    setNewOwnerName('');
    setError('');
  };

  const selectItem = (id: string) => {
    resetPanel();
    setActiveEnvId((cur) => (cur === id ? null : id));
  };

  const openMode = (m: 'transfer' | 'owner' | 'delete') => {
    setMode(m);
    setValue('');
    setError('');
    setToId(m === 'delete' ? 'default' : others[0]?.id ?? null);
  };

  const mapEnvelopeToAllocation = (
    id: string,
    name: string,
    balance: number,
    state: FundOwnershipState,
    ownerName: string | null
  ): AppWalletAllocation => {
    if (state === 'spendable') {
      return {
        id,
        owner: 'You',
        amount: balance,
        purpose: name,
        reservedAmount: 0,
        availabilityStatus: 'available',
        fundState: 'spendable',
      };
    }
    if (state === 'reserved') {
      return {
        id,
        owner: 'Reserved',
        amount: balance,
        purpose: name,
        reservedAmount: balance,
        availabilityStatus: 'reserved',
        fundState: 'reserved',
      };
    }
    if (state === 'savings') {
      return {
        id,
        owner: 'Savings',
        amount: balance,
        purpose: name,
        reservedAmount: balance,
        availabilityStatus: 'savings',
        fundState: 'savings',
      };
    }
    return {
      id,
      owner: ownerName?.trim() || 'Amanat',
      amount: balance,
      purpose: name,
      reservedAmount: balance,
      availabilityStatus: 'external',
      fundState: 'amanat',
    };
  };

  // Persist current envelopes & default envelope state back to Firestore
  const persistEnvelopes = async (
    nextEnvelopes: EnvelopeItem[],
    nextDefaultState: FundOwnershipState,
    nextDefaultOwner: string | null
  ) => {
    setSaving(true);
    try {
      const nextAllocated = nextEnvelopes.reduce((s, e) => s + e.balance, 0);
      const nextDefaultBal = Math.max(0, walletBalance - nextAllocated);

      const allAllocs: AppWalletAllocation[] = [
        mapEnvelopeToAllocation(
          `default_${wallet.id}`,
          wallet.name,
          nextDefaultBal,
          nextDefaultState,
          nextDefaultOwner
        ),
        ...nextEnvelopes.map((env) =>
          mapEnvelopeToAllocation(env.id, env.name, env.balance, env.fundState, env.ownerName)
        ),
      ];

      const totalReserved = allAllocs.reduce((s, a) => s + (a.reservedAmount || 0), 0);
      const hasOwnedFunds = allAllocs.some(
        (a) => a.amount > 0 && a.fundState !== 'amanat' && a.availabilityStatus !== 'external'
      );
      const primaryOwner = hasOwnedFunds
        ? 'You'
        : nextDefaultOwner || wallet.owner || 'You';

      await onUpdateAllocations(
        wallet.id,
        allAllocs,
        totalReserved,
        primaryOwner,
        hasOwnedFunds || wallet.hasOwnThisMoney
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEnvelope = async () => {
    const title = newEnvName.trim();
    if (!title) return;
    if (items.some((e) => e.name.toLowerCase() === title.toLowerCase())) {
      setError('Envelope already exists');
      return;
    }
    const color =
      PALETTE.find((c) => !envelopes.some((e) => e.color === c)) ??
      PALETTE[envelopes.length % PALETTE.length];
    const newEnv: EnvelopeItem = {
      id: `env_${Date.now()}`,
      name: title,
      balance: 0,
      fundState: 'reserved',
      ownerName: null,
      color,
    };
    const next = [...envelopes, newEnv];
    setEnvelopes(next);
    setNewEnvName('');
    setError('');
    setAddingEnv(false);
    await persistEnvelopes(next, defaultFundState, defaultOwnerName);
  };

  const handleToggleImportExpenses = async () => {
    const nextOpen = !importingExpenses;
    setImportingExpenses(nextOpen);
    setAddingEnv(false);
    setImportError('');
    setSelectedExpenseIds([]);

    if (!nextOpen || !user?.uid) return;

    setLoadingExpenses(true);
    try {
      const [snapPlanned, snapExp] = await Promise.all([
        getDocs(query(collection(db, 'plannedExpenses'), where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'expenditures'), where('userId', '==', user.uid))),
      ]);

      const list: ImportableExpense[] = [];
      snapPlanned.forEach((d) => {
        const p = d.data() as PlannedExpense;
        const amt = Math.round(Number(p.expectedAmount) || 0);
        if (p.title && amt > 0) {
          list.push({
            id: `planned_${d.id}`,
            title: p.title.trim(),
            category: p.category || 'Expense',
            amount: amt,
          });
        }
      });

      snapExp.forEach((d) => {
        const e = d.data() as Expenditure;
        const amt = Math.round(Number(e.amount) || 0);
        if (e.title && amt > 0) {
          list.push({
            id: `exp_${d.id}`,
            title: e.title.trim(),
            category: e.category || 'Expense',
            amount: amt,
          });
        }
      });

      list.sort((a, b) => b.amount - a.amount);
      setAvailableExpenses(list);
    } catch (err) {
      console.error('Failed to load expenses for envelope import:', err);
      setImportError('Could not load expenses. Please try again.');
    } finally {
      setLoadingExpenses(false);
    }
  };

  const toggleSelectExpense = (expId: string) => {
    setImportError('');
    setSelectedExpenseIds((prev) =>
      prev.includes(expId) ? prev.filter((id) => id !== expId) : [...prev, expId]
    );
  };

  const selectedImportExpenses = availableExpenses.filter((exp) =>
    selectedExpenseIds.includes(exp.id)
  );
  const selectedImportTotal = selectedImportExpenses.reduce((s, exp) => s + exp.amount, 0);
  const importExceedsBalance = selectedImportTotal > defaultBalance;

  const handleConfirmImportEnvelopes = async () => {
    if (selectedImportExpenses.length === 0 || saving) return;
    if (importExceedsBalance) {
      setImportError(
        `Selected total (${formatRs(selectedImportTotal)}) exceeds available balance in ${wallet.name} (${formatRs(defaultBalance)}).`
      );
      return;
    }

    const baseTime = Date.now();
    const newEnvs: EnvelopeItem[] = [];
    selectedImportExpenses.forEach((exp, idx) => {
      const exists =
        items.some((e) => e.name.toLowerCase() === exp.title.toLowerCase()) ||
        newEnvs.some((e) => e.name.toLowerCase() === exp.title.toLowerCase());
      if (exists) return;

      const color = PALETTE[(envelopes.length + newEnvs.length) % PALETTE.length];
      newEnvs.push({
        id: `env_${baseTime}_${idx}`,
        name: exp.title,
        balance: exp.amount,
        fundState: 'reserved',
        ownerName: null, // Reserved for this expense
        color,
      });
    });

    if (newEnvs.length === 0) {
      setImportError('All selected expenses already exist as envelopes in this wallet.');
      return;
    }

    const next = [...envelopes, ...newEnvs];
    setEnvelopes(next);
    setSelectedExpenseIds([]);
    setImportingExpenses(false);
    setImportError('');
    await persistEnvelopes(next, defaultFundState, defaultOwnerName);
  };

  const handleTransferBetweenEnvelopes = async () => {
    if (!active) return;
    const amt = Number(value);
    if (!toId) return setError('Choose the receiving envelope');
    if (!amt || amt <= 0) return setError('Enter an amount');
    if (amt > active.balance) return setError('More than available balance');

    const next = envelopes.map((e) =>
      e.id === active.id
        ? { ...e, balance: e.balance - amt }
        : e.id === toId
        ? { ...e, balance: e.balance + amt }
        : e
    );
    setEnvelopes(next);
    resetPanel();
    setActiveEnvId(null);
    await persistEnvelopes(next, defaultFundState, defaultOwnerName);
  };

  const handleSetFundState = async (
    nextState: FundOwnershipState,
    amanatOwner?: string | null
  ) => {
    if (!active) return;
    const resolvedOwner =
      nextState === 'spendable'
        ? 'You'
        : nextState === 'amanat'
        ? amanatOwner?.trim() || 'Amanat'
        : null;

    if (active.isDefault) {
      setDefaultFundState(nextState);
      setDefaultOwnerName(resolvedOwner);
      resetPanel();
      await persistEnvelopes(envelopes, nextState, resolvedOwner);
    } else {
      const next = envelopes.map((e) =>
        e.id === active.id ? { ...e, fundState: nextState, ownerName: resolvedOwner } : e
      );
      setEnvelopes(next);
      resetPanel();
      await persistEnvelopes(next, defaultFundState, defaultOwnerName);
    }
  };

  const handleCreateNewOwner = async () => {
    const clean = newOwnerName.trim();
    if (!clean) return;
    if (!customOwners.some((o) => o.name.toLowerCase() === clean.toLowerCase())) {
      setCustomOwners((prev) => [
        ...prev,
        { name: clean, color: PALETTE[prev.length % PALETTE.length] },
      ]);
    }
    setNewOwnerName('');
    setAddingOwner(false);
    await handleSetFundState('amanat', clean);
  };

  const handleDeleteEnvelope = async () => {
    if (!active || active.isDefault) return;
    if (active.balance > 0 && !toId) {
      return setError('Choose where the balance goes');
    }
    const next = envelopes
      .filter((e) => e.id !== active.id)
      .map((e) => (e.id === toId ? { ...e, balance: e.balance + active.balance } : e));
    setEnvelopes(next);
    resetPanel();
    setActiveEnvId(null);
    await persistEnvelopes(next, defaultFundState, defaultOwnerName);
  };

  const toggleQuickAction = (next: 'add' | 'spend') => {
    setQuickError('');
    setQuickAmount('');
    setQuickNote('');
    setQuickAction((cur) => (cur === next ? null : next));
  };

  const handleQuickTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAction || quickSaving) return;
    setQuickError('');

    const trimmed = quickAmount.trim();
    const num = Number(trimmed);

    if (!trimmed || !Number.isFinite(num) || num <= 0) {
      setQuickError('Please enter a valid amount greater than 0.');
      return;
    }

    if (quickAction === 'spend') {
      if (wallet.isLocked) {
        setQuickError('This wallet is locked. Unlock it before spending.');
        return;
      }
      if (num > walletBalance) {
        setQuickError(`Insufficient balance. Maximum available is ${formatRs(walletBalance)}.`);
        return;
      }
    }

    setQuickSaving(true);
    try {
      const cleanNote = quickNote.trim() || undefined;
      if (quickAction === 'add') {
        await onAddMoney(wallet, num, cleanNote, {
          fundState: quickFundState,
          allocationLabel: cleanNote,
          amanatOwnerName:
            quickFundState === 'amanat' ? quickAmanatOwner.trim() || 'Amanat' : undefined,
        });
      } else {
        await onSpendMoney(wallet, num, cleanNote);
      }
      setQuickAction(null);
      setQuickAmount('');
      setQuickNote('');
      setQuickFundState('spendable');
      setQuickAmanatOwner('');
      setQuickError('');
    } catch (err) {
      setQuickError(
        err instanceof Error && err.message
          ? err.message
          : 'Transaction failed. Please try again.'
      );
    } finally {
      setQuickSaving(false);
    }
  };

  const otherWallets = wallets.filter((w) => w.id !== wallet.id);

  const openDeleteFlow = () => {
    setDeleteError('');
    setDeleteNote('');
    setDeleteChoice(null);
    setDeleteTargetWalletId(otherWallets[0]?.id || '');
    setShowDeleteFlow(true);
  };

  const handleConfirmDeleteWallet = async () => {
    if (deletingWallet) return;
    setDeleteError('');

    if (walletBalance <= 0) {
      setDeletingWallet(true);
      try {
        await onDeleteWallet(wallet.id, { resolution: 'zero' });
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Failed to delete wallet.');
      } finally {
        setDeletingWallet(false);
      }
      return;
    }

    if (!deleteChoice) {
      setDeleteError('Please select what should happen to the remaining balance.');
      return;
    }

    if (deleteChoice === 'transfer' && !deleteTargetWalletId) {
      setDeleteError('Please choose a destination wallet for the transfer.');
      return;
    }

    setDeletingWallet(true);
    try {
      await onDeleteWallet(wallet.id, {
        resolution: deleteChoice,
        destinationWalletId: deleteChoice === 'transfer' ? deleteTargetWalletId : undefined,
        note: deleteNote.trim() || undefined,
      });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to close wallet.');
    } finally {
      setDeletingWallet(false);
    }
  };

  const inputCls = `min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 ${
    isDark
      ? 'bg-[#1f2430] text-white placeholder:text-slate-400 focus:ring-blue-500/40'
      : 'bg-white text-slate-900 placeholder:text-slate-400 focus:ring-blue-500/30 border border-slate-200'
  }`;

  const ghostBtn = `rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition active:scale-95 disabled:opacity-30 cursor-pointer ${
    isDark
      ? 'bg-white/10 text-slate-200 hover:bg-white/15'
      : 'bg-slate-200/80 text-slate-700 hover:bg-slate-200'
  }`;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Wallet details for ${wallet.name}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`max-h-[92vh] w-full sm:max-w-xl overflow-y-auto rounded-t-3xl sm:rounded-3xl border p-5 sm:p-6 shadow-2xl transition-colors ${
          isDark
            ? 'border-white/10 bg-[#1f2430] text-white'
            : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        {/* Wallet Switcher Pills (if multiple wallets) */}
        {wallets.length > 1 && (
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {wallets.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onSelectWallet(w.id)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    w.id === wallet.id
                      ? isDark
                        ? 'bg-white text-slate-900'
                        : 'bg-slate-900 text-white'
                      : isDark
                      ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition cursor-pointer ${
                isDark
                  ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Wallet Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-xs"
              style={{ backgroundColor: wallet.color || '#4f46e5' }}
            >
              <SvgIcon name="wallet" className="h-6 w-6" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-2">
                <p className="truncate text-lg font-semibold">{wallet.name}</p>
                {wallet.isLocked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                    <Lock size={10} /> Locked
                  </span>
                )}
              </div>
              <p className={`truncate text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {wallet.purpose || wallet.subtitle}
              </p>
            </div>
          </div>

          {wallets.length <= 1 && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition cursor-pointer ${
                isDark
                  ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <X size={17} />
            </button>
          )}
        </div>

        {/* Amount */}
        <div className="mt-5 px-1">
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Wallet balance</p>
          <h2 className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
            {formatRs(walletBalance)}
          </h2>
        </div>

        {/* Wallet Actions: Add / Spend / Transfer */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <ActionButton
            icon="plus"
            label="Add"
            onClick={() => toggleQuickAction('add')}
            tone={
              quickAction === 'add'
                ? 'bg-green-500 text-black ring-green-500 shadow-md'
                : isDark
                ? 'bg-green-500/10 text-green-400 ring-green-500/40'
                : 'bg-green-50 text-green-700 ring-green-200'
            }
          />
          <ActionButton
            icon="spend"
            label="Spend"
            disabled={wallet.isLocked || walletBalance <= 0}
            onClick={() => toggleQuickAction('spend')}
            tone={
              quickAction === 'spend'
                ? 'bg-rose-500 text-white ring-rose-500 shadow-md'
                : isDark
                ? 'bg-red-500/10 text-red-400 ring-red-500/40'
                : 'bg-red-50 text-red-700 ring-red-200'
            }
          />
          <ActionButton
            icon="transfer"
            label="Transfer"
            disabled={wallet.isLocked || walletBalance <= 0}
            onClick={() => {
              onClose();
              onTransfer(wallet);
            }}
            tone={
              isDark
                ? 'bg-blue-500/10 text-blue-400 ring-blue-500/40'
                : 'bg-blue-50 text-blue-700 ring-blue-200'
            }
          />
        </div>

        {/* Inline Quick Add / Spend Form */}
        <AnimatePresence initial={false}>
          {quickAction && (
            <motion.form
              key={quickAction}
              onSubmit={handleQuickTransactionSubmit}
              noValidate
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div
                className={`mt-3 rounded-2xl border p-3.5 space-y-3 ${
                  quickAction === 'add'
                    ? isDark
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-green-200 bg-green-50/70'
                    : isDark
                    ? 'border-rose-500/30 bg-rose-500/5'
                    : 'border-rose-200 bg-rose-50/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">
                    {quickAction === 'add'
                      ? `Add money to ${wallet.name}`
                      : `Spend from ${wallet.name}`}
                  </p>
                  {quickAction === 'spend' && (
                    <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Available: {formatRs(walletBalance)}
                    </span>
                  )}
                </div>

                {/* Amount Input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      Rs.
                    </span>
                    <input
                      autoFocus
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="any"
                      value={quickAmount}
                      onChange={(e) => {
                        setQuickAmount(e.target.value);
                        if (quickError) setQuickError('');
                      }}
                      placeholder="Enter amount"
                      className={`${inputCls} w-full pl-9`}
                    />
                  </div>
                  {quickAction === 'spend' && walletBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickAmount(String(walletBalance));
                        if (quickError) setQuickError('');
                      }}
                      className={`rounded-xl px-3 text-xs font-semibold transition active:scale-95 cursor-pointer ${
                        isDark
                          ? 'bg-white/10 text-slate-200 hover:bg-white/15'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Max
                    </button>
                  )}
                </div>

                {/* Quick Add Presets + 4-State Ownership Selector */}
                {quickAction === 'add' && (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {[500, 1000, 5000, 10000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setQuickAmount(String((Number(quickAmount) || 0) + preset));
                            if (quickError) setQuickError('');
                          }}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition active:scale-95 cursor-pointer ${
                            isDark
                              ? 'bg-white/10 text-slate-200 hover:bg-white/15'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          +{preset.toLocaleString('en-US')}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <p className={`text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        Ownership State
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(
                          [
                            { id: 'spendable', label: 'Spendable', dot: 'bg-green-500' },
                            { id: 'reserved', label: 'Reserved', dot: 'bg-blue-500' },
                            { id: 'savings', label: 'Savings', dot: 'bg-amber-500' },
                            { id: 'amanat', label: 'Amanat', dot: 'bg-purple-500' },
                          ] as const
                        ).map((st) => {
                          const selected = quickFundState === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => setQuickFundState(st.id)}
                              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                selected
                                  ? isDark
                                    ? 'bg-white text-slate-900'
                                    : 'bg-slate-900 text-white'
                                  : isDark
                                  ? 'bg-white/10 text-slate-200 hover:bg-white/15'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                      {quickFundState === 'amanat' && (
                        <input
                          type="text"
                          value={quickAmanatOwner}
                          onChange={(e) => setQuickAmanatOwner(e.target.value)}
                          placeholder="Third person / owner name (e.g. Father, Ali)"
                          maxLength={40}
                          className={`${inputCls} w-full`}
                        />
                      )}
                    </div>
                  </>
                )}

                {/* Optional Notes Input */}
                <input
                  type="text"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  placeholder={
                    quickAction === 'spend'
                      ? 'Note (optional, e.g. Groceries, Petrol, Bill)'
                      : 'Note (optional, e.g. Salary, Deposit)'
                  }
                  maxLength={120}
                  className={`${inputCls} w-full`}
                />

                {quickError && (
                  <p role="alert" className="text-xs font-medium text-rose-500">
                    {quickError}
                  </p>
                )}

                {/* Confirm / Cancel */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={quickSaving}
                    onClick={() => {
                      setQuickAction(null);
                      setQuickError('');
                    }}
                    className={`flex-1 ${ghostBtn}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={quickSaving}
                    className={`flex-[1.5] rounded-xl py-2.5 text-xs sm:text-sm font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer ${
                      quickAction === 'add'
                        ? 'bg-green-500 hover:bg-green-400 text-black'
                        : 'bg-rose-600 hover:bg-rose-500 text-white'
                    }`}
                  >
                    {quickSaving
                      ? 'Processing…'
                      : quickAction === 'add'
                      ? `Add${Number(quickAmount) > 0 ? ` ${formatRs(Number(quickAmount))}` : ''}`
                      : `Spend${Number(quickAmount) > 0 ? ` ${formatRs(Number(quickAmount))}` : ''}`}
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className={`my-5 h-px w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

        {/* Active Loans Linked to This Wallet */}
        {walletLoans.length > 0 && (
          <div
            className={`mb-4 rounded-2xl border p-3.5 ${
              isDark
                ? 'border-amber-500/25 bg-amber-500/10'
                : 'border-amber-200 bg-amber-50/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                Active Loans ({walletLoans.length})
              </p>
              <Link
                href="/finance/loans"
                onClick={onClose}
                className={`inline-flex items-center gap-0.5 text-[11px] font-bold hover:underline ${
                  isDark ? 'text-amber-300' : 'text-amber-700'
                }`}
              >
                <span>Settle on Loans</span>
                <ArrowUpRight size={12} />
              </Link>
            </div>
            <ul className="space-y-1.5">
              {walletLoans.map((l) => {
                const rem = Math.max(0, (l.amount || 0) - (l.paidAmount || 0));
                const isOutFromHere =
                  l.fromSourceKey === wallet.id ||
                  (!l.fromSourceKey && l.fromSource === wallet.id) ||
                  (wallet.bankName && l.fromSourceName === `Bank (${wallet.bankName})`) ||
                  (wallet.customName && l.fromSourceName === `Wallet (${wallet.customName})`);
                return (
                  <li
                    key={l.id}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs ${
                      isDark ? 'bg-[#1f2430]/80 text-slate-200' : 'bg-white text-slate-800 border border-amber-200/70'
                    }`}
                  >
                    <div className="min-w-0 leading-tight">
                      <p className="truncate font-semibold">
                        {isOutFromHere
                          ? `Transferred out as loan → ${l.toSourceName || l.counterparty}`
                          : `Received as loan ← ${l.fromSourceName || l.counterparty}`}
                      </p>
                      <p className={`mt-0.5 truncate text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {isOutFromHere
                          ? l.fromEnvelopeName
                            ? `From envelope: ${l.fromEnvelopeName}${l.fromEnvelopeOwner ? ` (${l.fromEnvelopeOwner})` : ''}`
                            : 'Will return to this wallet on settlement'
                          : l.toEnvelopeName
                          ? `Into envelope: ${l.toEnvelopeName}`
                          : 'Active loan balance'}
                      </p>
                    </div>
                    <span className={`shrink-0 font-bold tabular-nums ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                      {formatRs(rem)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Envelopes Header */}
        <div className={`rounded-2xl p-3.5 ${isDark ? 'bg-[#282e3d]' : 'bg-slate-100'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed ${
                  isDark
                    ? 'border-white/25 text-slate-300'
                    : 'border-slate-300 text-slate-500'
                }`}
              >
                <SvgIcon name="envelope" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="text-base font-semibold">Envelopes</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {items.length} {items.length === 1 ? 'envelope' : 'envelopes'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleToggleImportExpenses}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold transition active:scale-95 cursor-pointer ${
                  importingExpenses
                    ? 'bg-teal-500 text-black'
                    : isDark
                    ? 'bg-white/10 text-slate-200 hover:bg-white/15'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Download size={13} />
                <span>{importingExpenses ? 'Close' : 'Import'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingEnv((a) => !a);
                  setImportingExpenses(false);
                  setError('');
                }}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs sm:text-sm font-semibold transition active:scale-95 cursor-pointer ${
                  isDark ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'
                }`}
              >
                {addingEnv ? 'Close' : '+ Envelope'}
              </button>
            </div>
          </div>

          {/* Import Expenses as Envelopes Panel */}
          <AnimatePresence initial={false}>
            {importingExpenses && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  className={`mt-3 rounded-2xl border p-3 space-y-2.5 ${
                    isDark
                      ? 'border-white/10 bg-[#1f2430]'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold">
                      Import expenses as envelopes
                    </p>
                    <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Available: {formatRs(defaultBalance)}
                    </span>
                  </div>

                  {loadingExpenses ? (
                    <p className={`py-4 text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Loading your expenses…
                    </p>
                  ) : availableExpenses.length === 0 ? (
                    <p className={`py-4 text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      No expenses found to import. Add expenses first from the Expenses page.
                    </p>
                  ) : (
                    <>
                      <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
                        {availableExpenses.map((exp) => {
                          const alreadyExists = items.some(
                            (e) => e.name.toLowerCase() === exp.title.toLowerCase()
                          );
                          const isChecked = selectedExpenseIds.includes(exp.id);
                          return (
                            <li key={exp.id}>
                              <button
                                type="button"
                                disabled={alreadyExists}
                                onClick={() => toggleSelectExpense(exp.id)}
                                className={`flex w-full items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left transition ${
                                  alreadyExists
                                    ? 'opacity-45 cursor-not-allowed border-transparent bg-slate-500/10'
                                    : isChecked
                                    ? isDark
                                      ? 'border-teal-500 bg-teal-500/15 cursor-pointer'
                                      : 'border-teal-500 bg-teal-50 cursor-pointer'
                                    : isDark
                                    ? 'border-white/10 bg-[#282e3d]/70 hover:border-white/25 cursor-pointer'
                                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 cursor-pointer'
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                      isChecked
                                        ? 'border-teal-500 bg-teal-500 text-black'
                                        : isDark
                                        ? 'border-slate-500'
                                        : 'border-slate-400'
                                    }`}
                                  >
                                    {isChecked && <Check size={11} strokeWidth={3} />}
                                  </span>
                                  <div className="min-w-0 leading-tight">
                                    <p className="truncate text-xs font-semibold">
                                      {exp.title}
                                      {alreadyExists && (
                                        <span className="ml-1.5 text-[10px] text-slate-400">
                                          (Exists)
                                        </span>
                                      )}
                                    </p>
                                    <p className={`truncate text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                      {exp.category}
                                    </p>
                                  </div>
                                </div>
                                <span className="shrink-0 text-xs font-bold tabular-nums">
                                  {formatRs(exp.amount)}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>

                      {selectedImportExpenses.length > 0 && (
                        <div
                          className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${
                            importExceedsBalance
                              ? isDark
                                ? 'bg-rose-500/15 text-rose-300'
                                : 'bg-rose-50 text-rose-700'
                              : isDark
                              ? 'bg-teal-500/10 text-teal-300'
                              : 'bg-teal-50 text-teal-800'
                          }`}
                        >
                          <span className="font-semibold">
                            {selectedImportExpenses.length} selected
                          </span>
                          <span className="font-bold tabular-nums">
                            Total: {formatRs(selectedImportTotal)}
                          </span>
                        </div>
                      )}

                      {importExceedsBalance && (
                        <p className="text-[11px] font-medium text-rose-400 px-1">
                          Selected total exceeds available balance ({formatRs(defaultBalance)}) in {wallet.name}.
                        </p>
                      )}

                      {importError && (
                        <p className="text-[11px] font-medium text-rose-400 px-1">
                          {importError}
                        </p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setImportingExpenses(false);
                            setSelectedExpenseIds([]);
                            setImportError('');
                          }}
                          className={`flex-1 ${ghostBtn}`}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={
                            saving ||
                            selectedImportExpenses.length === 0 ||
                            importExceedsBalance
                          }
                          onClick={handleConfirmImportEnvelopes}
                          className="flex-[1.5] rounded-xl bg-teal-500 hover:bg-teal-400 py-2.5 text-xs sm:text-sm font-bold text-black transition active:scale-95 disabled:opacity-40 cursor-pointer"
                        >
                          {saving
                            ? 'Importing…'
                            : `Create ${selectedImportExpenses.length || ''} Envelope${
                                selectedImportExpenses.length === 1 ? '' : 's'
                              }`}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {addingEnv && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex gap-2">
                  <input
                    autoFocus
                    value={newEnvName}
                    onChange={(ev) => {
                      setNewEnvName(ev.target.value);
                      setError('');
                    }}
                    onKeyDown={(ev) => ev.key === 'Enter' && handleCreateEnvelope()}
                    placeholder="Envelope name (e.g. Bills, Kids, Savings)"
                    maxLength={28}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleCreateEnvelope}
                    className="rounded-xl bg-green-500 hover:bg-green-400 px-4 text-sm font-bold text-black transition active:scale-95 cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                {error && !activeEnvId && (
                  <p className="mt-2 px-1 text-xs text-rose-500">{error}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 4-State Breakdown (Spendable / Reserved / Savings / Amanat) — hide 0 categories */}
        {(() => {
          const buckets = [
            {
              key: 'spendable',
              label: 'Spendable',
              hint: 'Own · anytime',
              amount: spendable,
              bar: 'bg-green-500',
              dot: 'bg-green-500',
              darkCard: 'bg-green-500/10 ring-green-500/40',
              lightCard: 'bg-green-50 ring-green-200',
              darkText: 'text-green-400',
              lightText: 'text-green-700',
            },
            {
              key: 'reserved',
              label: 'Reserved',
              hint: 'Near-term expense',
              amount: reserved,
              bar: 'bg-blue-600',
              dot: 'bg-blue-500',
              darkCard: 'bg-blue-500/10 ring-blue-500/40',
              lightCard: 'bg-blue-50 ring-blue-200',
              darkText: 'text-blue-400',
              lightText: 'text-blue-700',
            },
            {
              key: 'savings',
              label: 'Savings',
              hint: 'Long-term / event',
              amount: savingsAmt,
              bar: 'bg-amber-500',
              dot: 'bg-amber-500',
              darkCard: 'bg-amber-500/10 ring-amber-500/40',
              lightCard: 'bg-amber-50 ring-amber-200',
              darkText: 'text-amber-400',
              lightText: 'text-amber-700',
            },
            {
              key: 'amanat',
              label: 'Amanat',
              hint: 'Third person',
              amount: amanatAmt,
              bar: 'bg-purple-500',
              dot: 'bg-purple-500',
              darkCard: 'bg-purple-500/10 ring-purple-500/40',
              lightCard: 'bg-purple-50 ring-purple-200',
              darkText: 'text-purple-400',
              lightText: 'text-purple-700',
            },
          ].filter((b) => b.amount > 0);

          if (buckets.length === 0) return null;

          return (
            <>
              <div className="mt-4 flex h-3.5 w-full gap-1">
                {buckets.map((b) => (
                  <div
                    key={b.key}
                    className={`rounded-full transition-all duration-300 ${b.bar}`}
                    style={{ width: `${total > 0 ? Math.max(4, Math.round((b.amount / total) * 100)) : 0}%` }}
                  />
                ))}
              </div>

              <div
                className={`mt-3 grid gap-2.5 ${
                  buckets.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                }`}
              >
                {buckets.map((b) => (
                  <div
                    key={b.key}
                    className={`min-w-0 rounded-2xl px-3.5 py-2.5 ring-1 ring-inset ${
                      isDark ? b.darkCard : b.lightCard
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${b.dot}`} />
                      <p className="text-xs sm:text-sm font-semibold">{b.label}</p>
                    </div>
                    <p
                      className={`mt-1.5 truncate text-base sm:text-lg font-bold tabular-nums ${
                        isDark ? b.darkText : b.lightText
                      }`}
                    >
                      {formatRs(b.amount)}
                    </p>
                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {b.hint}
                    </p>
                  </div>
                ))}
              </div>
            </>
          );
        })()}

        {/* Envelopes List (always shows default 1 envelope + any custom envelopes) */}
        <ul className="mt-4 space-y-2.5">
          {items.map((e) => {
            const isActive = e.id === activeEnvId;
            return (
              <li
                key={e.id}
                className={`rounded-2xl transition ${
                  isDark ? 'bg-[#282e3d]' : 'bg-slate-100'
                } ${
                  isActive
                    ? isDark
                      ? 'ring-1 ring-inset ring-white/25'
                      : 'ring-1 ring-inset ring-slate-300'
                    : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectItem(e.id)}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${e.color}`}
                    >
                      <SvgIcon name="envelope" />
                    </span>
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-sm sm:text-base font-semibold">
                        {e.name}
                        {e.isDefault && (
                          <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            Default
                          </span>
                        )}
                      </p>
                      <div className="mt-1.5">
                        {e.fundState === 'spendable' ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isDark
                                ? 'bg-green-500/15 text-green-400'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Spendable (You)
                          </span>
                        ) : e.fundState === 'reserved' ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isDark
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            Reserved
                          </span>
                        ) : e.fundState === 'savings' ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isDark
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Savings
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isDark
                                ? 'bg-purple-500/15 text-purple-300'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                            Amanat · {e.ownerName || 'Other'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="shrink-0 text-base sm:text-lg font-bold tabular-nums">
                    {formatRs(e.balance)}
                  </p>
                </button>

                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className={`overflow-hidden border-t px-3.5 pb-3.5 pt-3 ${
                        isDark ? 'border-white/10' : 'border-slate-200'
                      }`}
                    >
                      {!mode && (
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            disabled={others.length === 0 || e.balance === 0}
                            onClick={() => openMode('transfer')}
                            className={ghostBtn}
                          >
                            ⇄ Transfer
                          </button>
                          <button
                            type="button"
                            onClick={() => openMode('owner')}
                            className={ghostBtn}
                          >
                            Owner
                          </button>
                          <button
                            type="button"
                            disabled={e.isDefault}
                            onClick={() => openMode('delete')}
                            className={`rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition active:scale-95 disabled:opacity-30 cursor-pointer ${
                              isDark
                                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                : 'bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                          >
                            Delete
                          </button>
                        </div>
                      )}

                      {/* Transfer between envelopes */}
                      {mode === 'transfer' && (
                        <div className="space-y-3">
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Send from <span className="font-semibold text-current">{e.name}</span> to
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {others.map((x) => (
                              <Chip
                                key={x.id}
                                color={x.color}
                                selected={toId === x.id}
                                isDark={isDark}
                                onClick={() => setToId(x.id)}
                              >
                                {x.name}
                              </Chip>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={value}
                              onChange={(ev) => {
                                setValue(ev.target.value);
                                setError('');
                              }}
                              placeholder="Amount"
                              className={inputCls}
                            />
                            <button
                              type="button"
                              onClick={() => setValue(String(e.balance))}
                              className={`rounded-xl px-3 text-xs font-semibold active:scale-95 cursor-pointer ${
                                isDark
                                  ? 'bg-white/10 text-slate-200'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              Max
                            </button>
                          </div>
                          <div className="-mt-1 flex flex-wrap gap-1.5">
                            {[5, 10, 20, 30, 50].map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => {
                                  setValue(String(Math.round((e.balance * p) / 100)));
                                  setError('');
                                }}
                                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition active:scale-95 cursor-pointer ${
                                  isDark
                                    ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                }`}
                              >
                                {p}%
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={resetPanel}
                              className={`flex-1 ${ghostBtn}`}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={handleTransferBetweenEnvelopes}
                              className="flex-1 rounded-xl bg-green-500 hover:bg-green-400 py-2.5 text-sm font-bold text-black active:scale-95 cursor-pointer"
                            >
                              Transfer
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 4-State Ownership Assignment */}
                      {mode === 'owner' && (
                        <div className="space-y-3">
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Ownership state of <span className="font-semibold text-current">{e.name}</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Chip
                              color="bg-green-500"
                              selected={e.fundState === 'spendable'}
                              isDark={isDark}
                              onClick={() => handleSetFundState('spendable')}
                            >
                              Spendable (You)
                            </Chip>
                            <Chip
                              color="bg-blue-500"
                              selected={e.fundState === 'reserved'}
                              isDark={isDark}
                              onClick={() => handleSetFundState('reserved')}
                            >
                              Reserved
                            </Chip>
                            <Chip
                              color="bg-amber-500"
                              selected={e.fundState === 'savings'}
                              isDark={isDark}
                              onClick={() => handleSetFundState('savings')}
                            >
                              Savings
                            </Chip>
                            <Chip
                              color="bg-purple-500"
                              selected={e.fundState === 'amanat' && (!e.ownerName || e.ownerName.toLowerCase() === 'amanat')}
                              isDark={isDark}
                              onClick={() => handleSetFundState('amanat', 'Amanat')}
                            >
                              Amanat
                            </Chip>
                            {customOwners.map((o) => (
                              <Chip
                                key={o.name}
                                color="bg-purple-500"
                                selected={
                                  e.fundState === 'amanat' &&
                                  e.ownerName?.toLowerCase() === o.name.toLowerCase()
                                }
                                isDark={isDark}
                                onClick={() => handleSetFundState('amanat', o.name)}
                              >
                                Amanat: {o.name}
                              </Chip>
                            ))}
                            <button
                              type="button"
                              onClick={() => setAddingOwner((v) => !v)}
                              className={`inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                isDark
                                  ? 'border-white/25 text-slate-300 hover:border-white/50'
                                  : 'border-slate-300 text-slate-600 hover:border-slate-500'
                              }`}
                            >
                              <Plus size={12} /> Amanat person
                            </button>
                          </div>

                          {addingOwner && (
                            <div className="flex gap-2">
                              <input
                                autoFocus
                                value={newOwnerName}
                                onChange={(ev) => setNewOwnerName(ev.target.value)}
                                onKeyDown={(ev) => ev.key === 'Enter' && handleCreateNewOwner()}
                                placeholder="Person name (e.g. Father, Wife, Ali)"
                                maxLength={24}
                                className={inputCls}
                              />
                              <button
                                type="button"
                                onClick={handleCreateNewOwner}
                                className="rounded-xl bg-purple-600 hover:bg-purple-500 px-3.5 text-xs font-bold text-white cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          )}

                          <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Spendable = own &amp; free to spend · Reserved = near-term expense · Savings = long-term/event · Amanat = belongs to someone else.
                          </p>
                          <button
                            type="button"
                            onClick={resetPanel}
                            className={`w-full ${ghostBtn}`}
                          >
                            Close
                          </button>
                        </div>
                      )}

                      {/* Delete envelope */}
                      {mode === 'delete' && (
                        <div className="space-y-3">
                          {e.balance > 0 ? (
                            <>
                              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                <span className="font-semibold text-current">
                                  {formatRs(e.balance)}
                                </span>{' '}
                                will move to
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {others.map((x) => (
                                  <Chip
                                    key={x.id}
                                    color={x.color}
                                    selected={toId === x.id}
                                    isDark={isDark}
                                    onClick={() => setToId(x.id)}
                                  >
                                    {x.name}
                                  </Chip>
                                ))}
                              </div>
                            </>
                          ) : (
                            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              Delete <span className="font-semibold text-current">{e.name}</span>? No
                              balance to move.
                            </p>
                          )}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={resetPanel}
                              className={`flex-1 ${ghostBtn}`}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={handleDeleteEnvelope}
                              className="flex-1 rounded-xl bg-red-500 hover:bg-red-400 py-2.5 text-sm font-bold text-white active:scale-95 cursor-pointer"
                            >
                              Delete envelope
                            </button>
                          </div>
                        </div>
                      )}

                      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>

        {/* Footer Security Lock & Graceful Delete Wallet Controls */}
        <div
          className={`mt-5 border-t pt-4 ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onToggleLock(wallet.id, wallet.isLocked)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                wallet.isLocked
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                  : isDark
                  ? 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {wallet.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
              <span>{wallet.isLocked ? 'Unlock Wallet' : 'Lock Wallet'}</span>
            </button>

            {wallet.category !== 'built-in' && (
              <button
                type="button"
                onClick={() => (showDeleteFlow ? setShowDeleteFlow(false) : openDeleteFlow())}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                  isDark
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                    : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                }`}
              >
                <Trash2 size={14} />
                <span>Delete Wallet</span>
              </button>
            )}
          </div>

          {/* Graceful Wallet Closure Panel */}
          <AnimatePresence initial={false}>
            {showDeleteFlow && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div
                  className={`mt-3 rounded-2xl border p-4 space-y-3 ${
                    isDark
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : 'border-rose-200 bg-rose-50/70'
                  }`}
                >
                  {walletBalance > 0 ? (
                    <>
                      <div>
                        <p className="text-sm font-bold">
                          What should happen to this money?
                        </p>
                        <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {wallet.name} currently holds{' '}
                          <span className="font-bold text-current">{formatRs(walletBalance)}</span>.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {/* Option 1: Transfer to another wallet */}
                        <button
                          type="button"
                          disabled={otherWallets.length === 0}
                          onClick={() => {
                            setDeleteChoice('transfer');
                            setDeleteError('');
                          }}
                          className={`w-full rounded-xl border p-3 text-left text-xs font-semibold transition cursor-pointer disabled:opacity-40 ${
                            deleteChoice === 'transfer'
                              ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                              : isDark
                              ? 'border-white/10 bg-[#282e3d] text-slate-200 hover:border-white/25'
                              : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                          }`}
                        >
                          1. Transfer {formatRs(walletBalance)} to another wallet
                        </button>

                        {deleteChoice === 'transfer' && (
                          <div className="pl-2 space-y-1.5">
                            <label
                              className={`block text-[11px] font-semibold ${
                                isDark ? 'text-slate-300' : 'text-slate-600'
                              }`}
                            >
                              Choose receiving wallet
                            </label>
                            <select
                              value={deleteTargetWalletId}
                              onChange={(e) => {
                                setDeleteTargetWalletId(e.target.value);
                                setDeleteError('');
                              }}
                              className={`${inputCls} w-full`}
                            >
                              <option value="">— Select wallet —</option>
                              {otherWallets.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name} ({formatRs(w.amount)})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Option 2: Record balance adjustment */}
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteChoice('adjustment');
                            setDeleteError('');
                          }}
                          className={`w-full rounded-xl border p-3 text-left text-xs font-semibold transition cursor-pointer ${
                            deleteChoice === 'adjustment'
                              ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                              : isDark
                              ? 'border-white/10 bg-[#282e3d] text-slate-200 hover:border-white/25'
                              : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                          }`}
                        >
                          2. Record a balance adjustment (money no longer held)
                        </button>

                        {deleteChoice === 'adjustment' && (
                          <div className="pl-2">
                            <input
                              type="text"
                              value={deleteNote}
                              onChange={(e) => setDeleteNote(e.target.value)}
                              placeholder="Optional reason (e.g. Spent outside app, closed account)"
                              className={`${inputCls} w-full`}
                            />
                          </div>
                        )}

                        {/* Option 3: Cancel wallet closure */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeleteFlow(false);
                            setDeleteChoice(null);
                            setDeleteError('');
                          }}
                          className={`w-full rounded-xl border p-3 text-left text-xs font-semibold transition cursor-pointer ${
                            isDark
                              ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          3. Cancel wallet closure
                        </button>
                      </div>

                      {deleteError && (
                        <p role="alert" className="text-xs font-medium text-rose-500">
                          {deleteError}
                        </p>
                      )}

                      {deleteChoice && (
                        <button
                          type="button"
                          disabled={deletingWallet}
                          onClick={handleConfirmDeleteWallet}
                          className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {deletingWallet
                            ? 'Closing wallet…'
                            : deleteChoice === 'transfer'
                            ? `Transfer ${formatRs(walletBalance)} & Delete Wallet`
                            : 'Record Adjustment & Delete Wallet'}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-medium">
                        Delete <span className="font-bold">{wallet.name}</span>? Its balance is Rs.
                        0, so your total money won&apos;t change.
                      </p>
                      {deleteError && (
                        <p role="alert" className="text-xs font-medium text-rose-500">
                          {deleteError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowDeleteFlow(false)}
                          className={`flex-1 ${ghostBtn}`}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deletingWallet}
                          onClick={handleConfirmDeleteWallet}
                          className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {deletingWallet ? 'Deleting…' : 'Confirm Delete'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
