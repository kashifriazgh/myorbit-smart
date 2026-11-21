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
  Sparkles,
} from 'lucide-react';
import { WalletType, WalletAllocation } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';

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

type PredefinedTemplateKey = 'qurbani' | 'wedding' | 'emergency' | 'amanat';

function TemplateIcon({ template }: { template: PredefinedTemplateKey }) {
  if (template === 'qurbani') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
        <path d="M9 7C7 5.2 6.4 3.2 8 2" fill="none" stroke="#d6b36a" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M15 7c2-1.8 2.6-3.8 1-5" fill="none" stroke="#d6b36a" strokeWidth="1.7" strokeLinecap="round" />
        <ellipse cx="5" cy="10.5" rx="3" ry="1.5" transform="rotate(-25 5 10.5)" fill="#e7e5e4" />
        <ellipse cx="19" cy="10.5" rx="3" ry="1.5" transform="rotate(25 19 10.5)" fill="#e7e5e4" />
        <ellipse cx="5.2" cy="10.5" rx="1.6" ry="0.7" transform="rotate(-25 5.2 10.5)" fill="#f9a8d4" />
        <ellipse cx="18.8" cy="10.5" rx="1.6" ry="0.7" transform="rotate(25 18.8 10.5)" fill="#f9a8d4" />
        <path d="M10.6 19.5L12 23l1.4-3.5z" fill="#d6d3d1" />
        <path d="M12 21c-4 0-5-4-5-9 0-3.5 2-5 5-5s5 1.5 5 5c0 5-1 9-5 9z" fill="#fafaf9" />
        <circle cx="9.7" cy="11.5" r="0.95" fill="#1c1917" />
        <circle cx="14.3" cy="11.5" r="0.95" fill="#1c1917" />
        <ellipse cx="12" cy="17" rx="2.6" ry="2" fill="#d6d3d1" />
        <circle cx="11" cy="17" r="0.4" fill="#44403c" />
        <circle cx="13" cy="17" r="0.4" fill="#44403c" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-white"
      aria-hidden="true"
    >
      {template === 'emergency' && (
        <>
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </>
      )}
      {template === 'wedding' && (
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      )}
      {template === 'amanat' && (
        <>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          <path d="M12 15v2" />
        </>
      )}
    </svg>
  );
}

const PREDEFINED_WALLETS: {
  key: PredefinedTemplateKey;
  label: string;
  defaultName: string;
  subtitle: string;
  iconBg: string;
  color: string;
  owner: string;
  locked: boolean;
}[] = [
  {
    key: 'qurbani',
    label: 'Qurbani',
    defaultName: 'Qurbani Fund',
    subtitle: 'Event savings',
    iconBg: 'bg-emerald-700',
    color: '#10b981',
    owner: 'You',
    locked: false,
  },
  {
    key: 'wedding',
    label: 'Wedding',
    defaultName: 'Wedding Savings',
    subtitle: 'Savings goal',
    iconBg: 'bg-rose-700',
    color: '#ec4899',
    owner: 'You',
    locked: false,
  },
  {
    key: 'emergency',
    label: 'Emergency',
    defaultName: 'Emergency Fund',
    subtitle: 'Protected savings',
    iconBg: 'bg-indigo-700',
    color: '#6366f1',
    owner: 'You',
    locked: false,
  },
  {
    key: 'amanat',
    label: 'Amanat',
    defaultName: 'Amanat',
    subtitle: 'Money held for others',
    iconBg: 'bg-slate-600',
    color: '#64748b',
    owner: 'Amanat',
    locked: true,
  },
];

export default function CreateWalletModal({
  open,
  onClose,
  onSave,
  saving,
  existingWallets,
}: CreateWalletModalProps) {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [selectedTemplate, setSelectedTemplate] = useState<PredefinedTemplateKey | null>(null);
  const [name, setName] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('cash');
  const [openingBalance, setOpeningBalance] = useState('');
  const [initialOwner, setInitialOwner] = useState('You');
  const [parentWalletKey, setParentWalletKey] = useState('');
  const [purpose, setPurpose] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [notes, setNotes] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  const handleSelectTemplate = (tpl: (typeof PREDEFINED_WALLETS)[number]) => {
    if (selectedTemplate === tpl.key) {
      setSelectedTemplate(null);
      return;
    }
    setSelectedTemplate(tpl.key);
    setName(tpl.defaultName);
    setPurpose(tpl.subtitle);
    setColor(tpl.color);
    setInitialOwner(tpl.owner);
    setIsLocked(tpl.locked);
    setWalletType('cash');
  };

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
    setSelectedTemplate(null);
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

  const activeTemplateObj = PREDEFINED_WALLETS.find((t) => t.key === selectedTemplate);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          color: isDark ? '#f8fafc' : '#0f172a',
          borderRadius: 4,
          border: isDark ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid #e2e8f0',
        },
      }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle
          className={`flex items-center justify-between pb-2 border-b ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                activeTemplateObj ? activeTemplateObj.iconBg : ''
              }`}
              style={activeTemplateObj ? undefined : { backgroundColor: color }}
            >
              {activeTemplateObj ? (
                <TemplateIcon template={activeTemplateObj.key} />
              ) : (
                <WalletIcon size={18} />
              )}
            </div>
            <div>
              <h2
                className={`text-lg font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Create New Wallet
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Choose a quick template or configure a custom wallet
              </p>
            </div>
          </div>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#64748b' }}
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent className="pt-4 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {/* Quick Predefined Wallet Templates (Qurbani, Wedding, Emergency, Amanat) */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={13} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
              <label
                className={`text-xs font-semibold ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Quick Templates (Optional)
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PREDEFINED_WALLETS.map((tpl) => {
                const isSelected = selectedTemplate === tpl.key;
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`flex flex-col items-start rounded-2xl border p-3 text-left transition cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? isDark
                          ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500/40'
                          : 'bg-blue-50 border-blue-500 ring-1 ring-blue-300'
                        : isDark
                        ? 'bg-slate-800/80 border-slate-700/70 hover:border-slate-500'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-xs ${tpl.iconBg}`}
                    >
                      <TemplateIcon template={tpl.key} />
                    </div>
                    <span
                      className={`mt-2.5 text-xs font-bold leading-tight ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {tpl.label}
                    </span>
                    <span
                      className={`mt-0.5 text-[10px] leading-snug line-clamp-1 ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {tpl.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

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
