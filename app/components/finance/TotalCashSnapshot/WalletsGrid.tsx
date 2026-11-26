'use client';

import React from 'react';
import type { WalletItem } from '../TotalCashSnapshot';

type WalletIconName = 'shield' | 'heart' | 'moon' | 'lock' | 'goat' | 'bank' | 'mobile' | 'wallet';
type WalletThemeName = 'indigo' | 'rose' | 'emerald' | 'slate';

const ICONS: Record<Exclude<WalletIconName, 'goat'>, React.ReactNode> = {
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  heart: (
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  ),
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
  bank: (
    <>
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v8M9 10v8M15 10v8M19 10v8" />
      <path d="M3 18h18" />
    </>
  ),
  mobile: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 17h2" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M16 12.5h5" />
      <circle cx="16.5" cy="12.5" r="0.8" fill="currentColor" />
    </>
  ),
};

function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name: Exclude<WalletIconName, 'goat'>;
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

// Colored emoji-style SVG for Qurbani / Event savings
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

const THEMES: Record<WalletThemeName, { iconBg: string; bar: string }> = {
  indigo: { iconBg: 'bg-indigo-700', bar: 'bg-indigo-500' },
  rose: { iconBg: 'bg-rose-700', bar: 'bg-rose-500' },
  emerald: { iconBg: 'bg-emerald-700', bar: 'bg-emerald-500' },
  slate: { iconBg: 'bg-slate-600', bar: 'bg-slate-400' },
};

function resolveWalletVisual(wallet: WalletItem): {
  icon: WalletIconName;
  theme: WalletThemeName;
  protectedBalance: boolean;
} {
  const lower = `${wallet.name} ${wallet.purpose || ''}`.toLowerCase();
  const protectedBalance = wallet.isLocked || !wallet.hasOwnThisMoney || /amanat/.test(lower);

  if (/qurbani|bakra|eid/.test(lower)) {
    return { icon: 'goat', theme: 'emerald', protectedBalance };
  }
  if (/wedding|shadi|nikah|family/.test(lower)) {
    return { icon: 'heart', theme: 'rose', protectedBalance };
  }
  if (/emergency|protect|saving|reserve/.test(lower)) {
    return { icon: 'shield', theme: 'indigo', protectedBalance };
  }
  if (/ramadan|zakat|umrah|hajj/.test(lower)) {
    return { icon: 'moon', theme: 'emerald', protectedBalance };
  }
  if (protectedBalance) {
    return { icon: 'lock', theme: 'slate', protectedBalance: true };
  }
  if (wallet.walletType === 'bank') {
    return { icon: 'bank', theme: 'indigo', protectedBalance: false };
  }
  if (wallet.walletType === 'mobile_wallet') {
    return { icon: 'mobile', theme: 'emerald', protectedBalance: false };
  }
  if (wallet.walletType === 'virtual') {
    return { icon: 'shield', theme: 'rose', protectedBalance: false };
  }
  return { icon: 'wallet', theme: 'emerald', protectedBalance: false };
}

const formatRs = (n: number) => `Rs. ${Math.round(Number(n || 0)).toLocaleString('en-US')}`;

interface WalletsGridProps {
  wallets: WalletItem[];
  totalBalance: number;
  balancesVisible: boolean;
  isDark: boolean;
  onWalletClick: (wallet: WalletItem) => void;
  onMenuClick?: (wallet: WalletItem) => void;
}

export default function WalletsGrid({
  wallets,
  totalBalance,
  balancesVisible,
  isDark,
  onWalletClick,
  onMenuClick,
}: WalletsGridProps) {
  const displayRs = (n: number) => (balancesVisible ? formatRs(n) : 'Rs. •••••');

  return (
    <section
      className={`w-full rounded-[28px] border p-3.5 sm:p-5 transition-colors ${
        isDark
          ? 'border-slate-700/70 bg-slate-900 text-white shadow-xl'
          : 'border-slate-200 bg-white text-slate-900 shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1 sm:px-0">
        <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          My Wallets
        </h2>
        <span className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {wallets.length} {wallets.length === 1 ? 'wallet' : 'wallets'}
        </span>
      </div>

      {/* Grid: 2 per row on mobile, 3 per row on desktop */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-3 lg:grid-cols-3">
        {wallets.map((w) => {
          const visual = resolveWalletVisual(w);
          const t = THEMES[visual.theme];
          const progress =
            totalBalance > 0
              ? Math.min(100, Math.max(4, Math.round((w.amount / totalBalance) * 100)))
              : 0;

          return (
            <div
              key={w.id}
              onClick={() => onWalletClick(w)}
              className={`flex min-w-0 cursor-pointer flex-col rounded-2xl sm:rounded-3xl border p-3 sm:p-4 transition hover:scale-[1.01] active:scale-[0.98] ${
                isDark
                  ? 'border-slate-700/60 bg-slate-800/85 hover:border-slate-600 hover:bg-slate-800'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100/80'
              }`}
            >
              {/* Icon + menu */}
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl text-white shadow-xs ${t.iconBg}`}
                >
                  {visual.icon === 'goat' ? (
                    <GoatEmoji className="h-6 w-6 sm:h-8 sm:w-8" />
                  ) : (
                    <Icon name={visual.icon} className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Options for ${w.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    (onMenuClick ?? onWalletClick)(w);
                  }}
                  className={`-mr-1 rounded-full p-1 transition cursor-pointer ${
                    isDark
                      ? 'text-slate-400 hover:bg-white/10 hover:text-white'
                      : 'text-slate-400 hover:bg-slate-200 hover:text-slate-800'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 sm:h-5 sm:w-5">
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                </button>
              </div>

              {/* Name + subtitle */}
              <p
                className={`mt-3 sm:mt-4 truncate text-sm sm:text-base font-semibold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {w.name}
              </p>
              <p
                className={`mt-0.5 truncate text-[11px] sm:text-xs ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {w.purpose || w.subtitle}
              </p>
              {w.holderName && w.holderName.toLowerCase() !== 'me' && (
                <p
                  className={`mt-1 inline-flex w-fit max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    isDark
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  <span className="truncate">Held: {w.holderName}</span>
                </p>
              )}

              {/* Amount */}
              <p
                className={`mt-3 sm:mt-4 truncate text-base sm:text-xl font-bold tracking-tight tabular-nums ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {displayRs(w.amount)}
              </p>

              {/* Progress bar or protected label */}
              <div className="mt-2.5 sm:mt-3 flex min-h-[1.1rem] items-center">
                {visual.protectedBalance ? (
                  <p
                    className={`flex items-center gap-1 truncate text-[11px] sm:text-xs font-medium ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    <Icon name="lock" className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                    <span className="truncate">Protected balance</span>
                  </p>
                ) : (
                  <div
                    className={`h-1.5 w-full overflow-hidden rounded-full ${
                      isDark ? 'bg-slate-700' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${t.bar}`}
                      style={{ width: `${w.amount > 0 ? progress : 0}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

