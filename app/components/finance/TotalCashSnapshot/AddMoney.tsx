'use client';

import { useState, useEffect, useMemo } from 'react';
import { TransactionSource, Bank, CustomPaymentHead, TotalCashSnapshot } from '@/app/lib/interface';
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
    holderName?: string
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
    holderName?: string
  ) => Promise<void>;
  saving: boolean;
  snapshot?: TotalCashSnapshot | null;
  externalOpen?: boolean;
  onExternalClose?: () => void;
  defaultMode?: 'add' | 'deduct';
}

const MODES = {
  add: {
    label: "Add",
    cta: "Add money",
    tab: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
    btn: "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/25",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "focus-within:ring-emerald-500/40",
    sign: "+",
  },
  deduct: {
    label: "Deduct",
    cta: "Deduct money",
    tab: "bg-rose-500 text-white shadow-lg shadow-rose-500/30",
    btn: "bg-rose-500 hover:bg-rose-400 shadow-rose-500/25",
    text: "text-rose-600 dark:text-rose-400",
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
  other: 'Other',
  custom: 'Custom Wallet',
};

const SOURCE_OPTIONS: TransactionSource[] = ['in_hand', 'bank', 'easypaisa', 'jazzcash', 'other', 'custom'];

const fmt = (n: number | string) => Number(n || 0).toLocaleString("en-PK");

export default function AddMoney({ onSave, onDeduct, saving, snapshot, externalOpen, onExternalClose, defaultMode = 'add' }: Props) {
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
  const [toSource, setToSource] = useState<TransactionSource>('in_hand');
  const [note, setNote] = useState('');

  // Holder state
  const [selectedHolder, setSelectedHolder] = useState('Unassigned');
  const [newHolderName, setNewHolderName] = useState('');

  // Bank-specific state
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [selectedToBank, setSelectedToBank] = useState<string>('');
  const [newBankName, setNewBankName] = useState('');
  const [showAddBank, setShowAddBank] = useState(false);

  // Custom payment head state
  const [customPaymentHeads, setCustomPaymentHeads] = useState<CustomPaymentHead[]>([]);
  const [selectedCustomHead, setSelectedCustomHead] = useState<string>('');
  const [selectedToCustomHead, setSelectedToCustomHead] = useState<string>('');
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

  // Requirement 2: Auto-select bank or custom source if only 1 source exists
  useEffect(() => {
    if (source === 'bank') {
      if (banks.length === 1 && !selectedBank) {
        setSelectedBank(banks[0].id!);
      }
    } else if (source === 'custom') {
      if (allCustomHeads.length === 1 && !selectedCustomHead) {
        setSelectedCustomHead(allCustomHeads[0].id!);
      }
    }
  }, [source, banks, allCustomHeads, selectedBank, selectedCustomHead]);

  useEffect(() => {
    if (toSource === 'bank') {
      if (banks.length === 1 && !selectedToBank) {
        setSelectedToBank(banks[0].id!);
      }
    } else if (toSource === 'custom') {
      if (allCustomHeads.length === 1 && !selectedToCustomHead) {
        setSelectedToCustomHead(allCustomHeads[0].id!);
      }
    }
  }, [toSource, banks, allCustomHeads, selectedToBank, selectedToCustomHead]);

  const handleSourceChange = (newSrc: TransactionSource) => {
    setSource(newSrc);
    setSelectedHolder('Unassigned');
    if (newSrc === 'bank') {
      if (banks.length === 1) setSelectedBank(banks[0].id!);
      else setSelectedBank('');
    } else if (newSrc === 'custom') {
      if (allCustomHeads.length === 1) setSelectedCustomHead(allCustomHeads[0].id!);
      else setSelectedCustomHead('');
    }
  };

  const _handleToSourceChange = (newSrc: TransactionSource) => {
    setToSource(newSrc);
    if (newSrc === 'bank') {
      if (banks.length === 1) setSelectedToBank(banks[0].id!);
      else setSelectedToBank('');
    } else if (newSrc === 'custom') {
      if (allCustomHeads.length === 1) setSelectedToCustomHead(allCustomHeads[0].id!);
      else setSelectedToCustomHead('');
    }
  };

  const handleAddBank = async () => {
    if (!user || !newBankName.trim()) return;
    const docRef = await addDoc(collection(db, 'banks'), {
      userId: user.uid, name: newBankName.trim(), createdAt: Timestamp.now(),
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
      userId: user.uid, name: newCustomHeadName.trim(), createdAt: Timestamp.now(),
    });
    const newHead: CustomPaymentHead = { id: docRef.id, userId: user.uid, name: newCustomHeadName.trim(), createdAt: Timestamp.now() };
    setCustomPaymentHeads((prev) => [...prev, newHead]);
    setSelectedCustomHead(newHead.id!);
    setNewCustomHeadName('');
    setShowAddCustom(false);
  };

  const getSourceBalance = (srcType: TransactionSource, bankIdVal?: string, customIdVal?: string) => {
    if (!snapshot) return 0;
    if (srcType === 'bank') {
      const bName = banks.find((b) => b.id === bankIdVal)?.name;
      return bName ? (snapshot.sources.bank?.[bName] ?? 0) : 0;
    }
    if (srcType === 'custom') {
      const cName = allCustomHeads.find((c) => c.id === customIdVal || c.name === customIdVal)?.name;
      return cName ? (snapshot.sources.custom?.[cName] ?? 0) : 0;
    }
    return (snapshot.sources[srcType] as number) ?? 0;
  };

  const fromBalance = getSourceBalance(source, selectedBank, selectedCustomHead);
  const fromBankName = banks.find((b) => b.id === selectedBank)?.name;
  const fromCustomName = allCustomHeads.find((c) => c.id === selectedCustomHead)?.name;
  const sourceKey = getSourceKey(source, fromBankName, fromCustomName);
  const existingHolders = snapshot?.heldBy?.[sourceKey] || [];

  const toBankName = banks.find((b) => b.id === selectedToBank)?.name;
  const toCustomName = allCustomHeads.find((c) => c.id === selectedToCustomHead)?.name;
  const toSourceKey = getSourceKey(toSource, toBankName, toCustomName);
  const _existingToHolders = snapshot?.heldBy?.[toSourceKey] || [];

  const value = parseFloat(amount) || 0;
  const overdraw = mode !== 'add' && value > fromBalance;
  const isFromLocked = !!snapshot?.sourceOwnership?.[sourceKey]?.isLocked;

  const valid = value > 0 && !overdraw && !isFromLocked &&
    (source !== 'bank' || !!selectedBank) &&
    (source !== 'custom' || !!selectedCustomHead) &&
    (selectedHolder !== 'new' || !!newHolderName.trim());

  const handleClose = () => {
    if (saving) return;
    setShowModal(false);
    onExternalClose?.();
  };

  const handleSaveClick = async () => {
    if (!valid || saving) return;

    const holderToSave = selectedHolder === 'new' ? newHolderName.trim() : (selectedHolder === 'Unassigned' ? undefined : selectedHolder);

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

      await onSave(value, source, false, bankId, bankName, customPaymentHeadId, customPaymentHeadName, note, holderToSave);
    } else if (mode === 'deduct' && onDeduct) {
      await onDeduct(value, source, selectedBank, fromBankName, false, selectedCustomHead, fromCustomName, note, holderToSave);
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
      className="fixed inset-0 z-[1300] flex items-end justify-center bg-[#040d1a]/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#07142a] sm:w-full sm:max-w-full sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-3 pt-5 border-b border-slate-100 dark:border-white/5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Update balance</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Add or deduct funds from your accounts</p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Mode tabs (Add and Deduct) */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-white/5">
            {(Object.keys(MODES) as Array<keyof typeof MODES>).map((key) => {
              const v = MODES[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className={`rounded-xl py-2.5 text-sm font-bold transition ${
                    mode === key ? v.tab : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
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
              className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 ring-2 ring-transparent transition dark:border-white/10 dark:bg-white/5 ${m.ring}`}
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
                className="w-full bg-transparent text-3xl font-bold text-slate-900 placeholder-slate-300 focus:outline-none dark:text-white dark:placeholder-slate-600"
              />
            </label>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {[500, 1000, 5000, 10000].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(value + q))}
                  className="rounded-full border border-slate-200 px-3.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-teal-400 hover:text-teal-600 dark:border-white/10 dark:text-slate-300 dark:hover:text-teal-300"
                >
                  +{fmt(q)}
                </button>
              ))}
            </div>
            {overdraw && (
              <p className="mt-2 text-xs font-semibold text-rose-500">
                ⚠️ Selected source only has {formatCurrency(fromBalance, 'PKR')}.
              </p>
            )}
            {isFromLocked && (
              <p className="mt-2 text-xs font-semibold text-rose-500">
                🔒 This source is locked. Unlock it in Account Breakdown to make changes.
              </p>
            )}
          </div>

          {/* Source Selection Grid */}
          <div>
            <p className="mb-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
              {mode === "add" ? "Add to account" : "Deduct from account"}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition focus:outline-none ${
                      selected
                        ? "border-teal-500 bg-teal-500/10 ring-2 ring-teal-500/40"
                        : "border-slate-200 bg-slate-50 hover:border-teal-400/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400/20 to-cyan-400/20 text-lg">
                      {icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-800 dark:text-white">
                        {label}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {formatCurrency(bal, 'PKR')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bank Sub-selector */}
            {source === 'bank' && (
              <div className="mt-3.5 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Select Bank Account</label>
                  <button
                    type="button"
                    onClick={() => setShowAddBank((p) => !p)}
                    className="text-xs font-bold text-teal-600 hover:underline dark:text-teal-400"
                  >
                    + New Bank
                  </button>
                </div>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-semibold text-slate-800 focus:outline-none dark:border-white/10 dark:bg-[#0b1d38] dark:text-white"
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-white/10 dark:bg-[#040d1a] dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddBank}
                      disabled={!newBankName.trim()}
                      className="rounded-xl bg-teal-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-400 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Custom Sub-selector */}
            {source === 'custom' && (
              <div className="mt-3.5 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Select Custom Wallet</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustom((p) => !p)}
                    className="text-xs font-bold text-teal-600 hover:underline dark:text-teal-400"
                  >
                    + New Wallet
                  </button>
                </div>
                <select
                  value={selectedCustomHead}
                  onChange={(e) => setSelectedCustomHead(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-semibold text-slate-800 focus:outline-none dark:border-white/10 dark:bg-[#0b1d38] dark:text-white"
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-white/10 dark:bg-[#040d1a] dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPaymentHead}
                      disabled={!newCustomHeadName.trim()}
                      className="rounded-xl bg-teal-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-400 disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Holder assignment for From source */}
            {existingHolders.length > 0 && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Person holder (optional)</label>
                <select
                  value={selectedHolder}
                  onChange={(e) => setSelectedHolder(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <option value="Unassigned">Self (Default)</option>
                  {existingHolders.map((h) => (
                    <option key={h.holderName} value={h.holderName}>
                      👤 {h.holderName} ({formatCurrency(h.amount, 'PKR')})
                    </option>
                  ))}
                  <option value="new">+ Add new person</option>
                </select>
                {selectedHolder === 'new' && (
                  <input
                    type="text"
                    placeholder="Person Name (e.g. Ali, Wife)"
                    value={newHolderName}
                    onChange={(e) => setNewHolderName(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                )}
              </div>
            )}
          </div>

          {/* Note */}
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>

        {/* Sticky footer */}
        <div className="flex gap-3 border-t border-slate-200 bg-white/80 px-6 py-4 backdrop-blur dark:border-white/10 dark:bg-[#07142a]/80">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl border border-slate-200 px-6 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={handleSaveClick}
            className={`flex-1 rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${m.btn}`}
          >
            {saving ? 'Processing...' : `${m.cta}${value > 0 ? ` · ${formatCurrency(value, 'PKR')}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
