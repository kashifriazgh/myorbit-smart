'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
} from '@mui/material';
import {
  X,
  Wallet as WalletIcon,
  Building2,
  Smartphone,
  Layers,
  Plus,
  Trash2,
  Lock,
  Info,
} from 'lucide-react';
import { WalletType, WalletAllocation } from '@/app/lib/interface';

interface CreateWalletModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (walletData: {
    name: string;
    walletType: WalletType;
    openingBalance: number;
    initialOwner: string;
    isLocked: boolean;
    isVirtual: boolean;
    parentWalletKey?: string;
    purpose?: string;
    color: string;
    notes?: string;
    allocations?: WalletAllocation[];
  }) => Promise<void>;
  saving: boolean;
  existingWallets: { id: string; name: string; type: string }[];
}

const WALLET_TYPES: {
  type: WalletType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  {
    type: 'cash',
    label: 'Cash',
    desc: 'Physical money in hand, drawer, or safe',
    icon: WalletIcon,
  },
  {
    type: 'bank',
    label: 'Bank Account',
    desc: 'HBL, Meezan, Alfalah, Standard Chartered, etc.',
    icon: Building2,
  },
  {
    type: 'mobile_wallet',
    label: 'Mobile Wallet',
    desc: 'Easypaisa, JazzCash, SadaPay, NayaPay',
    icon: Smartphone,
  },
  {
    type: 'virtual',
    label: 'Virtual Wallet',
    desc: 'Budget bucket or savings envelope (links to funds in an existing wallet without duplicate money)',
    icon: Layers,
  },
];

const PRESET_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#14b8a6', // teal
  '#ef4444', // red
  '#6366f1', // indigo
];

