'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@mui/material';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Info,
  Lock,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import {
  checkPurchase,
  extractPendingExpenses,
  extractPurchaseData,
  type PendingExpenseItem,
  type PurchaseCheckResult,
  type PurchaseVerdict,
} from '@/app/lib/canIPurchase';
import { useAffordabilityData } from '@/app/lib/finance/useAffordabilityData';

const Money = ({ v }: { v: number }) => (
  <bdi dir="ltr" className="tabular-nums font-semibold">
    {(v < 0 ? '-' : '') + 'Rs ' + Math.abs(Math.round(v || 0)).toLocaleString('en-PK')}
  </bdi>
);

const BUFFER_OPTIONS = [0, 5, 10, 15];

const TONES: Record<
  PurchaseVerdict,
  {
    darkBox: string;
    lightBox: string;
    title: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  yes: {
    darkBox: 'bg-emerald-950/70 border-emerald-500/30 text-emerald-200',
    lightBox: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    title: 'جی ہاں، آپ یہ خرید سکتے ہیں',
    Icon: CheckCircle2,
  },
  tight: {
    darkBox: 'bg-amber-950/70 border-amber-500/30 text-amber-200',
    lightBox: 'bg-amber-50 border-amber-200 text-amber-900',
    title: 'ممکن ہے، لیکن گنجائش کم ہے',
    Icon: AlertTriangle,
  },
  no: {
    darkBox: 'bg-red-950/70 border-red-500/30 text-red-200',
    lightBox: 'bg-red-50 border-red-200 text-red-900',
    title: 'جی نہیں! ابھی مناسب نہیں',
    Icon: XCircle,
  },
  info: {
    darkBox: 'bg-blue-950/70 border-blue-500/30 text-blue-200',
    lightBox: 'bg-blue-50 border-blue-200 text-blue-900',
    title: 'آپ کی موجودہ خریداری کی گنجائش',
    Icon: Info,
  },
};

function Row({
  label,
  children,
  strong,
  isDark,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
  isDark: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className={isDark ? 'text-slate-400' : 'text-gray-600'}>{label}</span>
      <span
        className={
          strong
            ? `font-bold ${isDark ? 'text-white' : 'text-gray-900'}`
            : isDark
            ? 'text-slate-100'
            : 'text-gray-900'
        }
      >
        {children}
      </span>
    </div>
  );
}

