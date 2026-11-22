'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Pencil,
  CalendarDays,
  X,
  AlertTriangle,
  RefreshCw,
  LayoutGrid,
  Globe,
  CheckCircle2,
  FileText,
  PieChart,
} from 'lucide-react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { db } from '@/app/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  PlannedExpense,
  Expenditure,
  TotalCashSnapshot,
  TransactionSource,
} from '@/app/lib/interface';
import { PAKISTANI_EXPENSE_CATEGORIES, EXPENSE_CATEGORY_META } from '@/app/lib/constant';

type ExpenseTypeOption = 'recurring' | 'one_time' | 'event_based' | 'wish_list';
type ExpensePriorityOption = 'essential' | 'important' | 'wish_list' | 'lifestyle';
type ExpenseFrequencyOption = 'monthly' | 'yearly' | 'weekly' | 'daily';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const EXPENSE_TYPE_OPTIONS: { value: ExpenseTypeOption; label: string }[] = [
  { value: 'recurring', label: 'Recurring' },
  { value: 'one_time', label: 'One-Time' },
  { value: 'event_based', label: 'Event-Based' },
  { value: 'wish_list', label: 'Wish List' },
];

const PRIORITY_OPTIONS: {
  value: ExpensePriorityOption;
  label: string;
  hint: string;
  darkBadge: string;
  lightBadge: string;
  dot: string;
}[] = [
  {
    value: 'essential',
    label: 'Essential',
    hint: 'Must pay',
    darkBadge: 'bg-red-500/15 text-red-400',
    lightBadge: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
  {
    value: 'important',
    label: 'Important',
    hint: 'High priority',
    darkBadge: 'bg-amber-500/15 text-amber-400',
    lightBadge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
  {
    value: 'wish_list',
    label: 'Wish List',
    hint: 'When affordable',
    darkBadge: 'bg-blue-500/15 text-blue-400',
    lightBadge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
  },
  {
    value: 'lifestyle',
    label: 'Lifestyle',
    hint: 'Can be reduced',
    darkBadge: 'bg-purple-500/15 text-purple-300',
    lightBadge: 'bg-purple-100 text-purple-700',
    dot: 'bg-purple-500',
  },
];

const FREQUENCY_OPTIONS: { value: ExpenseFrequencyOption; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
];

const CATEGORY_META = EXPENSE_CATEGORY_META;

const FETCH_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

const formatRs = (n: number) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-US')}`;

const formatDueDate = (dueDate: string | Date | Timestamp | undefined): string => {
  if (!dueDate) return '';
  if (typeof dueDate === 'string') return dueDate;
  if (dueDate instanceof Timestamp) return dueDate.toDate().toISOString().split('T')[0];
  if (dueDate instanceof Date && !isNaN(dueDate.getTime())) {
    return dueDate.toISOString().split('T')[0];
  }
  return '';
};

export default function ExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [selectedMonthOffset, setSelectedMonthOffset] = useState<0 | 1>(0);

  const monthOptions = useMemo(() => {
    const now = new Date();
    return ([0, 1] as const).map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return {
        offset,
        year: d.getFullYear(),
        month: d.getMonth(),
        name: MONTH_NAMES[d.getMonth()],
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        tag: offset === 0 ? 'Current Month' : 'Next Month',
      };
    });
  }, []);

  const activeMonth = monthOptions[selectedMonthOffset];
  const currentMonthName = activeMonth.name;

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [plannedList, setPlannedList] = useState<PlannedExpense[]>([]);
  const [expendituresList, setExpendituresList] = useState<Expenditure[]>([]);
  const [snapshot, setSnapshot] = useState<TotalCashSnapshot | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail Dialog
  const [detailItem, setDetailItem] = useState<PlannedExpense | null>(null);

  // Add / Edit Expense Dialog (Sequence: Title, Amount, Due Date, Category, Type, Priority, Frequency, Notes)
  const [openAddModal, setOpenAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PlannedExpense | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState<string>(
    PAKISTANI_EXPENSE_CATEGORIES?.[0] || 'House rent'
  );
  const [customCat, setCustomCat] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseTypeOption>('recurring');
  const [priority, setPriority] = useState<ExpensePriorityOption>('essential');
  const [frequency, setFrequency] = useState<ExpenseFrequencyOption>('monthly');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isWishList = expenseType === 'wish_list' || priority === 'wish_list';

  // Pay Dialog
  const [payingItem, setPayingItem] = useState<PlannedExpense | null>(null);
  const [payWalletKey, setPayWalletKey] = useState<string>('in_hand');
  const [payAmount, setPayAmount] = useState<string>('');
  const [paying, setPaying] = useState(false);

  const fetchAllData = useCallback(async () => {
    if (authLoading) return;
    if (!user?.uid) {
      setLoading(false);
      setFetchError('Please sign in to view and manage your monthly expenses.');
      return;
    }

    setLoading(true);
    setFetchError(null);
    try {
      const qPlanned = query(collection(db, 'plannedExpenses'), where('userId', '==', user.uid));
      const qExp = query(collection(db, 'expenditures'), where('userId', '==', user.uid));
      const qSnap = query(collection(db, 'totalCashSnapshots'), where('userId', '==', user.uid));

      const [snapPlanned, snapExp, docSnap] = await withTimeout(
        Promise.all([getDocs(qPlanned), getDocs(qExp), getDocs(qSnap)]),
        FETCH_TIMEOUT_MS,
        'The server is taking too long to respond. Please check your internet connection and try again.'
      );

      const pList: PlannedExpense[] = snapPlanned.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PlannedExpense, 'id'>),
      }));
      setPlannedList(pList);

      const eList: Expenditure[] = snapExp.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Expenditure, 'id'>),
      }));
      setExpendituresList(eList);

      if (!docSnap.empty) {
        setSnapshot(docSnap.docs[0].data() as TotalCashSnapshot);
      }
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to load your expenses right now. Please try again.';
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [authLoading, user?.uid]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Wallets options for payment
  const walletOptions = useMemo(() => {
    const list: { key: string; name: string }[] = [
      { key: 'in_hand', name: 'Cash in Hand' },
      { key: 'easypaisa', name: 'Easypaisa' },
      { key: 'jazzcash', name: 'JazzCash' },
      { key: 'other', name: 'Personal Spending' },
    ];
    if (snapshot?.sources?.bank) {
      Object.keys(snapshot.sources.bank).forEach((b) => {
        list.push({ key: `bank:${b}`, name: `Bank: ${b}` });
      });
    }
    if (snapshot?.sources?.custom) {
      Object.keys(snapshot.sources.custom).forEach((c) => {
        list.push({ key: `custom:${c}`, name: c });
      });
    }
    return list;
  }, [snapshot]);

  // Helper: determine whether a plannedExpense belongs to the selected month
  const itemMatchesMonth = useCallback(
    (p: PlannedExpense, targetYear: number, targetMonth: number, isCurrentMonth: boolean): boolean => {
      const isGlobalWishList =
        p.expenseType === 'wish_list' || p.priority === 'wish_list' || p.isGlobal;
      if (isGlobalWishList) return true;

      const isOneTime =
        p.expenseType === 'one_time' ||
        p.expenseType === 'event_based' ||
        p.recurrence === 'one_time';

      if (!isOneTime) {
        // Recurring expenses apply to every month
        return true;
      }

      if (p.dueDate) {
        const d = p.dueDate instanceof Timestamp ? p.dueDate.toDate() : new Date(p.dueDate);
        if (!isNaN(d.getTime())) {
          return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
        }
      }

      // One-time without due date shows in current month by default
      return isCurrentMonth;
    },
    []
  );

  // Calculate selected month's totals
  const monthlyMetrics = useMemo(() => {
    let monthlyRecurring = 0;
    let oneTimeCurrentMonth = 0;
    let paidTotal = 0;

    const curYear = activeMonth.year;
    const curMonth = activeMonth.month;
    const isCurrentMonth = activeMonth.offset === 0;

    // From plannedExpenses
    plannedList.forEach((p) => {
      if (!itemMatchesMonth(p, curYear, curMonth, isCurrentMonth)) return;

      const amt = p.expectedAmount || 0;
      const isGlobalWishList =
        p.expenseType === 'wish_list' || p.priority === 'wish_list' || p.isGlobal;
      const effectiveFreq = p.frequency || (p.recurrence !== 'one_time' ? p.recurrence : undefined);
      const isOneTime = p.expenseType === 'one_time' || p.expenseType === 'event_based' || p.recurrence === 'one_time';

      let monthAmt = 0;
      if (isGlobalWishList) {
        monthAmt = amt;
        oneTimeCurrentMonth += amt;
      } else if (!isOneTime && effectiveFreq === 'monthly') {
        monthAmt = amt;
        monthlyRecurring += amt;
      } else if (!isOneTime && effectiveFreq === 'weekly') {
        monthAmt = amt * 4.33;
        monthlyRecurring += monthAmt;
      } else if (!isOneTime && effectiveFreq === 'daily') {
        monthAmt = amt * 30;
        monthlyRecurring += monthAmt;
      } else if (!isOneTime && effectiveFreq === 'yearly') {
        monthAmt = amt / 12;
        monthlyRecurring += monthAmt;
      } else {
        monthAmt = amt;
        oneTimeCurrentMonth += amt;
      }

      if (monthAmt > 0 && isCurrentMonth) {
        if (p.paymentStatus === 'paid') paidTotal += monthAmt;
        else paidTotal += Math.min(monthAmt, Number(p.actualPaidAmount) || 0);
      }
    });

    // From expenditures
    expendituresList.forEach((e) => {
      const amt = e.amount || 0;
      let monthAmt = 0;
      if (e.type === 'recurring') {
        if (e.frequency === 'monthly') monthAmt = amt;
        else if (e.frequency === 'weekly') monthAmt = amt * 4.33;
        else if (e.frequency === 'daily') monthAmt = amt * 30;
        monthlyRecurring += monthAmt;
      } else if (e.dueDate) {
        const d = e.dueDate instanceof Timestamp ? e.dueDate.toDate() : new Date(e.dueDate);
        if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
          monthAmt = amt;
          oneTimeCurrentMonth += amt;
        }
      }
      if (monthAmt > 0 && isCurrentMonth && e.isPaid) paidTotal += monthAmt;
    });

    const totalThisMonth = Math.round(monthlyRecurring + oneTimeCurrentMonth);
    const paidThisMonth = Math.round(paidTotal);
    const pendingThisMonth = Math.max(0, totalThisMonth - paidThisMonth);

    return {
      monthlyRecurring: Math.round(monthlyRecurring),
      oneTimeCurrentMonth: Math.round(oneTimeCurrentMonth),
      totalThisMonth,
      paidThisMonth,
      pendingThisMonth,
    };
  }, [plannedList, expendituresList, activeMonth, itemMatchesMonth]);

  // Filtered List (scoped to selected month)
  const filteredList = useMemo(() => {
    return plannedList.filter((item) => {
      if (!itemMatchesMonth(item, activeMonth.year, activeMonth.month, activeMonth.offset === 0)) {
        return false;
      }
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (statusFilter === 'pending' && item.paymentStatus === 'paid') return false;
      if (statusFilter === 'paid' && item.paymentStatus !== 'paid') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.notes || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [plannedList, selectedCategory, statusFilter, searchQuery, activeMonth, itemMatchesMonth]);

  const resetForm = () => {
    setEditingItem(null);
    setTitle('');
    setAmount('');
    setDueDate('');
    setCategory(PAKISTANI_EXPENSE_CATEGORIES?.[0] || 'House rent');
    setCustomCat('');
    setExpenseType('recurring');
    setPriority('essential');
    setFrequency('monthly');
    setNotes('');
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    // Default due date to the selected month if viewing next month
    if (activeMonth.offset === 1) {
      const mStr = String(activeMonth.month + 1).padStart(2, '0');
      setDueDate(`${activeMonth.year}-${mStr}-01`);
    }
    setOpenAddModal(true);
  };

  const openEditModal = (item: PlannedExpense) => {
    setDetailItem(null);
    setEditingItem(item);
    setTitle(item.title || '');
    setAmount(String(item.expectedAmount || ''));
    const isKnownCat = (
      (PAKISTANI_EXPENSE_CATEGORIES as readonly string[]) || []
    ).includes(item.category);
    if (isKnownCat) {
      setCategory(item.category);
      setCustomCat('');
    } else {
      setCategory('Other expenses');
      setCustomCat(item.category || '');
    }
    const resolvedType: ExpenseTypeOption =
      item.expenseType ||
      (item.isGlobal || item.priority === 'wish_list'
        ? 'wish_list'
        : item.recurrence === 'one_time'
        ? 'one_time'
        : 'recurring');
    setExpenseType(resolvedType);
    setPriority((item.priority as ExpensePriorityOption) || 'essential');
    const resolvedFreq: ExpenseFrequencyOption =
      (item.frequency as ExpenseFrequencyOption) ||
      (item.recurrence && item.recurrence !== 'one_time'
        ? (item.recurrence as ExpenseFrequencyOption)
        : 'monthly');
    setFrequency(resolvedFreq);
    setDueDate(resolvedType === 'wish_list' ? '' : formatDueDate(item.dueDate));
    setNotes(item.notes || '');
    setFormError(null);
    setOpenAddModal(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user?.uid) {
      setFormError('You must be signed in to save an expense.');
      return;
    }
    if (!title.trim()) {
      setFormError('Please enter an expense title.');
      return;
    }
    const numAmt = Number(amount);
    if (!amount || isNaN(numAmt) || numAmt <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!isWishList && !dueDate) {
      setFormError('Please select a due date for this expense.');
      return;
    }

    setSaving(true);
    try {
      const finalCat =
        category === 'Other expenses' && customCat.trim() ? customCat.trim() : category;
      const mappedRecurrence: PlannedExpense['recurrence'] = isWishList
        ? 'monthly'
        : expenseType === 'recurring'
        ? frequency
        : 'one_time';
      const trimmedNotes = notes.trim();

      if (editingItem?.id) {
        const updatePayload: Record<string, unknown> = {
          title: title.trim(),
          category: finalCat,
          expectedAmount: numAmt,
          dueDate: isWishList ? '' : dueDate,
          recurrence: mappedRecurrence,
          expenseType,
          priority,
          isGlobal: isWishList,
          notes: trimmedNotes || '',
        };
        if (!isWishList) {
          updatePayload.frequency = frequency;
        }

        await updateDoc(doc(db, 'plannedExpenses', editingItem.id), updatePayload);

        setPlannedList((prev) =>
          prev.map((item) =>
            item.id === editingItem.id
              ? {
                  ...item,
                  title: title.trim(),
                  category: finalCat,
                  expectedAmount: numAmt,
                  dueDate: isWishList ? '' : dueDate,
                  recurrence: mappedRecurrence,
                  expenseType,
                  priority,
                  isGlobal: isWishList,
                  ...(isWishList ? { frequency: undefined } : { frequency }),
                  notes: trimmedNotes || undefined,
                }
              : item
          )
        );
      } else {
        const newExpense: Omit<PlannedExpense, 'id'> = {
          userId: user.uid,
          title: title.trim(),
          category: finalCat,
          expectedAmount: numAmt,
          actualPaidAmount: 0,
          dueDate: isWishList ? '' : dueDate,
          paymentStatus: 'pending',
          recurrence: mappedRecurrence,
          expenseType,
          priority,
          isGlobal: isWishList,
          ...(isWishList ? {} : { frequency }),
          ...(trimmedNotes ? { notes: trimmedNotes } : {}),
          createdAt: new Date(),
        };

        const firestorePayload: Record<string, unknown> = {
          userId: user.uid,
          title: newExpense.title,
          category: newExpense.category,
          expectedAmount: newExpense.expectedAmount,
          actualPaidAmount: 0,
          dueDate: newExpense.dueDate,
          paymentStatus: 'pending',
          recurrence: newExpense.recurrence,
          expenseType: newExpense.expenseType,
          priority: newExpense.priority,
          isGlobal: isWishList,
          createdAt: serverTimestamp(),
        };
        if (!isWishList) {
          firestorePayload.frequency = frequency;
        }
        if (trimmedNotes) {
          firestorePayload.notes = trimmedNotes;
        }

        const docRef = await addDoc(collection(db, 'plannedExpenses'), firestorePayload);
        setPlannedList((prev) => [{ id: docRef.id, ...newExpense }, ...prev]);
      }

      resetForm();
      setOpenAddModal(false);
    } catch (err) {
      console.error('Error saving expense:', err);
      const errMsg =
        err instanceof Error && err.message
          ? `Could not save expense: ${err.message}`
          : 'Failed to save expense. Please check your connection and try again.';
      setFormError(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingItem || !payAmount || !user?.uid) return;
    setPaying(true);
    try {
      const amt = Number(payAmount) || 0;

      // 1. Record cash deduction transaction with current logged-in userId
      let src: TransactionSource = 'in_hand';
      let bName: string | undefined = undefined;
      let cName: string | undefined = undefined;

      if (payWalletKey.startsWith('bank:')) {
        src = 'bank';
        bName = payWalletKey.replace('bank:', '');
      } else if (payWalletKey.startsWith('custom:')) {
        src = 'custom';
        cName = payWalletKey.replace('custom:', '');
      } else {
        src = payWalletKey as TransactionSource;
      }

      await addDoc(collection(db, 'cashTransactions'), {
        userId: user.uid,
        amount: amt,
        type: 'deduct',
        source: src,
        category: 'expenditure',
        eventType: 'expense',
        expenseCategory: payingItem.category,
        note: `Paid expense: ${payingItem.title}`,
        BankName: bName || null,
        customPaymentHeadName: cName || null,
        createdAt: serverTimestamp(),
      });

      // 2. Persist updated payment status to plannedExpenses in Firestore
      if (payingItem.id) {
        const newPaid = (payingItem.actualPaidAmount || 0) + amt;
        const newStatus: PlannedExpense['paymentStatus'] =
          newPaid >= payingItem.expectedAmount ? 'paid' : 'partially_paid';

        await updateDoc(doc(db, 'plannedExpenses', payingItem.id), {
          actualPaidAmount: newPaid,
          paymentStatus: newStatus,
        });

        setPlannedList((prev) =>
          prev.map((item) =>
            item.id === payingItem.id
              ? { ...item, actualPaidAmount: newPaid, paymentStatus: newStatus }
              : item
          )
        );
      }

      setPayingItem(null);
      setPayAmount('');
    } catch (err) {
      console.error('Failed to pay expense:', err);
      setActionError('Failed to record payment. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const handleDeleteExpense = async (id?: string) => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteDoc(doc(db, 'plannedExpenses', id));
      setPlannedList((prev) => prev.filter((p) => p.id !== id));
      setDetailItem((cur) => (cur?.id === id ? null : cur));
    } catch (err) {
      console.error('Error deleting expense:', err);
      setActionError('Failed to delete expense. Please try again.');
    }
  };

  const inputClass = `w-full px-3.5 py-2.5 rounded-xl text-sm border transition focus:outline-none focus:ring-2 ${
    isDark
      ? 'bg-slate-800/80 border-slate-700/80 text-white placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/20'
      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500/20'
  }`;

  const labelClass = `block text-xs font-semibold mb-1.5 ${
    isDark ? 'text-slate-300' : 'text-slate-700'
  }`;

  return (
    <div
      className={`min-h-screen antialiased font-sans pb-16 transition-colors ${
        isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pt-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/finance"
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-900 border-slate-700/70 text-slate-400 hover:text-white hover:border-slate-600'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 shadow-xs'
              }`}
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1
                className={`text-2xl font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Monthly Expenses
              </h1>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                Track recurring, one-time &amp; event-based expenses
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>Add Expense</span>
          </button>
        </header>

        {/* Month Switcher: Current Month (default) & Next Month */}
        <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
          <div
            className={`inline-flex rounded-2xl p-1 border ${
              isDark ? 'bg-slate-900 border-slate-700/70' : 'bg-white border-slate-200 shadow-2xs'
            }`}
          >
            {monthOptions.map((m) => {
              const active = selectedMonthOffset === m.offset;
              return (
                <button
                  key={m.offset}
                  type="button"
                  onClick={() => setSelectedMonthOffset(m.offset)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isDark
                      ? 'text-slate-300 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarDays size={13} />
                  <span>{m.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      active
                        ? 'bg-white/20 text-white'
                        : isDark
                        ? 'bg-white/5 text-slate-400'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {m.offset === 0 ? 'Current' : 'Next'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Error Banner (create / pay / delete failures) */}
        {actionError && (
          <div
            role="alert"
            className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs ${
              isDark
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="p-1 rounded-full hover:bg-black/10 cursor-pointer"
              aria-label="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Current Month Expense Metrics */}
        <section
          className={`rounded-3xl border p-5 sm:p-6 mb-5 transition-colors ${
            isDark
              ? 'bg-slate-900 border-slate-700/70 shadow-xl'
              : 'bg-white border-slate-200 shadow-sm'
          }`}
        >
          <span
            className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
          >
            Total Expenses For {activeMonth.tag} ({activeMonth.label})
          </span>

          {loading ? (
            <>
              <div
                className={`mt-2 h-10 w-48 rounded-xl animate-pulse ${
                  isDark ? 'bg-slate-800' : 'bg-slate-200'
                }`}
              />
              <div
                className={`mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t pt-4 ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl p-3 space-y-2 ${
                      isDark ? 'bg-slate-800/80' : 'bg-slate-50 border border-slate-200/70'
                    }`}
                  >
                    <div
                      className={`h-3 w-20 rounded animate-pulse ${
                        isDark ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`h-5 w-24 rounded animate-pulse ${
                        isDark ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p
                className={`mt-1 text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {formatRs(monthlyMetrics.totalThisMonth)}
              </p>

              <div
                className={`mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t pt-4 text-xs ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}
              >
                <div
                  className={`rounded-2xl p-3 ${
                    isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-slate-50 border border-slate-200/70'
                  }`}
                >
                  <span className={`block text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Monthly Recurring
                  </span>
                  <span
                    className={`mt-0.5 block font-bold text-base tabular-nums ${
                      isDark ? 'text-rose-400' : 'text-rose-600'
                    }`}
                  >
                    {formatRs(monthlyMetrics.monthlyRecurring)}
                  </span>
                </div>

                <div
                  className={`rounded-2xl p-3 ${
                    isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-slate-50 border border-slate-200/70'
                  }`}
                >
                  <span className={`block text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    One-Time ({currentMonthName})
                  </span>
                  <span
                    className={`mt-0.5 block font-bold text-base tabular-nums ${
                      isDark ? 'text-amber-400' : 'text-amber-600'
                    }`}
                  >
                    {formatRs(monthlyMetrics.oneTimeCurrentMonth)}
                  </span>
                </div>

                <div
                  className={`rounded-2xl p-3 ${
                    isDark ? 'bg-green-500/10 ring-1 ring-green-500/30' : 'bg-green-50 ring-1 ring-green-200'
                  }`}
                >
                  <span className={`block text-[11px] ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                    Paid Off
                  </span>
                  <span
                    className={`mt-0.5 block font-bold text-base tabular-nums ${
                      isDark ? 'text-green-400' : 'text-green-700'
                    }`}
                  >
                    {formatRs(monthlyMetrics.paidThisMonth)}
                  </span>
                </div>

                <div
                  className={`rounded-2xl p-3 ${
                    isDark ? 'bg-amber-500/10 ring-1 ring-amber-500/30' : 'bg-amber-50 ring-1 ring-amber-200'
                  }`}
                >
                  <span className={`block text-[11px] ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                    Pending
                  </span>
                  <span
                    className={`mt-0.5 block font-bold text-base tabular-nums ${
                      isDark ? 'text-amber-400' : 'text-amber-700'
                    }`}
                  >
                    {formatRs(monthlyMetrics.pendingThisMonth)}
                  </span>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Search, Status & Category Filters */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search
                size={15}
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-neutral-400' : 'text-slate-400'
                }`}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expenses by title, category, or note…"
                className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:border-blue-500 ${
                  isDark
                    ? 'bg-slate-900 border-slate-700/70 text-white placeholder-slate-400'
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Status Filter Pills */}
            <div
              className={`inline-flex rounded-xl p-1 border self-start sm:self-auto ${
                isDark ? 'bg-slate-900 border-slate-700/70' : 'bg-white border-slate-200'
              }`}
            >
              {(['all', 'pending', 'paid'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark
                  ? 'bg-slate-900 text-slate-300 hover:text-white border border-slate-700/70 hover:border-slate-600'
                  : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <LayoutGrid
                size={13}
                className={
                  selectedCategory === 'all'
                    ? 'text-white'
                    : isDark
                    ? 'text-blue-400'
                    : 'text-blue-600'
                }
              />
              <span>All Categories</span>
            </button>
            {(PAKISTANI_EXPENSE_CATEGORIES || []).map((cat) => {
              const meta = CATEGORY_META[cat] ?? CATEGORY_META['Other expenses'];
              const CatIcon = meta.icon;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isDark
                      ? 'bg-slate-900 text-slate-300 hover:text-white border border-slate-700/70 hover:border-slate-600'
                      : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <CatIcon
                    size={13}
                    className={
                      isSelected ? 'text-white' : isDark ? meta.darkColor : meta.lightColor
                    }
                  />
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact, Borderless ExpensesList Card */}
        <div
          className={`w-full rounded-3xl p-4 sm:p-5 transition-colors ${
            isDark
              ? 'bg-slate-900 text-white shadow-xl border border-slate-700/70'
              : 'bg-white text-slate-900 shadow-sm border border-slate-200'
          }`}
        >
          {loading ? (
            <ul className="space-y-2.5" aria-label="Loading expenses">
              {[0, 1, 2, 3, 4].map((idx) => (
                <li
                  key={idx}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 ${
                    isDark ? 'bg-slate-800/80' : 'bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div
                      className={`h-4 w-44 max-w-[65%] rounded-md animate-pulse ${
                        isDark ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-4 w-20 rounded-full animate-pulse ${
                          isDark ? 'bg-slate-700' : 'bg-slate-200'
                        }`}
                      />
                      <div
                        className={`h-4 w-16 rounded-full animate-pulse ${
                          isDark ? 'bg-slate-700' : 'bg-slate-200'
                        }`}
                      />
                      <div
                        className={`h-4 w-14 rounded-full animate-pulse ${
                          isDark ? 'bg-slate-700' : 'bg-slate-200'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div
                      className={`h-4 w-20 rounded-md animate-pulse ${
                        isDark ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`h-5 w-16 rounded-full animate-pulse ${
                        isDark ? 'bg-slate-700' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : fetchError ? (
            <div
              role="alert"
              className={`py-10 px-4 text-center rounded-2xl border flex flex-col items-center gap-3 ${
                isDark
                  ? 'bg-rose-500/5 border-rose-500/25 text-slate-300'
                  : 'bg-rose-50/60 border-rose-200 text-slate-700'
              }`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-100 text-rose-600'
                }`}
              >
                <AlertTriangle size={22} />
              </div>
              <div className="max-w-sm">
                <p
                  className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}
                >
                  Couldn&apos;t load your expenses
                </p>
                <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {fetchError}
                </p>
              </div>
              {user?.uid && (
                <button
                  type="button"
                  onClick={fetchAllData}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer active:scale-95"
                >
                  <RefreshCw size={14} />
                  <span>Try Again</span>
                </button>
              )}
            </div>
          ) : filteredList.length === 0 ? (
            <div
              className={`py-12 text-center text-xs rounded-2xl ${
                isDark ? 'bg-slate-800/70 text-slate-400' : 'bg-slate-50 text-slate-500'
              }`}
            >
              No expenses match your search or filter.
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredList.map((item) => {
                const isPaid = item.paymentStatus === 'paid';
                const isGlobalWishList =
                  item.expenseType === 'wish_list' || item.priority === 'wish_list' || item.isGlobal;
                const catMeta = CATEGORY_META[item.category] ?? CATEGORY_META['Other expenses'];
                const RowCatIcon = catMeta.icon;
                const dueStr = isGlobalWishList ? 'Every month' : formatDueDate(item.dueDate) || activeMonth.label;

                return (
                  <li
                    key={item.id}
                    onClick={() => setDetailItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailItem(item);
                      }
                    }}
                    className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 transition cursor-pointer ${
                      isDark
                        ? 'bg-slate-800/80 hover:bg-slate-800 border border-transparent hover:border-slate-700'
                        : 'bg-slate-50 hover:bg-slate-100/90 border border-transparent hover:border-slate-200'
                    }`}
                  >
                    {/* Left: Title + Category + Date */}
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="flex items-center gap-2">
                        <p
                          className={`truncate text-sm font-semibold ${
                            isPaid
                              ? isDark
                                ? 'text-neutral-400 line-through'
                                : 'text-slate-400 line-through'
                              : isDark
                              ? 'text-white'
                              : 'text-slate-900'
                          }`}
                        >
                          {item.title}
                        </p>
                        {isPaid && (
                          <CheckCircle2
                            size={14}
                            className={isDark ? 'text-green-400 shrink-0' : 'text-green-600 shrink-0'}
                          />
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            isDark
                              ? 'bg-white/10 text-neutral-300'
                              : 'bg-slate-200/80 text-slate-700'
                          }`}
                        >
                          <RowCatIcon
                            size={11}
                            className={isDark ? catMeta.darkColor : catMeta.lightColor}
                          />
                          {item.category}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 text-[11px] ${
                            isDark ? 'text-neutral-400' : 'text-slate-500'
                          }`}
                        >
                          {isGlobalWishList ? <Globe size={11} /> : <CalendarDays size={11} />}
                          {dueStr}
                        </span>
                      </div>
                    </div>

                    {/* Right: Amount */}
                    <div className="shrink-0 text-right">
                      <p
                        className={`text-sm sm:text-base font-bold tabular-nums ${
                          isPaid
                            ? isDark
                              ? 'text-neutral-400'
                              : 'text-slate-400'
                            : isDark
                            ? 'text-white'
                            : 'text-slate-900'
                        }`}
                      >
                        {formatRs(item.expectedAmount)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Expense Detail Modal ──────────────────────────────── */}
      {detailItem && (() => {
        const isPaid = detailItem.paymentStatus === 'paid';
        const isPartial = detailItem.paymentStatus === 'partially_paid';
        const isGlobalWishList =
          detailItem.expenseType === 'wish_list' ||
          detailItem.priority === 'wish_list' ||
          detailItem.isGlobal;
        const priorityMeta = PRIORITY_OPTIONS.find((p) => p.value === detailItem.priority);
        const catMeta = CATEGORY_META[detailItem.category] ?? CATEGORY_META['Other expenses'];
        const DetailCatIcon = catMeta.icon;
        const dueStr = isGlobalWishList ? '' : formatDueDate(detailItem.dueDate);
        const freqLabel = isGlobalWishList
          ? 'Global (Every Month)'
          : detailItem.frequency ||
            (detailItem.recurrence !== 'one_time' ? detailItem.recurrence : 'One-Time');
        const typeLabel = isGlobalWishList
          ? 'Wish List'
          : detailItem.expenseType === 'event_based'
          ? 'Event-Based'
          : detailItem.expenseType === 'one_time' || detailItem.recurrence === 'one_time'
          ? 'One-Time'
          : 'Recurring';
        const monthForLabel = (() => {
          if (isGlobalWishList) return 'Every Month (Global)';
          if (typeLabel === 'Recurring') return `${activeMonth.label} (Recurring)`;
          if (dueStr) {
            const d = new Date(dueStr);
            if (!isNaN(d.getTime())) {
              return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
            }
          }
          return activeMonth.label;
        })();
        const paidAmt = Number(detailItem.actualPaidAmount) || 0;
        const remainingAmt = Math.max(0, (detailItem.expectedAmount || 0) - paidAmt);

        return (
          <Dialog
            open={Boolean(detailItem)}
            onClose={() => setDetailItem(null)}
            fullWidth
            maxWidth="sm"
            PaperProps={{
              sx: {
                backgroundColor: isDark ? '#1f2430' : '#ffffff',
                color: isDark ? '#f8fafc' : '#0f172a',
                borderRadius: 4,
                border: isDark ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid #e2e8f0',
                boxShadow: isDark
                  ? '0 24px 48px rgba(0,0,0,0.55)'
                  : '0 24px 48px rgba(15,23,42,0.12)',
              },
            }}
          >
            <DialogTitle
              className={`flex items-start justify-between gap-3 pb-3 border-b ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {detailItem.title}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      isPaid
                        ? isDark
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-green-100 text-green-700'
                        : isPartial
                        ? isDark
                          ? 'bg-blue-500/15 text-blue-300'
                          : 'bg-blue-100 text-blue-700'
                        : isDark
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isPaid ? 'Paid' : isPartial ? 'Partially Paid' : 'Pending'}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                  <DetailCatIcon
                    size={13}
                    className={isDark ? catMeta.darkColor : catMeta.lightColor}
                  />
                  <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                    {detailItem.category}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className={`p-1.5 rounded-full transition cursor-pointer ${
                  isDark
                    ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                    : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
                }`}
                aria-label="Close detail"
              >
                <X size={18} />
              </button>
            </DialogTitle>

            <DialogContent className="pt-4 space-y-4">
              {/* Financial Amounts Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`rounded-2xl p-3.5 border ${
                    isDark ? 'bg-[#282e3d] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`block text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Expense Amount
                  </span>
                  <span className={`mt-0.5 block text-xl font-extrabold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {formatRs(detailItem.expectedAmount)}
                  </span>
                  {paidAmt > 0 && !isPaid && (
                    <span className={`mt-1 block text-[11px] ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                      Paid: {formatRs(paidAmt)} · Rem: {formatRs(remainingAmt)}
                    </span>
                  )}
                </div>

                <div
                  className={`rounded-2xl p-3.5 border ${
                    typeof detailItem.allocatedBudget === 'number'
                      ? isDark
                        ? 'bg-teal-500/10 border-teal-500/30'
                        : 'bg-teal-50 border-teal-200'
                      : isDark
                      ? 'bg-[#282e3d] border-white/10'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className={`flex items-center gap-1 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <PieChart size={11} />
                    Allocated Budget
                  </span>
                  {typeof detailItem.allocatedBudget === 'number' ? (
                    <span className={`mt-0.5 block text-xl font-extrabold tabular-nums ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                      {formatRs(detailItem.allocatedBudget)}
                    </span>
                  ) : (
                    <div className="mt-1">
                      <span className={`block text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Not allocated
                      </span>
                      <Link
                        href="/finance/budget"
                        className="text-[11px] font-bold text-teal-500 hover:underline"
                      >
                        Allocate in Budget Planner →
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata Grid */}
              <div
                className={`rounded-2xl border divide-y text-xs ${
                  isDark
                    ? 'bg-[#282e3d]/60 border-white/10 divide-white/10'
                    : 'bg-slate-50/80 border-slate-200 divide-slate-200'
                }`}
              >
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Month For</span>
                  <span className="font-semibold">{monthForLabel}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Due Date</span>
                  <span className="font-semibold">{dueStr || 'No specific date'}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Type</span>
                  <span className="font-semibold">{typeLabel}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Frequency</span>
                  <span className="font-semibold capitalize">{freqLabel}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Priority</span>
                  {priorityMeta ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        isDark ? priorityMeta.darkBadge : priorityMeta.lightBadge
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${priorityMeta.dot}`} />
                      {priorityMeta.label}
                    </span>
                  ) : (
                    <span className="font-semibold capitalize">{detailItem.priority || '—'}</span>
                  )}
                </div>
              </div>

              {/* Notes (if any) */}
              {detailItem.notes && (
                <div
                  className={`rounded-2xl border p-3.5 text-xs ${
                    isDark ? 'bg-[#282e3d]/60 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className={`flex items-center gap-1.5 font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <FileText size={13} />
                    <span>Notes</span>
                  </div>
                  <p className={isDark ? 'text-slate-300 leading-relaxed' : 'text-slate-600 leading-relaxed'}>
                    {detailItem.notes}
                  </p>
                </div>
              )}
            </DialogContent>

            <DialogActions
              className={`border-t px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => handleDeleteExpense(detailItem.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                  isDark
                    ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
                    : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                }`}
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                {!isPaid && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailItem;
                      setDetailItem(null);
                      setPayingItem(target);
                      setPayAmount(
                        String(Math.max(1, target.expectedAmount - (target.actualPaidAmount || 0)))
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-2 text-xs font-bold text-black transition cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>Mark Paid</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openEditModal(detailItem)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white transition cursor-pointer"
                >
                  <Pencil size={14} />
                  <span>Edit</span>
                </button>
              </div>
            </DialogActions>
          </Dialog>
        );
      })()}

      {/* ── Full-Width Add / Edit Expense Modal ────────────────── */}
      <Dialog
        open={openAddModal}
        onClose={() => {
          resetForm();
          setOpenAddModal(false);
        }}
        fullWidth
        maxWidth={false}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: '100%',
            margin: { xs: 1, sm: 2.5 },
            backgroundColor: isDark ? '#1f2430' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
            borderRadius: 4,
            border: isDark ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid #e2e8f0',
            boxShadow: isDark
              ? '0 24px 48px rgba(0,0,0,0.55)'
              : '0 24px 48px rgba(15,23,42,0.12)',
          },
        }}
      >
        <form onSubmit={handleSaveExpense} noValidate>
          <DialogTitle
            className={`flex items-center justify-between pb-3 border-b ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            <div>
              <h2
                className={`text-lg font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {editingItem ? 'Edit Expense' : 'Add New Expense'}
              </h2>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                {editingItem
                  ? 'Update the details of this expense'
                  : 'Save a monthly, one-time, or event-based expense to your account'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setOpenAddModal(false);
              }}
              className={`p-1.5 rounded-full transition cursor-pointer ${
                isDark
                  ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                  : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
              }`}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </DialogTitle>

          <DialogContent className="pt-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
            {/* Inline Validation / Save Error Alert */}
            {formError && (
              <div
                role="alert"
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                  isDark
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                <AlertTriangle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* 1. Title */}
            <div>
              <label className={labelClass}>
                Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="e.g., House rent, LESCO Electricity Bill, School Fees"
                className={inputClass}
              />
            </div>

            {/* 2. Amount & 3. Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  Amount (PKR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Due Date {!isWishList && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="date"
                  disabled={isWishList}
                  value={isWishList ? '' : dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  className={`${inputClass} ${
                    isWishList ? 'opacity-45 cursor-not-allowed' : ''
                  }`}
                />
                {isWishList && (
                  <p className={`mt-1 text-[11px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    Disabled for Wish List (always shown every month)
                  </p>
                )}
              </div>
            </div>

            {/* 4. Category */}
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                {(PAKISTANI_EXPENSE_CATEGORIES || []).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {category === 'Other expenses' && (
              <div>
                <label className={labelClass}>Custom Category Name</label>
                <input
                  type="text"
                  value={customCat}
                  onChange={(e) => setCustomCat(e.target.value)}
                  placeholder="Enter custom category"
                  className={inputClass}
                />
              </div>
            )}

            {/* 5. Type (recurring, one-time, event-based, wish list) */}
            <div>
              <label className={labelClass}>Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EXPENSE_TYPE_OPTIONS.map((opt) => {
                  const active = expenseType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setExpenseType(opt.value);
                        if (opt.value === 'wish_list') {
                          setPriority('wish_list');
                          setDueDate('');
                          if (formError) setFormError(null);
                        } else if (priority === 'wish_list') {
                          setPriority('essential');
                        }
                      }}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        active
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                          : isDark
                          ? 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:border-slate-500'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6. Priority */}
            <div>
              <label className={labelClass}>Priority</label>
              <div className="grid grid-cols-2 gap-2">
                {PRIORITY_OPTIONS.map((opt) => {
                  const active = priority === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setPriority(opt.value);
                        if (opt.value === 'wish_list') {
                          setExpenseType('wish_list');
                          setDueDate('');
                          if (formError) setFormError(null);
                        } else if (expenseType === 'wish_list') {
                          setExpenseType('recurring');
                        }
                      }}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? isDark
                            ? 'bg-blue-600/20 border-blue-500 text-white'
                            : 'bg-blue-50 border-blue-500 text-slate-900'
                          : isDark
                          ? 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:border-slate-500'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opt.dot}`} />
                      <div className="min-w-0 leading-tight">
                        <span className="block text-xs font-bold">{opt.label}</span>
                        <span
                          className={`block text-[10px] ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {opt.hint}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 7. Frequency (monthly default, yearly, weekly, daily) */}
            <div>
              <label className={labelClass}>Frequency</label>
              <div className="grid grid-cols-4 gap-2">
                {FREQUENCY_OPTIONS.map((opt) => {
                  const active = !isWishList && frequency === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isWishList}
                      onClick={() => setFrequency(opt.value)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition ${
                        isWishList
                          ? isDark
                            ? 'bg-slate-800/35 border-slate-800 text-slate-600 cursor-not-allowed'
                            : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          : active
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs cursor-pointer'
                          : isDark
                          ? 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:border-slate-500 cursor-pointer'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {isWishList && (
                <p className={`mt-1 text-[11px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  Wish List items are global and display every month automatically.
                </p>
              )}
            </div>

            {/* Optional Notes */}
            <div>
              <label className={labelClass}>Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Consumer number, bill details, etc."
                className={inputClass}
              />
            </div>
          </DialogContent>

          <DialogActions
            className={`border-t px-6 py-3.5 flex justify-end gap-2 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            <Button
              onClick={() => {
                resetForm();
                setOpenAddModal(false);
              }}
              disabled={saving}
              sx={{ color: isDark ? '#a3a3a3' : '#64748b', textTransform: 'none', fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              variant="contained"
              sx={{
                backgroundColor: '#2563eb',
                '&:hover': { backgroundColor: '#1d4ed8' },
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2.5,
                px: 3,
              }}
            >
              {saving ? 'Saving…' : editingItem ? 'Update Expense' : 'Save Expense'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ── Pay Expense Modal ──────────────────────────────────── */}
      {payingItem && (
        <Dialog
          open={Boolean(payingItem)}
          onClose={() => setPayingItem(null)}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            sx: {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              color: isDark ? '#f8fafc' : '#0f172a',
              borderRadius: 4,
              border: isDark ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid #e2e8f0',
            },
          }}
        >
          <form onSubmit={handleExecutePayment}>
            <DialogTitle
              className={`flex items-center justify-between pb-3 border-b ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <div>
                <h2
                  className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}
                >
                  Pay: {payingItem.title}
                </h2>
                <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                  Deduct payment directly from your selected wallet
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingItem(null)}
                className={`p-1 rounded-full transition cursor-pointer ${
                  isDark ? 'text-neutral-400 hover:text-white' : 'text-slate-400 hover:text-slate-900'
                }`}
              >
                <X size={18} />
              </button>
            </DialogTitle>

            <DialogContent className="pt-4 flex flex-col gap-3.5 text-xs">
              <div>
                <label className={labelClass}>Payment Amount (PKR)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={`${inputClass} font-bold`}
                />
              </div>

              <div>
                <label className={labelClass}>Deduct From Wallet *</label>
                <select
                  required
                  value={payWalletKey}
                  onChange={(e) => setPayWalletKey(e.target.value)}
                  className={inputClass}
                >
                  {walletOptions.map((w) => (
                    <option key={w.key} value={w.key}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </DialogContent>

            <DialogActions
              className={`border-t px-5 py-3 flex justify-end gap-2 ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <Button
                onClick={() => setPayingItem(null)}
                disabled={paying}
                sx={{ color: isDark ? '#a3a3a3' : '#64748b', textTransform: 'none', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={paying || !payAmount}
                variant="contained"
                sx={{
                  backgroundColor: '#10b981',
                  '&:hover': { backgroundColor: '#059669' },
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: 2.5,
                }}
              >
                {paying ? 'Processing…' : 'Confirm Payment'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      )}
    </div>
  );
}
