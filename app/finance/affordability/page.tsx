'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Container, Skeleton } from '@mui/material';
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import {
  calculateAffordability,
  type AffordabilityResult,
  type AnalysisPeriodPreset,
} from '@/app/lib/finance/affordabilityAnalyzer';
import { useAffordabilityData } from '@/app/lib/finance/useAffordabilityData';

const formatPKR = (amount: number): string => {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  return `${sign}Rs. ${Math.abs(safe).toLocaleString('en-PK', {
    maximumFractionDigits: 0,
  })}`;
};

const BUFFER_PRESETS = [0, 5000, 10000, 25000, 50000];

const PERIOD_OPTIONS: { value: AnalysisPeriodPreset; label: string; hint: string }[] = [
  {
    value: 'remaining_current_month',
    label: 'Remaining Current Month',
    hint: 'Includes overdue obligations + remaining days this month',
  },
  {
    value: 'next_30_days',
    label: 'Next 30 Days',
    hint: 'Includes overdue obligations + next 30 calendar days',
  },
  {
    value: 'end_of_next_month',
    label: 'Through End of Next Month',
    hint: 'Includes overdue obligations + this month and next month',
  },
  {
    value: 'custom',
    label: 'Custom End Date',
    hint: 'Includes overdue obligations through a chosen date',
  },
];

