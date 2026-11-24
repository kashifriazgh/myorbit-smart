'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type {
  TransactionSource,
  Bank,
  CustomPaymentHead,
  TotalCashSnapshot,
  FinancialEventType,
  FundOwnershipState,
} from '@/app/lib/interface';
import {
  PAKISTANI_EXPENSE_CATEGORIES,
  STANDARD_EXPENSE_CATEGORIES,
} from '@/app/lib/constant';
import { db } from '@/app/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import { useGoals } from '@/app/lib/context/GoalsContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { getSourceKey } from '../TotalCashSnapshot';
import { formatCurrency } from '@/app/lib/utilts';

interface Props {
  onSave: (
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
  ) => Promise<void>;
  onDeduct?: (
    amount: number,
    source: TransactionSource,
    bankId?: string,
    bankName?: string,
    fromFreeze?: boolean,
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
  ) => Promise<void>;
  saving: boolean;
  snapshot?: TotalCashSnapshot | null;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  defaultMode?: 'add' | 'deduct';
  preselectedWalletId?: string;
  onOpenCreateWallet?: () => void;
}

const MODES = {
  add: {
    label: "Add Money",
    cta: "Add to wallet",
    tab: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
    btn: "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/25",
    text: "text-emerald-500 dark:text-emerald-400",
    ring: "focus-within:ring-emerald-500/40",
    sign: "+",
  },
  deduct: {
    label: "Spend / Deduct",
    cta: "Record expense",
    tab: "bg-rose-500 text-white shadow-lg shadow-rose-500/30",
    btn: "bg-rose-600 hover:bg-rose-500 shadow-rose-500/25",
    text: "text-rose-500 dark:text-rose-400",
    ring: "focus-within:ring-rose-500/40",
    sign: "−",
  },
};

const SOURCE_ICONS: Record<string, string> = {
  in_hand: '💵',
  bank: '🏦',
  easypaisa: '📱',
  jazzcash: '📱',
  other: '💼',
  custom: '🎯',
};

const SOURCE_LABELS: Record<string, string> = {
  in_hand: 'Cash in Hand',
  bank: 'Bank Account',
  easypaisa: 'EasyPaisa',
  jazzcash: 'JazzCash',
  other: 'Personal Spending',
  custom: 'Custom Wallet',
};

const SOURCE_OPTIONS: TransactionSource[] = ['in_hand', 'bank', 'easypaisa', 'jazzcash', 'other', 'custom'];

const fmt = (n: number | string) => Number(n || 0).toLocaleString("en-PK");

