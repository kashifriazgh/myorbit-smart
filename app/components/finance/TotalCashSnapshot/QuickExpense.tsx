'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  GraduationCap,
  HeartPulse,
  Home,
  Fuel,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  User,
  Zap,
} from 'lucide-react';

const CATEGORY_PILLS = [
  { short: 'Food', full: 'Groceries and food', Icon: ShoppingCart },
  { short: 'Fuel', full: 'Transport and fuel', Icon: Fuel },
  { short: 'Bills', full: 'Electricity, gas and water', Icon: Zap },
  { short: 'Mobile', full: 'Mobile and internet', Icon: Smartphone },
  { short: 'Health', full: 'Healthcare and medicines', Icon: HeartPulse },
  { short: 'Rent', full: 'House rent', Icon: Home },
  { short: 'School', full: "Children's education", Icon: GraduationCap },
  { short: 'Shop', full: 'Clothing and shopping', Icon: ShoppingBag },
  { short: 'Personal', full: 'Personal', Icon: User },
  { short: 'Other', full: 'Other expenses', Icon: Receipt },
];

export interface QuickExpensePayload {
  amount: number;
  title: string;
  category: string;
  walletKey: string;
  envelopeId?: string | null;
  envelopeName?: string | null;
  createdAt: Date;
}

export interface QuickExpenseWalletOption {
  optionId: string;
  walletKey: string;
  label: string;
  envelopeId?: string | null;
  envelopeName?: string | null;
  spendable: number;
}

interface QuickExpenseProps {
  onAdd: (payload: QuickExpensePayload) => Promise<void>;
  spendableWallets?: QuickExpenseWalletOption[];
  isDark?: boolean;
}

