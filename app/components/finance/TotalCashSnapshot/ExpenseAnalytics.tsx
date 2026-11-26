'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { resolveExpenseIconKey } from '../ExpenseCategoryIcon';

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
  | 'family'
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
  { id: 'family', label: 'Family', grad: 'from-pink-400 to-rose-500' },
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
  if (c.includes('family')) return 'family';
  if (c.includes('personal')) return 'personal';
  return 'other';
}

const formatRs = (n: number) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-PK')}`;
const formatCardRs = (n: number) => `Rs ${Math.round(Number(n || 0)).toLocaleString('en-PK')}`;

function CheckCircleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 sm:size-6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 sm:size-6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ExpenseStatCard({
  label,
  urdu,
  amountText,
  icon,
  tone,
  isDark,
}: {
  label: string;
  urdu: string;
  amountText: string;
  icon: React.ReactNode;
  tone: string;
  isDark: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border p-3 sm:p-4 transition-colors ${
        isDark
          ? 'border-white/10 bg-[#282e3d]'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`text-xs sm:text-sm font-medium ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          {label}
        </span>
        <span
          lang="ur"
          dir="rtl"
          className={`text-[9px] leading-none ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}
        >
          {urdu}
        </span>
      </div>

      <div className="mt-2.5 sm:mt-3.5 flex items-center gap-2 sm:gap-3">
        <div
          className={`flex size-9 sm:size-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl ${tone}`}
        >
          {icon}
        </div>
        <p
          className={`min-w-0 truncate text-[15px] sm:text-xl font-semibold tracking-tight tabular-nums ${
            isDark ? 'text-gray-50' : 'text-gray-900'
          }`}
        >
          {amountText}
        </p>
      </div>
    </div>
  );
}

const FALLBACK_CATEGORY =
  DEFAULT_EXPENSE_ANALYTICS_CATEGORIES[DEFAULT_EXPENSE_ANALYTICS_CATEGORIES.length - 1];

function catOfLabel(id: ExpenseAnalyticsCategoryId): string {
  return DEFAULT_EXPENSE_ANALYTICS_CATEGORIES.find((c) => c.id === id)?.label ?? FALLBACK_CATEGORY.label;
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
  topCount: _topCount = 5,
  balancesVisible = true,
  expensesHref = '/finance/expenses',
  isDark = true,
}: ExpenseAnalyticsProps) {
  const displayRs = (n: number) => (balancesVisible ? formatRs(n) : 'Rs. •••••');

  const { total, paidTotal, pendingTotal, paidPct, upcomingExpenses } = useMemo(() => {
    let tot = 0;
    let paidSum = 0;

    const upcoming: ExpenseAnalyticsItem[] = [];

    expenses.forEach((e) => {
      const amt = Math.max(0, Number(e.amount) || 0);
      if (amt <= 0) return;
      const paidPortion = e.paid ? amt : Math.min(amt, Math.max(0, Number(e.paidAmount) || 0));

      tot += amt;
      paidSum += paidPortion;

      if (!e.paid) {
        upcoming.push(e);
      }
    });

    const pendingSum = Math.max(0, tot - paidSum);
    const pPct = tot > 0 ? Math.round((paidSum / tot) * 100) : 0;

    // Sort by remaining amount descending so biggest pending shows first
    upcoming.sort((a, b) => b.amount - a.amount);

    return {
      total: Math.round(tot),
      paidTotal: Math.round(paidSum),
      pendingTotal: Math.round(pendingSum),
      paidPct: pPct,
      upcomingExpenses: upcoming,
    };
  }, [expenses]);

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
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Total expenses this month
              </p>
              <span
                dir="rtl"
                className={`text-sm sm:text-base font-semibold ${
                  isDark ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                میرے اخراجات
              </span>
            </div>
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
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ExpenseStatCard
            label="Paid"
            urdu="ادا شدہ"
            amountText={balancesVisible ? formatCardRs(paidTotal) : 'Rs •••••'}
            icon={<CheckCircleIcon />}
            tone={
              isDark
                ? 'bg-emerald-950/80 text-emerald-400'
                : 'bg-emerald-50 text-emerald-700'
            }
            isDark={isDark}
          />
          <ExpenseStatCard
            label="Pending"
            urdu="زیر التوا"
            amountText={balancesVisible ? formatCardRs(pendingTotal) : 'Rs •••••'}
            icon={<ClockIcon />}
            tone={
              isDark
                ? 'bg-amber-950/80 text-amber-400'
                : 'bg-amber-50 text-amber-700'
            }
            isDark={isDark}
          />
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
        ) : upcomingExpenses.length === 0 ? (
          <div
            className={`mt-4 rounded-2xl border p-4 text-center text-xs ${
              isDark
                ? 'bg-[#282e3d] border-white/10 text-slate-400'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            🎉 All expenses paid for this month!
          </div>
        ) : (
          <div className="mt-4 space-y-1.5">
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Upcoming — {upcomingExpenses.length} pending
            </p>
            <ul className="space-y-1.5">
              {upcomingExpenses.map((e) => {
                const remaining = Math.max(0, e.amount - (e.paidAmount || 0));
                return (
                  <li
                    key={e.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      isDark ? 'bg-[#282e3d] hover:bg-[#2e3547]' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {(() => {
                      const iconKey = resolveExpenseIconKey(e.title, e.categoryId);
                      const DOT_COLORS: Record<string, string> = {
                        bolt: 'bg-amber-400', flame: 'bg-red-400', droplet: 'bg-cyan-400',
                        school: 'bg-violet-400', wifi: 'bg-blue-400', home: 'bg-sky-400',
                        cart: 'bg-emerald-400', pill: 'bg-rose-400', fuel: 'bg-gray-400',
                        shirt: 'bg-fuchsia-400', film: 'bg-purple-400', landmark: 'bg-orange-400',
                        heart: 'bg-teal-400', users: 'bg-pink-400', user: 'bg-indigo-400',
                        receipt: 'bg-slate-400',
                      };
                      return (
                        <span
                          className={`size-2.5 shrink-0 rounded-full ${DOT_COLORS[iconKey] ?? 'bg-amber-400'}`}
                        />
                      );
                    })()}
                    <span className={`min-w-0 flex-1 truncate text-sm sm:text-base font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {e.title || catOfLabel(e.categoryId)}
                    </span>
                    <span className={`shrink-0 text-sm sm:text-base font-semibold tabular-nums ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                      {balancesVisible
                        ? `Rs. ${Math.round(remaining).toLocaleString('en-PK')}`
                        : 'Rs. •••••'}
                    </span>
                  </li>
                );
              })}
            </ul>
            {upcomingExpenses.length > 5 && (
              <Link
                href={expensesHref}
                className={`block pt-1 text-center text-[11px] font-semibold hover:underline ${
                  isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                View all {upcomingExpenses.length} pending →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