export default function AddMoney({
  onSave,
  onDeduct,
  saving,
  snapshot,
  externalOpen,
  onExternalClose,
  defaultMode = 'add',
  preselectedWalletId,
  onOpenCreateWallet,
}: Props) {
  const { user } = useAuth();
  const { goals, updateLinkedItemStatusInGoal } = useGoals();
  const { theme } = useCustomTheme();
  const _isDark = theme?.mode === 'dark';

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'add' | 'deduct'>(defaultMode);

  useEffect(() => {
    if (externalOpen !== undefined) {
      setShowModal(externalOpen);
      if (externalOpen) setMode(defaultMode);
    }
  }, [externalOpen, defaultMode]);

  const [amount, setAmount] = useState<string>('');
  const [source, setSource] = useState<TransactionSource>('in_hand');
  const [note, setNote] = useState('');

  // Expense Categories for Deduct Mode
  const [expenseCategory, setExpenseCategory] = useState<string>(
    PAKISTANI_EXPENSE_CATEGORIES?.[0] || 'House rent'
  );
  const [subCategory, setSubCategory] = useState('');

  // Holder state
  const [selectedHolder, setSelectedHolder] = useState('Unassigned');
  const [newHolderName, setNewHolderName] = useState('');

  // Bank-specific state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');

  // Custom payment head state
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);
  const [selectedCustomHead, setSelectedCustomHead] = useState<string>('');

  // Selected envelope (when spending from a wallet that has multiple envelopes)
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string>('');

  // 4-state fund ownership selection (Add mode)
  const [fundState, setFundState] = useState<FundOwnershipState>('spendable');
  const [allocationLabel, setAllocationLabel] = useState<string>('');
  const [amanatOwnerName, setAmanatOwnerName] = useState<string>('');

  useEffect(() => {
    if (!user || !showModal) return;
    const fetchBanks = async () => {
      const q = query(collection(db, 'banks'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Bank, 'id'>) }));
      setBanks(fetched);
    };
    fetchBanks();
  }, [user, showModal]);

  useEffect(() => {
    if (!user || !showModal) return;
    const fetchCustom = async () => {
      const q = query(collection(db, 'customPaymentHeads'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomPaymentHead, 'id'>) }));
      setCustomPaymentHeads(fetched);
    };
    fetchCustom();
  }, [user, showModal]);

  // Dynamically merge Goal Sources of Fund into custom payment heads
  const allCustomHeads = useMemo(() => {
    const list: CustomPaymentHead[] = [...customPaymentHeads];
    const existingNames = new Set(list.map((h) => h.name.toLowerCase()));

    (goals || []).forEach((g) => {
      (g.steps || []).forEach((s) => {
        if (s.linkedType === 'finance_source' && s.title) {
          const cleanName = s.title.replace(/^Source of Fund:\s*/i, '').replace(/^Finance Fund:\s*/i, '').trim();
          if (cleanName && !existingNames.has(cleanName.toLowerCase())) {
            list.push({
              id: s.linkedItemId || `goal_src_${g.id}_${cleanName}`,
              userId: user?.uid || '',
              name: cleanName,
              goalId: g.id,
              goalTitle: g.title,
              createdAt: new Date(),
            });
            existingNames.add(cleanName.toLowerCase());
          }
        }
      });
      if (g.linkedSourceId && !existingNames.has(g.linkedSourceId.toLowerCase())) {
        list.push({
          id: `goal_src_${g.id}`,
          userId: user?.uid || '',
          name: g.linkedSourceId,
          goalId: g.id,
          goalTitle: g.title,
          createdAt: new Date(),
        });
        existingNames.add(g.linkedSourceId.toLowerCase());
      }
    });

    return list;
  }, [customPaymentHeads, goals, user?.uid]);

  // Auto-select bank or custom source if only 1 exists
  useEffect(() => {
    if (source === 'bank') {
      if (banks.length === 1 && !selectedBank && banks[0]?.id) {
        setSelectedBank(banks[0].id);
      }
    } else if (source === 'custom') {
      if (allCustomHeads.length === 1 && !selectedCustomHead && allCustomHeads[0]?.id) {
        setSelectedCustomHead(allCustomHeads[0].id);
      }
    }
  }, [source, banks, allCustomHeads, selectedBank, selectedCustomHead]);

  // Auto-select wallet when preselectedWalletId is passed
  useEffect(() => {
    if (!preselectedWalletId) return;
    if (preselectedWalletId.startsWith('bank:')) {
      setSource('bank');
      const bName = preselectedWalletId.replace('bank:', '').trim().toLowerCase();
      const foundBank = banks.find((b) => b.name.trim().toLowerCase() === bName);
      if (foundBank?.id) setSelectedBank(foundBank.id);
    } else if (preselectedWalletId.startsWith('custom:')) {
      setSource('custom');
      const cName = preselectedWalletId.replace('custom:', '').trim().toLowerCase();
      const foundHead = allCustomHeads.find((c) => c.name.trim().toLowerCase() === cName);
      if (foundHead?.id) setSelectedCustomHead(foundHead.id);
    } else if (SOURCE_OPTIONS.includes(preselectedWalletId as TransactionSource)) {
      setSource(preselectedWalletId as TransactionSource);
    }
  }, [preselectedWalletId, banks, allCustomHeads]);

  const handleSourceChange = (newSrc: TransactionSource) => {
    setSource(newSrc);
    setSelectedHolder('Unassigned');
    if (newSrc === 'bank') {
      if (banks.length === 1 && banks[0]?.id) setSelectedBank(banks[0].id);
      else setSelectedBank('');
    } else if (newSrc === 'custom') {
      if (allCustomHeads.length === 1 && allCustomHeads[0]?.id) setSelectedCustomHead(allCustomHeads[0].id);
      else setSelectedCustomHead('');
    }
  };

  const fromBankName = useMemo(() => {
    return banks.find((b) => b.id === selectedBank)?.name;
  }, [banks, selectedBank]);

  const fromCustomName = useMemo(() => {
    return allCustomHeads.find((c) => c.id === selectedCustomHead)?.name;
  }, [allCustomHeads, selectedCustomHead]);

  const getSourceBalance = (src: TransactionSource, bankId?: string, customId?: string): number => {
    if (!snapshot || !snapshot.sources) return 0;
    if (src === 'bank') {
      const bName = banks.find((b) => b.id === bankId)?.name;
      if (!bName) return 0;
      return snapshot.sources.bank?.[bName] ?? 0;
    }
    if (src === 'custom') {
      const cName = allCustomHeads.find((c) => c.id === customId)?.name;
      if (!cName) return 0;
      return snapshot.sources.custom?.[cName] ?? 0;
    }
    return (snapshot.sources[src] as number) ?? 0;
  };

  // Immediate total balance displayed on each wallet tile (even before clicking a bank/custom sub-wallet)
  const getTileDisplayBalance = (src: TransactionSource): number => {
    if (!snapshot || !snapshot.sources) return 0;
    if (src === 'bank') {
      return Object.values(snapshot.sources.bank || {}).reduce(
        (sum, val) => sum + (Number(val) || 0),
        0
      );
    }
    if (src === 'custom') {
      return Object.values(snapshot.sources.custom || {}).reduce(
        (sum, val) => sum + (Number(val) || 0),
        0
      );
    }
    return (snapshot.sources[src] as number) ?? 0;
  };

  const fromBalance = getSourceBalance(source, selectedBank, selectedCustomHead);

  const activeSourceKey = useMemo(() => {
    if (source === 'bank' && !fromBankName) return '';
    if (source === 'custom' && !fromCustomName) return '';
    return getSourceKey(source, fromBankName, fromCustomName);
  }, [source, fromBankName, fromCustomName]);

  const walletEnvelopes = useMemo(() => {
    if (!activeSourceKey || !snapshot?.sourceOwnership) return [];
    const ownership = snapshot.sourceOwnership[activeSourceKey];
    const allocs = ownership?.allocations;
    if (!allocs || allocs.length <= 1) return [];

    const allocatedSum = allocs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const unallocatedDiff = Math.max(0, fromBalance - allocatedSum);

    return allocs.map((a, idx) => {
      const isDefault = a.id.startsWith('default_') || idx === 0;
      const baseAmt = Number(a.amount) || 0;
      const effectiveAmt = isDefault ? baseAmt + unallocatedDiff : baseAmt;
      const ownerLower = (a.owner || '').trim().toLowerCase();
      let resolvedState: FundOwnershipState = 'spendable';
      if (a.fundState) {
        resolvedState = a.fundState;
      } else if (a.availabilityStatus === 'external') {
        resolvedState = 'amanat';
      } else if (a.availabilityStatus === 'savings' || ownerLower === 'savings') {
        resolvedState = 'savings';
      } else if (
        a.availabilityStatus === 'reserved' ||
        ownerLower === 'reserved' ||
        (a.reservedAmount !== undefined &&
          a.reservedAmount >= baseAmt &&
          baseAmt > 0 &&
          (ownerLower === 'you' || ownerLower === 'self' || ownerLower === ''))
      ) {
        resolvedState = 'reserved';
      } else if (ownerLower && ownerLower !== 'you' && ownerLower !== 'self') {
        resolvedState = 'amanat';
      }

      const displayOwner =
        resolvedState === 'spendable'
          ? 'Spendable'
          : resolvedState === 'reserved'
          ? 'Reserved'
          : resolvedState === 'savings'
          ? 'Savings'
          : a.owner || 'Amanat';

      return {
        id: a.id,
        name: a.purpose || (isDefault ? 'Main Envelope' : `Envelope ${idx + 1}`),
        owner: displayOwner,
        amanatOwner: resolvedState === 'amanat' ? a.owner || 'Amanat' : '',
        fundState: resolvedState,
        isReserved: resolvedState !== 'spendable',
        isLocked: Boolean(a.isLocked),
        amount: effectiveAmt,
      };
    });
  }, [activeSourceKey, snapshot, fromBalance]);

  // Default ownership state of the selected wallet (used when wallet has 0 or 1 envelope, or no envelope selected)
  const walletDefaultOwnership = useMemo((): {
    fundState: FundOwnershipState;
    amanatOwner: string;
  } => {
    if (!activeSourceKey || !snapshot?.sourceOwnership) {
      return { fundState: 'spendable', amanatOwner: '' };
    }
    const o = snapshot.sourceOwnership[activeSourceKey];
    if (!o) return { fundState: 'spendable', amanatOwner: '' };

    // If wallet has a single or default allocation, read its state
    const singleOrDefault =
      o.allocations && o.allocations.length > 0
        ? o.allocations.find((a) => a.id.startsWith('default_')) || o.allocations[0]
        : null;

    if (singleOrDefault) {
      const ownerLower = (singleOrDefault.owner || '').trim().toLowerCase();
      if (singleOrDefault.fundState) {
        return {
          fundState: singleOrDefault.fundState,
          amanatOwner:
            singleOrDefault.fundState === 'amanat' ? singleOrDefault.owner || 'Amanat' : '',
        };
      }
      if (singleOrDefault.availabilityStatus === 'external') {
        return { fundState: 'amanat', amanatOwner: singleOrDefault.owner || 'Amanat' };
      }
      if (singleOrDefault.availabilityStatus === 'savings' || ownerLower === 'savings') {
        return { fundState: 'savings', amanatOwner: '' };
      }
      if (singleOrDefault.availabilityStatus === 'reserved' || ownerLower === 'reserved') {
        return { fundState: 'reserved', amanatOwner: '' };
      }
      if (ownerLower && ownerLower !== 'you' && ownerLower !== 'self') {
        return { fundState: 'amanat', amanatOwner: singleOrDefault.owner };
      }
    }

    if (o.fundState) {
      return {
        fundState: o.fundState,
        amanatOwner: o.fundState === 'amanat' ? o.ownerName || 'Amanat' : '',
      };
    }
    if (o.hasOwnThisMoney === false) {
      return { fundState: 'amanat', amanatOwner: o.ownerName || 'Amanat' };
    }
    const savingsRegex = /saving|emergency|goal|fund|invest/i;
    const isSavingsWallet = savingsRegex.test(`${o.purpose || ''} ${activeSourceKey}`);
    if ((Number(o.reservedAmount) || 0) > 0 && fromBalance > 0 && (Number(o.reservedAmount) || 0) >= fromBalance) {
      return { fundState: isSavingsWallet ? 'savings' : 'reserved', amanatOwner: '' };
    }
    return { fundState: 'spendable', amanatOwner: '' };
  }, [activeSourceKey, snapshot, fromBalance]);

  // Auto-select envelope in Spend mode, and reset invalid envelope when switching wallets
  useEffect(() => {
    if (walletEnvelopes.length <= 1) {
      setSelectedEnvelopeId('');
      return;
    }
    const stillValid = walletEnvelopes.some((e) => e.id === selectedEnvelopeId);
    if (!stillValid) {
      if (mode === 'deduct') {
        const preferred =
          walletEnvelopes.find((e) => !e.isLocked && !e.isReserved && e.amount > 0) ||
          walletEnvelopes.find((e) => !e.isLocked && e.amount > 0) ||
          walletEnvelopes[0];
        setSelectedEnvelopeId(preferred?.id || '');
      } else {
        // In Add mode, clear stale envelope from previous wallet (defaults to wallet's own state until user picks an envelope)
        setSelectedEnvelopeId('');
      }
    }
  }, [mode, walletEnvelopes, selectedEnvelopeId]);

  const selectedEnvelope = useMemo(
    () => walletEnvelopes.find((e) => e.id === selectedEnvelopeId) ?? null,
    [walletEnvelopes, selectedEnvelopeId]
  );

  // Auto-sync ownership state in Add mode:
  // - If an envelope is selected, inherit that envelope's ownership state
  // - Otherwise (0 or 1 envelope, or no envelope selected), inherit the wallet's default creation ownership state
  useEffect(() => {
    if (mode !== 'add') return;
    if (selectedEnvelope) {
      setFundState(selectedEnvelope.fundState);
      setAmanatOwnerName(selectedEnvelope.fundState === 'amanat' ? selectedEnvelope.amanatOwner : '');
    } else {
      setFundState(walletDefaultOwnership.fundState);
      setAmanatOwnerName(
        walletDefaultOwnership.fundState === 'amanat' ? walletDefaultOwnership.amanatOwner : ''
      );
    }
  }, [mode, activeSourceKey, selectedEnvelope, walletDefaultOwnership]);

  const isFromLocked = useMemo(() => {
    if (!activeSourceKey || !snapshot?.sourceOwnership) return false;
    return snapshot.sourceOwnership[activeSourceKey]?.isLocked ?? false;
  }, [snapshot, activeSourceKey]);

  const value = Number(amount) || 0;
  const isSourceReady =
    (source !== 'bank' && source !== 'custom') ||
    (source === 'bank' && !!selectedBank) ||
    (source === 'custom' && !!selectedCustomHead);

  const hasEnvelopesToChoose = walletEnvelopes.length > 1;
  const isEnvelopeReady = mode !== 'deduct' || !hasEnvelopesToChoose || Boolean(selectedEnvelope);
  const isSelectedEnvelopeLocked = mode === 'deduct' && Boolean(selectedEnvelope?.isLocked);
  const isSpendLocked = mode === 'deduct' && (isFromLocked || isSelectedEnvelopeLocked);
  const effectiveSpendBalance = selectedEnvelope ? selectedEnvelope.amount : fromBalance;
  const overdraw = mode === 'deduct' && value > effectiveSpendBalance;
  const valid =
    value > 0 &&
    isSourceReady &&
    isEnvelopeReady &&
    !isSpendLocked &&
    !overdraw;

  const handleClose = () => {
    setShowModal(false);
    onExternalClose?.();
  };

  const handleSaveClick = async () => {
    if (!valid || saving) return;

    const holderToSave =
      selectedHolder === 'new'
        ? newHolderName.trim()
        : selectedHolder === 'Unassigned'
        ? undefined
        : selectedHolder;

    if (mode === 'add') {
      let bankId: string | undefined;
      let bankName: string | undefined;
      let customPaymentHeadId: string | undefined;
      let customPaymentHeadName: string | undefined;

      if (source === 'bank') {
        bankId = selectedBank;
        bankName = fromBankName;
      }
      if (source === 'custom') {
        customPaymentHeadId = selectedCustomHead;
        const foundHead = allCustomHeads.find((c) => c.id === selectedCustomHead || c.name === selectedCustomHead);
        customPaymentHeadName = foundHead?.name || selectedCustomHead;
        if (foundHead?.goalId) {
          await updateLinkedItemStatusInGoal(foundHead.goalId, foundHead.id!, 'finance_source', true);
        }
      }

      const resolvedAmanatOwner =
        fundState === 'amanat' ? amanatOwnerName.trim() || 'Amanat' : undefined;

      await onSave(
        value,
        source,
        false,
        bankId,
        bankName,
        customPaymentHeadId,
        customPaymentHeadName,
        note,
        resolvedAmanatOwner || holderToSave,
        {
          eventType: 'income',
          sourceIncomeType: 'Income',
          fundState,
          allocationLabel: selectedEnvelope ? undefined : allocationLabel.trim() || undefined,
          amanatOwnerName: resolvedAmanatOwner,
          envelopeId: selectedEnvelope?.id,
          envelopeName: selectedEnvelope?.name,
        }
      );
    } else if (mode === 'deduct' && onDeduct) {
      let bankId: string | undefined;
      let bankName: string | undefined;
      let customPaymentHeadId: string | undefined;
      let customPaymentHeadName: string | undefined;

      if (source === 'bank') {
        bankId = selectedBank;
        bankName = fromBankName;
      }
      if (source === 'custom') {
        customPaymentHeadId = selectedCustomHead;
        const foundHead = allCustomHeads.find(
          (c) => c.id === selectedCustomHead || c.name === selectedCustomHead
        );
        customPaymentHeadName = foundHead?.name || fromCustomName || selectedCustomHead;
      }

      await onDeduct(
        value,
        source,
        bankId,
        bankName,
        false,
        customPaymentHeadId,
        customPaymentHeadName,
        note,
        holderToSave,
        {
          eventType: 'expense',
          expenseCategory,
          subCategory: subCategory.trim() || undefined,
          envelopeId: selectedEnvelope?.id,
          envelopeName: selectedEnvelope?.name,
        }
      );
    }

    setShowModal(false);
    onExternalClose?.();
    setAmount('');
    setSource('in_hand');
    setSelectedBank('');
    setSelectedCustomHead('');
    setSelectedEnvelopeId('');
    setFundState('spendable');
    setAllocationLabel('');
    setAmanatOwnerName('');
    setSelectedHolder('Unassigned');
    setNewHolderName('');
    setNote('');
  };

  if (!showModal) return null;

  const m = MODES[mode];

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0d131f] shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-3 pt-5 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Record Transaction</h2>
            <p className="text-xs text-slate-400">Classified inflows and Pakistani category expenses</p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Mode switch (Add vs Deduct) */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-900/80 border border-white/10 p-1.5">
            {(Object.keys(MODES) as Array<keyof typeof MODES>).map((key) => {
              const v = MODES[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`rounded-xl py-2.5 text-xs font-bold transition cursor-pointer ${
                    mode === key
                      ? v.tab
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          {/* Amount Input */}
          <div>
            <label
              className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-3.5 ring-2 ring-transparent transition ${m.ring}`}
            >
              <span className={`text-3xl font-extrabold ${m.text}`}>{m.sign}</span>
              <span className="text-base font-semibold text-slate-400">PKR</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                className="w-full bg-transparent text-3xl font-bold text-white placeholder-slate-600 focus:outline-none"
              />
            </label>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {[500, 1000, 5000, 10000].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(value + q))}
                  className="rounded-full border border-white/10 bg-slate-900/40 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-emerald-400 hover:text-emerald-300"
                >
                  +{fmt(q)}
                </button>
              ))}
            </div>
            {overdraw && (
              <p className="mt-2 text-xs font-semibold text-rose-400">
                ⚠️{' '}
                {selectedEnvelope
                  ? `Selected envelope "${selectedEnvelope.name}" only has ${formatCurrency(
                      selectedEnvelope.amount,
                      'PKR'
                    )}.`
                  : `Selected wallet only has ${formatCurrency(fromBalance, 'PKR')}.`}
              </p>
            )}
            {isSpendLocked && (
              <p className="mt-2 text-xs font-semibold text-rose-400">
                🔒{' '}
                {isSelectedEnvelopeLocked
                  ? 'Selected envelope is locked. Choose another envelope or unlock it first.'
                  : 'This wallet is security-locked. Unlock it from Wallet Settings before spending.'}
              </p>
            )}
          </div>

          {/* Target / Source Wallet Selection (with immediate balances) */}
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-300">
              {mode === "add" ? "Deposit into Wallet" : "Deduct from Wallet"}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SOURCE_OPTIONS.map((sKey) => {
                const selected = source === sKey;
                const bal = getTileDisplayBalance(sKey);
                const label = SOURCE_LABELS[sKey];
                const icon = SOURCE_ICONS[sKey];

                return (
                  <button
                    key={sKey}
                    type="button"
                    onClick={() => handleSourceChange(sKey)}
                    className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition focus:outline-none cursor-pointer ${
                      selected
                        ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                        : "border-white/10 bg-slate-900/50 hover:border-white/20"
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm">
                      {icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-white">
                        {label}
                      </span>
                      <span className="block truncate text-[11px] text-emerald-300/90 font-semibold tabular-nums">
                        {formatCurrency(bal, 'PKR')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bank Sub-selector (compact cards when <= 4 banks so balances show immediately) */}
            {source === 'bank' && (
              <div className="mt-2.5 space-y-2 rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                <label className="block text-[11px] font-bold uppercase text-slate-400">
                  Select Bank Account
                </label>
                {banks.length === 0 ? (
                  <p className="text-xs text-slate-400 py-1">
                    No bank accounts found. Create one in Wallets first.
                  </p>
                ) : banks.length <= 4 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {banks.map((b) => {
                      const isSelected = selectedBank === b.id;
                      const bal = snapshot?.sources.bank?.[b.name] ?? 0;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBank(b.id || '')}
                          className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500 text-white'
                              : 'border-white/10 bg-slate-950/80 hover:border-white/20 text-slate-200'
                          }`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs">
                            🏦
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-white">
                              {b.name}
                            </span>
                            <span className="block truncate text-[10px] text-emerald-300/90 font-semibold tabular-nums">
                              {formatCurrency(bal, 'PKR')}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 p-2 text-xs font-semibold text-white focus:outline-none"
                  >
                    <option value="">— Select Bank —</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        🏦 {b.name} ({formatCurrency(snapshot?.sources.bank?.[b.name] ?? 0, 'PKR')})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Custom Sub-selector (small cards in 2 lines when <= 4 wallets, dropdown when > 4) */}
            {source === 'custom' && (
              <div className="mt-2.5 space-y-2 rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-400">
                    Select Custom Wallet
                  </label>
                  {onOpenCreateWallet ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleClose();
                        onOpenCreateWallet();
                      }}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline transition cursor-pointer"
                    >
                      + Create New Wallet
                    </button>
                  ) : (
                    <Link
                      href="/finance/wallets"
                      onClick={handleClose}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline transition"
                    >
                      + Create New Wallet
                    </Link>
                  )}
                </div>
                {allCustomHeads.length === 0 ? (
                  <p className="text-xs text-slate-400 py-1">
                    No custom wallets yet.{' '}
                    {onOpenCreateWallet ? (
                      <button
                        type="button"
                        onClick={() => {
                          handleClose();
                          onOpenCreateWallet();
                        }}
                        className="font-semibold text-blue-400 hover:underline cursor-pointer"
                      >
                        Create a wallet →
                      </button>
                    ) : (
                      <Link
                        href="/finance/wallets"
                        onClick={handleClose}
                        className="font-semibold text-blue-400 hover:underline"
                      >
                        Create a wallet →
                      </Link>
                    )}
                  </p>
                ) : allCustomHeads.length <= 4 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {allCustomHeads.map((h) => {
                      const isSelected = selectedCustomHead === h.id;
                      const bal = snapshot?.sources.custom?.[h.name] ?? 0;
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setSelectedCustomHead(h.id || '')}
                          className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500 text-white'
                              : 'border-white/10 bg-slate-950/80 hover:border-white/20 text-slate-200'
                          }`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs">
                            🎯
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-white">
                              {h.name}
                            </span>
                            <span className="block truncate text-[10px] text-emerald-300/90 font-semibold tabular-nums">
                              {formatCurrency(bal, 'PKR')}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    value={selectedCustomHead}
                    onChange={(e) => setSelectedCustomHead(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950 p-2 text-xs font-semibold text-white focus:outline-none"
                  >
                    <option value="">— Select Wallet —</option>
                    {allCustomHeads.map((h) => (
                      <option key={h.id} value={h.id}>
                        🎯 {h.name} {h.goalTitle ? `(Goal: ${h.goalTitle})` : ''} ({formatCurrency(snapshot?.sources.custom?.[h.name] ?? 0, 'PKR')})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Envelope Selector (shown in both Add and Spend modes when selected wallet has 2+ envelopes) */}
            {hasEnvelopesToChoose && (
              <div
                className={`mt-2.5 space-y-2 rounded-2xl border bg-slate-900/70 p-3 ${
                  mode === 'add' ? 'border-emerald-500/25' : 'border-rose-500/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-300">
                    {mode === 'add' ? 'Select Envelope (Optional)' : 'Select Envelope'}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {walletEnvelopes.length} envelopes in this wallet
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {walletEnvelopes.map((env) => {
                    const isSelected = selectedEnvelopeId === env.id;
                    const disabledInMode = mode === 'deduct' && env.isLocked;
                    const badgeCls =
                      env.fundState === 'spendable'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : env.fundState === 'reserved'
                        ? 'bg-blue-500/15 text-blue-300'
                        : env.fundState === 'savings'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-purple-500/15 text-purple-300';
                    return (
                      <button
                        key={env.id}
                        type="button"
                        disabled={disabledInMode}
                        onClick={() => {
                          if (mode === 'add' && isSelected) {
                            setSelectedEnvelopeId('');
                          } else {
                            setSelectedEnvelopeId(env.id);
                          }
                        }}
                        className={`flex flex-col gap-1 rounded-xl border p-2.5 text-left transition ${
                          disabledInMode
                            ? 'opacity-45 cursor-not-allowed border-white/10 bg-slate-950/60'
                            : isSelected
                            ? mode === 'add'
                              ? 'border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/50 text-white cursor-pointer'
                              : 'border-rose-500 bg-rose-500/15 ring-1 ring-rose-500/50 text-white cursor-pointer'
                            : 'border-white/10 bg-slate-950/80 hover:border-white/25 text-slate-200 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 w-full">
                          <span className="truncate text-xs font-bold text-white">
                            ✉️ {env.name}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${badgeCls}`}
                          >
                            {env.owner}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold tabular-nums text-slate-300">
                          {formatCurrency(env.amount, 'PKR')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4-State Ownership Classification (Add mode) */}
          {mode === 'add' && (
            <div className="p-3.5 bg-slate-900/60 border border-white/10 rounded-2xl flex flex-col gap-3">
              <div>
                <label className="text-sm font-bold text-white tracking-tight block">
                  Ownership &amp; Fund State
                </label>
                <p className="text-[11px] text-slate-400">
                  Classify how this amount should be counted across your finances
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: 'spendable',
                      label: 'Spendable',
                      desc: 'Own · Spend anytime',
                      activeCls: 'border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/50',
                      dotCls: 'bg-emerald-500',
                    },
                    {
                      id: 'reserved',
                      label: 'Reserved',
                      desc: 'Own · Near-term expense',
                      activeCls: 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/50',
                      dotCls: 'bg-blue-500',
                    },
                    {
                      id: 'savings',
                      label: 'Savings',
                      desc: 'Own · Long-term / event',
                      activeCls: 'border-amber-500 bg-amber-500/15 ring-1 ring-amber-500/50',
                      dotCls: 'bg-amber-500',
                    },
                    {
                      id: 'amanat',
                      label: 'Amanat',
                      desc: 'Third person · Not owned',
                      activeCls: 'border-purple-500 bg-purple-500/15 ring-1 ring-purple-500/50',
                      dotCls: 'bg-purple-500',
                    },
                  ] as const
                ).map((opt) => {
                  const active = fundState === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setFundState(opt.id);
                        if (selectedEnvelope && selectedEnvelope.fundState !== opt.id) {
                          setSelectedEnvelopeId('');
                        }
                      }}
                      className={`flex flex-col gap-0.5 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                        active
                          ? `${opt.activeCls} text-white`
                          : 'border-white/10 bg-slate-950/80 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-bold">
                        <span className={`h-2 w-2 rounded-full ${opt.dotCls}`} />
                        {opt.label}
                      </span>
                      <span className="text-[10px] text-slate-400">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>

              {fundState === 'amanat' && (
                <input
                  type="text"
                  value={amanatOwnerName}
                  onChange={(e) => setAmanatOwnerName(e.target.value)}
                  placeholder="Person / owner name (e.g. Father, Ali, Office)"
                  className="w-full px-3 py-2 bg-slate-950 border border-purple-500/30 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              )}

              {(fundState === 'reserved' || fundState === 'savings') && (
                <input
                  type="text"
                  value={allocationLabel}
                  onChange={(e) => setAllocationLabel(e.target.value)}
                  placeholder={
                    fundState === 'reserved'
                      ? 'Optional purpose / envelope (e.g. Electricity Bill, Rent)'
                      : 'Optional saving goal (e.g. Car, Wedding, Emergency)'
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              )}
            </div>
          )}

          {/* Expense Categories (Spend mode — right below Wallets selection) */}
          {mode === 'deduct' && (
            <div className="p-3.5 bg-slate-900/60 border border-white/10 rounded-2xl flex flex-col gap-3">
              <label className="text-sm font-bold text-white tracking-tight">
                Select Category
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-0.5">
                {STANDARD_EXPENSE_CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  const isSelected = expenseCategory === cat.name;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setExpenseCategory(cat.name)}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-rose-500/20 border-rose-500 text-white ring-1 ring-rose-500/50'
                          : 'bg-slate-950/80 border-white/10 text-slate-300 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <CatIcon
                        size={14}
                        className={`shrink-0 ${isSelected ? 'text-rose-400' : cat.darkColor}`}
                      />
                      <span className="truncate">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
              <div>
                <input
                  type="text"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  placeholder="Optional subcategory (e.g. Petrol, Medicine, Dinner)"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {/* Note Input */}
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Description or reference notes (optional)…"
            className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Sticky footer */}
        <div className="flex gap-3 border-t border-white/10 bg-[#0d131f] px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl border border-white/10 px-5 py-3 text-xs font-bold text-slate-300 transition hover:bg-white/10 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={handleSaveClick}
            className={`flex-1 rounded-2xl py-3 text-xs font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${m.btn}`}
          >
            {saving ? 'Processing…' : `${m.cta}${value > 0 ? ` · ${formatCurrency(value, 'PKR')}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
