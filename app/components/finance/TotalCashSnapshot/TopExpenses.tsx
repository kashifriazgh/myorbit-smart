'use client';

import React from 'react';

export interface TopExpenseItem {
  id: string;
  title: string;
  amount: number;
  status?: 'paid' | 'upcoming' | 'overdue';
}

interface TopExpensesProps {
  expenses: TopExpenseItem[];
  maxItems?: number;
  currency?: string;
  className?: string;
  isDark?: boolean;
  balancesVisible?: boolean;
}

const COLORS = [
  '#F59E0B', // Amber
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#EC4899', // Pink
];

const OTHER_COLOR = '#94A3B8';

const STATUS_STYLES = {
  paid: {
    label: 'Paid',
    darkClass: 'text-green-400',
    lightClass: 'text-green-600',
  },
  upcoming: {
    label: 'Upcoming',
    darkClass: 'text-amber-400',
    lightClass: 'text-amber-600',
  },
  overdue: {
    label: 'Overdue',
    darkClass: 'text-red-400',
    lightClass: 'text-red-600',
  },
};

export default function TopExpenses({
  expenses,
  maxItems = 5,
  currency = 'Rs.',
  className = '',
  isDark = true,
  balancesVisible = true,
}: TopExpensesProps) {
  const sortedExpenses = expenses
    .filter((expense) => Number.isFinite(expense.amount) && expense.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const limit = Math.min(5, Math.max(1, Math.floor(maxItems || 5)));

  const totalAmount = sortedExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const topExpenses = sortedExpenses.slice(0, limit);

  const topAmount = topExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const remainingAmount = Math.max(0, totalAmount - topAmount);

  const getPercentage = (amount: number) => (totalAmount > 0 ? (amount / totalAmount) * 100 : 0);

  const topPercentage = getPercentage(topAmount);

  const formatAmount = (amount: number) =>
    balancesVisible
      ? `${currency} ${Math.round(amount).toLocaleString('en-PK', {
          maximumFractionDigits: 2,
        })}`
      : `${currency} •••••`;

  const segments = topExpenses.map((expense, index) => ({
    ...expense,
    color: COLORS[index % COLORS.length],
    percentage: getPercentage(expense.amount),
  }));

  const chartSegments = [
    ...segments,
    ...(remainingAmount > 0
      ? [
          {
            id: '__other_expenses__',
            title: 'Other expenses',
            amount: remainingAmount,
            color: OTHER_COLOR,
            percentage: getPercentage(remainingAmount),
          },
        ]
      : []),
  ];

  // SVG donut chart configuration
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  let accumulatedLength = 0;

  const arcs = chartSegments.map((segment) => {
    const length = (segment.percentage / 100) * circumference;
    const offset = accumulatedLength;
    accumulatedLength += length;

    const gap = chartSegments.length > 1 ? Math.min(2, length * 0.15) : 0;

    return {
      ...segment,
      length: Math.max(0, length - gap),
      offset,
    };
  });

  return (
    <section
      className={`w-full rounded-2xl border p-4 transition-colors ${
        isDark
          ? 'border-white/10 bg-[#282e3d] text-white'
          : 'border-slate-200 bg-slate-50/70 text-slate-900'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
            isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-600'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
            aria-hidden="true"
          >
            <path d="M21.21 15.89A10 10 0 1 1 8.11 2.79" />
            <path d="M22 12A10 10 0 0 0 12 2v10z" />
          </svg>
        </div>

        <div>
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Top {topExpenses.length} expenses
          </h3>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Monthly spending breakdown
          </p>
        </div>
      </div>

      {totalAmount === 0 ? (
        <div className="py-10 text-center">
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            No expenses to display
          </p>
        </div>
      ) : (
        <>
          {/* Donut chart and summary */}
          <div className="my-5 flex items-center gap-4 sm:gap-6">
            <div className="relative size-28 shrink-0 sm:size-36">
              <svg
                viewBox="0 0 140 140"
                className="size-full -rotate-90"
                role="img"
                aria-label={`Top expenses account for ${topPercentage.toFixed(1)} percent of total expenses`}
              >
                {/* Background track */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="13"
                  className={isDark ? 'text-white/10' : 'text-slate-200'}
                />

                {/* Expense segments */}
                {arcs.map((arc) => (
                  <circle
                    key={arc.id}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth="13"
                    strokeDasharray={`${arc.length} ${circumference - arc.length}`}
                    strokeDashoffset={-arc.offset}
                    strokeLinecap="butt"
                    className="transition-all duration-500 hover:opacity-75"
                  >
                    <title>
                      {arc.title}: {formatAmount(arc.amount)} ({arc.percentage.toFixed(1)}%)
                    </title>
                  </circle>
                ))}
              </svg>

              {/* Donut center */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {Number(topPercentage.toFixed(1))}%
                </span>
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  of total
                </span>
              </div>
            </div>

            {/* Amount summary */}
            <div className="min-w-0 flex-1 space-y-1">
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Combined expenses
              </p>

              <p
                className={`break-words text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {formatAmount(topAmount)}
              </p>

              <p className={`text-xs tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Out of {formatAmount(totalAmount)}
              </p>

              <div className="flex items-center gap-1.5 pt-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4 shrink-0 text-slate-400"
                  aria-hidden="true"
                >
                  <path d="M3 3v18h18" />
                  <path d="m7 14 4-4 4 4 6-7" />
                </svg>

                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {topExpenses.length} largest expenses
                </span>
              </div>
            </div>
          </div>

          {/* Expense breakdown */}
          <div
            className={`space-y-1 border-t pt-3 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            {segments.map((expense) => (
              <div
                key={expense.id}
                className={`flex items-center gap-2 rounded-lg px-1 py-2 transition-colors ${
                  isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'
                }`}
              >
                {/* Chart color indicator */}
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: expense.color }}
                />

                {/* Expense title and status */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`break-words text-xs font-medium sm:text-sm ${
                      isDark ? 'text-slate-200' : 'text-slate-700'
                    }`}
                  >
                    {expense.title}
                  </p>

                  {expense.status && (
                    <span
                      className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium ${
                        isDark
                          ? STATUS_STYLES[expense.status].darkClass
                          : STATUS_STYLES[expense.status].lightClass
                      }`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {STATUS_STYLES[expense.status].label}
                    </span>
                  )}
                </div>

                {/* Amount */}
                <span
                  className={`shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums sm:text-sm ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {formatAmount(expense.amount)}
                </span>

                {/* Percentage */}
                <span
                  className={`w-10 shrink-0 text-right text-[11px] tabular-nums sm:w-12 sm:text-xs ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {expense.percentage.toFixed(1)}%
                </span>
              </div>
            ))}

            {/* Remaining expenses */}
            {remainingAmount > 0 && (
              <div
                className={`mt-2 flex items-center gap-2 border-t border-dashed px-1 pt-3 ${
                  isDark ? 'border-white/10' : 'border-slate-200'
                }`}
              >
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: OTHER_COLOR }}
                />

                <span className={`flex-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Other expenses
                </span>

                <span
                  className={`text-xs font-medium tabular-nums ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {formatAmount(remainingAmount)}
                </span>

                <span
                  className={`w-10 text-right text-[11px] tabular-nums sm:w-12 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {getPercentage(remainingAmount).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
