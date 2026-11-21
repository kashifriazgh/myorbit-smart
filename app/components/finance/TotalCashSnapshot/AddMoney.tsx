'use client';

import { useState, useEffect, useMemo } from 'react';
import type {
  TransactionSource,
  Bank,
  CustomPaymentHead,
  TotalCashSnapshot,
  FinancialEventType,
} from '@/app/lib/interface';
import { PAKISTANI_EXPENSE_CATEGORIES } from '@/app/lib/constant';
import { db } from '@/app/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
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
    }
  ) => Promise<void>;
  saving: boolean;
  snapshot?: TotalCashSnapshot | null;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  defaultMode?: 'add' | 'deduct';
  preselectedWalletId?: string;
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

const INFLOW_SOURCES = [
  { id: 'salary', label: 'Salary Income', eventType: 'income' },
  { id: 'business', label: 'Business / Profit', eventType: 'income' },
  { id: 'freelance', label: 'Freelancing / Project', eventType: 'income' },
  { id: 'borrowed', label: 'Borrowed Money (Loan)', eventType: 'loan_received' },
  { id: 'opening_balance', label: 'Opening Balance', eventType: 'opening_balance' },
  { id: 'adjustment', label: 'Correction / Adjustment', eventType: 'balance_adjustment' },
  { id: 'gift', label: 'Gift / Allowance', eventType: 'income' },
];

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

  // Source Classifier (distinguish income from loans, adjustments, opening balance)
  const [inflowSource, setInflowSource] = useState('salary');

  // Expense Categories for Deduct Mode
  const [expenseCategory, setExpenseCategory] = useState<string>(
    PAKISTANI_EXPENSE_CATEGORIES?.[0] || 'Groceries'
  );
  const [subCategory, setSubCategory] = useState('');

  // Holder state
  const [selectedHolder, setSelectedHolder] = useState('Unassigned');
  const [newHolderName, setNewHolderName] = useState('');

  // Bank-specific state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [newBankName, setNewBankName] = useState('');
  const [showAddBank, setShowAddBank] = useState(false);

  // Custom payment head state
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);
  const [selectedCustomHead, setSelectedCustomHead] = useState<string>('');
  const [newCustomHeadName, setNewCustomHeadName] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

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

  const handleAddBank = async () => {
    if (!user || !newBankName.trim()) return;
    const docRef = await addDoc(collection(db, 'banks'), {
      userId: user.uid,
      name: newBankName.trim(),
      createdAt: Timestamp.now(),
    });
    const newBank: Bank = { id: docRef.id, userId: user.uid, name: newBankName.trim(), createdAt: Timestamp.now() };
    setBanks((prev) => [...prev, newBank]);
    setSelectedBank(newBank.id!);
    setNewBankName('');
    setShowAddBank(false);
  };

  const handleAddCustomPaymentHead = async () => {
    if (!user || !newCustomHeadName.trim()) return;
    const docRef = await addDoc(collection(db, 'customPaymentHeads'), {
      userId: user.uid,
      name: newCustomHeadName.trim(),
      createdAt: Timestamp.now(),
    });
    const newHead: CustomPaymentHead = {
      id: docRef.id,
      userId: user.uid,
      name: newCustomHeadName.trim(),
      createdAt: Timestamp.now(),
    };
    setCustomPaymentHeads((prev) => [...prev, newHead]);
    setSelectedCustomHead(newHead.id!);
    setNewCustomHeadName('');
    setShowAddCustom(false);
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

  const fromBalance = getSourceBalance(source, selectedBank, selectedCustomHead);

  const isFromLocked = useMemo(() => {
    if (!snapshot?.sourceOwnership) return false;
    const key = getSourceKey(source, fromBankName, fromCustomName);
    return snapshot.sourceOwnership[key]?.isLocked ?? false;
  }, [snapshot, source, fromBankName, fromCustomName]);

  const value = Number(amount) || 0;
  const isSourceReady =
    (source !== 'bank' && source !== 'custom') ||
    (source === 'bank' && !!selectedBank) ||
    (source === 'custom' && !!selectedCustomHead);

  const overdraw = mode === 'deduct' && value > fromBalance;
  const valid = value > 0 && isSourceReady && !isFromLocked && !overdraw;

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

      const selectedInflow = INFLOW_SOURCES.find((s) => s.id === inflowSource);
      const resolvedEventType = (selectedInflow?.eventType || 'income') as FinancialEventType;

      await onSave(
        value,
        source,
        false,
        bankId,
        bankName,
        customPaymentHeadId,
        customPaymentHeadName,
        note,
        holderToSave,
        {
          eventType: resolvedEventType,
          sourceIncomeType: selectedInflow?.label,
        }
      );
    } else if (mode === 'deduct' && onDeduct) {
      await onDeduct(
        value,
        source,
        selectedBank,
        fromBankName,
        false,
        selectedCustomHead,
        fromCustomName,
        note,
        holderToSave,
        {
          eventType: 'expense',
          expenseCategory,
          subCategory: subCategory.trim() || undefined,
        }
      );
    }

    setShowModal(false);
    onExternalClose?.();
    setAmount('');
    setSource('in_hand');
    setSelectedBank('');
    setSelectedCustomHead('');
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
                autoFocus
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
                ⚠️ Selected wallet only has {formatCurrency(fromBalance, 'PKR')}.
              </p>
            )}
            {isFromLocked && (
              <p className="mt-2 text-xs font-semibold text-rose-400">
                🔒 This wallet is security-locked. Unlock it from Wallet Settings before spending.
              </p>
            )}
          </div>

          {/* Inflow Source Selector (for Add mode) */}
          {mode === 'add' ? (
            <div className="p-3 bg-slate-900/60 border border-white/10 rounded-2xl flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">
                Classify Inflow Source:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {INFLOW_SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setInflowSource(s.id)}
                    className={`p-2 rounded-xl border text-left font-medium transition cursor-pointer ${
                      inflowSource === s.id
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-bold'
                        : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Pakistani Expense Categories (for Deduct mode) */
            <div className="p-3 bg-slate-900/60 border border-white/10 rounded-2xl flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">
                Standard Pakistani Expense Category:
              </label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
              >
                {(PAKISTANI_EXPENSE_CATEGORIES || []).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <div>
                <input
                  type="text"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  placeholder="Optional subcategory (e.g. Petrol, Medicine, Dinner)"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Target / Source Wallet Selection */}
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-300">
              {mode === "add" ? "Deposit into Wallet" : "Deduct from Wallet"}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SOURCE_OPTIONS.map((sKey) => {
                const selected = source === sKey;
                const bal = getSourceBalance(sKey, selectedBank, selectedCustomHead);
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
                      <span className="block truncate text-[11px] text-slate-400 font-medium">
                        {formatCurrency(bal, 'PKR')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bank Sub-selector */}
            {source === 'bank' && (
              <div className="mt-2.5 space-y-2 rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase text-slate-400">Select Bank Account</label>
                  <button
                    type="button"
                    onClick={() => setShowAddBank((p) => !p)}
                    className="text-xs font-bold text-blue-400 hover:underline"
                  >
                    + New Bank
                  </button>
                </div>
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

                {showAddBank && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Bank name (e.g. Meezan, HBL)"
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddBank}
                      disabled={!newBankName.trim()}
                      className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Custom Sub-selector */}
            {source === 'custom' && (
              <div className="mt-2.5 space-y-2 rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase text-slate-400">Select Custom Wallet</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustom((p) => !p)}
                    className="text-xs font-bold text-blue-400 hover:underline"
                  >
                    + New Wallet
                  </button>
                </div>
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

                {showAddCustom && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Wallet name (e.g. Emergency, Savings)"
                      value={newCustomHeadName}
                      onChange={(e) => setNewCustomHeadName(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPaymentHead}
                      disabled={!newCustomHeadName.trim()}
                      className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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
