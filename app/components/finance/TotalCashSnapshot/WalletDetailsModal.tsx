'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
} from '@mui/material';
import {
  X,
  PlusCircle,
  MinusCircle,
  ArrowRightLeft,
  Lock,
  Unlock,
  Settings,
  Users,
  Layers,
  Trash2,
  Building2,
  Smartphone,
  Wallet as WalletIcon,
  ShieldAlert,
  Edit2,
  Check,
} from 'lucide-react';
import {
  WalletAllocation,
  CashTransaction,
} from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

interface WalletDetailsModalProps {
  open: boolean;
  onClose: () => void;
  wallet: {
    id: string;
    name: string;
    walletType: string;
    category: string;
    amount: number;
    color: string;
    initial: string;
    owner: string;
    hasOwnThisMoney: boolean;
    isLocked: boolean;
    isVirtual?: boolean;
    parentWalletKey?: string;
    reservedAmount?: number;
    purpose?: string;
    allocations?: WalletAllocation[];
    subtitle?: string;
  } | null;
  onAddMoney: (walletId: string) => void;
  onSpendMoney: (walletId: string) => void;
  onTransfer: (walletId: string) => void;
  onToggleLock: (walletId: string, currentLock: boolean) => Promise<void>;
  onUpdateAllocations: (
    walletId: string,
    allocations: WalletAllocation[],
    reservedAmount: number,
    ownerName: string,
    hasOwnThisMoney: boolean,
    holderName?: string
  ) => Promise<void>;
  onDeleteWallet: (walletId: string) => Promise<void>;
  userId: string;
}

const fmt = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-PK')}`;

