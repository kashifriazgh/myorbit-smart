'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PushIcon from '@mui/icons-material/Notifications';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TuneIcon from '@mui/icons-material/Tune';
import PaletteIcon from '@mui/icons-material/Palette';
import PeopleIcon from '@mui/icons-material/People';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

const settingsSections = [
  {
    category: 'Notifications',
    items: [
      {
        href: '/settings/push-notifications',
        icon: <PushIcon className="text-amber-400" />,
        title: 'Push Notifications',
        description: 'Subscribe for web push alerts on tasks & reminders',
        badge: 'FCM',
        badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      },
      {
        href: '/settings/sharing',
        icon: <PeopleIcon className="text-sky-400" />,
        title: 'Device Sharing',
        description: 'Connect with other users to exchange push notification alerts',
        badge: 'NEW',
        badgeColor: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      },
    ],
  },
  {
    category: 'Preferences',
    items: [
      {
        href: '/user/theme',
        icon: <PaletteIcon className="text-violet-400" />,
        title: 'Theme Settings',
        description: 'Customize app appearance and color mode',
        badge: null,
        badgeColor: '',
      },
    ],
  },
];

const FINANCE_COLLECTIONS = [
  'cashTransactions',
  'banks',
  'customPaymentHeads',
  'plannedExpenses',
  'expenditures',
  'incomeSources',
  'loans',
  'liabilities',
  'financeBudgets',
  'monthlyBudgets',
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  // Double-check Finance Reset Modal State
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const closeResetModal = () => {
    if (resetting) return;
    setResetStep(0);
    setConfirmText('');
    setResetError(null);
  };

  const handleClearAllFinanceData = async () => {
    if (!user?.uid) {
      setResetError('You must be signed in to reset finance data.');
      return;
    }
    if (confirmText.trim().toUpperCase() !== 'RESET') {
      setResetError('Please type RESET to confirm.');
      return;
    }

    setResetting(true);
    setResetError(null);

    try {
      let deletedDocs = 0;

      // 1. Delete all user-owned docs across every finance collection
      for (const colName of FINANCE_COLLECTIONS) {
        try {
          const snap = await getDocs(
            query(collection(db, colName), where('userId', '==', user.uid))
          );
          if (!snap.empty) {
            await Promise.all(
              snap.docs.map((d) => deleteDoc(doc(db, colName, d.id)))
            );
            deletedDocs += snap.docs.length;
          }
        } catch (colErr) {
          console.warn(`Skipped or failed clearing ${colName}:`, colErr);
        }
      }

      // 2. Also delete any financeBudgets docs keyed by `${userId}_YYYY-MM` if not matched by userId
      try {
        const now = new Date();
        for (const offset of [-1, 0, 1, 2]) {
          const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          await deleteDoc(doc(db, 'financeBudgets', `${user.uid}_${mKey}`)).catch(() => {});
          await deleteDoc(doc(db, 'monthlyBudgets', `${user.uid}_${mKey}`)).catch(() => {});
        }
      } catch {}

      // 3. Reset totalCashSnapshots/{userId} to clean 0 level
      await setDoc(doc(db, 'totalCashSnapshots', user.uid), {
        userId: user.uid,
        sources: {
          in_hand: 0,
          easypaisa: 0,
          jazzcash: 0,
          other: 0,
          bank: {},
          custom: {},
        },
        heldBy: {},
        sourceOwnership: {},
        totalAmount: 0,
        freezeAmount: 0,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      // 4. Clear local finance caches
      try {
        localStorage.removeItem(`finance_cache_${user.uid}`);
        localStorage.removeItem('myorbit_budget_v1');
      } catch {}

      setResetStep(0);
      setConfirmText('');
      setResetSuccess(
        `All finance data has been reset to 0 level (${deletedDocs} records cleared).`
      );
    } catch (err) {
      console.error('Failed to clear finance data:', err);
      setResetError(
        err instanceof Error && err.message
          ? err.message
          : 'Failed to clear finance data. Please try again.'
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      className={`min-h-screen selection:bg-teal-500 selection:text-white pb-24 transition-colors ${
        isDark ? 'bg-[#181c24] text-slate-100' : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      {/* Ambient glow effects (dark mode) */}
      {isDark && (
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[120px]" />
          <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[100px]" />
        </div>
      )}

      {/* Header */}
      <div
        className={`relative border-b backdrop-blur-xl px-6 lg:px-12 py-10 ${
          isDark
            ? 'border-white/10 bg-[#1f2430]/80'
            : 'border-slate-200 bg-white/90'
        }`}
      >
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20">
              <TuneIcon className="text-teal-500 text-[22px]" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-500 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full">
              Control Center
            </span>
          </div>
          <h1
            className={`text-4xl font-black mt-3 tracking-tight ${
              isDark
                ? 'bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent'
                : 'text-slate-900'
            }`}
          >
            Settings
          </h1>
          <p
            className={`mt-2 text-sm font-medium max-w-md ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Manage your notification preferences, account settings, and finance data.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-3xl mx-auto px-6 lg:px-12 mt-10 space-y-10">
        {resetSuccess && (
          <div
            role="status"
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium ${
              isDark
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircleOutlineIcon fontSize="small" />
              <span>{resetSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setResetSuccess(null)}
              className="p-1 rounded-full hover:bg-black/10 cursor-pointer"
              aria-label="Dismiss"
            >
              <CloseIcon fontSize="small" />
            </button>
          </div>
        )}

        {settingsSections.map((section) => (
          <div key={section.category}>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-4 ml-1">
              {section.category}
            </p>
            <div className="space-y-3">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center justify-between gap-4 p-5 border rounded-[20px] transition-all duration-200 hover:-translate-y-0.5 ${
                    isDark
                      ? 'bg-[#1f2430] hover:bg-[#262c3b] border-white/10 hover:border-white/20 hover:shadow-xl'
                      : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-xl border transition-colors flex-shrink-0 ${
                        isDark
                          ? 'bg-slate-800/80 group-hover:bg-slate-800 border-slate-700/50'
                          : 'bg-slate-100 group-hover:bg-slate-200/70 border-slate-200'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`text-sm font-bold transition-colors ${
                            isDark
                              ? 'text-white group-hover:text-teal-300'
                              : 'text-slate-900 group-hover:text-teal-700'
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${item.badgeColor}`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-0.5 font-medium ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRightIcon
                    className={`group-hover:translate-x-1 transition-all flex-shrink-0 ${
                      isDark
                        ? 'text-slate-600 group-hover:text-slate-300'
                        : 'text-slate-400 group-hover:text-slate-700'
                    }`}
                  />
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Finance Data & Danger Zone */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-500 mb-4 ml-1">
            Finance Data · Danger Zone
          </p>
          <div
            className={`p-5 border rounded-[20px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              isDark
                ? 'bg-rose-950/20 border-rose-500/25'
                : 'bg-rose-50/70 border-rose-200'
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-xl border flex-shrink-0 ${
                  isDark
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : 'bg-rose-100 border-rose-200 text-rose-600'
                }`}
              >
                <DeleteForeverIcon />
              </div>
              <div>
                <h2
                  className={`text-sm font-bold ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Clear All Finance Data (Reset to 0)
                </h2>
                <p
                  className={`text-xs mt-0.5 font-medium ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  Permanently delete all wallets, transactions, expenses, income sources, loans,
                  liabilities, and monthly budgets to start fresh at Rs. 0.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={!user}
              onClick={() => {
                setResetSuccess(null);
                setResetError(null);
                setConfirmText('');
                setResetStep(1);
              }}
              className="shrink-0 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95 cursor-pointer"
            >
              Reset Finance
            </button>
          </div>
        </div>
      </div>

      {/* Double-Check Reset Confirmation Dialog */}
      {resetStep > 0 && (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={closeResetModal}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm finance reset"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${
              isDark
                ? 'bg-[#1f2430] border-white/10 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    isDark
                      ? 'bg-rose-500/15 text-rose-400'
                      : 'bg-rose-100 text-rose-600'
                  }`}
                >
                  <WarningAmberIcon />
                </div>
                <div>
                  <h3 className="text-base font-extrabold">
                    {resetStep === 1
                      ? 'Reset All Finance Data?'
                      : 'Final Confirmation Required'}
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Step {resetStep} of 2 · This action cannot be undone
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeResetModal}
                disabled={resetting}
                className={`p-1.5 rounded-full cursor-pointer ${
                  isDark
                    ? 'text-slate-400 hover:bg-white/10 hover:text-white'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <CloseIcon fontSize="small" />
              </button>
            </div>

            {resetStep === 1 ? (
              <div className="mt-4 space-y-3">
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Clearing your finance data will permanently remove all records and set every wallet
                  balance to <strong>Rs. 0</strong>:
                </p>
                <ul
                  className={`rounded-2xl p-3.5 text-xs space-y-1.5 list-disc list-inside ${
                    isDark
                      ? 'bg-rose-500/10 text-rose-200 border border-rose-500/20'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  <li>All wallet balances reset to Rs. 0 &amp; custom/bank wallets deleted</li>
                  <li>All transaction history records</li>
                  <li>All monthly &amp; recurring expenses and expenditures</li>
                  <li>All income sources, loans &amp; liabilities</li>
                  <li>All saved monthly budget plans</li>
                </ul>

                <div className="mt-5 flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={closeResetModal}
                    className={`rounded-xl px-4 py-2.5 text-xs font-bold cursor-pointer ${
                      isDark
                        ? 'bg-white/10 text-slate-200 hover:bg-white/15'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetStep(2)}
                    className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2.5 text-xs font-bold text-white cursor-pointer"
                  >
                    Continue to Final Check
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  To confirm you want to permanently wipe all finance data and reset balances to zero,
                  type <strong className="text-rose-500">RESET</strong> below:
                </p>

                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => {
                    setConfirmText(e.target.value);
                    if (resetError) setResetError(null);
                  }}
                  placeholder="Type RESET to confirm"
                  autoFocus
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/40 ${
                    isDark
                      ? 'bg-[#181c24] border-white/15 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />

                {resetError && (
                  <p className="text-xs font-semibold text-rose-400">{resetError}</p>
                )}

                <div className="mt-5 flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => setResetStep(1)}
                    className={`rounded-xl px-4 py-2.5 text-xs font-bold cursor-pointer ${
                      isDark
                        ? 'bg-white/10 text-slate-200 hover:bg-white/15'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={resetting || confirmText.trim().toUpperCase() !== 'RESET'}
                    onClick={handleClearAllFinanceData}
                    className="rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 px-4 py-2.5 text-xs font-bold text-white cursor-pointer"
                  >
                    {resetting ? 'Clearing Finance Data…' : 'Yes, Clear Everything'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
