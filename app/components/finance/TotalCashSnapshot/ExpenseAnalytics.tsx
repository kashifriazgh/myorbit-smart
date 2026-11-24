'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import TopExpenses, { type TopExpenseItem } from './TopExpenses';

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
  topCount = 5,
  balancesVisible = true,
  expensesHref = '/finance/expenses',
  isDark = true,
}: ExpenseAnalyticsProps) {
  const displayRs = (n: number) => (balancesVisible ? formatRs(n) : 'Rs. •••••');

  const { total, paidTotal, pendingTotal, paidPct, topExpenseItems } = useMemo(() => {
    let tot = 0;
    let paidSum = 0;

    const mapped: TopExpenseItem[] = [];

    expenses.forEach((e) => {
      const amt = Math.max(0, Number(e.amount) || 0);
      if (amt <= 0) return;
      const paidPortion = e.paid ? amt : Math.min(amt, Math.max(0, Number(e.paidAmount) || 0));
      const pendingPortion = Math.max(0, amt - paidPortion);

      tot += amt;
      paidSum += paidPortion;

      mapped.push({
        id: e.id,
        title: e.title || catOf(e.categoryId).label,
        amount: amt,
        status: pendingPortion <= 0 && paidPortion > 0 ? 'paid' : 'upcoming',
      });
    });

    const pendingSum = Math.max(0, tot - paidSum);
    const pPct = tot > 0 ? Math.round((paidSum / tot) * 100) : 0;

    return {
      total: Math.round(tot),
      paidTotal: Math.round(paidSum),
      pendingTotal: Math.round(pendingSum),
      paidPct: pPct,
      topExpenseItems: mapped,
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
          <TopExpenses
            expenses={topExpenseItems}
            maxItems={topCount}
            currency="Rs."
            isDark={isDark}
            balancesVisible={balancesVisible}
            className="mt-4"
          />
        )}
      </div>
    </div>
  );
}