export default function QuickExpense({
  onAdd,
  spendableWallets = [],
  isDark = true,
}: QuickExpenseProps) {
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORY_PILLS[0].full);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const amountRef = useRef<HTMLInputElement | null>(null);

  const numericAmount = Number(amount) || 0;
  const hasSpendableMoney = spendableWallets.length > 0;

  // Auto-select a wallet & envelope that has spendable money
  const autoOption = useMemo(() => {
    if (spendableWallets.length === 0) return null;
    const sorted = [...spendableWallets].sort((a, b) => b.spendable - a.spendable);
    if (numericAmount > 0) {
      const cashCovering = spendableWallets.find(
        (w) => w.walletKey === 'in_hand' && w.spendable >= numericAmount
      );
      if (cashCovering) return cashCovering;
      const anyCovering = sorted.find((w) => w.spendable >= numericAmount);
      if (anyCovering) return anyCovering;
    }
    const cash = spendableWallets.find((w) => w.walletKey === 'in_hand');
    return cash || sorted[0];
  }, [spendableWallets, numericAmount]);

  const activeOption = useMemo(() => {
    if (selectedOptionId) {
      const found = spendableWallets.find((w) => w.optionId === selectedOptionId);
      if (found) return found;
    }
    return autoOption;
  }, [selectedOptionId, spendableWallets, autoOption]);

  const insufficientInSelected =
    Boolean(activeOption) && numericAmount > 0 && numericAmount > activeOption!.spendable;

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 2600);
    return () => clearTimeout(timer);
  }, [feedback]);

  const activeCategoryObj =
    CATEGORY_PILLS.find((c) => c.full === selectedCategory) || CATEGORY_PILLS[0];
  const effectiveTitle = title.trim() || activeCategoryObj.short;
  const isValid =
    hasSpendableMoney &&
    Boolean(activeOption) &&
    numericAmount > 0 &&
    !insufficientInSelected &&
    effectiveTitle.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSpendableMoney || !activeOption) {
      setFeedback({
        type: 'err',
        text: 'No spendable money available in any wallet or envelope.',
      });
      return;
    }
    if (insufficientInSelected) {
      setFeedback({
        type: 'err',
        text: `Only Rs. ${Math.round(activeOption.spendable).toLocaleString('en-PK')} spendable in ${activeOption.label}${activeOption.envelopeName ? ` (${activeOption.envelopeName})` : ''}.`,
      });
      return;
    }
    if (!isValid || saving) return;

    try {
      setSaving(true);
      setFeedback(null);

      await onAdd({
        amount: numericAmount,
        title: effectiveTitle,
        category: selectedCategory,
        walletKey: activeOption.walletKey,
        envelopeId: activeOption.envelopeId,
        envelopeName: activeOption.envelopeName,
        createdAt: new Date(),
      });

      setAmount('');
      setTitle('');
      setFeedback({
        type: 'ok',
        text: `Paid Rs. ${Math.round(numericAmount).toLocaleString('en-PK')} — ${effectiveTitle}`,
      });
      amountRef.current?.focus();
    } catch (error) {
      console.error('Failed to add quick expense:', error);
      setFeedback({
        type: 'err',
        text: 'Could not save expense. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`w-full rounded-2xl border transition-colors ${
        isDark
          ? 'border-white/10 bg-[#1f2430] text-white shadow-lg'
          : 'border-slate-200 bg-white text-slate-900 shadow-xs'
      }`}
    >
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
              isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-600'
            }`}
          >
            <Zap size={15} />
          </span>
          <span className="text-sm font-bold tracking-tight">Make a Spend</span>
          {!expanded && activeOption && (
            <span
              className={`hidden sm:inline text-[11px] truncate ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              • Quick paid expense
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!hasSpendableMoney && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
              <AlertTriangle size={11} />
              No spendable
            </span>
          )}
          <ChevronDown
            size={17}
            className={`transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            } ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
          />
        </div>
      </button>

      {/* Collapsible Body */}
      {expanded && (
        <form
          onSubmit={handleSubmit}
          className={`space-y-2.5 border-t px-3 pb-3 pt-2.5 ${
            isDark ? 'border-white/10' : 'border-slate-100'
          }`}
        >
          {/* Warning when no spendable money exists */}
          {!hasSpendableMoney && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                isDark
                  ? 'border-amber-500/30 bg-amber-950/50 text-amber-300'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                No spendable money is available in your wallets or envelopes. Add spendable funds first.
              </span>
            </div>
          )}

          {/* Category pills (short names + small icons) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {CATEGORY_PILLS.map((cat) => {
              const IconComp = cat.Icon;
              const active = selectedCategory === cat.full;
              return (
                <button
                  key={cat.full}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.full);
                    if (!amount) amountRef.current?.focus();
                  }}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? isDark
                        ? 'bg-white text-slate-950'
                        : 'bg-zinc-900 text-white'
                      : isDark
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <IconComp size={12} />
                  <span>{cat.short}</span>
                </button>
              );
            })}
          </div>

          {/* Expense composer */}
          <div className="flex items-center gap-2">
            {/* Amount */}
            <div
              className={`flex w-28 shrink-0 items-center gap-1 rounded-xl px-2.5 ${
                isDark ? 'bg-[#282e3d]' : 'bg-gray-100'
              }`}
            >
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Rs.</span>
              <input
                ref={amountRef}
                type="text"
                inputMode="decimal"
                placeholder="0"
                disabled={!hasSpendableMoney}
                value={amount}
                onChange={(e) => {
                  if (/^\d*\.?\d{0,2}$/.test(e.target.value)) {
                    setAmount(e.target.value);
                  }
                }}
                className={`h-11 w-full min-w-0 bg-transparent text-base font-semibold outline-none disabled:opacity-50 ${
                  isDark
                    ? 'text-white placeholder:text-slate-500'
                    : 'text-slate-900 placeholder:text-gray-400'
                }`}
              />
            </div>

            {/* Title */}
            <input
              type="text"
              placeholder={`Note (default: ${activeCategoryObj.short})...`}
              disabled={!hasSpendableMoney}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`h-11 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none disabled:opacity-50 ${
                isDark
                  ? 'text-white placeholder:text-slate-500'
                  : 'text-slate-900 placeholder:text-gray-400'
              }`}
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || saving}
              aria-label="Make a spend"
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-white text-slate-950 hover:bg-slate-200'
                  : 'bg-zinc-900 text-white hover:bg-zinc-800'
              }`}
            >
              {saving ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              )}
            </button>
          </div>

          {/* Selected spendable wallet + envelope selector */}
          {hasSpendableMoney && activeOption && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>From:</span>
                {spendableWallets.length > 1 ? (
                  <select
                    value={activeOption.optionId}
                    onChange={(e) => setSelectedOptionId(e.target.value)}
                    aria-label="Deduct from wallet or envelope"
                    className={`max-w-[200px] truncate rounded-lg border px-2 py-0.5 text-[11px] font-medium outline-none cursor-pointer ${
                      isDark
                        ? 'border-white/10 bg-[#282e3d] text-slate-200'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {spendableWallets.map((w) => (
                      <option key={w.optionId} value={w.optionId}>
                        {w.label}
                        {w.envelopeName ? ` • ${w.envelopeName}` : ''} (Rs.{' '}
                        {Math.round(w.spendable).toLocaleString('en-PK')})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold truncate">
                    {activeOption.label}
                    {activeOption.envelopeName ? ` • ${activeOption.envelopeName}` : ''}
                  </span>
                )}
              </div>

              <span
                className={`tabular-nums font-medium ${
                  insufficientInSelected
                    ? 'text-rose-500'
                    : isDark
                    ? 'text-emerald-400'
                    : 'text-emerald-600'
                }`}
              >
                {insufficientInSelected
                  ? `Exceeds spendable (Rs. ${Math.round(activeOption.spendable).toLocaleString('en-PK')})`
                  : `Spendable: Rs. ${Math.round(activeOption.spendable).toLocaleString('en-PK')}`}
              </span>
            </div>
          )}

          {/* Brief confirmation / error feedback */}
          {feedback && (
            <p
              className={`px-0.5 text-[11px] font-medium ${
                feedback.type === 'ok'
                  ? isDark
                    ? 'text-emerald-400'
                    : 'text-emerald-600'
                  : isDark
                  ? 'text-rose-400'
                  : 'text-rose-600'
              }`}
            >
              {feedback.type === 'ok' ? '✓ ' : ''}
              {feedback.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
