'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface MonthlyMoneyOverviewData {
  income: number;
  expenses: {
    paid: number;
    pending: number;
  };
  liabilities: number; // loans / amounts you must pay back
  receivables: number; // loans / amounts others must give back to you
}

const EMPTY_DATA: MonthlyMoneyOverviewData = {
  income: 0,
  expenses: { paid: 0, pending: 0 },
  liabilities: 0,
  receivables: 0,
};

const formatRs = (n: number) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-US')}`;

interface TileProps {
  dot: string;
  label: string;
  hint?: string;
  amount: string;
  amountClass: string;
  tint: string;
  ring: string;
  isDark: boolean;
  onClick?: () => void;
}

// Compact tile so two can sit side by side on one line
function Tile({ dot, label, hint, amount, amountClass, tint, ring, isDark, onClick }: TileProps) {
  const classes = `min-w-0 w-full text-left rounded-2xl px-3.5 py-3 ring-1 ring-inset transition hover:scale-[1.02] ${tint} ${ring} ${
    onClick ? 'cursor-pointer' : ''
  }`;

  const content = (
    <>
      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${dot} ring-4 ${
            isDark ? 'ring-white/5' : 'ring-black/5'
          }`}
        />
        <p className={`truncate text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {label}
        </p>
      </div>
      <p className={`mt-2 truncate text-lg font-bold tabular-nums ${amountClass}`}>{amount}</p>
      {hint && (
        <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>{hint}</p>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}

interface MonthlyMoneyOverviewProps {
  data?: MonthlyMoneyOverviewData;
  balancesVisible?: boolean;
  incomeHref?: string;
  expensesHref?: string;
  onPayBackClick?: () => void;
  onGetBackClick?: () => void;
  isDark?: boolean;
}

export default function MonthlyMoneyOverview({
  data = EMPTY_DATA,
  balancesVisible = true,
  incomeHref = '/finance/income-sources',
  expensesHref = '/finance/expenses',
  onPayBackClick,
  onGetBackClick,
  isDark = true,
}: MonthlyMoneyOverviewProps) {
  const { income, expenses, liabilities, receivables } = data;
  const totalExpenses = expenses.paid + expenses.pending;
  const paidPct = totalExpenses > 0 ? Math.round((expenses.paid / totalExpenses) * 100) : 0;
  const pendingPct = totalExpenses > 0 ? 100 - paidPct : 0;
  const displayRs = (n: number) => (balancesVisible ? formatRs(n) : 'Rs. •••••');

  return (
    <div
      className={`w-full h-full flex flex-col justify-between rounded-3xl border p-5 sm:p-6 transition-colors ${
        isDark
          ? 'border-white/10 bg-[#1f2430] text-white shadow-xl'
          : 'border-slate-200 bg-white text-slate-900 shadow-sm'
      }`}
    >
      {/* 1. Income */}
      <Link
        href={incomeHref}
        className={`group flex items-center justify-between rounded-2xl px-4 py-1 transition ${
          isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
        }`}
      >
        <div>
          <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>Total income</p>
          <h2
            className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            {displayRs(income)}
          </h2>
        </div>
        <ChevronRight
          size={18}
          className={`transition-colors ${
            isDark
              ? 'text-neutral-500 group-hover:text-green-400'
              : 'text-slate-400 group-hover:text-green-600'
          }`}
        />
      </Link>

      <div className={`my-5 h-px w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

      {/* 2. Expenses */}
      <div
        className={`rounded-2xl p-4 ${
          isDark ? 'bg-[#282e3d] border border-white/10' : 'border border-slate-200/80 bg-slate-50'
        }`}
      >
        <Link href={expensesHref} className="group flex items-center justify-between">
          <div>
            <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
              Total expenses this month
            </p>
            <p
              className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {displayRs(totalExpenses)}
            </p>
          </div>
          <ChevronRight
            size={18}
            className={`transition-colors ${
              isDark
                ? 'text-neutral-500 group-hover:text-amber-400'
                : 'text-slate-400 group-hover:text-amber-600'
            }`}
          />
        </Link>

        <div className="mt-4 flex h-3.5 w-full gap-2">
          {totalExpenses > 0 ? (
            <>
              {paidPct > 0 && (
                <div
                  className="rounded-full bg-green-500 transition-all duration-300"
                  style={{ width: `${paidPct}%` }}
                />
              )}
              {pendingPct > 0 && (
                <div
                  className="rounded-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${pendingPct}%` }}
                />
              )}
            </>
          ) : (
            <div className={`w-full rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Tile
            dot="bg-green-500"
            label="Paid off"
            hint={`${paidPct}% of expenses`}
            amount={displayRs(expenses.paid)}
            amountClass={isDark ? 'text-green-400' : 'text-green-700'}
            tint={isDark ? 'bg-green-500/10' : 'bg-green-50'}
            ring={isDark ? 'ring-green-500/40' : 'ring-green-200'}
            isDark={isDark}
          />
          <Tile
            dot="bg-amber-500"
            label="Pending"
            hint={`${pendingPct}% of expenses`}
            amount={displayRs(expenses.pending)}
            amountClass={isDark ? 'text-amber-400' : 'text-amber-700'}
            tint={isDark ? 'bg-amber-500/10' : 'bg-amber-50'}
            ring={isDark ? 'ring-amber-500/40' : 'ring-amber-200'}
            isDark={isDark}
          />
        </div>
      </div>

      {/* 3. Loans (Distinguished section with To Pay Back & To Get Back on separate lines) */}
      <div
        className={`mt-4 rounded-2xl p-4 ${
          isDark ? 'bg-[#282e3d] border border-white/10' : 'border border-slate-200/80 bg-slate-50'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <p
            className={`text-sm font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Loans
          </p>
          <span
            className={`text-[11px] font-medium ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Payables &amp; Receivables
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onPayBackClick}
            className={`w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ring-inset transition hover:scale-[1.01] cursor-pointer text-left ${
              isDark
                ? 'bg-red-500/10 ring-red-500/35 hover:bg-red-500/15'
                : 'bg-red-50 ring-red-200 hover:bg-red-100/70'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`h-3 w-3 shrink-0 rounded-full bg-red-500 ring-4 ${
                  isDark ? 'ring-white/5' : 'ring-black/5'
                }`}
              />
              <div className="min-w-0 leading-tight">
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  To Pay back
                </p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Loans you owe
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`text-base sm:text-lg font-bold tabular-nums ${
                  isDark ? 'text-red-400' : 'text-red-700'
                }`}
              >
                {displayRs(liabilities)}
              </span>
              <ChevronRight
                size={16}
                className={isDark ? 'text-red-400/70' : 'text-red-500/70'}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={onGetBackClick}
            className={`w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ring-inset transition hover:scale-[1.01] cursor-pointer text-left ${
              isDark
                ? 'bg-blue-500/10 ring-blue-500/35 hover:bg-blue-500/15'
                : 'bg-blue-50 ring-blue-200 hover:bg-blue-100/70'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`h-3 w-3 shrink-0 rounded-full bg-blue-500 ring-4 ${
                  isDark ? 'ring-white/5' : 'ring-black/5'
                }`}
              />
              <div className="min-w-0 leading-tight">
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  To get back
                </p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Loans owed to you
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`text-base sm:text-lg font-bold tabular-nums ${
                  isDark ? 'text-blue-400' : 'text-blue-700'
                }`}
              >
                {displayRs(receivables)}
              </span>
              <ChevronRight
                size={16}
                className={isDark ? 'text-blue-400/70' : 'text-blue-500/70'}
              />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
