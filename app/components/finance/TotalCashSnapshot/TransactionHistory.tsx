'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Skeleton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  X,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  History,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { db } from '@/app/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { CashTransaction } from '@/app/lib/interface';
import { PAKISTANI_EXPENSE_CATEGORIES } from '@/app/lib/constant';

interface TransactionHistoryProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-PK')}`;

export default function TransactionHistory({
  open,
  onClose,
  userId,
}: TransactionHistoryProps) {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d' | '90d'>('30d');
  const [typeFilter, setTypeFilter] = useState<'all' | 'add' | 'deduct' | 'transfer' | 'loan'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [walletFilter, setWalletFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Selected Transaction for Detail Modal / Reversal
  const [selectedTxn, setSelectedTxn] = useState<CashTransaction | null>(null);
  const [reversing, setReversing] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!open || !userId) return;
    setLoading(true);
    try {
      // Single-field query avoids requiring a manual Firestore composite index;
      // sort descending by createdAt on the client instead.
      const q = query(
        collection(db, 'cashTransactions'),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const fetched: CashTransaction[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetched.push({
          id: docSnap.id,
          ...data,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate()
              : new Date(data.createdAt || Date.now()),
        } as CashTransaction);
      });

      fetched.sort((a, b) => {
        const aTime =
          a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : a.createdAt instanceof Timestamp
            ? a.createdAt.toMillis()
            : 0;
        const bTime =
          b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : b.createdAt instanceof Timestamp
            ? b.createdAt.toMillis()
            : 0;
        return bTime - aTime;
      });

      setTransactions(fetched.slice(0, 500));
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [open, userId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Extract unique wallets and owners for filter options
  const uniqueWallets = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach((t) => {
      const name =
        t.walletName ||
        t.BankName ||
        t.customPaymentHeadName ||
        (t.source === 'in_hand'
          ? 'Cash in Hand'
          : t.source === 'easypaisa'
          ? 'Easypaisa'
          : t.source === 'jazzcash'
          ? 'JazzCash'
          : t.source);
      if (name) s.add(name);
    });
    return Array.from(s).sort();
  }, [transactions]);

  const uniqueOwners = useMemo(() => {
    const s = new Set<string>();
    transactions.forEach((t) => {
      if (t.ownerName) s.add(t.ownerName);
      if (t.holderName) s.add(t.holderName);
    });
    return Array.from(s).sort();
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const now = Date.now();
    return transactions.filter((t) => {
      // 1. Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const noteMatch = (t.note || '').toLowerCase().includes(q);
        const bankMatch = (t.BankName || '').toLowerCase().includes(q);
        const customMatch = (t.customPaymentHeadName || '').toLowerCase().includes(q);
        const catMatch = (t.expenseCategory || t.category || '').toLowerCase().includes(q);
        const ownerMatch = (t.ownerName || t.holderName || '').toLowerCase().includes(q);
        if (!noteMatch && !bankMatch && !customMatch && !catMatch && !ownerMatch) {
          return false;
        }
      }

      // 2. Date filter
      const tTime =
        t.createdAt instanceof Date
          ? t.createdAt.getTime()
          : t.createdAt instanceof Timestamp
          ? t.createdAt.toMillis()
          : new Date(t.createdAt ? String(t.createdAt) : Date.now()).getTime();
      if (dateFilter === 'today') {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        if (tTime < todayStart) return false;
      } else if (dateFilter === '7d') {
        if (now - tTime > 7 * 86400000) return false;
      } else if (dateFilter === '30d') {
        if (now - tTime > 30 * 86400000) return false;
      } else if (dateFilter === '90d') {
        if (now - tTime > 90 * 86400000) return false;
      }

      // 3. Type filter
      if (typeFilter === 'add' && t.type !== 'add') return false;
      if (typeFilter === 'deduct' && t.type !== 'deduct') return false;
      if (typeFilter === 'transfer' && t.type !== 'transfer') return false;
      if (typeFilter === 'loan' && t.category !== 'loan' && !t.note?.toLowerCase().includes('loan')) {
        return false;
      }

      // 4. Category filter
      if (categoryFilter !== 'all') {
        const c = t.expenseCategory || t.category;
        if (c?.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      }

      // 5. Wallet filter
      if (walletFilter !== 'all') {
        const wName =
          t.walletName ||
          t.BankName ||
          t.customPaymentHeadName ||
          (t.source === 'in_hand'
            ? 'Cash in Hand'
            : t.source === 'easypaisa'
            ? 'Easypaisa'
            : t.source === 'jazzcash'
            ? 'JazzCash'
            : t.source);
        if (wName !== walletFilter) return false;
      }

      // 6. Owner filter
      if (ownerFilter !== 'all') {
        const oName = t.ownerName || t.holderName || 'You';
        if (oName !== ownerFilter) return false;
      }

      // 7. Amount Range
      if (minAmount && t.amount < Number(minAmount)) return false;
      if (maxAmount && t.amount > Number(maxAmount)) return false;

      return true;
    });
  }, [
    transactions,
    searchQuery,
    dateFilter,
    typeFilter,
    categoryFilter,
    walletFilter,
    ownerFilter,
    minAmount,
    maxAmount,
  ]);

  // Reversal Workflow
  const handleReverseTransaction = async (txn: CashTransaction) => {
    if (!confirm(`Are you sure you want to reverse this transaction of ${fmt(txn.amount)}?`)) {
      return;
    }
    setReversing(true);
    try {
      const reverseType = txn.type === 'add' ? 'deduct' : 'add';
      const reversalNote = `Reversal of txn: ${txn.note || txn.id}`;

      // Create opposite transaction
      await addDoc(collection(db, 'cashTransactions'), {
        userId,
        amount: txn.amount,
        type: reverseType,
        source: txn.source,
        category: 'manual',
        note: reversalNote,
        BankName: txn.BankName || null,
        customPaymentHeadName: txn.customPaymentHeadName || null,
        reversalOf: txn.id,
        createdAt: serverTimestamp(),
      });

      // Mark original transaction as reversed
      if (txn.id) {
        await updateDoc(doc(db, 'cashTransactions', txn.id), {
          isReversed: true,
          reversalReason: 'Reversed by user',
        });
      }

      alert('Transaction successfully reversed!');
      setSelectedTxn(null);
      fetchTransactions();
    } catch (e) {
      console.error('Failed to reverse transaction:', e);
      alert('Error reversing transaction.');
    } finally {
      setReversing(false);
    }
  };

  const getSourceDisplay = (t: CashTransaction) => {
    if (t.walletName) return t.walletName;
    if (t.source === 'bank' && t.BankName) return `Bank: ${t.BankName}`;
    if (t.source === 'custom' && t.customPaymentHeadName) return t.customPaymentHeadName;
    if (t.source === 'in_hand') return 'Cash in Hand';
    if (t.source === 'easypaisa') return 'Easypaisa';
    if (t.source === 'jazzcash') return 'JazzCash';
    if (t.source === 'other') return 'Personal Spending';
    return t.source;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          backgroundColor: '#0a0f1d',
          color: '#f8fafc',
          borderRadius: isMobile ? 0 : 4,
          border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
          ...(isMobile ? { width: '100%', maxWidth: '100%', margin: 0 } : {}),
        },
      }}
    >
      <DialogTitle className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <History size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Financial Audit & History</h2>
            <p className="text-xs text-slate-400">
              Search, filter, inspect balance snapshots, and manage reversals
            </p>
          </div>
        </div>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent
        className={`p-3 sm:p-4 flex flex-col gap-3 overflow-y-auto ${
          isMobile ? 'flex-1' : 'max-h-[80vh]'
        }`}
      >
        {/* Search Bar & Quick Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by note, category, wallet, or owner…"
              className="w-full pl-9 pr-3.5 py-2 bg-slate-900/90 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | '7d' | '30d' | '90d')}
              className="px-2.5 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'add' | 'deduct' | 'transfer' | 'loan')}
              className="px-2.5 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="add">Income / Inflows</option>
              <option value="deduct">Expenses / Outflows</option>
              <option value="transfer">Transfers</option>
              <option value="loan">Loans</option>
            </select>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                showAdvancedFilters
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <Filter size={13} />
              <span>More</span>
            </button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="p-3 bg-slate-900/80 border border-white/10 rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white text-xs"
              >
                <option value="all">All Categories</option>
                {(PAKISTANI_EXPENSE_CATEGORIES || []).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Wallet</label>
              <select
                value={walletFilter}
                onChange={(e) => setWalletFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white text-xs"
              >
                <option value="all">All Wallets</option>
                {uniqueWallets.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Owner / Holder</label>
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white text-xs"
              >
                <option value="all">All Owners</option>
                {uniqueOwners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Amount Range (PKR)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  placeholder="Min"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-1/2 px-2 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white text-xs"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-1/2 px-2 py-1.5 bg-slate-950 border border-white/10 rounded-lg text-white text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Transactions Count Bar */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          {loading ? (
            <Skeleton
              variant="text"
              width={140}
              height={18}
              sx={{ bgcolor: 'rgba(255,255,255,0.08)' }}
            />
          ) : (
            <span>Found {filteredTransactions.length} transactions</span>
          )}
          {(searchQuery || categoryFilter !== 'all' || walletFilter !== 'all' || minAmount || maxAmount) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setWalletFilter('all');
                setOwnerFilter('all');
                setMinAmount('');
                setMaxAmount('');
                setTypeFilter('all');
                setDateFilter('30d');
              }}
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Transaction Items List */}
        <div className="flex flex-col gap-2">
          {loading ? (
            <div className="flex flex-col gap-2" aria-label="Loading transactions">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-[#121824] border border-white/10 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Skeleton
                      variant="rounded"
                      width={36}
                      height={36}
                      sx={{ bgcolor: 'rgba(255,255,255,0.08)', borderRadius: '12px', flexShrink: 0 }}
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Skeleton
                        variant="text"
                        width={`${55 + (idx % 3) * 12}%`}
                        height={18}
                        sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
                      />
                      <Skeleton
                        variant="text"
                        width={`${35 + (idx % 2) * 15}%`}
                        height={14}
                        sx={{ bgcolor: 'rgba(255,255,255,0.06)' }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Skeleton
                      variant="text"
                      width={76}
                      height={20}
                      sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}
                    />
                    <Skeleton
                      variant="text"
                      width={52}
                      height={12}
                      sx={{ bgcolor: 'rgba(255,255,255,0.06)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 bg-slate-900/30 rounded-2xl border border-white/5">
              No transactions match your search and filter criteria.
            </div>
          ) : (
            filteredTransactions.map((t) => {
              const isIncome = t.type === 'add';
              const isTransfer = t.type === 'transfer';
              const isReversed = t.isReversed;

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTxn(t)}
                  className={`bg-[#121824] border hover:border-white/20 rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isReversed ? 'border-rose-500/20 opacity-60' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isIncome
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : isTransfer
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft size={17} strokeWidth={2.4} />
                      ) : isTransfer ? (
                        <ArrowRightLeft size={16} strokeWidth={2.2} />
                      ) : (
                        <ArrowUpRight size={17} strokeWidth={2.4} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">
                          {t.note || (isIncome ? 'Deposit / Income' : isTransfer ? 'Transfer' : 'Expense')}
                        </span>
                        {isReversed && (
                          <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.2 rounded-md">
                            Reversed
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                        <span className="text-slate-300 font-medium">
                          {getSourceDisplay(t)}
                        </span>
                        {(t.expenseCategory || t.category) && (
                          <>
                            <span>•</span>
                            <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.2 rounded-md">
                              {t.expenseCategory || t.category}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-slate-500 text-[11px]">
                          {t.createdAt
                            ? (t.createdAt instanceof Date
                                ? t.createdAt
                                : t.createdAt instanceof Timestamp
                                ? t.createdAt.toDate()
                                : new Date(String(t.createdAt))
                              ).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-bold tabular-nums block ${
                        isIncome
                          ? 'text-emerald-400'
                          : isTransfer
                          ? 'text-blue-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {isIncome ? '+' : isTransfer ? '↔ ' : '-'}
                      {fmt(t.amount)}
                    </span>

                    {/* Balance at that moment snapshot */}
                    {t.balanceAfter !== undefined && (
                      <span className="text-[10px] text-slate-500 block">
                        Bal at txn: {fmt(t.balanceAfter)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>

      {/* ── Transaction Detail & Reversal Modal ───────────────── */}
      {selectedTxn && (
        <Dialog
          open={Boolean(selectedTxn)}
          onClose={() => setSelectedTxn(null)}
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
          <DialogTitle className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h2 className="text-base font-bold text-white">Transaction Details</h2>
              <p className="text-xs text-slate-400">Audit breakdown and reversal controls</p>
            </div>
            <IconButton
              size="small"
              onClick={() => setSelectedTxn(null)}
              sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
            >
              <X size={18} />
            </IconButton>
          </DialogTitle>

          <DialogContent className="pt-4 flex flex-col gap-3 text-xs">
            <div className="p-3 bg-slate-900 rounded-xl border border-white/5 flex items-center justify-between">
              <span className="text-slate-400">Amount</span>
              <span
                className={`text-lg font-bold tabular-nums ${
                  selectedTxn.type === 'add'
                    ? 'text-emerald-400'
                    : selectedTxn.type === 'transfer'
                    ? 'text-blue-400'
                    : 'text-rose-400'
                }`}
              >
                {selectedTxn.type === 'add' ? '+' : selectedTxn.type === 'transfer' ? '↔ ' : '-'}
                {fmt(selectedTxn.amount)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-900/60 rounded-xl border border-white/5">
                <span className="text-[10px] text-slate-400 block mb-0.5">Wallet / Account</span>
                <span className="text-slate-200 font-semibold">{getSourceDisplay(selectedTxn)}</span>
              </div>
              <div className="p-2.5 bg-slate-900/60 rounded-xl border border-white/5">
                <span className="text-[10px] text-slate-400 block mb-0.5">Category</span>
                <span className="text-slate-200 font-semibold">
                  {selectedTxn.expenseCategory || selectedTxn.category || 'Standard'}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-xl border border-white/5">
              <span className="text-[10px] text-slate-400 block mb-0.5">Timestamp & Date</span>
              <span className="text-slate-200">
                {selectedTxn.createdAt
                  ? (selectedTxn.createdAt instanceof Date
                      ? selectedTxn.createdAt
                      : selectedTxn.createdAt instanceof Timestamp
                      ? selectedTxn.createdAt.toDate()
                      : new Date(String(selectedTxn.createdAt))
                    ).toLocaleString()
                  : 'N/A'}
              </span>
            </div>

            {/* Critical requirement: Balance at that moment snapshot */}
            <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-blue-300 block">
                  Snapshot Balance At Transaction Moment
                </span>
                <span className="text-[10px] text-slate-400">
                  Historical balance recorded when this transaction was logged
                </span>
              </div>
              <span className="text-sm font-bold text-white tabular-nums">
                {selectedTxn.balanceAfter !== undefined ? fmt(selectedTxn.balanceAfter) : 'Not recorded'}
              </span>
            </div>

            {selectedTxn.note && (
              <div className="p-2.5 bg-slate-900/60 rounded-xl border border-white/5">
                <span className="text-[10px] text-slate-400 block mb-0.5">Note / Description</span>
                <span className="text-slate-200">{selectedTxn.note}</span>
              </div>
            )}

            {selectedTxn.isReversed && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>This transaction has been reversed.</span>
              </div>
            )}
          </DialogContent>

          <DialogActions className="border-t border-white/10 p-3 flex justify-between">
            {!selectedTxn.isReversed ? (
              <Button
                onClick={() => handleReverseTransaction(selectedTxn)}
                disabled={reversing}
                variant="outlined"
                color="error"
                size="small"
                startIcon={<RotateCcw size={14} />}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                {reversing ? 'Reversing…' : 'Reverse Transaction'}
              </Button>
            ) : (
              <span className="text-xs text-rose-400">Already Reversed</span>
            )}
            <Button
              onClick={() => setSelectedTxn(null)}
              sx={{ color: '#94a3b8', textTransform: 'none' }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Dialog>
  );
}
