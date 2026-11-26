'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { WalletType, WalletAllocation } from '@/app/lib/interface';
import { useCustomTheme } from '@/app/lib/context/themeContext';

export type WalletOwnershipKind = 'own' | 'amanat';
export type OwnFundClassification = 'spendable' | 'reserved' | 'long_term_saving';

export interface CreateWalletPayload {
  name: string;
  walletType: WalletType;
  openingBalance: number;
  initialOwner: string;
  holderName?: string;
  isLocked: boolean;
  isReserved?: boolean;
  fundClassification?: OwnFundClassification | 'amanat';
  isVirtual: boolean;
  parentWalletKey?: string;
  purpose?: string;
  color: string;
  icon?: string;
  target?: number | null;
  notes?: string;
  allocations?: WalletAllocation[];
}

interface CreateWalletModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (walletData: CreateWalletPayload) => Promise<void>;
  saving: boolean;
  existingWallets: { id: string; name: string; type: string }[];
}

type IconKey = 'wallet' | 'shield' | 'heart' | 'moon' | 'goat' | 'lock';
type ThemeKey = 'indigo' | 'rose' | 'emerald' | 'amber' | 'sky' | 'slate';

const formatRs = (n: number) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-US')}`;

const ICONS: Record<Exclude<IconKey, 'goat'>, React.ReactNode> = {
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1 1 0 0 1 1 1v2" />
      <path d="M4 7.5V17a2 2 0 0 0 2 2h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5z" />
      <circle cx="15.5" cy="13.5" r="1" fill="currentColor" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  moon: (
    <>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
      <path d="M17 3v4M15 5h4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <path d="M12 15v2" />
    </>
  ),
};

