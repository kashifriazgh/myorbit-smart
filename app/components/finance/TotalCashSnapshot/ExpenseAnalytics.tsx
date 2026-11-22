'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

export type ExpenseAnalyticsCategoryId =
  | 'house_rent'
  | 'groceries'
  | 'utilities'
  | 'education'
  | 'healthcare'
  | 'transport'
  | 'mobile_internet'
  | 'clothing'
  | 'entertainment'
  | 'loans'
  | 'charity'
  | 'personal'
  | 'other';

export interface ExpenseAnalyticsItem {
  id: string;
  title: string;
  categoryId: ExpenseAnalyticsCategoryId;
  amount: number;
  paidAmount: number;
  paid: boolean;
}

interface CategoryDef {
  id: ExpenseAnalyticsCategoryId;
  label: string;
  grad: string;
}

/* ---------- icon paths (24x24, stroke) ---------- */
const PATHS: Record<ExpenseAnalyticsCategoryId, React.ReactNode> = {
  house_rent: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  groceries: (
    <>
      <path d="M3 4h2l2.5 11h10.5l2-8H6.5" />
      <circle cx="9" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </>
  ),
  utilities: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  education: (
    <>
      <path d="M2 9l10-5 10 5-10 5L2 9z" />
      <path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />
      <path d="M22 9v6" />
    </>
  ),
  healthcare: (
    <>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      <path d="M7.5 12h2l1.5-2.5 2 4 1.2-1.5h2.3" />
    </>
  ),
  transport: (
    <>
      <path d="M5 16v-4l2-5h10l2 5v4" />
      <path d="M3 16h18v3H3z" />
      <path d="M7 19v1.5M17 19v1.5" />
      <circle cx="8" cy="13.5" r="0.8" fill="currentColor" />
      <circle cx="16" cy="13.5" r="0.8" fill="currentColor" />
    </>
  ),
  mobile_internet: (
    <>
      <path d="M2 9a15 15 0 0 1 20 0" />
      <path d="M5.5 12.5a10 10 0 0 1 13 0" />
      <path d="M9 16a5 5 0 0 1 6 0" />
      <circle cx="12" cy="19.5" r="1" fill="currentColor" />
    </>
  ),
  clothing: (
    <>
      <path d="M5 8h14l-1 12H6L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  entertainment: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4" />
    </>
  ),
  loans: (
    <>
      <path d="M3 10l9-6 9 6" />
      <path d="M5.5 10v7M10 10v7M14 10v7M18.5 10v7" />
      <path d="M3 20h18" />
    </>
  ),
  charity: (
    <>
      <path d="M12 10.5s-3.5-2.1-3.5-4.7A2 2 0 0 1 12 4.7a2 2 0 0 1 3.5 1.1c0 2.6-3.5 4.7-3.5 4.7z" />
      <path d="M3 14v6h3" />
      <path d="M6 15h3.5l2 1.5h3a1.3 1.3 0 0 1 0 2.6H10" />
      <path d="M14.5 19l5-2.2a1.4 1.4 0 0 1 1.3 2.5L15.5 21.5H6" />
    </>
  ),
  personal: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  other: (
    <>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
};

export const DEFAULT_EXPENSE_ANALYTICS_CATEGORIES: CategoryDef[] = [
  { id: 'house_rent', label: 'House rent', grad: 'from-rose-400 to-red-500' },
  { id: 'groceries', label: 'Groceries and food', grad: 'from-emerald-400 to-green-600' },
  { id: 'utilities', label: 'Electricity, gas and water', grad: 'from-yellow-300 to-yellow-500' },
  { id: 'education', label: "Children's education", grad: 'from-sky-400 to-blue-600' },
  { id: 'healthcare', label: 'Healthcare and medicines', grad: 'from-pink-400 to-red-500' },
  { id: 'transport', label: 'Transport and fuel', grad: 'from-indigo-400 to-violet-600' },
  { id: 'mobile_internet', label: 'Mobile and internet', grad: 'from-cyan-300 to-sky-500' },
  { id: 'clothing', label: 'Clothing and shopping', grad: 'from-fuchsia-400 to-purple-600' },
  { id: 'entertainment', label: 'Entertainment', grad: 'from-purple-400 to-violet-700' },
  { id: 'loans', label: 'Loans and installments', grad: 'from-orange-400 to-red-500' },
  { id: 'charity', label: 'Charity', grad: 'from-teal-300 to-teal-600' },
  { id: 'personal', label: 'Personal', grad: 'from-amber-300 to-orange-500' },
  { id: 'other', label: 'Other expenses', grad: 'from-zinc-400 to-zinc-600' },
];

export function mapExpenseCategoryToId(category?: string): ExpenseAnalyticsCategoryId {
  const c = (category || '').toLowerCase().trim();
  if (!c) return 'other';
  if (c.includes('rent') || c.includes('house')) return 'house_rent';
  if (c.includes('grocer') || c.includes('food')) return 'groceries';
  if (c.includes('electric') || c.includes('gas') || c.includes('water') || c.includes('utilit')) return 'utilities';
  if (c.includes('education') || c.includes('school') || c.includes('fee')) return 'education';
  if (c.includes('health') || c.includes('medic') || c.includes('doctor')) return 'healthcare';
  if (c.includes('transport') || c.includes('fuel') || c.includes('petrol')) return 'transport';
  if (c.includes('mobile') || c.includes('internet') || c.includes('wifi')) return 'mobile_internet';
  if (c.includes('cloth') || c.includes('shop')) return 'clothing';
  if (c.includes('entertain') || c.includes('netflix') || c.includes('subscrip')) return 'entertainment';
  if (c.includes('loan') || c.includes('installment') || c.includes('debt')) return 'loans';
  if (c.includes('charity') || c.includes('sadqa') || c.includes('zakat')) return 'charity';
  if (c.includes('personal')) return 'personal';
  return 'other';
}

function CategoryIcon({
  id,
  className = 'h-3.5 w-3.5',
}: {
  id: ExpenseAnalyticsCategoryId;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[id] ?? PATHS.other}
    </svg>
  );
}

