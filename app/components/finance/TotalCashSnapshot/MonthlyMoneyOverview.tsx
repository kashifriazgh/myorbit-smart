'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface MonthlyMoneyOverviewData {
  income: number;
  liabilities: number; // loans / amounts you must pay back
  receivables: number; // loans / amounts others must give back to you
}

const EMPTY_DATA: MonthlyMoneyOverviewData = {
  income: 0,
  liabilities: 0,
  receivables: 0,
};

const formatRs = (n: number) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-US')}`;

interface MonthlyMoneyOverviewProps {
  data?: MonthlyMoneyOverviewData;
  balancesVisible?: boolean;
  incomeHref?: string;
  onPayBackClick?: () => void;
  onGetBackClick?: () => void;
  isDark?: boolean;
}

export default function MonthlyMoneyOverview({
  data = EMPTY_DATA,
  balancesVisible = true,
  incomeHref = '/finance/income-sources',
  onPayBackClick,
  onGetBackClick,
  isDark = true,
}: MonthlyMoneyOverviewProps) {
  const { income, liabilities, receivables } = data;
  const displayRs = (n: number) => (balancesVisible ? formatRs(n) : 'Rs. •••••');

  const segmentClass = `w-full rounded-3xl border p-4 sm:p-5 transition-colors ${
    isDark
      ? 'border-white/10 bg-[#1f2430] text-white shadow-xl'
      : 'border-slate-200 bg-white text-slate-900 shadow-sm'
  }`;

  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* Segment: Total Monthly Income */}
      <div className={segmentClass}>
        <Link
          href={incomeHref}
          className="group flex items-center justify-between gap-2"
        >
          <div>
            <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Total income
            </p>
            <h2
              className={`mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              {displayRs(income)}
            </h2>
          </div>
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
              isDark
                ? 'bg-white/5 text-slate-400 group-hover:bg-green-500/15 group-hover:text-green-400'
                : 'bg-slate-100 text-slate-500 group-hover:bg-green-50 group-hover:text-green-600'
            }`}
          >
            <ChevronRight size={18} />
          </span>
        </Link>
      </div>

      {/* Segment: Loans (Distinguished section with To Pay back & To get back on separate lines) */}
      <div className={segmentClass}>
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
            className={`w-full flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 ring-1 ring-inset transition hover:scale-[1.01] cursor-pointer text-left ${
              isDark
                ? 'bg-red-500/10 ring-red-500/35 hover:bg-red-500/15'
                : 'bg-red-50 ring-red-200 hover:bg-red-100/70'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
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
            <div className="flex items-center gap-1 shrink-0">
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
            className={`w-full flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 ring-1 ring-inset transition hover:scale-[1.01] cursor-pointer text-left ${
              isDark
                ? 'bg-blue-500/10 ring-blue-500/35 hover:bg-blue-500/15'
                : 'bg-blue-50 ring-blue-200 hover:bg-blue-100/70'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
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
            <div className="flex items-center gap-1 shrink-0">
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
