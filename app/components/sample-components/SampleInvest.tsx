"use client";

import { useMemo, useState } from "react";

/**
 * InvestmentMilestone
 * ----------------------
 * Template for a single investment (Gold / Stock / Mutual Fund /
 * Real Estate / Business / Other) under Finance -> Investments.
 *
 * Two metrics are shown, deliberately kept separate and labeled with
 * their formula, since they answer different questions:
 *
 *   Profit Progress = Actual Profit / Expected Profit x 100
 *     "how much of the expected profit has been achieved"
 *     Only computable when there's a fixed total expected profit —
 *     i.e. profitTiming.mode === "date". For recurring expectations
 *     (monthly/weekly/custom), there's no single total to divide by,
 *     so this metric is omitted and the per-period expectation is
 *     shown instead as a reference line.
 *
 *   Investment Return = Actual Profit / Amount Invested x 100
 *     "how much the investment has actually grown relative to what
 *     was put in" — always computable, independent of any target.
 *
 * Actual profit entries can be added inline (amount + date, optionally
 * tagged as part of a weekly/monthly/custom recurring log) and are
 * grouped by month for the running history, matching:
 *
 *   Aug -> PKR 2,000
 *   Sep -> PKR 2,500
 *   Oct -> PKR 1,500
 *   -------------------
 *   Total Profit  PKR 6,000
 *
 * Usage:
 *   <InvestmentMilestone investment={{
 *     type: "gold",
 *     title: "Gold - 10 grams",
 *     currency: "PKR",
 *     amountInvested: 100000,
 *     quantity: 10,
 *     unit: "grams",
 *     expectedProfit: 20000,
 *     profitTiming: { mode: "date", expectedBy: "2026-12-31" },
 *     profitLogs: [
 *       { amount: 2000, date: "2026-08-15" },
 *       { amount: 2500, date: "2026-09-10" },
 *       { amount: 1500, date: "2026-10-05" },
 *     ],
 *   }} />
 */

const TYPE_META = {
  gold: { label: "Gold", color: "amber", icon: GoldIcon },
  stock: { label: "Stock", color: "sky", icon: StockIcon },
  mutual_fund: { label: "Mutual Fund", color: "violet", icon: FundIcon },
  real_estate: { label: "Real Estate", color: "emerald", icon: HomeIcon },
  business: { label: "Business", color: "indigo", icon: BriefcaseIcon },
  other: { label: "Other", color: "slate", icon: TagIcon },
};

const COLOR_CLASSES = {
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  indigo: "bg-indigo-50 text-indigo-600",
  slate: "bg-slate-100 text-slate-500",
};

const FREQUENCY_LABEL = { weekly: "Weekly", monthly: "Monthly", custom: "Custom" };

const DEMO_INVESTMENT = {
  type: "gold",
  title: "Gold – 10 grams",
  currency: "PKR",
  amountInvested: 100000,
  quantity: 10,
  unit: "grams",
  expectedProfit: 20000,
  profitTiming: { mode: "date", expectedBy: "2026-12-31" },
  profitLogs: [
    { amount: 2000, date: "2026-08-15" },
    { amount: 2500, date: "2026-09-10" },
    { amount: 1500, date: "2026-10-05" },
  ],
};

interface ProfitLog {
  amount: number;
  date: string;
  recurring?: string;
}

interface ProfitTiming {
  mode?: string;
  expectedBy?: string;
  label?: string;
}