export default function CanIPurchasePage() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const { data: rawData, loading, error, refresh } = useAffordabilityData(user?.uid);

  const [amount, setAmount] = useState('');
  const [bufferPct, setBufferPct] = useState(5);
  const [hasChecked, setHasChecked] = useState(false);

  // Inline edit / delete state for pending expenses
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const purchaseData = useMemo(
    () =>
      extractPurchaseData(
        rawData.snapshot,
        rawData.plannedExpenses,
        rawData.expenditures,
        rawData.loans,
        rawData.liabilities
      ),
    [rawData]
  );

  const pendingExpenses = useMemo(
    () => extractPendingExpenses(rawData.plannedExpenses, rawData.expenditures),
    [rawData.plannedExpenses, rawData.expenditures]
  );

  const requestedAmount = Math.max(0, Number(amount) || 0);

  const baseline = useMemo(
    () => checkPurchase(purchaseData, 0, bufferPct),
    [purchaseData, bufferPct]
  );

  // Live reactive result once the user has clicked Check (updates automatically after expense edit/delete)
  const activeResult: PurchaseCheckResult | null = useMemo(() => {
    if (!hasChecked) return null;
    return checkPurchase(purchaseData, requestedAmount, bufferPct);
  }, [hasChecked, purchaseData, requestedAmount, bufferPct]);

  useEffect(() => {
    if (!actionMsg) return;
    const t = setTimeout(() => setActionMsg(null), 3000);
    return () => clearTimeout(t);
  }, [actionMsg]);

  const handleCheck = (e?: React.FormEvent) => {
    e?.preventDefault();
    setHasChecked(true);
  };

  const startEdit = (item: PendingExpenseItem) => {
    setEditingId(item.id);
    setEditValue(String(item.remainingAmount));
  };

  const handleSaveReduce = async (item: PendingExpenseItem) => {
    const newRemaining = Math.max(0, Math.round(Number(editValue) || 0));
    setBusyId(item.id);
    try {
      const ref = doc(db, item.collection, item.id);
      if (item.collection === 'plannedExpenses') {
        const newExpected = item.paidAmount + newRemaining;
        await updateDoc(ref, {
          expectedAmount: newExpected,
          ...(newRemaining === 0 ? { paymentStatus: 'paid' } : {}),
        });
      } else {
        await updateDoc(ref, {
          amount: newRemaining,
          ...(newRemaining === 0 ? { isPaid: true } : {}),
        });
      }
      setEditingId(null);
      setActionMsg(`"${item.title}" کی رقم اپ ڈیٹ ہو گئی۔`);
      await refresh();
    } catch (err) {
      console.error('Error updating expense:', err);
      setActionMsg('رقم محفوظ کرنے میں مسئلہ آیا۔ دوبارہ کوشش کریں۔');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteExpense = async (item: PendingExpenseItem) => {
    if (!confirm(`کیا آپ واقعی "${item.title}" (${item.remainingAmount.toLocaleString('en-PK')} Rs) حذف کرنا چاہتے ہیں؟`)) {
      return;
    }
    setBusyId(item.id);
    try {
      await deleteDoc(doc(db, item.collection, item.id));
      if (editingId === item.id) setEditingId(null);
      setActionMsg(`"${item.title}" حذف کر دیا گیا۔`);
      await refresh();
    } catch (err) {
      console.error('Error deleting expense:', err);
      setActionMsg('حذف کرنے میں مسئلہ آیا۔ دوبارہ کوشش کریں۔');
    } finally {
      setBusyId(null);
    }
  };

  const pageBg = isDark ? 'bg-[#181c24] text-slate-100' : 'bg-[#f1f5f9] text-slate-900';
  const cardCls = isDark
    ? 'border-white/10 bg-[#1f2430] text-slate-100 shadow-xl'
    : 'border-slate-200 bg-white text-slate-900 shadow-sm';

  if (authLoading) {
    return (
      <div className={`min-h-screen ${pageBg} p-4`}>
        <div className="mx-auto max-w-xl space-y-3 pt-4">
          <Skeleton variant="rounded" height={52} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen ${pageBg} flex items-center justify-center p-4`}>
        <div className={`w-full max-w-sm rounded-2xl border p-6 text-center ${cardCls}`}>
          <Lock className="mx-auto mb-3 size-8 text-indigo-500" />
          <p className="text-base font-semibold">Sign in required</p>
          <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Please sign in to check your purchasing capacity.
          </p>
          <Link
            href="/finance"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <ArrowLeft className="size-4" />
            Back to Finance
          </Link>
        </div>
      </div>
    );
  }

  const tone = activeResult ? TONES[activeResult.verdict] : null;
  const VerdictIcon = tone?.Icon;

  const showPendingEditor =
    Boolean(activeResult) &&
    pendingExpenses.length > 0 &&
    (activeResult!.verdict === 'no' ||
      activeResult!.verdict === 'tight' ||
      activeResult!.free < 0 ||
      purchaseData.spendable < purchaseData.expensesDue);

  const renderPersonalizedMessage = (res: PurchaseCheckResult) => {
    const { spendable, expensesDue, loansToPay, loansToReceive } = purchaseData;

    // 1. Spendable is already less than pending expenses
    if (spendable < expensesDue && (res.verdict === 'no' || res.verdict === 'info')) {
      return (
        <div className="space-y-1.5 text-sm leading-relaxed">
          <p>
            جی نہیں! آپ کے پاس موجودہ قابلِ خرچ رقم <Money v={spendable} /> ہے، جبکہ ابھی آپ کے{' '}
            <Money v={expensesDue} /> کے اخراجات زیرِ التوا ہیں
            {loansToPay > 0 ? (
              <>
                {' '}
                (اور <Money v={loansToPay} /> کا قرض بھی ادا کرنا ہے)
              </>
            ) : null}
            ۔ اگر ان اخراجات میں کوئی کمی کر لیں تو ممکن ہے۔
          </p>
          {res.ifIncoming && loansToReceive > 0 && (
            <p className="text-xs opacity-90">
              البتہ <Money v={loansToReceive} /> متوقع قرض واپس ملنے پر یہ خریداری ممکن ہو سکتی ہے۔
            </p>
          )}
        </div>
      );
    }

    // 2. Verdict: YES
    if (res.verdict === 'yes') {
      const remainingSafe = res.safe - requestedAmount;
      return (
        <p className="text-sm leading-relaxed">
          جی ہاں، آپ بے فکر ہو کر <Money v={requestedAmount} /> کی یہ خریداری کر سکتے ہیں۔ آپ کے پاس{' '}
          <Money v={spendable} /> قابلِ خرچ ہیں
          {expensesDue + loansToPay > 0 ? (
            <>
              {' '}
              — اس ماہ کے <Money v={expensesDue + loansToPay} /> واجبات اور یہ خریداری نکالنے کے بعد بھی آپ کے پاس{' '}
            </>
          ) : (
            <> — یہ خریداری کرنے کے بعد بھی آپ کے پاس </>
          )}
          <Money v={remainingSafe} /> محفوظ بچیں گے۔
        </p>
      );
    }

    // 3. Verdict: TIGHT
    if (res.verdict === 'tight') {
      const remainingFree = res.free - requestedAmount;
      return (
        <p className="text-sm leading-relaxed">
          یہ خریداری ممکن تو ہے، لیکن گنجائش بہت کم رہ جائے گی۔ واجبات نکالنے کے بعد آپ کے پاس{' '}
          <Money v={res.free} /> بچتے ہیں؛ <Money v={requestedAmount} /> خرچ کرنے پر آپ کا{' '}
          <Money v={res.buffer} /> حفاظتی ذخیرہ متاثر ہو گا اور صرف <Money v={remainingFree} /> باقی رہیں گے۔ اگر ضروری نہ ہو تو تھوڑا انتظار بہتر ہے۔
        </p>
      );
    }

    // 4. Verdict: NO (general deficit or amount > free)
    if (res.verdict === 'no') {
      if (res.free < 0) {
        return (
          <div className="space-y-1.5 text-sm leading-relaxed">
            <p>
              جی نہیں! آپ کے پاس موجودہ قابلِ خرچ رقم <Money v={spendable} /> ہے، جبکہ اس ماہ{' '}
              {expensesDue > 0 && (
                <>
                  <Money v={expensesDue} /> کے اخراجات
                </>
              )}
              {expensesDue > 0 && loansToPay > 0 && ' اور '}
              {loansToPay > 0 && (
                <>
                  <Money v={loansToPay} /> کا قرض
                </>
              )}{' '}
              واجب الادا ہے۔ پہلے ان واجبات کو پورا کریں یا نیچے دیے گئے اخراجات میں کمی کریں۔
            </p>
            {res.ifIncoming && (
              <p className="text-xs opacity-90">
                متوقع <Money v={loansToReceive} /> قرض واپس ملنے کے بعد یہ خریداری ممکن ہو جائے گی۔
              </p>
            )}
          </div>
        );
      }

      return (
        <div className="space-y-1.5 text-sm leading-relaxed">
          <p>
            ابھی <Money v={requestedAmount} /> کی خریداری ممکن نہیں۔ آپ کے پاس{' '}
            <Money v={spendable} /> قابلِ خرچ ہیں، جن میں سے اس ماہ کے واجبات نکال کر صرف{' '}
            <Money v={res.free} /> بچتے ہیں — یعنی آپ کو مزید <Money v={res.shortfall} /> کی کمی ہے۔
          </p>
          {res.ifIncoming ? (
            <p className="text-xs font-medium opacity-95">
              خوشخبری: <Money v={loansToReceive} /> متوقع قرض کی رقم ملنے کے بعد یہ خریداری ممکن ہو جائے گی۔
            </p>
          ) : pendingExpenses.length > 0 ? (
            <p className="text-xs opacity-90">
              اگر آپ نیچے دیے گئے زیرِ التوا اخراجات میں کوئی کمی کر لیں تو گنجائش بن سکتی ہے۔
            </p>
          ) : null}
        </div>
      );
    }

    // 5. Verdict: INFO (no amount entered)
    if (res.safe > 0) {
      return (
        <div className="space-y-1">
          <p className="text-2xl sm:text-3xl font-bold tracking-tight">
            <Money v={res.safe} />
          </p>
          <p className="text-sm leading-relaxed opacity-95">
            آپ کے پاس موجودہ قابلِ خرچ رقم <Money v={spendable} /> ہے۔ اس ماہ کے واجبات اور حفاظتی ذخیرہ نکال کر آپ کے پاس{' '}
            <Money v={res.safe} /> محفوظ بچتے ہیں — یعنی باقی {res.daysLeft} دنوں کے لیے تقریباً{' '}
            <Money v={res.dailyLimit} /> روزانہ خرچ کی گنجائش ہے۔
          </p>
        </div>
      );
    }

    return (
      <p className="text-sm leading-relaxed">
        آپ کے پاس <Money v={spendable} /> قابلِ خرچ ہیں، لیکن اس ماہ کے واجبات اور{' '}
        <Money v={res.buffer} /> حفاظتی ذخیرہ نکالنے کے بعد اضافی محفوظ گنجائش نہیں بچتی۔ اس وقت غیر ضروری خریداری سے گریز بہتر ہے۔
      </p>
    );
  };

  return (
    <div className={`min-h-screen ${pageBg} px-3 py-4 sm:px-4 sm:py-6`}>
      <div className="mx-auto max-w-xl space-y-4">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Link
              href="/finance"
              className={`flex size-9 items-center justify-center rounded-xl border transition-colors ${
                isDark
                  ? 'border-white/10 bg-[#1f2430] text-slate-200 hover:bg-white/10'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
              aria-label="Back to Finance"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight">Can I Purchase?</h1>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Personal spending advisor from your live balances
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refresh()}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
              isDark
                ? 'border-white/10 bg-[#1f2430] text-slate-200 hover:bg-white/10'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div
            className={`rounded-xl border p-3 text-xs flex items-center justify-between ${
              isDark
                ? 'border-red-500/30 bg-red-950/50 text-red-200'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            <span>{error}</span>
            <button type="button" onClick={() => refresh()} className="font-semibold underline cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {/* Main Urdu-first Mobile-first Card */}
        <section
          dir="rtl"
          lang="ur"
          className={`rounded-2xl border p-4 sm:p-5 leading-loose transition-colors ${cardCls}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold">کیا میں خرید سکتا ہوں؟</h2>
              <p className={`mt-0.5 text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                رقم درج کریں، یا خالی چھوڑ دیں تاکہ آپ کی محفوظ حد معلوم ہو جائے۔
              </p>
            </div>
            {!loading && (
              <div
                className={`shrink-0 rounded-xl px-2.5 py-1.5 text-center ${
                  isDark ? 'bg-white/5' : 'bg-slate-100'
                }`}
              >
                <p className={`text-[10px] leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  محفوظ حد
                </p>
                <p
                  className={`text-xs font-bold leading-tight mt-0.5 ${
                    baseline.safe >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  <Money v={baseline.safe} />
                </p>
              </div>
            )}
          </div>

          {/* Input + Check Button */}
          <form onSubmit={handleCheck} className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                Rs
              </span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                dir="ltr"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setHasChecked(false);
                }}
                placeholder="رقم (اختیاری)"
                className={`h-11 w-full rounded-xl border bg-transparent pe-3 ps-9 text-start text-sm outline-none placeholder:text-right transition-colors ${
                  isDark
                    ? 'border-white/15 text-white focus:border-indigo-400'
                    : 'border-gray-300 text-gray-900 focus:border-gray-900'
                }`}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`h-11 shrink-0 rounded-xl px-5 text-sm font-semibold transition active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                isDark
                  ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              چیک کریں
            </button>
          </form>

          {/* Buffer % Setting */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              حفاظتی ذخیرہ (Buffer):
            </span>
            <div dir="ltr" className="flex items-center gap-1.5">
              {BUFFER_OPTIONS.map((pct) => {
                const active = bufferPct === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setBufferPct(pct)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : isDark
                        ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {pct}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && !activeResult && (
            <div className="mt-4 space-y-2.5">
              <Skeleton variant="rounded" height={88} sx={{ borderRadius: 3 }} />
              <Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} />
            </div>
          )}

          {/* Personalized Result Card + Actionable Pending Expenses */}
          {activeResult && tone && VerdictIcon && (
            <div className="mt-4 space-y-4">
              <div
                className={`rounded-xl border p-4 ${
                  isDark ? tone.darkBox : tone.lightBox
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <VerdictIcon className="size-5 shrink-0" />
                  <p className="text-sm font-bold">{tone.title}</p>
                </div>

                {renderPersonalizedMessage(activeResult)}
              </div>

              {/* Actionable Pending Expenses List (Reduce / Delete directly in DB) */}
              {showPendingEditor && (
                <div
                  className={`rounded-xl border p-3.5 ${
                    isDark
                      ? 'border-amber-500/25 bg-[#262c3a]'
                      : 'border-amber-200 bg-amber-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div>
                      <h3 className="text-sm font-bold">زیرِ التوا اخراجات میں کمی یا حذف کریں</h3>
                      <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        یہاں کی گئی تبدیلی براہِ راست آپ کے ریکارڈ میں محفوظ ہو گی۔
                      </p>
                    </div>
                    <span className="text-xs font-bold text-amber-500 shrink-0">
                      <Money v={purchaseData.expensesDue} />
                    </span>
                  </div>

                  {actionMsg && (
                    <div
                      className={`mb-2.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                        isDark
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {actionMsg}
                    </div>
                  )}

                  <div className="space-y-2">
                    {pendingExpenses.map((item) => {
                      const isEditing = editingId === item.id;
                      const isBusy = busyId === item.id;

                      return (
                        <div
                          key={`${item.collection}_${item.id}`}
                          className={`rounded-xl border p-2.5 transition-colors ${
                            isDark
                              ? 'border-white/10 bg-[#1c212c]'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold truncate">
                                {item.title}
                              </p>
                              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {item.category}
                                {item.paidAmount > 0 ? (
                                  <>
                                    {' '}• ادا شدہ: <Money v={item.paidAmount} />
                                  </>
                                ) : null}
                              </p>
                            </div>

                            {!isEditing ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-xs sm:text-sm font-bold">
                                  <Money v={item.remainingAmount} />
                                </span>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => startEdit(item)}
                                  title="رقم کم کریں"
                                  className={`flex size-8 items-center justify-center rounded-lg border transition-colors cursor-pointer disabled:opacity-40 ${
                                    isDark
                                      ? 'border-white/10 bg-white/5 text-sky-400 hover:bg-sky-500/15'
                                      : 'border-slate-200 bg-slate-50 text-sky-600 hover:bg-sky-50'
                                  }`}
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleDeleteExpense(item)}
                                  title="حذف کریں"
                                  className={`flex size-8 items-center justify-center rounded-lg border transition-colors cursor-pointer disabled:opacity-40 ${
                                    isDark
                                      ? 'border-white/10 bg-white/5 text-red-400 hover:bg-red-500/15'
                                      : 'border-slate-200 bg-slate-50 text-red-600 hover:bg-red-50'
                                  }`}
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  dir="ltr"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className={`h-8 w-24 rounded-lg border px-2 text-xs font-semibold outline-none ${
                                    isDark
                                      ? 'border-indigo-400/50 bg-[#141820] text-white'
                                      : 'border-indigo-400 bg-white text-slate-900'
                                  }`}
                                />
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleSaveReduce(item)}
                                  title="محفوظ کریں"
                                  className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer disabled:opacity-50"
                                >
                                  <Check className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => setEditingId(null)}
                                  title="منسوخ"
                                  className={`flex size-8 items-center justify-center rounded-lg border cursor-pointer ${
                                    isDark
                                      ? 'border-white/10 bg-white/5 text-slate-300'
                                      : 'border-slate-200 bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  <X className="size-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Compact Breakdown */}
              <div
                className={`divide-y ${
                  isDark ? 'divide-white/10' : 'divide-gray-100'
                }`}
              >
                <Row label="قابلِ خرچ رقم" isDark={isDark}>
                  <Money v={purchaseData.spendable} />
                </Row>
                <Row label="اس ماہ کے واجب الادا اخراجات" isDark={isDark}>
                  <Money v={-purchaseData.expensesDue} />
                </Row>
                <Row label="اس ماہ ادا کیے جانے والے قرض" isDark={isDark}>
                  <Money v={-purchaseData.loansToPay} />
                </Row>
                <Row label={`حفاظتی ذخیرہ (${bufferPct}%)`} isDark={isDark}>
                  <Money v={-activeResult.buffer} />
                </Row>
                <Row label="خرچ کے لیے محفوظ رقم" strong isDark={isDark}>
                  <span className={activeResult.safe < 0 ? 'text-red-500' : 'text-emerald-500'}>
                    <Money v={activeResult.safe} />
                  </span>
                </Row>
              </div>

              {/* Protected / Excluded Funds Summary */}
              {(purchaseData.reserved > 0 ||
                purchaseData.savings > 0 ||
                purchaseData.amanat > 0 ||
                purchaseData.loansToReceive > 0) && (
                <div
                  className={`rounded-xl border p-3 ${
                    isDark
                      ? 'border-white/10 bg-[#282e3d]/70'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-75 mb-2">
                    <ShieldCheck className="size-3.5 text-indigo-500" />
                    <span>حساب سے باہر محفوظ رقوم</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {purchaseData.reserved > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="opacity-70">مختص (Reserved)</span>
                        <Money v={purchaseData.reserved} />
                      </div>
                    )}
                    {purchaseData.savings > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="opacity-70">بچت (Savings)</span>
                        <Money v={purchaseData.savings} />
                      </div>
                    )}
                    {purchaseData.amanat > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="opacity-70">امانت (Amanat)</span>
                        <Money v={purchaseData.amanat} />
                      </div>
                    )}
                    {purchaseData.loansToReceive > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="opacity-70">متوقع واپسی</span>
                        <span className="text-blue-500">
                          <Money v={purchaseData.loansToReceive} />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                مخصوص مقصد کے لیے رکھی گئی رقم، بچت، امانت اور وہ رقم جو ابھی ملی نہیں، حساب میں شامل نہیں ہیں۔
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