export default function WalletDetailsModal({
  open,
  onClose,
  wallet,
  onAddMoney,
  onSpendMoney,
  onTransfer,
  onToggleLock,
  onUpdateAllocations,
  onDeleteWallet,
  userId,
}: WalletDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [recentTxns, setRecentTxns] = useState<CashTransaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  // Editing state in settings
  const [isEditing, setIsEditing] = useState(false);
  const [ownerIsSelf, setOwnerIsSelf] = useState(true);
  const [ownerName, setOwnerName] = useState('');
  const [reservedInput, setReservedInput] = useState('0');
  const [allocationsList, setAllocationsList] = useState<WalletAllocation[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (wallet) {
      setOwnerIsSelf(wallet.hasOwnThisMoney);
      setOwnerName(wallet.owner === 'You' ? '' : wallet.owner);
      setReservedInput(String(wallet.reservedAmount || 0));
      setAllocationsList(wallet.allocations || []);
    }
  }, [wallet]);

  // Fetch recent transactions for this wallet
  useEffect(() => {
    if (!wallet || !open || !userId) return;
    const fetchWalletTxns = async () => {
      setLoadingTxns(true);
      try {
        const q = query(
          collection(db, 'cashTransactions'),
          where('userId', '==', userId)
        );
        const snap = await getDocs(q);
        const matched: CashTransaction[] = [];
        snap.forEach((d) => {
          const data = d.data() as CashTransaction;
          // Check if matches this wallet by bank, custom, or source type
          const isMatch =
            (wallet.id.startsWith('bank:') && data.BankName === wallet.id.replace('bank:', '')) ||
            (wallet.id.startsWith('custom:') &&
              data.customPaymentHeadName === wallet.id.replace('custom:', '')) ||
            (data.source === wallet.id) ||
            (data.walletName && data.walletName.toLowerCase() === wallet.name.toLowerCase());
          if (isMatch) {
            matched.push({
              id: d.id,
              ...data,
              createdAt:
                data.createdAt instanceof Timestamp
                  ? data.createdAt.toDate()
                  : data.createdAt instanceof Date
                  ? data.createdAt
                  : new Date(String(data.createdAt)),
            });
          }
        });
        matched.sort((a, b) => {
          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
          return bTime - aTime;
        });
        setRecentTxns(matched.slice(0, 6));
      } catch (e) {
        console.warn('Error fetching recent wallet txns:', e);
      } finally {
        setLoadingTxns(false);
      }
    };
    fetchWalletTxns();
  }, [wallet, open, userId]);

  if (!wallet) return null;

  // Financial calculations
  const totalBalance = wallet.amount || 0;
  const reservedBalance = Number(wallet.reservedAmount || 0);
  
  // Available balance excludes locked funds and other owners' allocations
  let availableBalance = totalBalance;
  if (wallet.isLocked) {
    availableBalance = 0;
  } else if (!wallet.hasOwnThisMoney) {
    availableBalance = 0;
  } else {
    availableBalance = Math.max(0, totalBalance - reservedBalance);
  }

  // Type Icon
  const getWalletTypeIcon = (type: string) => {
    switch (type) {
      case 'bank':
        return <Building2 size={16} className="text-blue-400" />;
      case 'mobile_wallet':
        return <Smartphone size={16} className="text-emerald-400" />;
      case 'virtual':
        return <Layers size={16} className="text-purple-400" />;
      default:
        return <WalletIcon size={16} className="text-amber-400" />;
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const finalReserved = Number(reservedInput) || 0;
      await onUpdateAllocations(
        wallet.id,
        allocationsList,
        finalReserved,
        ownerIsSelf ? 'You' : ownerName.trim() || 'Someone else',
        ownerIsSelf
      );
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to update wallet settings:', e);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          backgroundColor: '#0d131f',
          color: '#f8fafc',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      }}
    >
      <DialogTitle className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-md"
            style={{ backgroundColor: wallet.color }}
          >
            {wallet.initial}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">{wallet.name}</h2>
              {wallet.isLocked && (
                <span className="flex items-center gap-1 text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full">
                  <Lock size={11} /> Locked
                </span>
              )}
              {wallet.isVirtual && (
                <span className="text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full">
                  Virtual Bucket
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              {getWalletTypeIcon(wallet.walletType)}
              <span className="capitalize">{wallet.walletType.replace('_', ' ')}</span>
              <span>•</span>
              <span>Owner: {wallet.owner}</span>
            </div>
          </div>
        </div>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      {/* Tabs: Overview vs Settings */}
      <div className="flex border-b border-white/10 bg-slate-900/60 px-4">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Wallet Overview & Actions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'settings'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings size={14} />
          <span>Administrative Settings</span>
        </button>
      </div>

      <DialogContent className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
        {activeTab === 'overview' ? (
          <>
            {/* Balance Overview Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-900/90 border border-white/10 p-3 rounded-2xl flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-400">Total Balance</span>
                <span className="text-base font-bold text-white tabular-nums">
                  {fmt(totalBalance)}
                </span>
                <span className="text-[10px] text-slate-500">Gross recorded</span>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-2xl flex flex-col gap-1">
                <span className="text-[11px] font-medium text-emerald-400">Available to Spend</span>
                <span className="text-base font-bold text-emerald-400 tabular-nums">
                  {fmt(availableBalance)}
                </span>
                <span className="text-[10px] text-emerald-400/70">Personally usable</span>
              </div>

              <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-2xl flex flex-col gap-1">
                <span className="text-[11px] font-medium text-amber-400">Reserved / Planned</span>
                <span className="text-base font-bold text-amber-300 tabular-nums">
                  {fmt(reservedBalance)}
                </span>
                <span className="text-[10px] text-amber-400/70">Not spendable</span>
              </div>
            </div>

            {/* Security Lock Notice if locked */}
            {wallet.isLocked && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
                <ShieldAlert size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <div>
                  <strong className="font-semibold block">Security Lock Active</strong>
                  Spending and transfers from this wallet are restricted for security. To operate, unlock the wallet in Settings below.
                </div>
              </div>
            )}

            {/* Non-self owner notice */}
            {!wallet.hasOwnThisMoney && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-2.5 text-xs text-blue-300">
                <Users size={16} className="shrink-0 mt-0.5 text-blue-400" />
                <div>
                  <strong className="font-semibold block">Belongs to: {wallet.owner}</strong>
                  This money belongs to someone else (or an external party) and is excluded from your personal spendable overview.
                </div>
              </div>
            )}

            {/* Primary Action Buttons: Add, Spend, Transfer */}
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-2">
                Primary Financial Actions
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAddMoney(wallet.id);
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl transition-all cursor-pointer font-semibold text-xs"
                >
                  <PlusCircle size={18} className="text-emerald-400" />
                  <span>Add Money</span>
                </button>

                <button
                  type="button"
                  disabled={wallet.isLocked || availableBalance <= 0}
                  onClick={() => {
                    onClose();
                    onSpendMoney(wallet.id);
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl transition-all font-semibold text-xs border ${
                    wallet.isLocked || availableBalance <= 0
                      ? 'bg-slate-800/50 border-white/5 text-slate-500 cursor-not-allowed'
                      : 'bg-rose-600/20 hover:bg-rose-600/30 border-rose-500/40 text-rose-300 cursor-pointer'
                  }`}
                >
                  <MinusCircle size={18} className={wallet.isLocked ? 'text-slate-500' : 'text-rose-400'} />
                  <span>Spend</span>
                </button>

                <button
                  type="button"
                  disabled={wallet.isLocked || availableBalance <= 0}
                  onClick={() => {
                    onClose();
                    onTransfer(wallet.id);
                  }}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl transition-all font-semibold text-xs border ${
                    wallet.isLocked || availableBalance <= 0
                      ? 'bg-slate-800/50 border-white/5 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/40 text-blue-300 cursor-pointer'
                  }`}
                >
                  <ArrowRightLeft size={18} className={wallet.isLocked ? 'text-slate-500' : 'text-blue-400'} />
                  <span>Transfer</span>
                </button>
              </div>
            </div>

            {/* Purpose & Allocations Breakdown */}
            {(wallet.purpose || (wallet.allocations && wallet.allocations.length > 0)) && (
              <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Allocations & Purpose</span>
                  {wallet.purpose && (
                    <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-white/10">
                      🎯 {wallet.purpose}
                    </span>
                  )}
                </div>

                {wallet.allocations && wallet.allocations.length > 0 ? (
                  <div className="flex flex-col gap-1.5 mt-1">
                    {wallet.allocations.map((a, i) => (
                      <div
                        key={a.id || i}
                        className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-800/60 rounded-lg border border-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{a.owner}</span>
                          {a.purpose && (
                            <span className="text-[10px] text-slate-400">({a.purpose})</span>
                          )}
                          {a.isLocked && <Lock size={12} className="text-rose-400" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold tabular-nums text-white">{fmt(a.amount)}</span>
                          {a.reservedAmount ? (
                            <span className="text-[10px] text-amber-400">
                              (Res: {fmt(a.reservedAmount)})
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {/* Recent Transactions in this Wallet */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">Recent Transactions</span>
                <span className="text-[11px] text-slate-500">
                  {recentTxns.length} recorded
                </span>
              </div>

              {loadingTxns ? (
                <div className="py-4 text-center text-xs text-slate-400">Loading activity…</div>
              ) : recentTxns.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-white/5">
                  No recent transactions recorded for this wallet yet.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {recentTxns.map((t) => {
                    const isIncome = t.type === 'add';
                    const isTransfer = t.type === 'transfer';
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between py-2 px-3 bg-slate-900/60 border border-white/5 rounded-xl text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200">
                            {t.note || (isIncome ? 'Deposit' : isTransfer ? 'Transfer' : 'Expense')}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {t.createdAt
                              ? (t.createdAt instanceof Date
                                  ? t.createdAt
                                  : t.createdAt instanceof Timestamp
                                  ? t.createdAt.toDate()
                                  : new Date(String(t.createdAt))
                                ).toLocaleDateString()
                              : ''}
                            {t.balanceAfter !== undefined ? ` • Bal: ${fmt(t.balanceAfter)}` : ''}
                          </span>
                        </div>
                        <span
                          className={`font-bold tabular-nums ${
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── Administrative Settings View ─────────────────────── */
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-slate-900/80 rounded-2xl border border-white/10 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Security & Operational Lock
              </h3>
              <p className="text-xs text-slate-400">
                A security lock prevents any accidental spending, deductions, or transfers from this wallet.
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-300 font-medium">Wallet Lock Status:</span>
                <Button
                  onClick={() => onToggleLock(wallet.id, wallet.isLocked)}
                  variant="outlined"
                  size="small"
                  color={wallet.isLocked ? 'error' : 'inherit'}
                  startIcon={wallet.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  {wallet.isLocked ? 'Unlock Wallet' : 'Lock Wallet'}
                </Button>
              </div>
            </div>

            {/* Ownership & Reservations Edit */}
            <div className="p-3 bg-slate-900/80 rounded-2xl border border-white/10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Ownership & Reserved Funds
                </h3>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={savingSettings}
                      onClick={handleSaveSettings}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                    >
                      <Check size={14} /> {savingSettings ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {!isEditing ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Primary Owner</span>
                    <span className="text-slate-200 font-semibold">{wallet.owner}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Reserved Amount</span>
                    <span className="text-amber-400 font-semibold">{fmt(Number(wallet.reservedAmount || 0))}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 text-xs pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Does this money belong to you?
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                        <input
                          type="radio"
                          name="ownershipSelf"
                          checked={ownerIsSelf}
                          onChange={() => setOwnerIsSelf(true)}
                          className="accent-blue-500"
                        />
                        <span>Yes, belongs to me (Spendable)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                        <input
                          type="radio"
                          name="ownershipSelf"
                          checked={!ownerIsSelf}
                          onChange={() => setOwnerIsSelf(false)}
                          className="accent-blue-500"
                        />
                        <span>Someone else</span>
                      </label>
                    </div>
                  </div>

                  {!ownerIsSelf && (
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Owner Name</label>
                      <input
                        type="text"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="e.g., Father, Client, Business partner"
                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Reserved Amount (PKR) - affects spendable balance without locking the wallet:
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={totalBalance}
                      value={reservedInput}
                      onChange={(e) => setReservedInput(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Danger Zone: Delete / Archive */}
            {wallet.category !== 'built-in' && (
              <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-rose-300">Delete Wallet</h4>
                  <p className="text-[11px] text-slate-400">
                    Permanently delete this custom or bank wallet and remove it from snapshot.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ${wallet.name}?`)) {
                      onDeleteWallet(wallet.id);
                    }
                  }}
                  variant="outlined"
                  size="small"
                  color="error"
                  startIcon={<Trash2 size={14} />}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