export default function AffordabilityAnalyzerPage() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const { data, loading, error, lastFetchedAt, refresh } = useAffordabilityData(user?.uid);

  // Form state
  const [purchaseName, setPurchaseName] = useState('');
  const [proposedAmountStr, setProposedAmountStr] = useState('');
  const [emergencyBufferStr, setEmergencyBufferStr] = useState('10000');
  const [periodPreset, setPeriodPreset] = useState<AnalysisPeriodPreset>('remaining_current_month');
  const [customEndDate, setCustomEndDate] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Submitted analysis parameters (so analysis runs deterministically when user clicks Analyze)
  const [submittedConfig, setSubmittedConfig] = useState<{
    purchaseName: string;
    proposedPurchaseAmount: number;
    emergencyBuffer: number;
    periodPreset: AnalysisPeriodPreset;
    customPeriodEnd: string | null;
  } | null>(null);

  const [activeDetailTab, setActiveDetailTab] = useState<
    'expenses' | 'repayments' | 'recoveries' | 'wallets'
  >('expenses');

  // Recompute deterministically whenever submittedConfig or fresh Firestore data changes
  const result: AffordabilityResult | null = useMemo(() => {
    if (!submittedConfig) return null;
    return calculateAffordability({
      purchaseName: submittedConfig.purchaseName,
      proposedPurchaseAmount: submittedConfig.proposedPurchaseAmount,
      emergencyBuffer: submittedConfig.emergencyBuffer,
      periodPreset: submittedConfig.periodPreset,
      customPeriodEnd: submittedConfig.customPeriodEnd,
      snapshot: data.snapshot,
      plannedExpenses: data.plannedExpenses,
      expenditures: data.expenditures,
      loans: data.loans,
      liabilities: data.liabilities,
    });
  }, [submittedConfig, data]);

  // Baseline snapshot preview (before purchase) for quick orientation
  const baselinePreview = useMemo(() => {
    if (!data.snapshot && data.plannedExpenses.length === 0 && data.loans.length === 0) {
      return null;
    }
    return calculateAffordability({
      purchaseName: 'Baseline',
      proposedPurchaseAmount: 0,
      emergencyBuffer: Math.max(0, Number(emergencyBufferStr) || 0),
      periodPreset,
      customPeriodEnd: periodPreset === 'custom' ? customEndDate || null : null,
      snapshot: data.snapshot,
      plannedExpenses: data.plannedExpenses,
      expenditures: data.expenditures,
      loans: data.loans,
      liabilities: data.liabilities,
    });
  }, [data, emergencyBufferStr, periodPreset, customEndDate]);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(proposedAmountStr);
    const buffer = emergencyBufferStr.trim() === '' ? 0 : Number(emergencyBufferStr);

    if (!Number.isFinite(amount) || amount <= 0) {
      setValidationError('Please enter a valid proposed purchase amount greater than 0.');
      return;
    }
    if (!Number.isFinite(buffer) || buffer < 0) {
      setValidationError('Emergency buffer must be 0 or a positive amount.');
      return;
    }
    if (periodPreset === 'custom' && !customEndDate) {
      setValidationError('Please select a custom analysis end date.');
      return;
    }

    setValidationError(null);
    setSubmittedConfig({
      purchaseName: purchaseName.trim(),
      proposedPurchaseAmount: amount,
      emergencyBuffer: buffer,
      periodPreset,
      customPeriodEnd: periodPreset === 'custom' ? customEndDate : null,
    });
  };

  const pageBg = isDark ? 'bg-[#181c24] text-slate-100' : 'bg-[#f1f5f9] text-slate-900';
  const cardCls = isDark
    ? 'bg-[#1f2430] border border-white/10 text-slate-100 shadow-lg'
    : 'bg-white border border-slate-200 text-slate-900 shadow-sm';
  const subPanelCls = isDark
    ? 'bg-[#282e3d] border border-white/10'
    : 'bg-slate-50 border border-slate-200';
  const inputCls = isDark
    ? 'bg-[#181c24] border border-white/15 text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30'
    : 'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

  if (authLoading) {
    return (
      <div className={`min-h-screen ${pageBg} py-8`}>
        <Container maxWidth="lg">
          <Skeleton variant="rounded" height={60} sx={{ mb: 2, borderRadius: 3 }} />
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: 3 }} />
        </Container>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen ${pageBg} flex items-center justify-center p-4`}>
        <div className={`max-w-md w-full rounded-2xl p-6 text-center ${cardCls}`}>
          <Lock className="w-10 h-10 mx-auto mb-3 text-indigo-500" />
          <h1 className="text-lg font-bold mb-1">Sign in required</h1>
          <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Please sign in to analyze purchase affordability using your personal finance records.
          </p>
          <Link
            href="/finance"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Finance
          </Link>
        </div>
      </div>
    );
  }

  const verdictTheme = (() => {
    if (!result) return null;
    switch (result.verdict.color) {
      case 'green':
        return {
          wrap: isDark
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-100'
            : 'bg-emerald-50 border-emerald-300 text-emerald-950',
          badge: 'bg-emerald-600 text-white',
          icon: <CheckCircle2 className="w-7 h-7 text-emerald-500 shrink-0" />,
        };
      case 'amber':
        return {
          wrap: isDark
            ? 'bg-amber-950/60 border-amber-500/40 text-amber-100'
            : 'bg-amber-50 border-amber-300 text-amber-950',
          badge: 'bg-amber-500 text-slate-950',
          icon: <AlertTriangle className="w-7 h-7 text-amber-500 shrink-0" />,
        };
      case 'blue':
        return {
          wrap: isDark
            ? 'bg-blue-950/60 border-blue-500/40 text-blue-100'
            : 'bg-blue-50 border-blue-300 text-blue-950',
          badge: 'bg-blue-600 text-white',
          icon: <Clock className="w-7 h-7 text-blue-500 shrink-0" />,
        };
      default:
        return {
          wrap: isDark
            ? 'bg-rose-950/60 border-rose-500/40 text-rose-100'
            : 'bg-rose-50 border-rose-300 text-rose-950',
          badge: 'bg-rose-600 text-white',
          icon: <XCircle className="w-7 h-7 text-rose-500 shrink-0" />,
        };
    }
  })();

  return (
    <div className={`min-h-screen ${pageBg} pb-12`}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 2.5 } }}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/finance"
              className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                isDark
                  ? 'bg-[#1f2430] border border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
              aria-label="Back to Finance"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Affordability Analyzer
                </h1>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isDark
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                      : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  }`}
                >
                  Read-Only
                </span>
              </div>
              <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Check if you can safely afford a purchase without compromising bills, loans, savings, or Amanat.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refresh()}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ${
              isDark
                ? 'bg-[#1f2430] border border-white/10 hover:bg-white/10 text-slate-200'
                : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing...' : 'Refresh Data'}
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div
            className={`mb-5 rounded-2xl border p-4 flex items-center justify-between gap-3 ${
              isDark
                ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2.5 text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => refresh()}
              className="text-xs font-semibold underline shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Quick Live Snapshot Strip */}
        {loading && !data.snapshot ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={78} sx={{ borderRadius: 3 }} />
            ))}
          </div>
        ) : baselinePreview ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className={`rounded-2xl p-3.5 ${cardCls}`}>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Spendable Now
              </p>
              <p className="text-lg font-bold text-emerald-500 mt-0.5">
                {formatPKR(baselinePreview.ownership.totalSpendable)}
              </p>
            </div>
            <div className={`rounded-2xl p-3.5 ${cardCls}`}>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Uncovered Obligations
              </p>
              <p className="text-lg font-bold text-rose-500 mt-0.5">
                {formatPKR(baselinePreview.obligations.totalUncoveredObligations)}
              </p>
            </div>
            <div className={`rounded-2xl p-3.5 ${cardCls}`}>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Protected (Reserve/Save/Amanat)
              </p>
              <p className="text-lg font-bold text-blue-500 mt-0.5">
                {formatPKR(
                  baselinePreview.ownership.totalReserve +
                    baselinePreview.ownership.totalSaving +
                    baselinePreview.ownership.totalAmanat
                )}
              </p>
            </div>
            <div className={`rounded-2xl p-3.5 ${cardCls}`}>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Current Safe Capacity
              </p>
              <p
                className={`text-lg font-bold mt-0.5 ${
                  baselinePreview.capacity.safePurchasingCapacity >= 0
                    ? 'text-indigo-500'
                    : 'text-rose-500'
                }`}
              >
                {formatPKR(baselinePreview.capacity.safePurchasingCapacity)}
              </p>
            </div>
          </div>
        ) : null}

        {/* Input Form Card */}
        <form onSubmit={handleAnalyze} className={`rounded-3xl p-4 sm:p-6 mb-6 ${cardCls}`}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-500" />
              <h2 className="text-base sm:text-lg font-bold">Purchase Evaluation Details</h2>
            </div>
            {lastFetchedAt && (
              <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Synced {lastFetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Purchase / Product Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 opacity-80">
                Purchase / Product Name <span className="font-normal opacity-60">(optional)</span>
              </label>
              <input
                type="text"
                value={purchaseName}
                onChange={(e) => setPurchaseName(e.target.value)}
                placeholder="e.g., New Laptop, Bike Repair, Air Conditioner"
                className={`w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all ${inputCls}`}
              />
            </div>

            {/* Proposed Purchase Amount */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 opacity-80">
                Proposed Purchase Amount (Rs.) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={proposedAmountStr}
                onChange={(e) => {
                  setProposedAmountStr(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Enter amount in PKR"
                className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none transition-all ${inputCls}`}
              />
            </div>

            {/* Emergency Buffer */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 opacity-80">
                Emergency Buffer (Rs.)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={emergencyBufferStr}
                onChange={(e) => setEmergencyBufferStr(e.target.value)}
                placeholder="Minimum cash cushion to keep untouched"
                className={`w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all ${inputCls}`}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {BUFFER_PRESETS.map((preset) => {
                  const active = Number(emergencyBufferStr) === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEmergencyBufferStr(String(preset))}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : isDark
                          ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {preset === 0 ? 'No Buffer' : `Rs. ${preset.toLocaleString('en-PK')}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Analysis Period */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5 opacity-80">
                Analysis Period
              </label>
              <select
                value={periodPreset}
                onChange={(e) => setPeriodPreset(e.target.value as AnalysisPeriodPreset)}
                className={`w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-all ${inputCls}`}
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className={`text-[11px] mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {PERIOD_OPTIONS.find((o) => o.value === periodPreset)?.hint}
              </p>

              {periodPreset === 'custom' && (
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className={`mt-2 w-full rounded-xl px-3.5 py-2 text-sm outline-none transition-all ${inputCls}`}
                />
              )}
            </div>
          </div>

          {validationError && (
            <p className="mt-3 text-xs font-medium text-rose-500">{validationError}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Amanat and Savings are automatically excluded. No balances or records will be modified.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              Analyze Affordability
            </button>
          </div>
        </form>

        {/* Results Dashboard */}
        {result && verdictTheme && (
          <div className="space-y-6">
            {/* 1. Verdict Banner */}
            <div className={`rounded-3xl border p-5 sm:p-6 ${verdictTheme.wrap}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  {verdictTheme.icon}
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${verdictTheme.badge}`}
                      >
                        {result.verdict.label}
                      </span>
                      <span className="text-xs opacity-75">
                        {result.period.label} ({result.period.startDate} → {result.period.endDate})
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold">
                      {result.purchaseName} — {formatPKR(result.proposedPurchaseAmount)}
                    </h2>
                    <p className="text-sm opacity-90 mt-1">{result.verdict.summary}</p>
                  </div>
                </div>

                <div className="flex sm:flex-col gap-3 sm:gap-1.5 sm:text-right shrink-0">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide opacity-75">
                      Post-Purchase Safe Balance
                    </p>
                    <p
                      className={`text-lg sm:text-xl font-extrabold ${
                        result.capacity.remainingPostPurchaseSafeBalance < 0 ? 'text-rose-500' : ''
                      }`}
                    >
                      {formatPKR(result.capacity.remainingPostPurchaseSafeBalance)}
                    </p>
                  </div>
                  {result.capacity.purchaseShortfall > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide opacity-75">
                        Purchase Shortfall
                      </p>
                      <p className="text-base font-bold text-rose-500">
                        {formatPKR(result.capacity.purchaseShortfall)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Complete Metrics Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Column A: Ownership Breakdown */}
              <div className={`rounded-3xl p-5 ${cardCls}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-sm sm:text-base font-bold">Wallet Ownership</h3>
                </div>

                {/* Stacked Bar */}
                {result.ownership.totalWalletBalance > 0 && (
                  <div className="h-3 w-full rounded-full overflow-hidden flex mb-4 bg-slate-700/20">
                    {[
                      { val: result.ownership.totalSpendable, cls: 'bg-emerald-500' },
                      { val: result.ownership.totalReserve, cls: 'bg-blue-500' },
                      { val: result.ownership.totalSaving, cls: 'bg-violet-500' },
                      { val: result.ownership.totalAmanat, cls: 'bg-amber-500' },
                    ].map((seg, i) => {
                      const pct = (seg.val / result.ownership.totalWalletBalance) * 100;
                      if (pct <= 0) return null;
                      return <div key={i} className={seg.cls} style={{ width: `${pct}%` }} />;
                    })}
                  </div>
                )}

                <div className="space-y-2.5 text-sm">
                  <MetricRow
                    label="Total Wallet Balance"
                    value={formatPKR(result.ownership.totalWalletBalance)}
                    bold
                    isDark={isDark}
                  />
                  <MetricRow
                    label="Spendable (Available)"
                    value={formatPKR(result.ownership.totalSpendable)}
                    dot="bg-emerald-500"
                    valueClass="text-emerald-500 font-semibold"
                    isDark={isDark}
                  />
                  <MetricRow
                    label="Reserve (Earmarked)"
                    value={formatPKR(result.ownership.totalReserve)}
                    dot="bg-blue-500"
                    valueClass="text-blue-500"
                    isDark={isDark}
                  />
                  <MetricRow
                    label="Saving (Excluded)"
                    value={formatPKR(result.ownership.totalSaving)}
                    dot="bg-violet-500"
                    valueClass="text-violet-400"
                    isDark={isDark}
                  />
                  <MetricRow
                    label="Amanat (Strictly Excluded)"
                    value={formatPKR(result.ownership.totalAmanat)}
                    dot="bg-amber-500"
                    valueClass="text-amber-500"
                    isDark={isDark}
                  />
                </div>
              </div>

              {/* Column B: Financial Obligations */}
              <div className={`rounded-3xl p-5 ${cardCls}`}>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-5 h-5 text-rose-500" />
                  <h3 className="text-sm sm:text-base font-bold">Obligations & Recoveries</h3>
                </div>

                <div className="space-y-2.5 text-sm">
                  <MetricRow
                    label="Pending Expenses"
                    sub={
                      result.obligations.totalOverdueExpenses > 0
                        ? `Incl. ${formatPKR(result.obligations.totalOverdueExpenses)} overdue`
                        : undefined
                    }
                    value={formatPKR(result.obligations.totalPendingExpenses)}
                    isDark={isDark}
                  />
                  <MetricRow
                    label="Upcoming Loan Repayments"
                    sub={
                      result.obligations.totalOverdueLoanRepayments > 0
                        ? `Incl. ${formatPKR(result.obligations.totalOverdueLoanRepayments)} overdue`
                        : undefined
                    }
                    value={formatPKR(result.obligations.totalUpcomingLoanRepayments)}
                    isDark={isDark}
                  />
                  <MetricRow
                    label="Covered by Reserve Funds"
                    value={`- ${formatPKR(result.obligations.obligationsCoveredByReserve)}`}
                    valueClass="text-blue-500 font-medium"
                    isDark={isDark}
                  />
                  <div className={`border-t pt-2.5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <MetricRow
                      label="Total Uncovered Obligations"
                      value={formatPKR(result.obligations.totalUncoveredObligations)}
                      bold
                      valueClass="text-rose-500 font-bold"
                      isDark={isDark}
                    />
                  </div>
                  <div className={`border-t pt-2.5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <MetricRow
                      label="Expected Loan Recoveries"
                      sub="Separate — not counted in Spendable"
                      value={formatPKR(result.obligations.totalExpectedLoanRecoveries)}
                      valueClass="text-sky-500 font-semibold"
                      isDark={isDark}
                    />
                  </div>
                </div>
              </div>

              {/* Column C: Purchasing Capacity Formula */}
              <div className={`rounded-3xl p-5 ${cardCls}`}>
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm sm:text-base font-bold">Purchasing Capacity</h3>
                </div>

                <div className="space-y-2.5 text-sm">
                  <MetricRow
                    label="Net Spendable Capacity"
                    sub="Spendable − Uncovered Obligations"
                    value={formatPKR(result.capacity.netSpendableCapacity)}
                    valueClass={
                      result.capacity.netSpendableCapacity < 0
                        ? 'text-rose-500 font-semibold'
                        : 'font-semibold'
                    }
                    isDark={isDark}
                  />
                  <MetricRow
                    label="Emergency Buffer"
                    value={`- ${formatPKR(result.emergencyBuffer)}`}
                    isDark={isDark}
                  />
                  <div className={`border-t pt-2.5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <MetricRow
                      label="Safe Purchasing Capacity"
                      sub="Net Spendable − Emergency Buffer"
                      value={formatPKR(result.capacity.safePurchasingCapacity)}
                      bold
                      valueClass={
                        result.capacity.safePurchasingCapacity < 0
                          ? 'text-rose-500 font-bold'
                          : 'text-emerald-500 font-bold'
                      }
                      isDark={isDark}
                    />
                  </div>
                  <MetricRow
                    label="Proposed Purchase"
                    value={`- ${formatPKR(result.proposedPurchaseAmount)}`}
                    isDark={isDark}
                  />
                  <div className={`border-t pt-2.5 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <MetricRow
                      label="Remaining Post-Purchase Balance"
                      value={formatPKR(result.capacity.remainingPostPurchaseSafeBalance)}
                      bold
                      valueClass={
                        result.capacity.remainingPostPurchaseSafeBalance < 0
                          ? 'text-rose-500 font-bold'
                          : 'text-emerald-500 font-bold'
                      }
                      isDark={isDark}
                    />
                    {result.capacity.purchaseShortfall > 0 && (
                      <div className="mt-2">
                        <MetricRow
                          label="Purchase Shortfall"
                          value={formatPKR(result.capacity.purchaseShortfall)}
                          valueClass="text-rose-500 font-bold"
                          isDark={isDark}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Recommendations & Disclosures */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Recommendations */}
              <div className={`rounded-3xl p-5 ${cardCls}`}>
                <h3 className="text-sm sm:text-base font-bold mb-3.5">
                  Recommendations & Reasoning
                </h3>
                <div className="space-y-3">
                  {result.recommendations.map((rec, idx) => {
                    const accent =
                      rec.type === 'positive'
                        ? isDark
                          ? 'border-emerald-500/30 bg-emerald-950/30'
                          : 'border-emerald-200 bg-emerald-50'
                        : rec.type === 'warning'
                        ? isDark
                          ? 'border-rose-500/30 bg-rose-950/30'
                          : 'border-rose-200 bg-rose-50'
                        : rec.type === 'caution'
                        ? isDark
                          ? 'border-amber-500/30 bg-amber-950/30'
                          : 'border-amber-200 bg-amber-50'
                        : isDark
                        ? 'border-indigo-500/30 bg-indigo-950/30'
                        : 'border-indigo-200 bg-indigo-50';
                    return (
                      <div key={idx} className={`rounded-2xl border p-3.5 ${accent}`}>
                        <p className="text-sm font-semibold">{rec.title}</p>
                        <p
                          className={`text-xs mt-1 leading-relaxed ${
                            isDark ? 'text-slate-300' : 'text-slate-700'
                          }`}
                        >
                          {rec.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transparency & Disclosures */}
              <div className={`rounded-3xl p-5 ${cardCls}`}>
                <div className="flex items-center gap-2 mb-3.5">
                  <Info className="w-4 h-4 text-sky-500" />
                  <h3 className="text-sm sm:text-base font-bold">
                    Assumptions & Data Disclosures
                  </h3>
                </div>
                {result.disclosures.length === 0 ? (
                  <div className={`rounded-2xl p-4 text-xs ${subPanelCls}`}>
                    All wallet balances, payment statuses, and obligation due dates were clean and unambiguous for this analysis period.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {result.disclosures.map((d) => (
                      <div
                        key={d.code}
                        className={`rounded-2xl border p-3.5 ${
                          d.severity === 'warning'
                            ? isDark
                              ? 'border-amber-500/30 bg-amber-950/25'
                              : 'border-amber-200 bg-amber-50/70'
                            : isDark
                            ? 'border-sky-500/25 bg-sky-950/25'
                            : 'border-sky-200 bg-sky-50/70'
                        }`}
                      >
                        <p className="text-xs sm:text-sm font-semibold">{d.title}</p>
                        <p
                          className={`text-xs mt-1 leading-relaxed ${
                            isDark ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          {d.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Itemized Breakdown Tabs */}
            <div className={`rounded-3xl p-5 ${cardCls}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-sm sm:text-base font-bold">Itemized Breakdown</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      {
                        key: 'expenses',
                        label: `Pending Expenses (${result.obligations.pendingExpenses.length})`,
                      },
                      {
                        key: 'repayments',
                        label: `Loan Repayments (${result.obligations.borrowedLoanRepayments.length})`,
                      },
                      {
                        key: 'recoveries',
                        label: `Expected Recoveries (${result.obligations.expectedLoanRecoveries.length})`,
                      },
                      {
                        key: 'wallets',
                        label: `Wallets (${result.ownership.wallets.length})`,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveDetailTab(tab.key)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                        activeDetailTab === tab.key
                          ? 'bg-indigo-600 text-white'
                          : isDark
                          ? 'bg-white/5 hover:bg-white/10 text-slate-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeDetailTab === 'expenses' && (
                <div className="space-y-2">
                  {result.obligations.pendingExpenses.length === 0 ? (
                    <p className={`text-xs py-4 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      No unpaid or overdue expenses due in this analysis period.
                    </p>
                  ) : (
                    result.obligations.pendingExpenses.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 ${subPanelCls}`}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{item.title}</span>
                            {item.isOverdue && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500">
                                Overdue
                              </span>
                            )}
                            {item.hasUndefinedStatus && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                                Status Unset
                              </span>
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {item.category} • Due: {item.dueDate || 'Unscheduled'}
                            {item.paidAmount > 0
                              ? ` • Paid ${formatPKR(item.paidAmount)} of ${formatPKR(item.totalAmount)}`
                              : ''}
                            {item.matchedEnvelopeLabel
                              ? ` • Reserve: ${item.matchedEnvelopeLabel}`
                              : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{formatPKR(item.uncoveredAmount)}</p>
                          {item.reserveCoveredAmount > 0 && (
                            <p className="text-[11px] text-blue-500">
                              {formatPKR(item.reserveCoveredAmount)} covered by Reserve
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeDetailTab === 'repayments' && (
                <div className="space-y-2">
                  {result.obligations.borrowedLoanRepayments.length === 0 ? (
                    <p className={`text-xs py-4 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      No borrowed loan repayments due in this analysis period.
                    </p>
                  ) : (
                    result.obligations.borrowedLoanRepayments.map((loan) => (
                      <div
                        key={loan.id}
                        className={`rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 ${subPanelCls}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{loan.counterparty}</span>
                            {loan.isOverdue && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500">
                                Overdue
                              </span>
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Due: {loan.dueDate || 'Overdue'}
                            {loan.paidAmount > 0
                              ? ` • Repaid ${formatPKR(loan.paidAmount)} of ${formatPKR(loan.totalAmount)}`
                              : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{formatPKR(loan.uncoveredAmount)}</p>
                          {loan.reserveCoveredAmount > 0 && (
                            <p className="text-[11px] text-blue-500">
                              {formatPKR(loan.reserveCoveredAmount)} covered by Reserve
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeDetailTab === 'recoveries' && (
                <div className="space-y-2">
                  {result.obligations.expectedLoanRecoveries.length === 0 ? (
                    <p className={`text-xs py-4 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      No lent loan recoveries expected in this analysis period.
                    </p>
                  ) : (
                    result.obligations.expectedLoanRecoveries.map((loan) => (
                      <div
                        key={loan.id}
                        className={`rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 ${subPanelCls}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{loan.counterparty}</span>
                            {loan.isOverdue && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                                Past Due
                              </span>
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Expected: {loan.dueDate || 'Pending'}
                            {loan.paidAmount > 0
                              ? ` • Received ${formatPKR(loan.paidAmount)} of ${formatPKR(loan.totalAmount)}`
                              : ''}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-sky-500">
                          + {formatPKR(loan.remainingAmount)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeDetailTab === 'wallets' && (
                <div className="overflow-x-auto">
                  {result.ownership.wallets.length === 0 ? (
                    <p className={`text-xs py-4 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      No non-virtual wallets with positive balances found.
                    </p>
                  ) : (
                    <table className="w-full text-xs sm:text-sm text-left">
                      <thead>
                        <tr
                          className={`border-b ${
                            isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
                          }`}
                        >
                          <th className="py-2 pr-3 font-semibold">Wallet</th>
                          <th className="py-2 px-2 text-right font-semibold">Total</th>
                          <th className="py-2 px-2 text-right font-semibold text-emerald-500">
                            Spendable
                          </th>
                          <th className="py-2 px-2 text-right font-semibold text-blue-500">
                            Reserve
                          </th>
                          <th className="py-2 px-2 text-right font-semibold text-violet-400">
                            Saving
                          </th>
                          <th className="py-2 pl-2 text-right font-semibold text-amber-500">
                            Amanat
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.ownership.wallets.map((w) => (
                          <tr
                            key={w.walletKey}
                            className={`border-b last:border-b-0 ${
                              isDark ? 'border-white/5' : 'border-slate-100'
                            }`}
                          >
                            <td className="py-2.5 pr-3 font-medium">
                              {w.label}
                              {w.isLocked && (
                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500">
                                  Locked
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-right font-semibold">
                              {formatPKR(w.grossBalance)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-emerald-500">
                              {formatPKR(w.spendable)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-blue-500">
                              {formatPKR(w.reserve)}
                            </td>
                            <td className="py-2.5 px-2 text-right text-violet-400">
                              {formatPKR(w.saving)}
                            </td>
                            <td className="py-2.5 pl-2 text-right text-amber-500">
                              {formatPKR(w.amanat)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}

function MetricRow({
  label,
  sub,
  value,
  dot,
  bold,
  valueClass,
  isDark,
}: {
  label: string;
  sub?: string;
  value: string;
  dot?: string;
  bold?: boolean;
  valueClass?: string;
  isDark: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-start gap-2 min-w-0">
        {dot && <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${dot}`} />}
        <div className="min-w-0">
          <p className={`${bold ? 'font-bold' : 'font-medium'} leading-snug`}>{label}</p>
          {sub && (
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{sub}</p>
          )}
        </div>
      </div>
      <span className={`shrink-0 tabular-nums ${valueClass || (bold ? 'font-bold' : 'font-medium')}`}>
        {value}
      </span>
    </div>
  );
}