interface InvestmentData {
  type?: string;
  title?: string;
  currency?: string;
  amountInvested?: number;
  quantity?: number;
  unit?: string;
  expectedProfit?: number;
  profitTiming?: ProfitTiming;
  profitLogs?: ProfitLog[];
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

function formatMoney(value: number, currency: string) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${currency} ${Math.round(Math.abs(value)).toLocaleString()}`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function monthLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short" });
}

export default function InvestmentMilestone({ investment = DEMO_INVESTMENT as InvestmentData }: { investment?: InvestmentData }) {
  const {
    type = "other",
    title,
    currency = "PKR",
    amountInvested = 0,
    quantity,
    unit,
    expectedProfit,
    profitTiming,
  } = investment || {};

  const [profitLogs, setProfitLogs] = useState<ProfitLog[]>(investment?.profitLogs ?? []);

  const meta = TYPE_META[type as keyof typeof TYPE_META] ?? TYPE_META.other;
  const Icon = meta.icon;

  const totalProfit = useMemo(() => profitLogs.reduce((sum, p) => sum + (p.amount || 0), 0), [profitLogs]);

  const monthlyGroups = useMemo(() => {
    const groups = new Map<string, number>();
    [...profitLogs]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((p) => {
        const label = monthLabel(p.date);
        groups.set(label, (groups.get(label) ?? 0) + p.amount);
      });
    return Array.from(groups.entries());
  }, [profitLogs]);

  const hasFixedTarget = profitTiming?.mode === "date" && typeof expectedProfit === "number";
  const progress = hasFixedTarget ? clamp(Math.round((totalProfit / expectedProfit) * 100)) : null;
  const returnPct = amountInvested > 0 ? Math.round((totalProfit / amountInvested) * 1000) / 10 : null;

  const addProfitLog = (log: ProfitLog) => setProfitLogs((prev) => [...prev, log]);

  return (
    <div className="w-full max-w-sm space-y-4">
      {/* Header + investment facts */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${COLOR_CLASSES[meta.color as keyof typeof COLOR_CLASSES]}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-medium text-slate-400">{meta.label}</p>
              <h3 className="mt-0.5 text-lg font-semibold text-slate-800">{title}</h3>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Amount invested</p>
            <p className="font-semibold text-slate-800">{formatMoney(amountInvested, currency)}</p>
          </div>
          {quantity != null && (
            <div>
              <p className="text-[11px] font-medium text-slate-400">Quantity</p>
              <p className="font-semibold text-slate-800">
                {quantity} {unit}
              </p>
            </div>
          )}
          <div>
            <p className="text-[11px] font-medium text-slate-400">Expected profit</p>
            <p className="font-semibold text-slate-800">
              {typeof expectedProfit === "number" ? formatMoney(expectedProfit, currency) : "Unknown"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">
              {profitTiming?.mode === "date" ? "Expected by" : "Frequency"}
            </p>
            <p className="font-semibold text-slate-800">
              {profitTiming?.mode === "date"
                ? formatDate(profitTiming.expectedBy)
                : profitTiming?.mode === "custom"
                ? profitTiming.label
                : FREQUENCY_LABEL[profitTiming?.mode as keyof typeof FREQUENCY_LABEL] ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Two explicit metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Profit Progress</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {progress !== null ? `${progress}%` : "—"}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-slate-400">Actual profit ÷ expected profit</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Investment Return</p>
          <p className={`mt-1 text-2xl font-semibold ${returnPct !== null && returnPct >= 0 ? "text-sky-600" : "text-rose-600"}`}>
            {returnPct !== null ? `${returnPct}%` : "—"}
          </p>
          <p className="mt-1 text-[10px] leading-tight text-slate-400">Actual profit ÷ amount invested</p>
        </div>
      </div>

      {/* Actual profit log */}
      <ProfitLogSection
        monthlyGroups={monthlyGroups}
        totalProfit={totalProfit}
        currency={currency}
        onAdd={addProfitLog}
      />
    </div>
  );
}

function ProfitLogSection({
  monthlyGroups,
  totalProfit,
  currency,
  onAdd,
}: {
  monthlyGroups: [string, number][];
  totalProfit: number;
  currency: string;
  onAdd: (log: ProfitLog) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [recurring, setRecurring] = useState("");

  const submit = () => {
    if (!amount || date === "") return;
    onAdd({ amount: Number(amount), date, recurring: recurring || undefined });
    setAmount("");
    setDate("");
    setRecurring("");
    setAdding(false);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-medium text-slate-400">Actual profit</p>
        <button type="button" onClick={() => setAdding((v) => !v)} className="text-xs font-medium text-slate-500 hover:text-slate-700">
          {adding ? "Cancel" : "+ Add profit"}
        </button>
      </div>

      {adding && (
        <div className="mb-3 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Amount (${currency})`}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={recurring}
              onChange={(e) => setRecurring(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
            >
              <option value="">One-time entry</option>
              <option value="weekly">Recurring · Weekly</option>
              <option value="monthly">Recurring · Monthly</option>
              <option value="custom">Recurring · Custom</option>
            </select>
            <button type="button" onClick={submit} className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700">
              Add
            </button>
          </div>
        </div>
      )}

      {monthlyGroups.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <ul className="space-y-1.5">
            {monthlyGroups.map(([label, amount]) => (
              <li key={label} className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{label}</span>
                <span className={`font-medium tabular-nums ${amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatMoney(amount, currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-semibold">
            <span className="text-slate-700">Total Profit</span>
            <span className={totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>
              {formatMoney(totalProfit, currency)}
            </span>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
          No profit logged yet
        </p>
      )}
    </div>
  );
}

/* ---------- Icons ---------- */

function GoldIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="9" width="18" height="10" rx="1" />
      <path d="M3 9l4-5h10l4 5" />
    </svg>
  );
}

function StockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
    </svg>
  );
}

function FundIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="12" width="4" height="8" />
      <rect x="10" y="7" width="4" height="13" />
      <rect x="17" y="3" width="4" height="17" />
    </svg>
  );
}

function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 11l9-7 9 7M5 10v10h14V10" />
    </svg>
  );
}

function BriefcaseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function TagIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2l9 9-9 9-9-9V2h9z" />
      <circle cx="7.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}