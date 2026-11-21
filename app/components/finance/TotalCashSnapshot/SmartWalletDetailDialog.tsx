'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  ArrowLeftRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  Lock,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Split,
  Trash2,
  Unlock,
  Wallet,
  X,
} from 'lucide-react';
import type { WalletAllocation as AppWalletAllocation } from '@/app/lib/interface';
import type { WalletItem } from '../TotalCashSnapshot';

export type Ownership = {
  id: string;
  name: string;
  color: string;
};

type SubAction = 'ownership' | 'envelope' | null;

const DEFAULT_OWNERS: Ownership[] = [
  { id: 'mine', name: 'My Money', color: '#6366F1' },
  { id: 'amanat', name: 'Amanat', color: '#F59E0B' },
  { id: 'family', name: 'Family', color: '#10B981' },
];

const ENVELOPE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'];

const formatMoney = (n: number) =>
  new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 2,
  }).format(Math.round(Number(n || 0)));

interface SmartWalletDetailDialogProps {
  open: boolean;
  onClose: () => void;
  wallets: WalletItem[];
  activeWalletId: string | null;
  onSelectWallet: (walletId: string) => void;
  isDark: boolean;
  onAddMoney: (wallet: WalletItem) => void;
  onSpendMoney: (wallet: WalletItem) => void;
  onTransfer: (wallet: WalletItem) => void;
  onToggleLock: (walletId: string, currentLock: boolean) => Promise<void>;
  onUpdateAllocations: (
    walletId: string,
    allocations: AppWalletAllocation[],
    reservedAmount: number,
    ownerName: string,
    hasOwnThisMoney: boolean
  ) => Promise<void>;
  onDeleteWallet: (walletId: string) => Promise<void>;
}

