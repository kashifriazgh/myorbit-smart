'use client';

import React from 'react';

export type ExpenseIconKey =
  | 'bolt'
  | 'flame'
  | 'droplet'
  | 'school'
  | 'wifi'
  | 'home'
  | 'cart'
  | 'pill'
  | 'fuel'
  | 'shirt'
  | 'film'
  | 'landmark'
  | 'heart'
  | 'users'
  | 'user'
  | 'receipt';

const ICONS: Record<ExpenseIconKey, React.ReactNode> = {
  bolt: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  flame: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  ),
  droplet: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  school: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </>
  ),
  wifi: (
    <>
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <path d="M12 20h.01" />
    </>
  ),
  home: (
    <>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </>
  ),
  pill: (
    <>
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z" />
      <path d="m8.5 8.5 7 7" />
    </>
  ),
  fuel: (
    <>
      <path d="M3 22h12" />
      <path d="M4 9h10" />
      <path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18" />
      <path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5" />
    </>
  ),
  shirt: (
    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
  ),
  film: (
    <>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4" />
    </>
  ),
  landmark: (
    <>
      <line x1="3" x2="21" y1="22" y2="22" />
      <line x1="6" x2="6" y1="18" y2="11" />
      <line x1="10" x2="10" y1="18" y2="11" />
      <line x1="14" x2="14" y1="18" y2="11" />
      <line x1="18" x2="18" y1="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </>
  ),
  heart: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  receipt: (
    <>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </>
  ),
};

const CAT_TONES: Record<ExpenseIconKey, { light: string; dark: string }> = {
  bolt: { light: 'bg-amber-50 text-amber-700', dark: 'bg-amber-950/90 text-amber-400' },
  flame: { light: 'bg-red-50 text-red-700', dark: 'bg-red-950/90 text-red-400' },
  droplet: { light: 'bg-cyan-50 text-cyan-700', dark: 'bg-cyan-950/90 text-cyan-400' },
  school: { light: 'bg-violet-50 text-violet-700', dark: 'bg-violet-950/90 text-violet-400' },
  wifi: { light: 'bg-blue-50 text-blue-700', dark: 'bg-blue-950/90 text-blue-400' },
  home: { light: 'bg-sky-50 text-sky-700', dark: 'bg-sky-950/90 text-sky-400' },
  cart: { light: 'bg-emerald-50 text-emerald-700', dark: 'bg-emerald-950/90 text-emerald-400' },
  pill: { light: 'bg-rose-50 text-rose-700', dark: 'bg-rose-950/90 text-rose-400' },
  fuel: { light: 'bg-gray-100 text-gray-700', dark: 'bg-gray-800 text-gray-300' },
  shirt: { light: 'bg-fuchsia-50 text-fuchsia-700', dark: 'bg-fuchsia-950/90 text-fuchsia-400' },
  film: { light: 'bg-purple-50 text-purple-700', dark: 'bg-purple-950/90 text-purple-400' },
  landmark: { light: 'bg-orange-50 text-orange-700', dark: 'bg-orange-950/90 text-orange-400' },
  heart: { light: 'bg-teal-50 text-teal-700', dark: 'bg-teal-950/90 text-teal-400' },
  users: { light: 'bg-pink-50 text-pink-700', dark: 'bg-pink-950/90 text-pink-400' },
  user: { light: 'bg-indigo-50 text-indigo-700', dark: 'bg-indigo-950/90 text-indigo-400' },
  receipt: { light: 'bg-slate-100 text-slate-700', dark: 'bg-slate-800 text-slate-300' },
};

export function resolveExpenseIconKey(title?: string, category?: string): ExpenseIconKey {
  const t = (title || '').toLowerCase();
  const c = (category || '').toLowerCase();

  // Specific utility keywords in title take precedence
  if (/\bgas\b|sui|cylinder|lpg/.test(t)) return 'flame';
  if (/water|tanker|pani|wasa/.test(t)) return 'droplet';
  if (/electric|wapda|lesco|iesco|ke\b|bijli|power/.test(t)) return 'bolt';

  // Category & general title matching
  if (/rent|house|home|housing|society/.test(c) || /\brent\b|house/.test(t)) return 'home';
  if (/grocer|food|kitchen/.test(c) || /grocer|milk|meat|sabzi|fruit|lunch|dinner|food/.test(t)) return 'cart';
  if (/education|school|fee/.test(c) || /school|tuition|college|uni|fee|book/.test(t)) return 'school';
  if (/mobile|internet|wifi/.test(c) || /internet|wifi|fiber|ptcl|mobile|phone|package|sim/.test(t)) return 'wifi';
  if (/health|medic|doctor/.test(c) || /medic|doctor|hospital|pharma|clinic|lab/.test(t)) return 'pill';
  if (/transport|fuel|petrol/.test(c) || /fuel|petrol|diesel|bus|fare|bike|car|uber|indrive/.test(t)) return 'fuel';
  if (/cloth|shop/.test(c) || /cloth|shoe|tailor|dress|shirt/.test(t)) return 'shirt';
  if (/entertain|netflix|subscrip/.test(c) || /netflix|movie|cinema|outing|game/.test(t)) return 'film';
  if (/loan|installment|debt/.test(c) || /loan|installment|qist|committee/.test(t)) return 'landmark';
  if (/charity|sadqa|zakat/.test(c) || /charity|sadqa|zakat|donation/.test(t)) return 'heart';
  if (/family/.test(c) || /family|wife|kids|parent|sister|brother|mother|father/.test(t)) return 'users';
  if (/personal/.test(c) || /barber|salon|gym/.test(t)) return 'user';
  if (/electric|gas|water|utilit/.test(c)) return 'bolt';

  return 'receipt';
}

export function ExpenseCategoryIconBadge({
  title,
  category,
  isDark = false,
}: {
  title?: string;
  category?: string;
  isDark?: boolean;
}) {
  const key = resolveExpenseIconKey(title, category);
  const tone = isDark ? CAT_TONES[key].dark : CAT_TONES[key].light;

  return (
    <div
      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        {ICONS[key]}
      </svg>
    </div>
  );
}