export default function CreateWalletModal({
  open,
  onClose,
  onSave,
  saving,
  existingWallets,
}: CreateWalletModalProps) {
  const [name, setName] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('cash');
  const [openingBalance, setOpeningBalance] = useState('');
  const [initialOwner, setInitialOwner] = useState('You');
  const [parentWalletKey, setParentWalletKey] = useState('');
  const [purpose, setPurpose] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [notes, setNotes] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  // Multi-owner allocations toggle
  const [enableMultiOwner, setEnableMultiOwner] = useState(false);
  const [allocations, setAllocations] = useState<
    { id: string; owner: string; amount: string; purpose: string; reserved: string; isLocked: boolean }[]
  >([
    { id: '1', owner: 'You', amount: '', purpose: 'General Spending', reserved: '0', isLocked: false },
  ]);

  const addAllocationRow = () => {
    setAllocations((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        owner: '',
        amount: '',
        purpose: '',
        reserved: '0',
        isLocked: false,
      },
    ]);
  };

  const removeAllocationRow = (index: number) => {
    setAllocations((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAllocation = (index: number, field: string, val: string | boolean) => {
    setAllocations((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let finalAllocations: WalletAllocation[] | undefined = undefined;
    if (enableMultiOwner && allocations.length > 0) {
      finalAllocations = allocations
        .filter((a) => a.owner.trim())
        .map((a) => ({
          id: a.id,
          owner: a.owner.trim(),
          amount: Number(a.amount) || 0,
          purpose: a.purpose.trim() || undefined,
          reservedAmount: Number(a.reserved) || 0,
          isLocked: a.isLocked,
          availabilityStatus: a.isLocked
            ? 'locked'
            : (Number(a.reserved) || 0) > 0
            ? 'reserved'
            : 'available',
        }));
    }

    const isVirtual = walletType === 'virtual';

    await onSave({
      name: name.trim(),
      walletType,
      openingBalance: Number(openingBalance) || 0,
      initialOwner: initialOwner.trim() || 'You',
      isLocked,
      isVirtual,
      parentWalletKey: isVirtual ? parentWalletKey : undefined,
      purpose: purpose.trim() || undefined,
      color,
      notes: notes.trim() || undefined,
      allocations: finalAllocations,
    });

    // Reset form
    setName('');
    setOpeningBalance('');
    setInitialOwner('You');
    setParentWalletKey('');
    setPurpose('');
    setNotes('');
    setIsLocked(false);
    setEnableMultiOwner(false);
    setAllocations([{ id: '1', owner: 'You', amount: '', purpose: 'General Spending', reserved: '0', isLocked: false }]);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          backgroundColor: '#121824',
          color: '#f8fafc',
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: color }}
            >
              <WalletIcon size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Create New Wallet</h2>
              <p className="text-xs text-slate-400">Configure balance, ownership, and allocation</p>
            </div>
          </div>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent className="pt-4 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {/* Wallet Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Wallet Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., HBL Salary Account, Meezan Savings, Cash In Hand"
              className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Wallet Type Selection (4 types) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Wallet Type</label>
            <div className="grid grid-cols-2 gap-2">
              {WALLET_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = walletType === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setWalletType(t.type)}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-900/50 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={isSelected ? 'text-blue-400' : 'text-slate-400'} />
                      <span className="text-sm font-semibold">{t.label}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 leading-snug">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* If Virtual Wallet, select underlying source wallet to avoid duplicate money */}
          {walletType === 'virtual' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <Info size={15} />
                <span>Virtual Wallet Duplicate Prevention</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                Virtual wallets represent earmarked portions of funds (e.g., an Emergency Bucket or Eid Envelope).
                They will <strong>not create duplicate money</strong> when calculating total recorded wealth.
              </p>
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Backing Source Wallet (Optional):
                </label>
                <select
                  value={parentWalletKey}
                  onChange={(e) => setParentWalletKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Standalone Virtual Bucket --</option>
                  {existingWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Opening Balance & Primary Owner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Opening Balance (PKR)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Primary Owner
              </label>
              <input
                type="text"
                value={initialOwner}
                onChange={(e) => setInitialOwner(e.target.value)}
                placeholder="You (or Father, Wife, Business)"
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Color & Purpose */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Wallet Purpose
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g., Grocery, Savings, Utility bills"
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Card Theme Color
              </label>
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                      color === c ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Security Lock Toggle */}
          <div className="p-3 bg-slate-900/50 border border-white/10 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={16} className={isLocked ? 'text-amber-400' : 'text-slate-400'} />
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  Security Lock Wallet
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Prevents spending & transfers from this wallet until explicitly unlocked
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isLocked}
              onChange={(e) => setIsLocked(e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
          </div>

          {/* Multi-Owner Allocations Section */}
          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  Multiple Owners & Allocations (Optional)
                </span>
                <span className="text-[11px] text-slate-400">
                  Track shared money, partial reservations, and individual limits
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEnableMultiOwner(!enableMultiOwner)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                  enableMultiOwner
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                    : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {enableMultiOwner ? 'Enabled' : 'Enable'}
              </button>
            </div>

            {enableMultiOwner && (
              <div className="flex flex-col gap-2 mt-2 bg-slate-900/60 p-3 rounded-xl border border-white/10">
                <div className="text-[11px] text-slate-400">
                  Funds allocated to other owners do not count toward your personally spendable balance.
                </div>
                {allocations.map((alloc, idx) => (
                  <div
                    key={alloc.id}
                    className="p-2.5 bg-slate-800/80 border border-white/10 rounded-lg flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">Allocation #{idx + 1}</span>
                      {allocations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAllocationRow(idx)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Owner</label>
                        <input
                          type="text"
                          value={alloc.owner}
                          onChange={(e) => updateAllocation(idx, 'owner', e.target.value)}
                          placeholder="e.g. You, Father, Client"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Amount (PKR)</label>
                        <input
                          type="number"
                          value={alloc.amount}
                          onChange={(e) => updateAllocation(idx, 'amount', e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Purpose</label>
                        <input
                          type="text"
                          value={alloc.purpose}
                          onChange={(e) => updateAllocation(idx, 'purpose', e.target.value)}
                          placeholder="e.g. Emergency, Rent"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">
                          Reserved Amount (PKR)
                        </label>
                        <input
                          type="number"
                          value={alloc.reserved}
                          onChange={(e) => updateAllocation(idx, 'reserved', e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAllocationRow}
                  className="mt-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 border border-dashed border-blue-500/40 rounded-lg"
                >
                  <Plus size={14} /> Add Another Allocation
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details about this wallet..."
              className="w-full px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </DialogContent>

        <DialogActions className="border-t border-white/10 px-5 py-3 flex justify-end gap-2">
          <Button
            onClick={onClose}
            disabled={saving}
            sx={{ color: '#94a3b8', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || !name.trim()}
            variant="contained"
            sx={{
              backgroundColor: '#2563eb',
              '&:hover': { backgroundColor: '#1d4ed8' },
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2.5,
              px: 3,
            }}
          >
            {saving ? 'Creating…' : 'Create Wallet'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