function ActionButton({
  icon: Icon,
  label,
  primary = false,
  disabled = false,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition ${
        disabled
          ? 'bg-white/5 text-white/35 cursor-not-allowed'
          : primary
          ? 'bg-white text-indigo-700 hover:bg-indigo-50 cursor-pointer active:scale-95'
          : 'bg-white/10 text-white hover:bg-white/20 cursor-pointer active:scale-95'
      }`}
    >
      <Icon size={19} />
      {label}
    </button>
  );
}

function normalizeOwnerId(ownerName: string): string {
  const lower = ownerName.trim().toLowerCase();
  if (!lower || lower === 'you' || lower === 'self' || lower === 'my money' || lower === 'mine') {
    return 'mine';
  }
  if (lower.includes('amanat')) return 'amanat';
  if (lower.includes('family') || lower.includes('father') || lower.includes('wife') || lower.includes('mother')) {
    return 'family';
  }
  return ownerName.trim();
}

export default function SmartWalletDetailDialog({
  open,
  onClose,
  wallets,
  activeWalletId,
  onSelectWallet,
  isDark,
  onAddMoney,
  onSpendMoney,
  onTransfer,
  onToggleLock,
  onUpdateAllocations,
  onDeleteWallet,
}: SmartWalletDetailDialogProps) {
  const [tab, setTab] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [subAction, setSubAction] = useState<SubAction>(null);
  const [saving, setSaving] = useState(false);

  // Sub-dialog form state
  const [amount, setAmount] = useState('');
  const [ownerId, setOwnerId] = useState('mine');
  const [toOwnerId, setToOwnerId] = useState('amanat');
  const [envelopeName, setEnvelopeName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const wallet = useMemo(
    () => wallets.find((w) => w.id === activeWalletId) ?? null,
    [wallets, activeWalletId]
  );

  useEffect(() => {
    setSuccess('');
    setError('');
  }, [activeWalletId, open]);

  // Derive owners list (defaults + any custom owner present on this wallet)
  const owners = useMemo<Ownership[]>(() => {
    const list = [...DEFAULT_OWNERS];
    if (wallet?.allocations) {
      wallet.allocations.forEach((a) => {
        const id = normalizeOwnerId(a.owner);
        if (!list.some((o) => o.id === id)) {
          list.push({ id, name: a.owner, color: '#8B5CF6' });
        }
      });
    }
    if (wallet && !wallet.hasOwnThisMoney && wallet.owner && wallet.owner !== 'You') {
      const id = normalizeOwnerId(wallet.owner);
      if (!list.some((o) => o.id === id)) {
        list.push({ id, name: wallet.owner, color: '#8B5CF6' });
      }
    }
    return list;
  }, [wallet]);

  // Compute structured ownership & envelope breakdown from real wallet data
  const breakdown = useMemo(() => {
    if (!wallet) {
      return {
        balance: 0,
        reserved: 0,
        unallocated: 0,
        ownerTotals: {} as Record<string, number>,
        envelopes: [] as { id: string; name: string; amount: number; color: string }[],
      };
    }

    const balance = wallet.amount || 0;
    const ownerTotals: Record<string, number> = { mine: 0, amanat: 0, family: 0 };
    const envelopes: { id: string; name: string; amount: number; color: string }[] = [];

    if (wallet.allocations && wallet.allocations.length > 0) {
      let allocatedSum = 0;
      wallet.allocations.forEach((a, idx) => {
        const amt = Number(a.amount) || 0;
        if (amt <= 0) return;
        allocatedSum += amt;
        const oid = normalizeOwnerId(a.owner);
        ownerTotals[oid] = (ownerTotals[oid] || 0) + amt;

        if (a.purpose) {
          envelopes.push({
            id: a.id || `env_${idx}`,
            name: a.purpose,
            amount: amt,
            color: ENVELOPE_COLORS[idx % ENVELOPE_COLORS.length],
          });
        }
      });

      const remainder = Math.max(0, balance - allocatedSum);
      if (remainder > 0) {
        const defaultOwner = wallet.hasOwnThisMoney ? 'mine' : normalizeOwnerId(wallet.owner || 'amanat');
        ownerTotals[defaultOwner] = (ownerTotals[defaultOwner] || 0) + remainder;
      }
    } else {
      const defaultOwner = wallet.hasOwnThisMoney ? 'mine' : normalizeOwnerId(wallet.owner || 'amanat');
      ownerTotals[defaultOwner] = balance;

      if (wallet.reservedAmount && wallet.reservedAmount > 0) {
        envelopes.push({
          id: 'reserved_default',
          name: wallet.purpose || 'Reserved Funds',
          amount: Math.min(balance, wallet.reservedAmount),
          color: ENVELOPE_COLORS[0],
        });
      }
    }

    const inEnvelopes = envelopes.reduce((s, e) => s + e.amount, 0);
    const reserved = Math.min(balance, Math.max(inEnvelopes, wallet.reservedAmount || 0));
    const unallocated = Math.max(0, balance - reserved);

    return { balance, reserved, unallocated, ownerTotals, envelopes };
  }, [wallet]);

  const numericAmount = Number(amount);
  const ownershipSourceBalance = breakdown.ownerTotals[ownerId] || 0;

  const canSubmitSubAction = useMemo(() => {
    if (!wallet || !Number.isFinite(numericAmount) || numericAmount <= 0) return false;
    if (subAction === 'ownership') {
      return ownerId !== toOwnerId && Boolean(toOwnerId) && numericAmount <= ownershipSourceBalance;
    }
    if (subAction === 'envelope') {
      return envelopeName.trim().length > 0 && numericAmount <= breakdown.unallocated;
    }
    return false;
  }, [
    wallet,
    numericAmount,
    subAction,
    ownerId,
    toOwnerId,
    ownershipSourceBalance,
    envelopeName,
    breakdown.unallocated,
  ]);

  if (!wallet) return null;

  const openSubAction = (next: SubAction) => {
    setSubAction(next);
    setAmount('');
    setOwnerId('mine');
    setToOwnerId('amanat');
    setEnvelopeName('');
    setError('');
  };

  const closeSubAction = () => {
    setSubAction(null);
    setError('');
  };

  const handleSubActionSubmit = async () => {
    if (!canSubmitSubAction || !subAction) return;
    setSaving(true);
    setError('');
    try {
      const value = Math.round(numericAmount * 100) / 100;
      const existingAllocs: AppWalletAllocation[] = (wallet.allocations || []).map((a) => ({ ...a }));

      if (subAction === 'ownership') {
        // Seed unallocated remainder if allocations were empty
        const existingSum = existingAllocs.reduce((s, a) => s + (a.amount || 0), 0);
        const unallocRem = Math.max(0, breakdown.balance - existingSum);
        if (unallocRem > 0) {
          existingAllocs.push({
            id: `base_${Date.now()}`,
            owner: wallet.hasOwnThisMoney ? 'You' : wallet.owner || 'Amanat',
            amount: unallocRem,
            isLocked: wallet.isLocked,
          });
        }

        const fromOwnerLabel =
          ownerId === 'mine' ? 'You' : owners.find((o) => o.id === ownerId)?.name || ownerId;
        const toOwnerLabel =
          toOwnerId === 'mine' ? 'You' : owners.find((o) => o.id === toOwnerId)?.name || toOwnerId;

        let remaining = value;
        const nextAllocs: AppWalletAllocation[] = [];

        existingAllocs.forEach((alloc) => {
          if (normalizeOwnerId(alloc.owner) === ownerId && remaining > 0) {
            const take = Math.min(alloc.amount, remaining);
            const left = Math.round((alloc.amount - take) * 100) / 100;
            if (left > 0) nextAllocs.push({ ...alloc, amount: left });
            remaining = Math.round((remaining - take) * 100) / 100;
          } else {
            nextAllocs.push(alloc);
          }
        });

        const existingTargetIdx = nextAllocs.findIndex(
          (a) => normalizeOwnerId(a.owner) === toOwnerId && !a.purpose
        );
        if (existingTargetIdx >= 0) {
          nextAllocs[existingTargetIdx].amount =
            Math.round((nextAllocs[existingTargetIdx].amount + value) * 100) / 100;
        } else {
          nextAllocs.push({
            id: `own_${Date.now()}`,
            owner: toOwnerLabel,
            amount: value,
            isLocked: toOwnerId === 'amanat',
            availabilityStatus: toOwnerId === 'mine' ? 'available' : 'external',
          });
        }

        const selfTotal = nextAllocs
          .filter((a) => normalizeOwnerId(a.owner) === 'mine')
          .reduce((s, a) => s + a.amount, 0);
        const stillOwn = selfTotal > 0;
        const primaryOwner = stillOwn ? 'You' : toOwnerLabel || fromOwnerLabel;

        await onUpdateAllocations(
          wallet.id,
          nextAllocs,
          wallet.reservedAmount || 0,
          primaryOwner,
          stillOwn
        );
        setSuccess('Ownership updated successfully.');
        closeSubAction();
      } else if (subAction === 'envelope') {
        const ownerLabel =
          ownerId === 'mine' ? 'You' : owners.find((o) => o.id === ownerId)?.name || ownerId;

        const nextAllocs: AppWalletAllocation[] = [
          ...existingAllocs,
          {
            id: `env_${Date.now()}`,
            owner: ownerLabel,
            amount: value,
            purpose: envelopeName.trim(),
            reservedAmount: value,
            availabilityStatus: 'reserved',
          },
        ];

        const newReserved = Math.min(
          breakdown.balance,
          (wallet.reservedAmount || 0) + value
        );

        await onUpdateAllocations(
          wallet.id,
          nextAllocs,
          newReserved,
          wallet.owner,
          wallet.hasOwnThisMoney
        );
        setSuccess(`Envelope "${envelopeName.trim()}" created.`);
        closeSubAction();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update wallet.');
    } finally {
      setSaving(false);
    }
  };

  const outlineButtonSx = {
    mt: 1,
    py: 1.3,
    borderRadius: '12px',
    textTransform: 'none' as const,
    fontWeight: 600,
    borderColor: isDark ? 'rgba(129, 140, 248, 0.4)' : '#C7D2FE',
    color: isDark ? '#A5B4FC' : '#4F46E5',
    '&:hover': {
      borderColor: isDark ? '#818CF8' : '#6366F1',
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.06)',
    },
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            backgroundColor: isDark ? '#0f172a' : '#F5F7FB',
            color: isDark ? '#f8fafc' : '#0f172a',
            borderRadius: '26px',
            border: isDark ? '1px solid rgba(148,163,184,0.2)' : '1px solid #e2e8f0',
            overflow: 'hidden',
          },
        }}
      >
        <div className="max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                My Wallets
              </h2>
              <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Money, ownership &amp; envelopes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`rounded-xl p-2.5 ${
                  isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                <Wallet size={20} />
              </div>
              <IconButton
                onClick={onClose}
                aria-label="Close wallet details"
                sx={{ color: isDark ? '#94a3b8' : '#64748b' }}
              >
                <X size={20} />
              </IconButton>
            </div>
          </div>

          {/* Wallet switcher */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {wallets.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectWallet(item.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                  wallet.id === item.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isDark
                    ? 'border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>

          {/* Premium wallet hero card */}
          <div className="relative overflow-hidden rounded-[26px] bg-[#171C39] p-5 text-white shadow-xl shadow-indigo-950/15 sm:p-7">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-400/15 blur-2xl" />

            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/10 p-3">
                    <Wallet size={22} className="text-indigo-200" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{wallet.name}</h3>
                      {wallet.isLocked && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-200 border border-rose-400/30">
                          <Lock size={10} /> Locked
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-indigo-200">
                      {wallet.purpose || 'Multi-ownership wallet'}
                    </p>
                  </div>
                </div>

                <Tooltip title={hidden ? 'Show balance' : 'Hide balance'}>
                  <IconButton
                    onClick={() => setHidden(!hidden)}
                    aria-label={hidden ? 'Show balance' : 'Hide balance'}
                    sx={{ color: '#C7D2FE' }}
                  >
                    {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
                  </IconButton>
                </Tooltip>
              </div>

              <div className="mt-6">
                <p className="text-xs text-indigo-200">Total wallet balance</p>
                <h2 className="mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                  {hidden ? 'Rs. ••••••' : `Rs. ${formatMoney(breakdown.balance)}`}
                </h2>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs text-indigo-200">Unallocated</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {hidden ? '••••' : `Rs. ${formatMoney(breakdown.unallocated)}`}
                  </p>
                </div>

                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-xs text-indigo-200">In envelopes</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {hidden ? '••••' : `Rs. ${formatMoney(breakdown.reserved)}`}
                  </p>
                </div>
              </div>

              {/* Primary actions wired to existing handlers */}
              <div className="mt-5 grid grid-cols-3 gap-2">
                <ActionButton
                  icon={Plus}
                  label="Add"
                  primary
                  onClick={() => {
                    onClose();
                    onAddMoney(wallet);
                  }}
                />
                <ActionButton
                  icon={ArrowUpRight}
                  label="Spend"
                  disabled={wallet.isLocked || breakdown.balance <= 0}
                  onClick={() => {
                    onClose();
                    onSpendMoney(wallet);
                  }}
                />
                <ActionButton
                  icon={ArrowLeftRight}
                  label="Transfer"
                  disabled={wallet.isLocked || breakdown.balance <= 0}
                  onClick={() => {
                    onClose();
                    onTransfer(wallet);
                  }}
                />
              </div>
            </div>
          </div>

          {success && (
            <Alert severity="success" onClose={() => setSuccess('')} sx={{ borderRadius: 3 }}>
              {success}
            </Alert>
          )}

          {/* Money Organization Card (Ownership & Envelopes) */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 ${
              isDark
                ? 'border-slate-700/70 bg-slate-800/70'
                : 'border-slate-100 bg-white shadow-sm'
            }`}
          >
            <div className="mb-3">
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Money organization
              </h3>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Track ownership and reserved funds
              </p>
            </div>

            <Tabs
              value={tab}
              onChange={(_, value: number) => setTab(value)}
              variant="fullWidth"
              sx={{
                mb: 3,
                minHeight: 42,
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  minHeight: 42,
                  color: isDark ? '#94a3b8' : '#64748b',
                },
                '& .Mui-selected': {
                  color: isDark ? '#a5b4fc !important' : '#4f46e5 !important',
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: isDark ? '#818cf8' : '#4f46e5',
                },
              }}
            >
              <Tab label="Ownership" />
              <Tab label="Envelopes" />
            </Tabs>

            {tab === 0 ? (
              <div className="space-y-4">
                {/* Ownership distribution bar */}
                <div
                  className={`flex h-2.5 overflow-hidden rounded-full ${
                    isDark ? 'bg-slate-700' : 'bg-slate-100'
                  }`}
                >
                  {owners.map((owner) => {
                    const amt = breakdown.ownerTotals[owner.id] || 0;
                    return (
                      <div
                        key={owner.id}
                        style={{
                          width: `${breakdown.balance > 0 ? (amt / breakdown.balance) * 100 : 0}%`,
                          backgroundColor: owner.color,
                        }}
                      />
                    );
                  })}
                </div>

                {owners.map((owner) => {
                  const amt = breakdown.ownerTotals[owner.id] || 0;
                  return (
                    <div key={owner.id} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: `${owner.color}20`,
                            color: owner.color,
                          }}
                        >
                          {owner.id === 'amanat' ? (
                            <LockKeyhole size={18} />
                          ) : (
                            <ShieldCheck size={18} />
                          )}
                        </div>
                        <div>
                          <p
                            className={`text-sm font-semibold ${
                              isDark ? 'text-slate-100' : 'text-slate-800'
                            }`}
                          >
                            {owner.name}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                            {breakdown.balance > 0
                              ? Math.round((amt / breakdown.balance) * 100)
                              : 0}
                            % of wallet
                          </p>
                        </div>
                      </div>

                      <p
                        className={`shrink-0 text-sm font-bold tabular-nums ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {hidden ? '••••' : `Rs. ${formatMoney(amt)}`}
                      </p>
                    </div>
                  );
                })}

                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Split size={17} />}
                  onClick={() => openSubAction('ownership')}
                  disabled={breakdown.balance <= 0}
                  sx={outlineButtonSx}
                >
                  Split / Change ownership
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {breakdown.envelopes.length === 0 && (
                  <div
                    className={`rounded-xl p-5 text-center text-sm ${
                      isDark ? 'bg-slate-900/70 text-slate-400' : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    No envelopes created yet.
                  </div>
                )}

                {breakdown.envelopes.map((envelope) => {
                  const percent =
                    breakdown.balance > 0
                      ? Math.min(100, (envelope.amount / breakdown.balance) * 100)
                      : 0;
                  return (
                    <div
                      key={envelope.id}
                      className={`rounded-xl p-4 ${
                        isDark ? 'bg-slate-900/70' : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: envelope.color }}
                          />
                          <p
                            className={`text-sm font-semibold ${
                              isDark ? 'text-slate-100' : 'text-slate-800'
                            }`}
                          >
                            {envelope.name}
                          </p>
                        </div>
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {hidden ? '••••' : `Rs. ${formatMoney(envelope.amount)}`}
                        </p>
                      </div>

                      <div
                        className={`mt-3 h-1.5 overflow-hidden rounded-full ${
                          isDark ? 'bg-slate-700' : 'bg-slate-200'
                        }`}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: envelope.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div
                  className={`flex justify-between text-xs ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <span>Unallocated funds</span>
                  <span className="tabular-nums">Rs. {formatMoney(breakdown.unallocated)}</span>
                </div>

                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Plus size={17} />}
                  onClick={() => openSubAction('envelope')}
                  disabled={breakdown.unallocated <= 0}
                  sx={outlineButtonSx}
                >
                  Create envelope
                </Button>
              </div>
            )}
          </div>

          {/* Security Lock & Delete Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              onClick={() => onToggleLock(wallet.id, wallet.isLocked)}
              variant="outlined"
              size="small"
              color={wallet.isLocked ? 'error' : 'inherit'}
              startIcon={wallet.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
              sx={{
                textTransform: 'none',
                borderRadius: 2,
                color: wallet.isLocked ? undefined : isDark ? '#cbd5e1' : '#475569',
                borderColor: wallet.isLocked
                  ? undefined
                  : isDark
                  ? 'rgba(148,163,184,0.3)'
                  : '#cbd5e1',
              }}
            >
              {wallet.isLocked ? 'Unlock Wallet' : 'Lock Wallet'}
            </Button>

            {wallet.category !== 'built-in' && (
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
                Delete Wallet
              </Button>
            )}
          </div>
        </div>
      </Dialog>

      {/* Sub-dialog: Split / Change Ownership or Create Envelope */}
      <Dialog
        open={subAction !== null}
        onClose={closeSubAction}
        fullWidth
        maxWidth="xs"
        slotProps={{
          paper: {
            sx: {
              m: 2,
              width: 'calc(100% - 32px)',
              borderRadius: '22px',
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              color: isDark ? '#f8fafc' : '#0f172a',
              border: isDark ? '1px solid rgba(148,163,184,0.2)' : '1px solid #e2e8f0',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          {subAction === 'ownership' ? 'Change ownership' : 'Create envelope'}
          <IconButton
            onClick={closeSubAction}
            aria-label="Close"
            sx={{ color: isDark ? '#94a3b8' : '#64748b' }}
          >
            <X size={19} />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <div className="space-y-4 pt-2">
            {subAction === 'envelope' && (
              <TextField
                fullWidth
                size="small"
                label="Envelope name"
                value={envelopeName}
                onChange={(e) => setEnvelopeName(e.target.value)}
                placeholder="e.g. Medical expenses"
              />
            )}

            <TextField
              select
              fullWidth
              size="small"
              label={subAction === 'ownership' ? 'Current owner' : 'Money belongs to'}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              {owners.map((owner) => (
                <MenuItem key={owner.id} value={owner.id}>
                  {owner.name}
                </MenuItem>
              ))}
            </TextField>

            {subAction === 'ownership' && (
              <TextField
                select
                fullWidth
                size="small"
                label="New owner"
                value={toOwnerId}
                onChange={(e) => setToOwnerId(e.target.value)}
              >
                {owners
                  .filter((owner) => owner.id !== ownerId)
                  .map((owner) => (
                    <MenuItem key={owner.id} value={owner.id}>
                      {owner.name}
                    </MenuItem>
                  ))}
              </TextField>
            )}

            <TextField
              fullWidth
              size="small"
              label="Amount (PKR)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              slotProps={{ htmlInput: { min: 1, step: 'any' } }}
            />

            <div
              className={`rounded-xl p-3 ${
                isDark ? 'bg-indigo-500/15 border border-indigo-400/20' : 'bg-indigo-50'
              }`}
            >
              <p className={`text-xs ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                {subAction === 'ownership'
                  ? "Selected owner's total balance"
                  : 'Available unallocated balance'}
              </p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${
                  isDark ? 'text-white' : 'text-indigo-950'
                }`}
              >
                Rs.{' '}
                {formatMoney(
                  subAction === 'ownership' ? ownershipSourceBalance : breakdown.unallocated
                )}
              </p>
            </div>

            {subAction === 'ownership' && (
              <p className={`text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Ownership will be reassigned without changing your total wallet balance.
              </p>
            )}

            {subAction === 'envelope' && (
              <p className={`text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                This reserves existing unallocated money without increasing the wallet balance.
              </p>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </div>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button
            onClick={closeSubAction}
            disabled={saving}
            sx={{ textTransform: 'none', color: isDark ? '#94a3b8' : '#64748b' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={saving || !canSubmitSubAction}
            onClick={handleSubActionSubmit}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              backgroundColor: '#4F46E5',
              '&:hover': { backgroundColor: '#4338CA' },
              boxShadow: 'none',
            }}
          >
            {saving ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

