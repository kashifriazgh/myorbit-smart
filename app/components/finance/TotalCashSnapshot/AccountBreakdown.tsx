'use client';

import { useState, useMemo, useEffect } from 'react';
import { TotalCashSnapshot, HolderAmount, TransactionSource } from '@/app/lib/interface';
import { db } from '@/app/lib/firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';

/* ================= Helpers ================= */
const SELF = 'You';
const ALL = '__all__';

const normName = (n = '') => {
  const t = n.trim().replace(/\s+/g, ' ');
  return ['you', 'me', 'self', 'myself'].includes(t.toLowerCase()) ? SELF : t;
};
const money = (n: number) => `Rs ${Math.round(n || 0).toLocaleString('en-US')}`;
const sum = (holders: Array<{ name: string; amount: number }>) => holders.reduce((s, h) => s + (h.amount || 0), 0);

const PALETTE = ['bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-teal-500', 'bg-sky-500', 'bg-orange-500'];
const colorFor = (name: string) => {
  if (name === SELF || name === 'Self') return 'bg-emerald-500';
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

/** Holders array after moving `amount` from `from` to `to` (from === ALL moves everything). */
function computeHolders(
  holders: Array<{ name: string; amount: number }>,
  from: string,
  to: string,
  amount: number
) {
  if (from === ALL) return [{ name: to, amount: sum(holders) }];
  const next = holders.map((h) => ({ ...h }));
  const src = next.find((h) => h.name === from);
  if (src) src.amount -= amount;
  const dest = next.find((h) => h.name === to);
  if (dest) dest.amount += amount;
  else next.push({ name: to, amount });
  return next.filter((h) => h.amount > 0);
}

/* ================= Shared styles ================= */
const cardStyle = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5';
const textMain = 'text-slate-900 dark:text-slate-100';
const textSub = 'text-slate-500 dark:text-slate-400';
const inputStyle =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';
const btnPrimary =
  'rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-500 dark:text-[#040d1a] dark:hover:bg-emerald-400';
const btnGhost =
  'rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10';

/* ================= Icons ================= */
const Svg = ({ children, className = 'h-5 w-5' }: { children: React.ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const KindIcon = ({ kind }: { kind: string }) => {
  switch (kind) {
    case 'bank':
      return (
        <Svg>
          <path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18M12 3 3 8h18z" />
        </Svg>
      );
    case 'fund':
    case 'easypaisa':
    case 'jazzcash':
      return (
        <Svg>
          <path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6" />
        </Svg>
      );
    case 'committee':
    case 'family':
      return (
        <Svg>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19c0-3 3-5 6-5s6 2 6 5" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 14c3 0 5 1.5 5 4" />
        </Svg>
      );
    case 'in_hand':
      return (
        <Svg>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M6 12h.01M18 12h.01" />
        </Svg>
      );
    default:
      return (
        <Svg>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" />
        </Svg>
      );
  }
};

const CloseIcon = () => (
  <Svg className="h-4 w-4">
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

const ArrowIcon = () => (
  <Svg className="h-4 w-4">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

/* ================= Shared parts ================= */
function HolderSplit({
  holders,
  highlight,
}: {
  holders: Array<{ name: string; amount: number }>;
  highlight?: string | null;
}) {
  const total = sum(holders) || 1;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        {holders.map((h) => (
          <div
            key={h.name}
            className={`${colorFor(h.name)} transition-all duration-500`}
            style={{ width: `${(h.amount / total) * 100}%` }}
            title={`${h.name}: ${money(h.amount)}`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {holders.map((h) => (
          <li key={h.name} className="flex items-center justify-between gap-3 text-sm">
            <span className={`flex min-w-0 items-center gap-2 ${textMain}`}>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorFor(h.name)}`} />
              <span className="truncate">{h.name}</span>
              {highlight === h.name && (
                <span className="rounded bg-emerald-100 px-1.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  updated
                </span>
              )}
            </span>
            <span className={`shrink-0 tabular-nums ${textSub}`}>
              {money(h.amount)} · {Math.round((h.amount / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl dark:border dark:border-white/10 dark:bg-[#0a1628] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div>
            <h3 className={`text-base font-semibold ${textMain}`}>{title}</h3>
            {subtitle && <p className={`mt-0.5 text-xs ${textSub}`}>{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-white/10">{footer}</div>
      </div>
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className={`mb-1.5 text-xs font-medium uppercase tracking-wide ${textSub}`}>{children}</p>
);

function PersonChips({
  people,
  onPick,
  selected,
}: {
  people: string[];
  onPick: (person: string) => void;
  selected?: string;
}) {
  if (!people.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {people.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
            selected === p
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

/* ================= Transfer holder dialog ================= */
function TransferDialog({
  name,
  holders,
  people,
  onClose,
  onConfirm,
}: {
  name: string;
  holders: Array<{ name: string; amount: number }>;
  people: string[];
  onClose: () => void;
  onConfirm: (data: { from: string; to: string; amount: number }) => Promise<void> | void;
}) {
  const total = sum(holders);
  const [from, setFrom] = useState(
    [...holders].sort((a, b) => b.amount - a.amount)[0]?.name || SELF
  );
  const [to, setTo] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fromAll = from === ALL;
  const max = fromAll ? total : holders.find((h) => h.name === from)?.amount ?? 0;
  const amount = fromAll ? total : Number(amountStr || 0);
  const dest = normName(to);

  const sameTarget = fromAll ? holders.length === 1 && holders[0].name === dest : dest === from;
  const error = !fromAll && amount > max ? `Maximum is ${money(max)}` : dest && sameTarget ? 'Choose a different holder' : '';
  const valid = !!dest && amount > 0 && amount <= max && !sameTarget;

  const after = valid ? computeHolders(holders, from, dest, amount) : holders;
  const suggestions = people.filter((p) => p !== from);

  const handleConfirm = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm({ from, to: dest, amount });
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Transfer holder"
      subtitle={`${name} · ${money(total)}`}
      onClose={() => !submitting && onClose()}
      footer={
        <>
          <button type="button" className={btnGhost} disabled={submitting} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`${btnPrimary} inline-flex items-center justify-center gap-2`}
            disabled={!valid || submitting}
            onClick={handleConfirm}
          >
            {submitting ? (
              <>
                <svg className="h-4 w-4 animate-spin text-current" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Transferring...</span>
              </>
            ) : (
              'Confirm transfer'
            )}
          </button>
        </>
      }
    >
      <div>
        <Label>Move from</Label>
        <div className="space-y-1.5">
          {[...holders, ...(holders.length > 1 ? [{ name: ALL, amount: total }] : [])].map((h) => (
            <button
              key={h.name}
              type="button"
              onClick={() => {
                setFrom(h.name);
                setAmountStr('');
              }}
              aria-pressed={from === h.name}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                from === h.name
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5'
              }`}
            >
              <span className={`flex items-center gap-2 ${textMain}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${h.name === ALL ? 'bg-slate-400' : colorFor(h.name)}`} />
                {h.name === ALL ? 'All holders (whole amount)' : h.name}
              </span>
              <span className={`tabular-nums ${textSub}`}>{money(h.amount)}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Move to</Label>
        <input
          className={inputStyle}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Type a name, or tap one below"
        />
        <PersonChips people={suggestions} onPick={setTo} selected={dest} />
      </div>

      <div>
        <Label>Amount</Label>
        <input
          className={`${inputStyle} tabular-nums`}
          inputMode="numeric"
          disabled={fromAll}
          value={fromAll ? String(total) : amountStr}
          onChange={(e) => setAmountStr(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="0"
        />
        {!fromAll && (
          <div className="mt-2 flex gap-1.5">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmountStr(String(Math.round((max * p) / 100)))}
                className={`${btnGhost} !px-2.5 !py-1 !text-xs`}
              >
                {p === 100 ? 'Full' : `${p}%`}
              </button>
            ))}
          </div>
        )}
        {error && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>

      <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
        <Label>{valid ? 'After transfer' : 'Current split'}</Label>
        <HolderSplit holders={after} highlight={valid ? dest : null} />
      </div>
    </Modal>
  );
}

/* ================= Ownership dialog ================= */
function OwnershipDialog({
  name,
  owner: currentOwner,
  isLocked: currentIsLocked,
  people,
  onClose,
  onSave,
}: {
  name: string;
  owner: string;
  isLocked: boolean;
  people: string[];
  onClose: () => void;
  onSave: (data: { owner: string; isLocked: boolean }) => void;
}) {
  const [type, setType] = useState(currentOwner === SELF ? 'self' : 'other');
  const [ownerName, setOwnerName] = useState(currentOwner === SELF ? '' : currentOwner);
  const [isLocked, setIsLocked] = useState(currentIsLocked);

  const owner = type === 'self' ? SELF : normName(ownerName);
  const others = people.filter((p) => p !== SELF);

  return (
    <Modal
      title="Change ownership & settings"
      subtitle={name}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={!owner}
            onClick={() => onSave({ owner, isLocked })}
          >
            Save settings
          </button>
        </>
      }
    >
      <div>
        <Label>Whose money is this?</Label>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/10">
          {[
            ['self', 'Mine'],
            ['other', "Someone else's"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              aria-pressed={type === key}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                type === key
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#0a1628] dark:text-slate-100'
                  : `${textSub} hover:text-slate-700`
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {type === 'other' && (
        <div>
          <Label>Owner name</Label>
          <input
            className={inputStyle}
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="e.g. Ammi, Abbu, Friend"
            autoFocus
          />
          <PersonChips people={others} onPick={setOwnerName} selected={normName(ownerName)} />
        </div>
      )}

      {/* Lock Source Toggle */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <span className={`text-sm font-medium flex items-center gap-1.5 ${textMain}`}>
              🔒 Lock Source
            </span>
            <p className={`text-xs ${textSub}`}>Prevent any deductions or transfers from this source</p>
          </div>
          <input
            type="checkbox"
            checked={isLocked}
            onChange={(e) => setIsLocked(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-white/20 dark:bg-white/10"
          />
        </label>
      </div>

      <p className={`rounded-lg bg-slate-50 p-3 text-xs leading-relaxed dark:bg-white/5 ${textSub}`}>
        Ownership says <b>whose money</b> this is. The holder says <b>who has it right now</b>. Changing the owner does not move the money.
      </p>
    </Modal>
  );
}

/* ================= Source card (Smarter & Compact Vertically) ================= */
interface SourceCardProps {
  name: string;
  kind: string;
  builtIn: boolean;
  owner: string;
  isLocked: boolean;
  holders: Array<{ name: string; amount: number }>;
  people: string[];
  onTransfer: () => void;
  onOwnership: () => void;
}

function SourceCard({
  name,
  kind,
  builtIn,
  owner,
  isLocked,
  holders,
  onTransfer,
  onOwnership,
}: SourceCardProps) {
  const total = sum(holders);
  const ownedByMe = owner === SELF;

  return (
    <article className={`${cardStyle} flex flex-col p-3.5 sm:p-4`}>
      {/* Header: Left = Icon + Name + Badge, Right = Total Amount + Owned by pill right below */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <KindIcon kind={kind} />
          </span>
          <div className="min-w-0">
            <h3 className={`truncate text-sm font-semibold ${textMain}`}>{name}</h3>
            <span className={`text-[11px] ${textSub}`}>{builtIn ? 'Built-in' : 'Custom'}</span>
          </div>
        </div>

        {/* Right side: Amount and Owned by pill right below it */}
        <div className="flex flex-col items-end shrink-0">
          <p className={`text-base sm:text-lg font-semibold tabular-nums ${textMain}`}>{money(total)}</p>
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap justify-end">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                ownedByMe
                  ? 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200'
                  : 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
              }`}
            >
              {ownedByMe ? 'Owned by you' : `Owned by ${owner}`}
            </span>
            {isLocked && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                🔒 Locked
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Only show HolderSplit for non-built-in / custom sources */}
      {!builtIn && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-white/10">
          <HolderSplit holders={holders} />
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
        {!builtIn && (
          <button
            type="button"
            onClick={onTransfer}
            className={`${btnPrimary} flex flex-1 items-center justify-center gap-1.5 !py-1.5 !text-xs`}
          >
            Transfer holder <ArrowIcon />
          </button>
        )}
        <button
          type="button"
          onClick={onOwnership}
          className={`${btnGhost} ${builtIn ? 'w-full' : ''} !py-1.5 !text-xs`}
        >
          Ownership
        </button>
      </div>
    </article>
  );
}

/* ================= Main Account Breakdown Component ================= */
interface Props {
  snapshot: TotalCashSnapshot;
  currency: 'PKR' | 'USD';
  isDark: boolean;
  userId?: string;
  onUpdateSnapshot?: (updated: TotalCashSnapshot) => void;
}

interface SourceItem {
  id: string;
  name: string;
  kind: string;
  builtIn: boolean;
  owner: string;
  isLocked: boolean;
  total: number;
  holders: Array<{ name: string; amount: number }>;
}

export default function AccountBreakdown({
  snapshot,
  userId,
  onUpdateSnapshot,
}: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [modal, setModal] = useState<{ type: 'transfer' | 'owner'; id: string } | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Construct source items list from Firestore snapshot
  const sourcesList: SourceItem[] = useMemo(() => {
    if (!snapshot || !snapshot.sources) return [];
    const list: SourceItem[] = [];

    const getOwner = (key: string, isCustom: boolean) => {
      const o = snapshot.sourceOwnership?.[key];
      if (o && o.hasOwnThisMoney === false) {
        return o.ownerName || o.ownserName || 'Someone else';
      }
      return isCustom ? 'Someone else' : SELF;
    };

    const getIsLocked = (key: string) => {
      return snapshot.sourceOwnership?.[key]?.isLocked === true;
    };

    const getHolders = (key: string, totalAmt: number) => {
      const raw = snapshot.heldBy?.[key] || [];
      const namedSum = raw.reduce((s, h) => s + (h.amount || 0), 0);
      const unassigned = Math.max(0, totalAmt - namedSum);

      const holders: Array<{ name: string; amount: number }> = [];
      if (unassigned > 0 || raw.length === 0) {
        holders.push({ name: SELF, amount: unassigned });
      }
      for (const h of raw) {
        if (h.amount > 0) {
          holders.push({ name: h.holderName === 'Self' ? SELF : h.holderName, amount: h.amount });
        }
      }
      return holders;
    };

    // 1. Standard sources: in_hand, easypaisa, jazzcash, other
    const standardKeys: Array<{ key: TransactionSource; name: string; kind: string }> = [
      { key: 'in_hand', name: 'Cash in Hand', kind: 'in_hand' },
      { key: 'easypaisa', name: 'EasyPaisa', kind: 'easypaisa' },
      { key: 'jazzcash', name: 'JazzCash', kind: 'jazzcash' },
      { key: 'other', name: 'Other Wallet', kind: 'other' },
    ];

    for (const item of standardKeys) {
      const amt = typeof snapshot.sources[item.key] === 'number' ? (snapshot.sources[item.key] as number) : 0;
      const rawHolders = snapshot.heldBy?.[item.key] || [];
      if (amt >= 1 || rawHolders.length > 0) {
        list.push({
          id: item.key,
          name: item.name,
          kind: item.kind,
          builtIn: true,
          owner: getOwner(item.key, false),
          isLocked: getIsLocked(item.key),
          total: amt,
          holders: getHolders(item.key, amt),
        });
      }
    }

    // 2. Bank accounts
    if (snapshot.sources.bank && typeof snapshot.sources.bank === 'object') {
      for (const [bankName, amt] of Object.entries(snapshot.sources.bank)) {
        const key = `bank:${bankName}`;
        const rawHolders = snapshot.heldBy?.[key] || [];
        if (amt >= 1 || rawHolders.length > 0) {
          list.push({
            id: key,
            name: `Bank (${bankName})`,
            kind: 'bank',
            builtIn: true,
            owner: getOwner(key, false),
            isLocked: getIsLocked(key),
            total: amt,
            holders: getHolders(key, amt),
          });
        }
      }
    }

    // 3. Custom payment heads
    if (snapshot.sources.custom && typeof snapshot.sources.custom === 'object') {
      for (const [customName, amt] of Object.entries(snapshot.sources.custom)) {
        const key = `custom:${customName}`;
        const rawHolders = snapshot.heldBy?.[key] || [];
        if (amt >= 1 || rawHolders.length > 0) {
          list.push({
            id: key,
            name: customName,
            kind: 'custom',
            builtIn: false,
            owner: getOwner(key, true),
            isLocked: getIsLocked(key),
            total: amt,
            holders: getHolders(key, amt),
          });
        }
      }
    }

    return list;
  }, [snapshot]);

  // Aggregate stats across all sources (Commented out for now as requested)
  /*
  const stats = useMemo(() => {
    let yours = 0;
    let yoursWithOthers = 0;
    let othersWithYou = 0;

    sourcesList.forEach((s) => {
      const mine = s.holders.find((h) => h.name === SELF)?.amount ?? 0;
      if (s.owner === SELF) {
        yours += s.total;
        yoursWithOthers += s.total - mine;
      } else {
        othersWithYou += mine;
      }
    });

    return { yours, yoursWithOthers, othersWithYou };
  }, [sourcesList]);
  */

  // People list for suggestion chips
  const people = useMemo(() => {
    const set = new Set([SELF]);
    sourcesList.forEach((s) => {
      set.add(s.owner);
      s.holders.forEach((h) => set.add(h.name));
    });
    return [...set];
  }, [sourcesList]);

  const activeSource = modal && sourcesList.find((s) => s.id === modal.id);

  // Handle Transfer Holder Confirmation
  const handleTransfer = async ({ from, to, amount }: { from: string; to: string; amount: number }) => {
    if (!activeSource || !userId || !onUpdateSnapshot || !snapshot) return;

    const nextHolders = computeHolders(activeSource.holders, from, to, amount);
    const namedHolders: HolderAmount[] = nextHolders
      .filter((h) => h.name !== SELF && h.name !== 'Self' && h.amount > 0)
      .map((h) => ({ holderName: h.name, amount: h.amount }));

    const updatedHeldBy = {
      ...(snapshot.heldBy || {}),
      [activeSource.id]: namedHolders,
    };

    const updatedSnapshot: TotalCashSnapshot = {
      ...snapshot,
      heldBy: updatedHeldBy,
      updatedAt: new Date(),
    };

    try {
      const docRef = doc(db, 'totalCashSnapshots', userId);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });

      // Audit log
      await addDoc(collection(db, 'cashTransactions'), {
        userId,
        amount: from === ALL ? activeSource.total : amount,
        type: 'transfer',
        source: activeSource.kind === 'bank' ? 'bank' : activeSource.kind === 'custom' ? 'custom' : activeSource.kind,
        category: 'transfer',
        note: `Transferred ${money(from === ALL ? activeSource.total : amount)} ${
          from === ALL ? '(all)' : `from ${from}`
        } to ${to} in ${activeSource.name}`,
        fromHolderName: from === SELF || from === ALL ? null : from,
        toHolderName: to === SELF ? null : to,
        createdAt: serverTimestamp(),
      });

      onUpdateSnapshot(updatedSnapshot);
      setModal(null);
      setToast(`Moved ${money(from === ALL ? activeSource.total : amount)} to ${to}`);
    } catch (err) {
      console.error('Failed to save transfer:', err);
    }
  };

  // Handle Ownership & Lock Save
  const handleOwnership = async ({ owner, isLocked }: { owner: string; isLocked: boolean }) => {
    if (!activeSource || !userId || !onUpdateSnapshot || !snapshot) return;

    const hasOwnThisMoney = owner === SELF;
    const ownerNameVal = hasOwnThisMoney ? '' : owner;

    const updatedOwnership = {
      ...(snapshot.sourceOwnership || {}),
      [activeSource.id]: {
        hasOwnThisMoney,
        ownerName: ownerNameVal,
        ownserName: ownerNameVal,
        isLocked,
      },
    };

    const updatedSnapshot: TotalCashSnapshot = {
      ...snapshot,
      sourceOwnership: updatedOwnership,
      updatedAt: new Date(),
    };

    try {
      const docRef = doc(db, 'totalCashSnapshots', userId);
      await setDoc(docRef, { ...updatedSnapshot, updatedAt: serverTimestamp() });
      onUpdateSnapshot(updatedSnapshot);
      setModal(null);
      setToast(`${activeSource.name} settings updated`);
    } catch (err) {
      console.error('Failed to save ownership:', err);
    }
  };

  /*
  const tiles = [
    ['Your money', stats.yours, 'Sources you own'],
    ['Your money with others', stats.yoursWithOthers, 'Held by someone else'],
    ["Others' money with you", stats.othersWithYou, "You're holding for them"],
  ];
  */

  return (
    <section aria-label="Finance sources" className="space-y-4 my-4">
      <div className="flex items-center justify-between">
        <h2 className={`text-base font-bold ${textMain}`}>Account Breakdown</h2>
        <button
          type="button"
          onClick={() => setShowBreakdown((prev) => !prev)}
          className={`${btnGhost} !px-3 !py-1.5 !text-xs`}
        >
          {showBreakdown ? 'Hide Breakdown' : 'Show Breakdown'}
        </button>
      </div>

      {showBreakdown && (
        <div className="space-y-4">
          {/* Summary Stats Tiles (Commented out for now as requested) */}
          {/*
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tiles.map(([label, value, hint]) => (
              <div key={label as string} className={`${cardStyle} p-4`}>
                <p className={`text-xs ${textSub}`}>{label}</p>
                <p className={`mt-1 text-xl font-bold tabular-nums ${textMain}`}>{money(value as number)}</p>
                <p className={`text-xs ${textSub} opacity-70`}>{hint}</p>
              </div>
            ))}
          </div>
          */}

          {/* Source Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:gap-4 lg:gap-5">
            {sourcesList.map((s) => (
              <SourceCard
                key={s.id}
                name={s.name}
                kind={s.kind}
                builtIn={s.builtIn}
                owner={s.owner}
                isLocked={s.isLocked}
                holders={s.holders}
                people={people}
                onTransfer={() => setModal({ type: 'transfer', id: s.id })}
                onOwnership={() => setModal({ type: 'owner', id: s.id })}
              />
            ))}
          </div>

          {/* Manage Sources Link */}
          <div className="pt-2 text-center">
            <a
              href="/finance/manage-sources"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              ⚙️ Manage Sources & Banks
            </a>
          </div>
        </div>
      )}

      {/* Modals */}
      {activeSource && modal?.type === 'transfer' && (
        <TransferDialog
          key={activeSource.id}
          name={activeSource.name}
          holders={activeSource.holders}
          people={people}
          onClose={() => setModal(null)}
          onConfirm={handleTransfer}
        />
      )}

      {activeSource && modal?.type === 'owner' && (
        <OwnershipDialog
          key={activeSource.id}
          name={activeSource.name}
          owner={activeSource.owner}
          isLocked={activeSource.isLocked}
          people={people}
          onClose={() => setModal(null)}
          onSave={handleOwnership}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-emerald-500 dark:text-[#040d1a]"
        >
          {toast}
        </div>
      )}
    </section>
  );
}