const SIZES = {
  xs: { box: 'h-5 w-5', icon: 'h-3 w-3' },
  sm: { box: 'h-8 w-8', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10', icon: 'h-5 w-5' },
  lg: { box: 'h-12 w-12', icon: 'h-6 w-6' },
};

function IconCircle({
  cat,
  size = 'sm',
}: {
  cat: CategoryDef;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  return (
    <span
      className={`relative flex ${s.box} shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-md shadow-black/20 ring-1 ring-inset ring-white/30 ${cat.grad}`}
    >
      <span className="pointer-events-none absolute left-[18%] top-[8%] h-[28%] w-[50%] rounded-full bg-white/30 blur-[1px]" />
      <CategoryIcon id={cat.id} className={s.icon} />
    </span>
  );
}

function Track({
  pct,
  grad,
  isDark,
  faded = false,
  height = 'h-2',
}: {
  pct: number;
  grad: string;
  isDark: boolean;
  faded?: boolean;
  height?: string;
}) {
  return (
    <div
      className={`${height} w-full overflow-hidden rounded-full ${
        isDark ? 'bg-white/10' : 'bg-slate-200'
      }`}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={`h-full rounded-full bg-gradient-to-r ${grad} ${faded ? 'opacity-40' : ''}`}
      />
    </div>
  );
}

const formatRs = (n: number) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-US')}`;

const FALLBACK_CATEGORY =
  DEFAULT_EXPENSE_ANALYTICS_CATEGORIES[DEFAULT_EXPENSE_ANALYTICS_CATEGORIES.length - 1];

function catOf(id: ExpenseAnalyticsCategoryId): CategoryDef {
  return DEFAULT_EXPENSE_ANALYTICS_CATEGORIES.find((c) => c.id === id) ?? FALLBACK_CATEGORY;
}

interface ExpenseAnalyticsProps {
  expenses: ExpenseAnalyticsItem[];
  income?: number;
  heroCount?: number;
  topCount?: number;
  balancesVisible?: boolean;
  expensesHref?: string;
  isDark?: boolean;
}

export default function ExpenseAnalytics({
  expenses = [],
  income = 0,
  heroCount = 3,
  topCount = 5,
  balancesVisible = true,
  expensesHref = '/finance/expenses',
  isDark = true,
}: ExpenseAnalyticsProps) {
  const displayRs = (n: number) => (balancesVisible ? formatRs(n) : 'Rs. •••••');

  const { total, paidTotal, pendingTotal, paidPct, hero, heroSum, topList, topListMax } =
    useMemo(() => {
      let tot = 0;
      let paidSum = 0;

      const normalized: Array<{
        id: string;
        title: string;
        categoryId: ExpenseAnalyticsCategoryId;
        total: number;
        paid: number;
        pending: number;
      }> = [];

      expenses.forEach((e) => {
        const amt = Math.max(0, Number(e.amount) || 0);
        if (amt <= 0) return;
        const paidPortion = e.paid ? amt : Math.min(amt, Math.max(0, Number(e.paidAmount) || 0));
        const pendingPortion = Math.max(0, amt - paidPortion);

        tot += amt;
        paidSum += paidPortion;

        normalized.push({
          id: e.id,
          title: e.title || catOf(e.categoryId).label,
          categoryId: e.categoryId,
          total: amt,
          paid: paidPortion,
          pending: pendingPortion,
        });
      });

      const pendingSum = Math.max(0, tot - paidSum);
      const pPct = tot > 0 ? Math.round((paidSum / tot) * 100) : 0;

      // Sort all individual expenses by highest amount first
      const sorted = [...normalized].sort((a, b) => b.total - a.total);

      // Biggest spend: top N individual expenses
      const heroItems = sorted.slice(0, heroCount);
      const hSum = heroItems.reduce((s, h) => s + h.total, 0);

      // Next top N individual expenses after those top heroCount expenses
      const nextList = sorted.slice(heroCount, heroCount + topCount);

      return {
        total: Math.round(tot),
        paidTotal: Math.round(paidSum),
        pendingTotal: Math.round(pendingSum),
        paidPct: pPct,
        hero: heroItems,
        heroSum: Math.round(hSum),
        topList: nextList,
        topListMax: nextList[0]?.total ?? 0,
      };
    }, [expenses, heroCount, topCount]);

  // Percentage strictly based on total expenses
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const renderStatusBadge = (paidAmt: number, pendingAmt: number) => {
    if (pendingAmt <= 0 && paidAmt > 0) {
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isDark
              ? 'bg-green-500/15 text-green-400'
              : 'bg-green-100 text-green-700'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Paid
        </span>
      );
    }
    if (paidAmt <= 0 && pendingAmt > 0) {
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isDark
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Upcoming
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          isDark
            ? 'bg-sky-500/15 text-sky-300'
            : 'bg-sky-100 text-sky-700'
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        Partial · Upcoming
      </span>
    );
  };

  return (
    <div
      className={`w-full h-full flex flex-col justify-between rounded-3xl border p-4 sm:p-5 transition-colors ${
        isDark
          ? 'border-white/10 bg-[#1f2430] text-white shadow-xl'
          : 'border-slate-200 bg-white text-slate-900 shadow-sm'
      }`}
    >
      <div>
        {/* Header & Total */}
        <Link
          href={expensesHref}
          className="group flex items-start justify-between gap-2"
        >
          <div className="min-w-0">
            <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Total expenses this month
            </p>
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <h2 className="text-3xl font-extrabold tracking-tight tabular-nums">
                {displayRs(total)}
              </h2>
              {income > 0 && total > 0 && (
                <span
                  className={`mb-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {Math.round((total / income) * 100)}% of income
                </span>
              )}
            </div>
          </div>
          <span
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
              isDark
                ? 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-amber-400'
                : 'bg-slate-100 text-slate-500 group-hover:bg-amber-50 group-hover:text-amber-600'
            }`}
          >
            <ChevronRight size={17} />
          </span>
        </Link>

        {/* Paid / Pending Bar */}
        <div className="mt-3 flex h-3 w-full gap-1.5">
          {total > 0 ? (
            <>
              {paidTotal > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${paidPct}%` }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="rounded-full bg-green-500"
                />
              )}
              {pendingTotal > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${100 - paidPct}%` }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="rounded-full bg-amber-500"
                />
              )}
            </>
          ) : (
            <div className={`w-full rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs">
          <span className={`font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
            Paid {displayRs(paidTotal)}
          </span>
          <span className={`font-semibold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            Pending {displayRs(pendingTotal)}
          </span>
        </div>

        {expenses.length === 0 ? (
          <div
            className={`mt-4 rounded-2xl border p-5 text-center text-xs ${
              isDark
                ? 'bg-[#282e3d] border-white/10 text-slate-400'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            No expenses recorded for this month yet.{' '}
            <Link
              href={expensesHref}
              className="font-bold text-teal-500 hover:underline"
            >
              Add an expense →
            </Link>
          </div>
        ) : (
          <>
            {/* Biggest Spend: Top 3 Expenses Combined */}
            {hero.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={`mt-4 rounded-2xl p-3.5 border ${
                  isDark
                    ? 'bg-[#282e3d] border-white/10'
                    : 'bg-slate-50 border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <IconCircle cat={catOf(hero[0].categoryId)} size="md" />
                  <div className="min-w-0 leading-tight">
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-wide ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      Biggest spend
                    </p>
                    <p className="mt-0.5 text-sm font-semibold">
                      {hero.length === 1 ? 'Top expense' : `Top ${hero.length} expenses`}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-end justify-between gap-2">
                  <p className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums">
                    {displayRs(heroSum)}
                  </p>
                  <p
                    className={`mb-0.5 text-xs sm:text-sm font-semibold ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {pct(heroSum)}% of expenses
                  </p>
                </div>

                {/* Stacked share bar */}
                <div
                  className={`mt-2.5 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full ${
                    isDark ? 'bg-white/10' : 'bg-slate-200'
                  }`}
                >
                  {hero.map((h) => (
                    <motion.div
                      key={h.id}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct(h.total)}%` }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                      className={`h-full bg-gradient-to-r ${catOf(h.categoryId).grad}`}
                    />
                  ))}
                </div>

                {/* Top 3 individual expenses breakdown */}
                <ul className="mt-2.5 space-y-1.5">
                  {hero.map((h) => {
                    const cat = catOf(h.categoryId);
                    return (
                      <li
                        key={h.id}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span
                          className={`flex min-w-0 items-center gap-1.5 ${
                            isDark ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full bg-gradient-to-br ${cat.grad}`}
                          />
                          <span className="truncate font-medium">{h.title}</span>
                          {renderStatusBadge(h.paid, h.pending)}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {displayRs(h.total)}{' '}
                          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                            ({pct(h.total)}%)
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}

            {/* Next Top 5 Expenses (after top 3): All expenses with Paid / Upcoming status */}
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">More top expenses</p>
                <span
                  className={`text-[11px] font-medium ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Paid &amp; Upcoming
                </span>
              </div>

              {topList.length === 0 ? (
                <p
                  className={`mt-3 text-xs ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  No additional expenses beyond the top {hero.length} this month.
                </p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {topList.map((item, idx) => {
                    const cat = catOf(item.categoryId);
                    return (
                      <motion.li
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: idx * 0.04 }}
                        className="flex items-center gap-2.5"
                      >
                        <IconCircle cat={cat} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p className="truncate text-xs sm:text-sm font-semibold">
                                {item.title}
                              </p>
                              {renderStatusBadge(item.paid, item.pending)}
                            </div>
                            <p className="shrink-0 text-xs sm:text-sm font-bold tabular-nums">
                              {displayRs(item.total)}
                            </p>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Track
                              pct={topListMax ? (item.total / topListMax) * 100 : 0}
                              grad={cat.grad}
                              isDark={isDark}
                            />
                            <span
                              className={`w-8 shrink-0 text-right text-[11px] tabular-nums ${
                                isDark ? 'text-slate-400' : 'text-slate-500'
                              }`}
                            >
                              {pct(item.total)}%
                            </span>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

