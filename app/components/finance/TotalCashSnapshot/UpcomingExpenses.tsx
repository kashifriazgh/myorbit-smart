'use client';

import React from 'react';

export interface UpcomingExpenseItem {
  id: string | number;
  title: string;
  date: string; // "YYYY-MM-DD"
  priority: 'high' | 'medium' | 'low';
  amount: number;
}

const DEFAULT_ITEMS: UpcomingExpenseItem[] = [
  { id: 1, title: 'House rent', date: '2026-11-25', priority: 'high', amount: 35000 },
  { id: 2, title: 'Electricity bill', date: '2026-11-27', priority: 'high', amount: 8500 },
  { id: 3, title: 'Internet package', date: '2026-11-30', priority: 'medium', amount: 3000 },
  { id: 4, title: 'Gym membership', date: '2026-12-02', priority: 'low', amount: 4000 },
];

const PRIORITY = {
  high: {
    label: 'High',
    dot: 'bg-red-500',
    badge: 'bg-red-500/15 text-red-400',
    lightBadge: 'bg-red-100 text-red-700',
    tint: 'bg-red-500/10',
    lightTint: 'bg-red-50',
    ring: 'ring-red-500/40',
    lightRing: 'ring-red-200',
    amount: 'text-red-400',
    lightAmount: 'text-red-700',
  },
  medium: {
    label: 'Medium',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/15 text-amber-400',
    lightBadge: 'bg-amber-100 text-amber-700',
    tint: 'bg-amber-500/10',
    lightTint: 'bg-amber-50',
    ring: 'ring-amber-500/40',
    lightRing: 'ring-amber-200',
    amount: 'text-amber-400',
    lightAmount: 'text-amber-700',
  },
  low: {
    label: 'Low',
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/15 text-blue-400',
    lightBadge: 'bg-blue-100 text-blue-700',
    tint: 'bg-blue-500/10',
    lightTint: 'bg-blue-50',
    ring: 'ring-blue-500/40',
    lightRing: 'ring-blue-200',
    amount: 'text-blue-400',
    lightAmount: 'text-blue-700',
  },
};

const formatRs = (n: number) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-US')}`;

// "2026-11-25" -> "25 Nov" (timezone-safe, no hydration mismatch)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatDate = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1] ?? ''}`;
};

interface UpcomingExpensesProps {
  items?: UpcomingExpenseItem[];
  max?: number;
  balancesVisible?: boolean;
  isDark?: boolean;
}

export default function UpcomingExpenses({
  items = DEFAULT_ITEMS,
  max = 4,
  balancesVisible = true,
  isDark = true,
}: UpcomingExpensesProps) {
  const list = [...items].sort((a, b) => a.date.localeCompare(b.date)).slice(0, max);
  const total = list.reduce((sum, i) => sum + i.amount, 0);
  const displayRs = (n: number) => (balancesVisible ? formatRs(n) : 'Rs. •••••');

  return (
    <div
      className={`w-full rounded-3xl border p-5 sm:p-6 transition-colors ${
        isDark
          ? 'border-white/10 bg-[#1f2430] text-white shadow-xl'
          : 'border-slate-200 bg-white text-slate-900 shadow-sm'
      }`}
    >
      {/* Summary */}
      <div className="px-4">
        <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
          Upcoming expenses
        </p>
        <h2
          className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          {displayRs(total)}
        </h2>
      </div>

      <div className={`my-5 h-px w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

      {/* Items */}
      <ul className="space-y-2.5">
        {list.map((item) => {
          const p = PRIORITY[item.priority] ?? PRIORITY.low;
          return (
            <li
              key={item.id}
              className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 ring-1 ring-inset transition hover:scale-[1.01] ${
                isDark ? `${p.tint} ${p.ring}` : `${p.lightTint} ${p.lightRing}`
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`h-3.5 w-3.5 shrink-0 rounded-full ${p.dot} ring-4 ${
                    isDark ? 'ring-white/5' : 'ring-black/5'
                  }`}
                />
                <div className="min-w-0 leading-tight">
                  <p
                    className={`truncate text-base font-semibold ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {item.title}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`text-xs ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                      {formatDate(item.date)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isDark ? p.badge : p.lightBadge
                      }`}
                    >
                      {p.label}
                    </span>
                  </div>
                </div>
              </div>
              <p
                className={`shrink-0 text-lg font-bold tabular-nums ${
                  isDark ? p.amount : p.lightAmount
                }`}
              >
                {displayRs(item.amount)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
