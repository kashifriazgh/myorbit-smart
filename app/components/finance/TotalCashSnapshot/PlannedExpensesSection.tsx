'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  Clock,
  Receipt,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
} from '@mui/material';
import {
  PlannedExpense,
} from '@/app/lib/interface';
import { PAKISTANI_EXPENSE_CATEGORIES } from '@/app/lib/constant';
import { db } from '@/app/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

interface PlannedExpensesSectionProps {
  userId: string;
  wallets: { id: string; name: string; amount: number }[];
  onPayExpense: (expense: PlannedExpense, walletId: string, paidAmount: number) => Promise<void>;
  balancesVisible: boolean;
}

const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-PK')}`;

export default function PlannedExpensesSection({
  userId,
  wallets,
  onPayExpense,
  balancesVisible,
}: PlannedExpensesSectionProps) {
  const [expenses, setExpenses] = useState<PlannedExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [openAddModal, setOpenAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(
    PAKISTANI_EXPENSE_CATEGORIES?.[1] || 'Bills & Utilities'
  );
  const [customCategory, setCustomCategory] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState<'one_time' | 'monthly' | 'weekly' | 'yearly'>('monthly');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Pay modal
  const [payingExpense, setPayingExpense] = useState<PlannedExpense | null>(null);
  const [payWalletId, setPayWalletId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [paying, setPaying] = useState(false);

  // Fetch planned expenses
  const fetchExpenses = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'plannedExpenses'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const list: PlannedExpense[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PlannedExpense, 'id'>),
      }));

      // If user has no planned expenses yet, initialize with default Pakistani commitments!
      if (list.length === 0) {
        const defaults: Omit<PlannedExpense, 'id'>[] = [
          {
            userId,
            title: 'Electricity bill (LESCO/K-Electric)',
            category: 'Bills & Utilities',
            expectedAmount: 8500,
            actualPaidAmount: 0,
            dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
            paymentStatus: 'pending',
            recurrence: 'monthly',
            notes: 'Due by 5th of the month',
            createdAt: new Date(),
          },
          {
            userId,
            title: 'Monthly Groceries',
            category: 'Groceries',
            expectedAmount: 25000,
            actualPaidAmount: 0,
            dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
            paymentStatus: 'pending',
            recurrence: 'monthly',
            notes: 'Ration & supermarket staples',
            createdAt: new Date(),
          },
          {
            userId,
            title: 'Internet Fiber Bill',
            category: 'Mobile & Internet',
            expectedAmount: 3500,
            actualPaidAmount: 0,
            dueDate: new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0],
            paymentStatus: 'pending',
            recurrence: 'monthly',
            notes: 'StormFiber / Nayatel broadband',
            createdAt: new Date(),
          },
        ];

        for (const item of defaults) {
          const docRef = await addDoc(collection(db, 'plannedExpenses'), {
            ...item,
            createdAt: serverTimestamp(),
          });
          list.push({ id: docRef.id, ...item });
        }
      }

      setExpenses(list);
    } catch (e) {
      console.warn('Error fetching planned expenses:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleCreatePlannedExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !expectedAmount || !userId) return;
    setSaving(true);
    try {
      const chosenCategory = category === 'Other' && customCategory.trim() ? customCategory.trim() : category;
      const newPlan: Omit<PlannedExpense, 'id'> = {
        userId,
        title: title.trim(),
        category: chosenCategory,
        expectedAmount: Number(expectedAmount) || 0,
        actualPaidAmount: 0,
        dueDate: dueDate || new Date().toISOString().split('T')[0],
        paymentStatus: 'pending',
        walletId: selectedWalletId || undefined,
        walletName: wallets.find((w) => w.id === selectedWalletId)?.name,
        recurrence,
        notes: notes.trim() || undefined,
        createdAt: new Date(),
      };

      const docRef = await addDoc(collection(db, 'plannedExpenses'), {
        ...newPlan,
        createdAt: serverTimestamp(),
      });

      setExpenses((prev) => [{ id: docRef.id, ...newPlan }, ...prev]);

      // Reset
      setTitle('');
      setExpectedAmount('');
      setDueDate('');
      setNotes('');
      setOpenAddModal(false);
    } catch (err) {
      console.error('Error creating planned expense:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingExpense || !payWalletId || !payAmount) return;
    setPaying(true);
    try {
      const amt = Number(payAmount) || 0;
      await onPayExpense(payingExpense, payWalletId, amt);

      // Update state locally
      setExpenses((prev) =>
        prev.map((item) =>
          item.id === payingExpense.id
            ? {
                ...item,
                actualPaidAmount: (item.actualPaidAmount || 0) + amt,
                paymentStatus:
                  (item.actualPaidAmount || 0) + amt >= item.expectedAmount ? 'paid' : 'partially_paid',
              }
            : item
        )
      );

      setPayingExpense(null);
      setPayAmount('');
    } catch (e) {
      console.error('Error paying expense:', e);
    } finally {
      setPaying(false);
    }
  };

  // Group budgets and commitments
  const totalPlanned = expenses.reduce((acc, curr) => acc + (curr.expectedAmount || 0), 0);
  const totalPaid = expenses.reduce((acc, curr) => acc + (curr.actualPaidAmount || 0), 0);
  const pendingCommitments = expenses.filter((e) => e.paymentStatus !== 'paid');

  return (
    <div className="flex flex-col gap-4">
      {/* Top Banner / Budget Utilization */}
      <div className="bg-[#121824] border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-blue-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Upcoming Expenses & Commitments
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setOpenAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-all"
          >
            <Plus size={14} />
            <span>Add Planned</span>
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
            <span className="text-[11px] text-slate-400 block font-medium">Expected Total</span>
            <span className="text-base font-bold text-white tabular-nums">
              {balancesVisible ? fmt(totalPlanned) : 'Rs. •••••'}
            </span>
          </div>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
            <span className="text-[11px] text-slate-400 block font-medium">Already Paid</span>
            <span className="text-base font-bold text-emerald-400 tabular-nums">
              {balancesVisible ? fmt(totalPaid) : 'Rs. •••••'}
            </span>
          </div>
        </div>

        {/* Utilization Bar */}
        {totalPlanned > 0 && (
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Budget Utilization</span>
              <span className="font-semibold text-slate-300">
                {Math.round((totalPaid / totalPlanned) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((totalPaid / totalPlanned) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Commitments List */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-400">
          Due Commitments ({pendingCommitments.length} pending)
        </span>

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading planned expenses…</div>
        ) : expenses.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 bg-slate-900/30 rounded-2xl border border-white/5">
            No planned expenses added yet. Tap &quot;Add Planned&quot; above to track upcoming bills.
          </div>
        ) : (
          expenses.map((item) => {
            const isPaid = item.paymentStatus === 'paid';
            return (
              <div
                key={item.id}
                className="bg-[#121824] border border-white/10 hover:border-white/20 rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isPaid
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {isPaid ? <CheckCircle2 size={18} /> : <Receipt size={18} />}
                  </div>

                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-white truncate block">
                      {item.title}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-white/5">
                        {item.category}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock size={11} />
                        {item.dueDate ? `Due ${item.dueDate}` : 'Recurring'}
                      </span>
                      {item.recurrence !== 'one_time' && (
                        <span className="text-[10px] text-blue-400 capitalize">
                          ({item.recurrence})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-sm font-bold text-white tabular-nums block">
                      {balancesVisible ? fmt(item.expectedAmount) : 'Rs. •••••'}
                    </span>
                    {isPaid ? (
                      <span className="text-[10px] text-emerald-400 font-semibold">Fully Paid</span>
                    ) : item.actualPaidAmount && item.actualPaidAmount > 0 ? (
                      <span className="text-[10px] text-amber-400">
                        Paid: {fmt(item.actualPaidAmount)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-400">Unpaid</span>
                    )}
                  </div>

                  {!isPaid && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayingExpense(item);
                        setPayAmount(String(item.expectedAmount - (item.actualPaidAmount || 0)));
                        setPayWalletId(wallets[0]?.id || '');
                      }}
                      className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl cursor-pointer transition-all"
                    >
                      Pay
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Add Planned Expense Modal ─────────────────────────── */}
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
        <form onSubmit={handleCreatePlannedExpense}>
          <DialogTitle className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white">Add Planned Expense</h2>
              <p className="text-xs text-slate-400">
                Plan ahead without immediately deducting wallet funds
              </p>
            </div>
            <IconButton
              size="small"
              onClick={() => setOpenAddModal(false)}
              sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
            >
              <X size={18} />
            </IconButton>
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
                  value={expectedAmount}
                  onChange={(e) => setExpectedAmount(e.target.value)}
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

            {/* Standard Pakistani Categories Dropdown */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1">Category</label>
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
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Enter custom category"
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Recurrence</label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as 'one_time' | 'monthly' | 'weekly' | 'yearly')}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="one_time">One-time</option>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Preferred Wallet</label>
                <select
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="">Any wallet</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Consumer number, bill reference, etc."
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
              disabled={saving || !title.trim() || !expectedAmount}
              variant="contained"
              sx={{
                backgroundColor: '#2563eb',
                '&:hover': { backgroundColor: '#1d4ed8' },
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 2,
              }}
            >
              {saving ? 'Saving…' : 'Save Plan'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* ── Pay Expense Modal ─────────────────────────────────── */}
      {payingExpense && (
        <Dialog
          open={Boolean(payingExpense)}
          onClose={() => setPayingExpense(null)}
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
                <h2 className="text-base font-bold text-white">Pay: {payingExpense.title}</h2>
                <p className="text-xs text-slate-400">
                  Deduct payment directly from your selected wallet
                </p>
              </div>
              <IconButton
                size="small"
                onClick={() => setPayingExpense(null)}
                sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
              >
                <X size={18} />
              </IconButton>
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
                  value={payWalletId}
                  onChange={(e) => setPayWalletId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({fmt(w.amount)})
                    </option>
                  ))}
                </select>
              </div>
            </DialogContent>

            <DialogActions className="border-t border-white/10 p-3 flex justify-end gap-2">
              <Button
                onClick={() => setPayingExpense(null)}
                disabled={paying}
                sx={{ color: '#94a3b8', textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={paying || !payAmount || !payWalletId}
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
