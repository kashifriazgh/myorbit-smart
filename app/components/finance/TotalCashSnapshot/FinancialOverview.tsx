'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';

export interface FinancialOverviewItem {
  key: 'spendable' | 'reserved' | 'savings' | 'amanat' | string;
  label: string;
  amount: number;
  bar: string;
  dot: string;
  text: string;
  tint: string;
  ring: string;
  lightText?: string;
  lightTint?: string;
  lightRing?: string;
}

export interface FinancialOverviewData {
  total: number;
  items: FinancialOverviewItem[];
}

const LIGHT_STYLES_BY_KEY: Record<string, { text: string; tint: string; ring: string }> = {
  spendable: { text: 'text-green-700', tint: 'bg-green-50', ring: 'ring-green-200' },
  reserved: { text: 'text-blue-700', tint: 'bg-blue-50', ring: 'ring-blue-200' },
  savings: { text: 'text-amber-700', tint: 'bg-amber-50', ring: 'ring-amber-200' },
  amanat: { text: 'text-slate-700', tint: 'bg-slate-100', ring: 'ring-slate-200' },
};

export const EMPTY_FINANCIAL_OVERVIEW_DATA: FinancialOverviewData = {
  total: 0,
  items: [
    {
      key: 'spendable',
      label: 'Spendable',
      amount: 0,
      bar: 'bg-green-500',
      dot: 'bg-green-500',
      text: 'text-green-400',
      tint: 'bg-green-500/10',
      ring: 'ring-green-500/40',
    },
    {
      key: 'reserved',
      label: 'Reserved',
      amount: 0,
      bar: 'bg-blue-600',
      dot: 'bg-blue-500',
      text: 'text-blue-400',
      tint: 'bg-blue-500/10',
      ring: 'ring-blue-500/40',
    },
    {
      key: 'savings',
      label: 'Savings allocation',
      amount: 0,
      bar: 'bg-amber-500',
      dot: 'bg-amber-500',
      text: 'text-amber-400',
      tint: 'bg-amber-500/10',
      ring: 'ring-amber-500/40',
    },
    {
      key: 'amanat',
      label: 'Amanat',
      amount: 0,
      bar: 'bg-slate-400',
      dot: 'bg-slate-400',
      text: 'text-slate-300',
      tint: 'bg-slate-400/10',
      ring: 'ring-slate-400/40',
    },
  ],
};

interface FinancialOverviewProps {
  data?: FinancialOverviewData;
  illustrative?: boolean;
  balancesVisible?: boolean;
  onToggleBalancesVisible?: () => void;
  isDark?: boolean;
}

const formatRs = (n: number) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-US')}`;

export default function FinancialOverview({
  data = EMPTY_FINANCIAL_OVERVIEW_DATA,
  illustrative = false,
  balancesVisible = true,
  onToggleBalancesVisible,
  isDark = true,
}: FinancialOverviewProps) {
  const { total, items } = data;
  const spendable = items.find((i) => i.key === 'spendable');
  const displayRs = (n: number) => (balancesVisible ? formatRs(n) : 'Rs. •••••');
  const visibleSegments = items.filter((item) => total > 0 && item.amount > 0);

  return (
    <div
      className={`w-full h-full flex flex-col justify-between rounded-3xl border p-4 sm:p-5 transition-colors ${
        isDark
          ? 'border-white/10 bg-[#1f2430] text-white shadow-xl'
          : 'border-slate-200 bg-white text-slate-900 shadow-sm'
      }`}
    >
      <div>
        {/* Distinguished Total Money Hero */}
        <div
          className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 border ${
            isDark
              ? 'bg-gradient-to-br from-[#282e3d] to-[#212633] border-white/10'
              : 'bg-gradient-to-br from-slate-50 to-emerald-50/50 border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-xs sm:text-sm font-semibold uppercase tracking-wider ${
                isDark ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              You have
            </p>
            <div className="flex items-center gap-2">
              {illustrative && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-100 text-green-700'
                  }`}
                >
                  Illustrative
                </span>
              )}
              {onToggleBalancesVisible && (
                <button
                  type="button"
                  onClick={onToggleBalancesVisible}
                  aria-label={balancesVisible ? 'Hide balances' : 'Show balances'}
                  className={`cursor-pointer rounded-full p-1.5 transition-colors ${
                    isDark
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                      : 'bg-white text-slate-500 hover:text-slate-900 shadow-2xs'
                  }`}
                >
                  {balancesVisible ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
              )}
            </div>
          </div>

          <h2
            className={`mt-2 text-4xl lg:text-5xl font-extrabold tracking-tight tabular-nums ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            {displayRs(total)}
          </h2>

          <div className="mt-2 flex justify-end">
            <Link
              href="/finance/wallets"
              className={`inline-flex items-center gap-0.5 text-xs font-semibold transition-colors ${
                isDark
                  ? 'text-emerald-400 hover:text-emerald-300'
                  : 'text-emerald-700 hover:text-emerald-800'
              }`}
            >
              <span>View your wallets</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Segmented bar */}
        <div className="mt-5 flex h-3.5 w-full gap-2">
          {visibleSegments.length > 0 ? (
            visibleSegments.map((item) => (
              <div
                key={item.key}
                className={`${item.bar} rounded-full transition-all duration-300`}
                style={{ width: `${(item.amount / total) * 100}%` }}
              />
            ))
          ) : (
            <div className={`w-full rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
          )}
        </div>

        {/* Breakdown rows (highlighted) */}
        <ul className="mt-5 space-y-2.5">
          {items.map((item) => {
            const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0;
            const isMain = item.key === 'spendable';
            const lightStyle = LIGHT_STYLES_BY_KEY[item.key] ?? LIGHT_STYLES_BY_KEY.amanat;
            const rowTint = isDark ? item.tint : item.lightTint ?? lightStyle.tint;
            const rowRing = isDark ? item.ring : item.lightRing ?? lightStyle.ring;
            const amountText = isDark ? item.text : item.lightText ?? lightStyle.text;

            return (
              <li
                key={item.key}
                className={`flex items-center justify-between rounded-2xl px-4 py-3.5 ring-1 ring-inset transition hover:scale-[1.01] ${rowTint} ${rowRing} ${
                  isMain ? (isDark ? 'shadow-lg shadow-green-500/10' : 'shadow-sm shadow-green-500/10') : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-3.5 w-3.5 rounded-full ${item.dot} ring-4 ${
                      isDark ? 'ring-white/5' : 'ring-black/5'
                    }`}
                  />
                  <div className="leading-tight">
                    <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {item.label}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {pct}% of total
                    </p>
                  </div>
                </div>
                <p className={`text-lg font-bold tabular-nums ${amountText}`}>
                  {displayRs(item.amount)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className={`my-5 h-px w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

        {/* Available box */}
        <div
          className={`rounded-2xl p-5 ${
            isDark ? 'bg-[#282e3d] border border-white/10' : 'border border-slate-200/80 bg-slate-50'
          }`}
        >
          <p
            dir="rtl"
            className={`text-base font-semibold text-right ${
              isDark ? 'text-slate-200' : 'text-slate-700'
            }`}
          >
            قابلِ خرچ رقم
          </p>
          <p
            className={`mt-1 text-3xl font-bold tracking-tight tabular-nums ${
              isDark ? 'text-green-400' : 'text-green-600'
            }`}
          >
            {displayRs(spendable?.amount ?? 0)}
          </p>
          <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            After reserved amounts, savings allocations and Amanat are excluded.
          </p>
        </div>
      </div>
    </div>
  );
}
