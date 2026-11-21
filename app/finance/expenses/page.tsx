'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Receipt,
  CheckCircle2,
  Search,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { useAuth } from '@/app/lib/context/userContext';
import { db } from '@/app/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
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
import { PAKISTANI_EXPENSE_CATEGORIES } from '@/app/lib/constant';

const money = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-PK')}`;

export default function ExpensesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plannedList, setPlannedList] = useState<PlannedExpense[]>([]);
  const [expendituresList, setExpendituresList] = useState<Expenditure[]>([]);
  const [snapshot, setSnapshot] = useState<TotalCashSnapshot | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Expense Dialog
  const [openAddModal, setOpenAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(
    PAKISTANI_EXPENSE_CATEGORIES?.[0] || 'Groceries'
  );
  const [customCat, setCustomCat] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState<'one_time' | 'monthly' | 'weekly' | 'yearly'>('monthly');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Pay Dialog
  const [payingItem, setPayingItem] = useState<PlannedExpense | null>(null);
  const [payWalletKey, setPayWalletKey] = useState<string>('in_hand');
  const [payAmount, setPayAmount] = useState<string>('');
  const [paying, setPaying] = useState(false);

  const fetchAllData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      // 1. Fetch plannedExpenses
      const qPlanned = query(collection(db, 'plannedExpenses'), where('userId', '==', user.uid));
      const snapPlanned = await getDocs(qPlanned);
      const pList: PlannedExpense[] = snapPlanned.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PlannedExpense, 'id'>),
      }));
      setPlannedList(pList);

      // 2. Fetch expenditures (legacy or existing recurring expenditures)
      const qExp = query(collection(db, 'expenditures'), where('userId', '==', user.uid));
      const snapExp = await getDocs(qExp);
      const eList: Expenditure[] = snapExp.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Expenditure, 'id'>),
      }));
      setExpendituresList(eList);

      // 3. Fetch snapshot for wallets
      const docSnap = await getDocs(query(collection(db, 'totalCashSnapshots'), where('userId', '==', user.uid)));
      if (!docSnap.empty) {
        setSnapshot(docSnap.docs[0].data() as TotalCashSnapshot);
      }
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

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

  // Calculate current month's totals
  const monthlyMetrics = useMemo(() => {
    let monthlyRecurring = 0;
    let oneTimeCurrentMonth = 0;

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    // From plannedExpenses
    plannedList.forEach((p) => {
      const amt = p.expectedAmount || 0;
      if (p.recurrence === 'monthly') {
        monthlyRecurring += amt;
      } else if (p.recurrence === 'weekly') {
        monthlyRecurring += amt * 4.33;
      } else if (p.recurrence === 'yearly') {
        monthlyRecurring += amt / 12;
      } else {
        // one-time: check if in current month
        if (p.dueDate) {
          const d = p.dueDate instanceof Timestamp ? p.dueDate.toDate() : new Date(p.dueDate);
          if (!isNaN(d.getTime()) && d.getFullYear() === curYear && d.getMonth() === curMonth) {
            oneTimeCurrentMonth += amt;
          }
        } else {
          oneTimeCurrentMonth += amt;
        }
      }
    });

    // From expenditures
    expendituresList.forEach((e) => {
      const amt = e.amount || 0;
      if (e.type === 'recurring') {
        if (e.frequency === 'monthly') monthlyRecurring += amt;
        else if (e.frequency === 'weekly') monthlyRecurring += amt * 4.33;
        else if (e.frequency === 'daily') monthlyRecurring += amt * 30;
      } else {
        if (e.dueDate) {
          const d = e.dueDate instanceof Timestamp ? e.dueDate.toDate() : new Date(e.dueDate);
          if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
            oneTimeCurrentMonth += amt;
          }
        }
      }
    });

    return {
      monthlyRecurring: Math.round(monthlyRecurring),
      oneTimeCurrentMonth: Math.round(oneTimeCurrentMonth),
      totalThisMonth: Math.round(monthlyRecurring + oneTimeCurrentMonth),
    };
  }, [plannedList, expendituresList]);

  // Filtered List
  const filteredList = useMemo(() => {
    return plannedList.filter((item) => {
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
  }, [plannedList, selectedCategory, statusFilter, searchQuery]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || !user?.uid) return;
    setSaving(true);
    try {
      const finalCat = category === 'Other' && customCat.trim() ? customCat.trim() : category;
      const numAmt = Number(amount) || 0;

      const newExpense: Omit<PlannedExpense, 'id'> = {
        userId: user.uid,
        title: title.trim(),
        category: finalCat,
        expectedAmount: numAmt,
        actualPaidAmount: 0,
        dueDate: dueDate || new Date().toISOString().split('T')[0],
        paymentStatus: 'pending',
        recurrence,
        notes: notes.trim() || undefined,
        createdAt: new Date(),
      };

      const docRef = await addDoc(collection(db, 'plannedExpenses'), {
        ...newExpense,
        createdAt: serverTimestamp(),
      });

      setPlannedList((prev) => [{ id: docRef.id, ...newExpense }, ...prev]);

      // Reset
      setTitle('');
      setAmount('');
      setDueDate('');
      setNotes('');
      setOpenAddModal(false);
    } catch (e) {
      console.error('Error creating expense:', e);
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

      // 1. Record cash deduction transaction
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

      // 2. Update planned expense document
      if (payingItem.id) {
        const newPaid = (payingItem.actualPaidAmount || 0) + amt;
        const newStatus = newPaid >= payingItem.expectedAmount ? 'paid' : 'partially_paid';

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
    } catch (e) {
      console.error('Failed to pay expense:', e);
    } finally {
      setPaying(false);
    }
  };

  const handleDeleteExpense = async (id?: string) => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this expense plan?')) return;
    try {
      await deleteDoc(doc(db, 'plannedExpenses', id));
      setPlannedList((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error('Error deleting expense:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white antialiased font-sans pb-16">
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col border-x border-white/10 px-4 pt-6 sm:px-5">
        {/* Header */}
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/finance"
              className="p-2 rounded-xl bg-[#121824] border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Expenses & Bills</h1>
              <p className="text-xs text-slate-400">Monthly recurring and planned commitments</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Expense</span>
          </button>
        </header>

        {/* Current Month Expense Metrics */}
        <section className="rounded-[20px] bg-[#141b29] border border-white/10 p-4 mb-4 shadow-md">
          <span className="text-xs text-slate-400 font-medium">Total Expenses For Current Month</span>
          <p className="mt-1 text-3xl font-extrabold text-white tabular-nums">
            {money(monthlyMetrics.totalThisMonth)}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Monthly Recurring</span>
              <span className="text-rose-400 font-bold text-base tabular-nums">
                {money(monthlyMetrics.monthlyRecurring)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[11px]">One-Time (This Month)</span>
              <span className="text-amber-400 font-bold text-base tabular-nums">
                {money(monthlyMetrics.oneTimeCurrentMonth)}
              </span>
            </div>
          </div>
        </section>

        {/* Search & Category Filter */}
        <div className="flex flex-col gap-2 mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses by title or note…"
              className="w-full pl-8 pr-3 py-2 bg-[#121824] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#121824] text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              All Categories
            </button>
            {(PAKISTANI_EXPENSE_CATEGORIES || []).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#121824] text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Expenses List */}
        <div className="flex-1 flex flex-col gap-2.5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading expenses…</div>
          ) : filteredList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 bg-[#121824] rounded-2xl border border-white/5">
              No expenses match your search or filter.
            </div>
          ) : (
            filteredList.map((item) => {
              const isPaid = item.paymentStatus === 'paid';
              return (
                <div
                  key={item.id}
                  className="bg-[#121824] hover:bg-[#161f30] rounded-2xl border border-white/10 p-3.5 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isPaid
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {isPaid ? <CheckCircle2 size={18} /> : <Receipt size={18} />}
                    </div>

                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-white truncate block">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.2 rounded-md">
                          {item.category}
                        </span>
                        <span>•</span>
                        <span className="text-[11px] text-slate-400">
                          {item.dueDate ? `Due: ${item.dueDate}` : 'Recurring'}
                        </span>
                        {item.recurrence !== 'one_time' && (
                          <span className="text-[10px] text-blue-400 capitalize">
                            ({item.recurrence})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="text-sm font-bold text-white tabular-nums block">
                        {money(item.expectedAmount)}
                      </span>
                      {isPaid ? (
                        <span className="text-[10px] text-emerald-400 font-semibold">Fully Paid</span>
                      ) : item.actualPaidAmount && item.actualPaidAmount > 0 ? (
                        <span className="text-[10px] text-amber-400">
                          Paid: {money(item.actualPaidAmount)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-rose-400">Unpaid</span>
                      )}
                    </div>

                    {!isPaid ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPayingItem(item);
                          setPayAmount(String(item.expectedAmount - (item.actualPaidAmount || 0)));
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                      >
                        Pay
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(item.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Add Expense Modal ──────────────────────────────────── */}
      <Dialog
        open={openAddModal}
        onClose={() => setOpenAddModal(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            backgroundColor: '#121824',
            color: '#f8fafc',
            borderRadius: 4,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <form onSubmit={handleCreateExpense}>
          <DialogTitle className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white">Add New Expense</h2>
              <p className="text-xs text-slate-400">Plan recurring or one-time expenses</p>
            </div>
            <button
              type="button"
              onClick={() => setOpenAddModal(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </DialogTitle>

          <DialogContent className="pt-4 flex flex-col gap-3 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Expense Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., LESCO Electricity Bill, School Fees"
                className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Expected Amount (PKR) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Pakistani Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
              >
                {(PAKISTANI_EXPENSE_CATEGORIES || []).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {category === 'Other' && (
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Custom Category Name</label>
                <input
                  type="text"
                  value={customCat}
                  onChange={(e) => setCustomCat(e.target.value)}
                  placeholder="Enter custom category"
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs"
                />
              </div>
            )}

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Recurrence</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as 'one_time' | 'monthly' | 'weekly' | 'yearly')}
                className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="monthly">Monthly Recurring</option>
                <option value="one_time">One-Time Only</option>
                <option value="weekly">Weekly Recurring</option>
                <option value="yearly">Yearly Recurring</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Consumer number, bill details, etc."
                className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </DialogContent>

          <DialogActions className="border-t border-white/10 p-3 flex justify-end gap-2">
            <Button
              onClick={() => setOpenAddModal(false)}
              disabled={saving}
              sx={{ color: '#94a3b8', textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !title.trim() || !amount}
              variant="contained"
              sx={{
                backgroundColor: '#2563eb',
                '&:hover': { backgroundColor: '#1d4ed8' },
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 2,
              }}
            >
              {saving ? 'Saving…' : 'Save Expense'}
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
              backgroundColor: '#121824',
              color: '#f8fafc',
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <form onSubmit={handleExecutePayment}>
            <DialogTitle className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h2 className="text-base font-bold text-white">Pay: {payingItem.title}</h2>
                <p className="text-xs text-slate-400">Deduct payment directly from your selected wallet</p>
              </div>
              <button
                type="button"
                onClick={() => setPayingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </DialogTitle>

            <DialogContent className="pt-4 flex flex-col gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Payment Amount (PKR)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Deduct From Wallet *</label>
                <select
                  required
                  value={payWalletKey}
                  onChange={(e) => setPayWalletKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                >
                  {walletOptions.map((w) => (
                    <option key={w.key} value={w.key}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </DialogContent>

            <DialogActions className="border-t border-white/10 p-3 flex justify-end gap-2">
              <Button
                onClick={() => setPayingItem(null)}
                disabled={paying}
                sx={{ color: '#94a3b8', textTransform: 'none' }}
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
                  fontWeight: 600,
                  borderRadius: 2,
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