function SvgIcon({
  name,
  className = 'h-5 w-5',
}: {
  name: Exclude<IconKey, 'goat'>;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function GoatEmoji({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
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

function WalletGlyph({ name, className }: { name: IconKey; className?: string }) {
  return name === 'goat' ? (
    <GoatEmoji className={className} />
  ) : (
    <SvgIcon name={name} className={className} />
  );
}

const ICON_OPTIONS: IconKey[] = ['wallet', 'shield', 'heart', 'moon', 'goat', 'lock'];

const THEMES: Record<ThemeKey, { iconBg: string; bar: string; swatch: string; hex: string }> = {
  indigo: { iconBg: 'bg-indigo-700', bar: 'bg-indigo-600', swatch: 'bg-indigo-600', hex: '#4f46e5' },
  rose: { iconBg: 'bg-rose-700', bar: 'bg-rose-600', swatch: 'bg-rose-600', hex: '#e11d48' },
  emerald: { iconBg: 'bg-emerald-700', bar: 'bg-emerald-600', swatch: 'bg-emerald-600', hex: '#059669' },
  amber: { iconBg: 'bg-amber-700', bar: 'bg-amber-600', swatch: 'bg-amber-500', hex: '#d97706' },
  sky: { iconBg: 'bg-sky-700', bar: 'bg-sky-600', swatch: 'bg-sky-600', hex: '#0284c7' },
  slate: { iconBg: 'bg-slate-600', bar: 'bg-slate-500', swatch: 'bg-slate-500', hex: '#475569' },
};

const WALLET_TYPE_PILLS: { key: WalletType; label: string; subtitle: string; icon: IconKey; theme: ThemeKey }[] = [
  { key: 'cash', label: 'Cash', subtitle: 'Physical cash wallet', icon: 'wallet', theme: 'emerald' },
  { key: 'bank', label: 'Bank', subtitle: 'Bank account', icon: 'shield', theme: 'indigo' },
  { key: 'mobile_wallet', label: 'Mobile Wallet', subtitle: 'Easypaisa, JazzCash, SadaPay', icon: 'wallet', theme: 'sky' },
  { key: 'virtual', label: 'Virtual', subtitle: 'Virtual bucket / savings', icon: 'moon', theme: 'amber' },
];

// Exact sequence requested: Emergency, Amanat, Qurbani & Wedding
const VIRTUAL_PRESETS: {
  key: string;
  label: string;
  defaultName: string;
  subtitle: string;
  icon: IconKey;
  theme: ThemeKey;
  ownershipKind: WalletOwnershipKind;
  classification: OwnFundClassification;
}[] = [
  {
    key: 'emergency',
    label: 'Emergency',
    defaultName: 'Emergency Fund',
    subtitle: 'Long-term savings',
    icon: 'shield',
    theme: 'indigo',
    ownershipKind: 'own',
    classification: 'long_term_saving',
  },
  {
    key: 'amanat',
    label: 'Amanat',
    defaultName: 'Amanat',
    subtitle: 'Money held for others',
    icon: 'lock',
    theme: 'slate',
    ownershipKind: 'amanat',
    classification: 'reserved',
  },
  {
    key: 'qurbani',
    label: 'Qurbani',
    defaultName: 'Qurbani Fund',
    subtitle: 'Reserved for event',
    icon: 'goat',
    theme: 'emerald',
    ownershipKind: 'own',
    classification: 'reserved',
  },
  {
    key: 'wedding',
    label: 'Wedding',
    defaultName: 'Wedding Savings',
    subtitle: 'Long-term savings goal',
    icon: 'heart',
    theme: 'rose',
    ownershipKind: 'own',
    classification: 'long_term_saving',
  },
];

const OWN_CLASSIFICATION_OPTIONS: {
  key: OwnFundClassification;
  label: string;
  hint: string;
  dot: string;
  darkActive: string;
  lightActive: string;
}[] = [
  {
    key: 'spendable',
    label: 'Spendable',
    hint: 'Available to spend anytime',
    dot: 'bg-green-500',
    darkActive: 'border-green-500 bg-green-500/15 text-white',
    lightActive: 'border-green-500 bg-green-50 text-slate-900',
  },
  {
    key: 'reserved',
    label: 'Reserved',
    hint: 'Set aside for near / short-term use',
    dot: 'bg-blue-500',
    darkActive: 'border-blue-500 bg-blue-500/15 text-white',
    lightActive: 'border-blue-500 bg-blue-50 text-slate-900',
  },
  {
    key: 'long_term_saving',
    label: 'Long-term Saving',
    hint: 'Protected for long-term savings & goals',
    dot: 'bg-amber-500',
    darkActive: 'border-amber-500 bg-amber-500/15 text-white',
    lightActive: 'border-amber-500 bg-amber-50 text-slate-900',
  },
];

export default function CreateWalletModal({
  open,
  onClose,
  onSave,
  saving,
  existingWallets,
}: CreateWalletModalProps) {
  const { theme: appTheme } = useCustomTheme();
  const isDark = appTheme?.mode === 'dark';

  const [name, setName] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('cash');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showVirtualPresets, setShowVirtualPresets] = useState(false); // collapsed by default
  const [parentWalletKey, setParentWalletKey] = useState('');

  const [opening, setOpening] = useState('');
  const [target, setTarget] = useState('');
  const [purpose, setPurpose] = useState('');

  // Ownership (mutually exclusive: 'own' vs 'amanat') & Own Fund Classification
  const [ownershipKind, setOwnershipKind] = useState<WalletOwnershipKind>('own');
  const [fundClassification, setFundClassification] = useState<OwnFundClassification>('spendable');
  const [otherOwnerName, setOtherOwnerName] = useState('');
  const [holderKind, setHolderKind] = useState<'me' | 'other'>('me');
  const [holderName, setHolderName] = useState('');

  // Collapsible More options (Icons & Colors)
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [icon, setIcon] = useState<IconKey>('wallet');
  const [colorTheme, setColorTheme] = useState<ThemeKey>('emerald');

  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const activeTypeObj = WALLET_TYPE_PILLS.find((tp) => tp.key === walletType) ?? WALLET_TYPE_PILLS[0];
  const t = THEMES[colorTheme];
  const amountNum = Math.max(0, Number(opening) || 0);
  const targetNum = Math.max(0, Number(target) || 0);
  const iOwnIt = ownershipKind === 'own';
  const isReserved = !iOwnIt || fundClassification !== 'spendable';
  const isProtected = !iOwnIt || fundClassification !== 'spendable';
  const progress =
    !isProtected && targetNum > 0 ? Math.min(100, Math.round((amountNum / targetNum) * 100)) : 0;

  const pickWalletType = (tp: (typeof WALLET_TYPE_PILLS)[number]) => {
    setWalletType(tp.key);
    setIcon(tp.icon);
    setColorTheme(tp.theme);
    if (tp.key !== 'virtual') {
      setSelectedPreset(null);
      setShowVirtualPresets(false);
      setParentWalletKey('');
    }
  };

  const pickVirtualPreset = (preset: (typeof VIRTUAL_PRESETS)[number]) => {
    setSelectedPreset(preset.key);
    setName(preset.defaultName);
    setPurpose(preset.subtitle);
    setIcon(preset.icon);
    setColorTheme(preset.theme);
    setOwnershipKind(preset.ownershipKind);
    setFundClassification(preset.classification);
    if (preset.ownershipKind === 'amanat') {
      setOtherOwnerName('Amanat');
    } else {
      setOtherOwnerName('');
    }
    setError('');
  };

  const resetForm = () => {
    setName('');
    setWalletType('cash');
    setSelectedPreset(null);
    setShowVirtualPresets(false);
    setParentWalletKey('');
    setOpening('');
    setTarget('');
    setPurpose('');
    setOwnershipKind('own');
    setFundClassification('spendable');
    setOtherOwnerName('');
    setHolderKind('me');
    setHolderName('');
    setShowMoreOptions(false);
    setIcon('wallet');
    setColorTheme('emerald');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = name.trim();
    if (!title) {
      setError('Give your wallet a name');
      return;
    }
    if (existingWallets.some((w) => w.name.toLowerCase() === title.toLowerCase())) {
      setError('A wallet with this name already exists');
      return;
    }

    const resolvedOwner = iOwnIt ? 'You' : otherOwnerName.trim() || 'Amanat';
    const isLongTermSaving = iOwnIt && fundClassification === 'long_term_saving';
    const resolvedPurpose =
      purpose.trim() ||
      (!iOwnIt
        ? 'Amanat · Held for others'
        : isLongTermSaving
        ? 'Long-term Savings'
        : fundClassification === 'reserved'
        ? 'Reserved for near-term use'
        : activeTypeObj.subtitle);

    const resolvedHolder =
      holderKind === 'other' && holderName.trim() ? holderName.trim() : 'Me';

    const defaultEnvelopeAllocation: WalletAllocation | undefined =
      amountNum > 0
        ? {
            id: `default_${Date.now()}`,
            owner: !iOwnIt ? resolvedOwner : isReserved ? 'You' : 'You',
            holderName: resolvedHolder,
            amount: amountNum,
            purpose: isLongTermSaving ? `${title} (Long-term Savings)` : title,
            reservedAmount: isReserved ? amountNum : 0,
            isLocked: !iOwnIt,
            availabilityStatus: !iOwnIt ? 'external' : isReserved ? 'reserved' : 'available',
          }
        : undefined;

    await onSave({
      name: title,
      walletType,
      openingBalance: amountNum,
      initialOwner: resolvedOwner,
      holderName: resolvedHolder,
      isLocked: !iOwnIt,
      isReserved,
      fundClassification: iOwnIt ? fundClassification : 'amanat',
      isVirtual: walletType === 'virtual',
      parentWalletKey: walletType === 'virtual' ? parentWalletKey || undefined : undefined,
      purpose: resolvedPurpose,
      color: t.hex,
      icon,
      target: targetNum || null,
      allocations: defaultEnvelopeAllocation ? [defaultEnvelopeAllocation] : undefined,
    });

    resetForm();
  };

  const inputCls = `w-full rounded-xl px-3.5 py-3 text-sm sm:text-base transition focus:outline-none focus:ring-2 ${
    isDark
      ? 'bg-[#282e3d] text-white placeholder:text-slate-400 focus:ring-blue-500/40'
      : 'bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:ring-blue-500/30'
  }`;

  const labelCls = `mb-1.5 block px-1 text-xs font-semibold ${
    isDark ? 'text-slate-400' : 'text-slate-500'
  }`;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Create new wallet"
    >
      <form
        onSubmit={handleSubmit}
        className={`w-full min-w-full sm:min-w-0 max-w-none sm:max-w-lg min-h-[100dvh] sm:min-h-0 max-h-[100dvh] sm:max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-none sm:rounded-3xl border p-4 sm:p-6 shadow-2xl transition-colors ${
          isDark
            ? 'border-white/10 bg-[#1f2430] text-white'
            : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">New wallet</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95 cursor-pointer ${
              isDark
                ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <X size={17} />
          </button>
        </div>

        {/* Live preview */}
        <div
          className={`mt-4 rounded-3xl p-4 ${
            isDark ? 'bg-[#282e3d] border border-white/10' : 'bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${t.iconBg}`}
            >
              <WalletGlyph name={icon} className={icon === 'goat' ? 'h-8 w-8' : 'h-6 w-6'} />
            </div>
            <div className="min-w-0 leading-tight">
              <p
                className={`truncate text-base font-semibold ${
                  name.trim()
                    ? ''
                    : isDark
                    ? 'text-slate-500'
                    : 'text-slate-400'
                }`}
              >
                {name.trim() || 'Wallet name'}
              </p>
              <p className={`truncate text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {purpose.trim() || activeTypeObj.subtitle}
              </p>
            </div>
          </div>

          <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
            {formatRs(amountNum)}
          </p>

          <div className="mt-2.5 flex min-h-[1.25rem] items-center">
            {isProtected ? (
              <p
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <SvgIcon name="lock" className="h-3.5 w-3.5" />
                {!iOwnIt
                  ? 'Amanat · Another person’s money'
                  : fundClassification === 'long_term_saving'
                  ? 'Long-term Saving · Protected'
                  : 'Reserved · Near-term use'}
              </p>
            ) : (
              <div
                className={`h-1.5 w-full rounded-full ${
                  isDark ? 'bg-white/10' : 'bg-black/10'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all ${t.bar}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Name */}
        <div className="mt-5">
          <label className={labelCls} htmlFor="wallet-name">
            Wallet name
          </label>
          <input
            id="wallet-name"
            autoFocus
            value={name}
            maxLength={32}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="e.g. Meezan Bank, Emergency Fund"
            className={inputCls}
          />
        </div>

        {/* Type: Cash, Bank, Mobile Wallet, Virtual */}
        <div className="mt-4">
          <span className={labelCls}>Type</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {WALLET_TYPE_PILLS.map((tp) => {
              const active = walletType === tp.key;
              return (
                <button
                  key={tp.key}
                  type="button"
                  onClick={() => pickWalletType(tp)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95 cursor-pointer ${
                    active
                      ? isDark
                        ? 'bg-white text-slate-900'
                        : 'bg-slate-900 text-white'
                      : isDark
                      ? 'bg-white/10 text-slate-300 hover:bg-white/15'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tp.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Virtual Preset Wallets (Collapsed by default when Virtual is clicked) */}
        {walletType === 'virtual' && (
          <div
            className={`mt-3 rounded-2xl border p-3 transition-all ${
              isDark
                ? 'border-white/10 bg-[#282e3d]/70'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <button
              type="button"
              onClick={() => setShowVirtualPresets((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-semibold cursor-pointer"
            >
              <span>
                Predefined virtual wallets
                {selectedPreset ? ` (${VIRTUAL_PRESETS.find((p) => p.key === selectedPreset)?.label})` : ''}
              </span>
              {showVirtualPresets ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showVirtualPresets && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {VIRTUAL_PRESETS.map((preset) => {
                  const active = selectedPreset === preset.key;
                  const pt = THEMES[preset.theme];
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => pickVirtualPreset(preset)}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition active:scale-95 cursor-pointer ${
                        active
                          ? 'border-blue-500 bg-blue-500/15'
                          : isDark
                          ? 'border-white/10 bg-[#1f2430] hover:border-white/25'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${pt.iconBg}`}
                      >
                        <WalletGlyph
                          name={preset.icon}
                          className={preset.icon === 'goat' ? 'h-6 w-6' : 'h-4 w-4'}
                        />
                      </span>
                      <div className="min-w-0 leading-tight">
                        <p className="truncate text-xs font-bold">{preset.label}</p>
                        <p
                          className={`truncate text-[10px] ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {preset.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Optional backing wallet selector */}
            <div className="mt-3">
              <label className={labelCls} htmlFor="backing-wallet">
                Backing source wallet (optional)
              </label>
              <select
                id="backing-wallet"
                value={parentWalletKey}
                onChange={(e) => setParentWalletKey(e.target.value)}
                className={inputCls}
              >
                <option value="">Standalone virtual bucket</option>
                {existingWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Opening Balance */}
        <div className="mt-4">
          <label className={labelCls} htmlFor="wallet-opening">
            Opening balance
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              Rs.
            </span>
            <input
              id="wallet-opening"
              type="number"
              inputMode="numeric"
              min="0"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="0"
              className={`${inputCls} pl-11`}
            />
          </div>
        </div>

        {/* Ownership (I own it vs Amanat — mutually exclusive) & Fund Classification */}
        <div
          className={`mt-4 space-y-3 rounded-2xl border p-3.5 ${
            isDark
              ? 'border-white/10 bg-[#282e3d]/60'
              : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div>
            <span className={labelCls}>Who owns this money?</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setOwnershipKind('own');
                  setOtherOwnerName('');
                }}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition cursor-pointer ${
                  iOwnIt
                    ? isDark
                      ? 'border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500/40'
                      : 'border-emerald-500 bg-emerald-50 text-slate-900 ring-1 ring-emerald-500/30'
                    : isDark
                    ? 'border-white/10 bg-[#1f2430] text-slate-300 hover:border-white/25'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    iOwnIt ? 'border-emerald-500' : isDark ? 'border-slate-500' : 'border-slate-400'
                  }`}
                >
                  {iOwnIt && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                </span>
                <div className="min-w-0 leading-tight">
                  <span className="block text-sm font-bold">I own it</span>
                  <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Your own money
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOwnershipKind('amanat')}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition cursor-pointer ${
                  !iOwnIt
                    ? isDark
                      ? 'border-slate-400 bg-slate-500/20 text-white ring-1 ring-slate-400/40'
                      : 'border-slate-700 bg-slate-200/70 text-slate-900 ring-1 ring-slate-500/30'
                    : isDark
                    ? 'border-white/10 bg-[#1f2430] text-slate-300 hover:border-white/25'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                    !iOwnIt
                      ? isDark
                        ? 'border-slate-300'
                        : 'border-slate-700'
                      : isDark
                      ? 'border-slate-500'
                      : 'border-slate-400'
                  }`}
                >
                  {!iOwnIt && (
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isDark ? 'bg-slate-200' : 'bg-slate-700'
                      }`}
                    />
                  )}
                </span>
                <div className="min-w-0 leading-tight">
                  <span className="block text-sm font-bold">Amanat</span>
                  <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Someone else&apos;s money
                  </span>
                </div>
              </button>
            </div>
          </div>

          {iOwnIt ? (
            <div className="pt-1">
              <div className={`mb-2.5 h-px w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              <span className={labelCls}>Classify this amount</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {OWN_CLASSIFICATION_OPTIONS.map((opt) => {
                  const active = fundClassification === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setFundClassification(opt.key)}
                      className={`flex items-start gap-2 rounded-xl border p-2.5 text-left transition cursor-pointer ${
                        active
                          ? isDark
                            ? opt.darkActive
                            : opt.lightActive
                          : isDark
                          ? 'border-white/10 bg-[#1f2430] text-slate-300 hover:border-white/25'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${opt.dot}`} />
                      <div className="min-w-0 leading-tight">
                        <span className="block text-xs font-bold">{opt.label}</span>
                        <span
                          className={`mt-0.5 block text-[10px] ${
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
          ) : (
            <div className="space-y-2 pt-1">
              <div className={`h-px w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
              <p className={`text-[11px] px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                This wallet will be recorded strictly as <strong>Amanat</strong> (excluded from your spendable balance).
              </p>
              <input
                type="text"
                value={otherOwnerName}
                onChange={(e) => setOtherOwnerName(e.target.value)}
                placeholder="Owner name (optional, e.g. Father, Friend, Client)"
                className={inputCls}
              />
            </div>
          )}

          {/* Money Held With / Physical Location */}
          <div className="pt-1">
            <div className={`mb-2.5 h-px w-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />
            <span className={labelCls}>Held with / Kept at</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setHolderKind('me');
                  setHolderName('');
                }}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                  holderKind === 'me'
                    ? isDark
                      ? 'border-blue-500 bg-blue-500/15 text-white'
                      : 'border-blue-500 bg-blue-50 text-slate-900'
                    : isDark
                    ? 'border-white/10 bg-[#1f2430] text-slate-300 hover:border-white/25'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                With Me
              </button>
              <button
                type="button"
                onClick={() => setHolderKind('other')}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                  holderKind === 'other'
                    ? isDark
                      ? 'border-amber-500 bg-amber-500/15 text-white'
                      : 'border-amber-500 bg-amber-50 text-slate-900'
                    : isDark
                    ? 'border-white/10 bg-[#1f2430] text-slate-300 hover:border-white/25'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                Other Person / Place
              </button>
            </div>
            {holderKind === 'other' && (
              <input
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="e.g. Sister, At Home, Locker, Brother"
                className={`${inputCls} mt-2`}
              />
            )}
          </div>
        </div>

        {/* Collapsible More Options (Icons, Colors, Target) */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowMoreOptions((v) => !v)}
            className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer ${
              isDark
                ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>More options (Icon, Color &amp; Target)</span>
            {showMoreOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showMoreOptions && (
            <div className="mt-3 space-y-4 px-1">
              {/* Target (optional) */}
              {!isProtected && (
                <div>
                  <label className={labelCls} htmlFor="wallet-target">
                    Target <span className="text-slate-400">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      Rs.
                    </span>
                    <input
                      id="wallet-target"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="0"
                      className={`${inputCls} pl-11`}
                    />
                  </div>
                </div>
              )}

              {/* Icon Picker */}
              <div>
                <span className={labelCls}>Icon</span>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      aria-label={`Icon ${ic}`}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 cursor-pointer ${
                        icon === ic
                          ? isDark
                            ? 'bg-[#282e3d] text-white ring-2 ring-white'
                            : 'bg-slate-100 text-slate-900 ring-2 ring-slate-900'
                          : isDark
                          ? 'bg-[#282e3d] text-slate-400 hover:text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <WalletGlyph name={ic} className={ic === 'goat' ? 'h-7 w-7' : 'h-5 w-5'} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Swatches */}
              <div>
                <span className={labelCls}>Color</span>
                <div className="flex flex-wrap gap-3 px-1">
                  {(Object.entries(THEMES) as [ThemeKey, (typeof THEMES)[ThemeKey]][]).map(
                    ([key, th]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setColorTheme(key)}
                        aria-label={`Color ${key}`}
                        className={`h-8 w-8 rounded-full transition active:scale-90 cursor-pointer ${th.swatch} ${
                          colorTheme === key
                            ? isDark
                              ? 'ring-2 ring-offset-2 ring-white ring-offset-[#1f2430]'
                              : 'ring-2 ring-offset-2 ring-slate-900 ring-offset-white'
                            : ''
                        }`}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-4 px-1 text-xs font-medium text-rose-500">{error}</p>}

        {/* Actions */}
        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition active:scale-95 cursor-pointer ${
              isDark
                ? 'bg-white/10 text-slate-200 hover:bg-white/15'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex-[1.5] rounded-xl bg-green-500 hover:bg-green-400 py-3 text-sm font-bold text-black transition active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            {saving ? 'Creating…' : 'Create wallet'}
          </button>
        </div>
      </form>
    </div>
  );
}
