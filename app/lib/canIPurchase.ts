import type {
  Expenditure,
  Liability,
  LoanRecord,
  PlannedExpense,
  TotalCashSnapshot,
} from './interface';

export interface PurchaseFinancialData {
  spendable: number;
  reserved: number;
  savings: number;
  amanat: number;
  expensesDue: number;
  loansToPay: number;
  loansToReceive: number;
}

export type PurchaseVerdict = 'yes' | 'tight' | 'no' | 'info';

export interface PurchaseCheckResult {
  free: number;
  buffer: number;
  safe: number;
  dailyLimit: number;
  daysLeft: number;
  verdict: PurchaseVerdict;
  shortfall: number;
  ifIncoming: boolean;
}

/**
 * Pure deterministic "Can I purchase?" calculation.
 * Reserved, savings, and amanat are NEVER counted.
 * loansToReceive is NOT counted in `free`; only used for `ifIncoming`.
 */
export function checkPurchase(
  data: PurchaseFinancialData,
  amount = 0,
  bufferPct = 5,
  now: Date = new Date()
): PurchaseCheckResult {
  const spendable = Number(data.spendable) || 0;
  const expensesDue = Math.max(0, Number(data.expensesDue) || 0);
  const loansToPay = Math.max(0, Number(data.loansToPay) || 0);
  const loansToReceive = Math.max(0, Number(data.loansToReceive) || 0);
  const pct = Math.max(0, Number(bufferPct) || 0);
  const requested = Math.max(0, Number(amount) || 0);

  const free = spendable - expensesDue - loansToPay;
  const buffer = Math.max(0, (spendable * pct) / 100);
  const safe = free - buffer;

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, lastDay - now.getDate() + 1);
  const dailyLimit = Math.max(0, safe) / daysLeft;

  let verdict: PurchaseVerdict = 'info';
  let shortfall = 0;
  let ifIncoming = false;

  if (requested > 0) {
    if (requested <= safe) {
      verdict = 'yes';
    } else if (requested <= free) {
      verdict = 'tight';
    } else {
      verdict = 'no';
      shortfall = requested - free;
      ifIncoming = loansToReceive > 0 && requested <= free + loansToReceive;
    }
  }

  return { free, buffer, safe, dailyLimit, daysLeft, verdict, shortfall, ifIncoming };
}

// ---------- Compact helper to extract monthly figures from Firestore data ----------

type DateLike = Date | string | { toDate: () => Date } | { seconds: number } | null | undefined;

function toDate(val: DateLike): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val.trim());
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'object' && 'toDate' in val && typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (typeof val === 'object' && 'seconds' in val && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  return null;
}

export interface PendingExpenseItem {
  id: string;
  collection: 'plannedExpenses' | 'expenditures';
  title: string;
  category: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export function extractPendingExpenses(
  plannedExpenses: PlannedExpense[] = [],
  expenditures: Expenditure[] = [],
  now: Date = new Date()
): PendingExpenseItem[] {
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const items: PendingExpenseItem[] = [];

  for (const e of plannedExpenses) {
    if (!e.id || e.paymentStatus === 'paid') continue;
    const total = Math.max(0, Number(e.expectedAmount) || 0);
    const paid = Math.max(0, Number(e.actualPaidAmount) || 0);
    const rem = Math.max(0, total - paid);
    if (!rem) continue;
    const due = toDate(e.dueDate);
    if (!due || due <= endOfMonth) {
      items.push({
        id: e.id,
        collection: 'plannedExpenses',
        title: e.title || 'Untitled Expense',
        category: e.category || 'General',
        totalAmount: Math.round(total),
        paidAmount: Math.round(paid),
        remainingAmount: Math.round(rem),
      });
    }
  }

  for (const e of expenditures) {
    if (!e.id || e.isPaid) continue;
    const amt = Math.max(0, Number(e.amount) || 0);
    if (!amt) continue;
    const due = toDate(e.dueDate);
    if (!due || due <= endOfMonth) {
      items.push({
        id: e.id,
        collection: 'expenditures',
        title: e.title || 'Untitled Expense',
        category: e.category || 'General',
        totalAmount: Math.round(amt),
        paidAmount: 0,
        remainingAmount: Math.round(amt),
      });
    }
  }

  return items.sort((a, b) => b.remainingAmount - a.remainingAmount);
}

export function extractPurchaseData(
  snapshot: TotalCashSnapshot | null,
  plannedExpenses: PlannedExpense[] = [],
  expenditures: Expenditure[] = [],
  loans: LoanRecord[] = [],
  liabilities: Liability[] = [],
  now: Date = new Date()
): PurchaseFinancialData {
  let spendable = 0;
  let reserved = 0;
  let savings = 0;
  let amanat = 0;

  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const savingsRe = /saving|emergency|goal|fund|invest/i;

  const addWallet = (key: string, label: string, gross: number, isCustom: boolean) => {
    if (gross <= 0) return;
    const o = snapshot?.sourceOwnership?.[key];
    if (o?.parentWalletKey) return; // skip parent-backed virtual sub-wallets

    const isSavingsWallet = savingsRe.test(`${o?.purpose || ''} ${label}`);
    if (o?.allocations && o.allocations.length > 0) {
      let allocSum = 0;
      for (const a of o.allocations) {
        const amt = Math.max(0, Number(a.amount) || 0);
        if (!amt) continue;
        allocSum += amt;
        const owner = (a.owner || '').trim().toLowerCase();
        if (a.fundState === 'amanat' || a.availabilityStatus === 'external' || (owner && owner !== 'you' && owner !== 'self' && owner !== 'reserved' && owner !== 'savings')) {
          amanat += amt;
        } else if (a.fundState === 'savings' || a.availabilityStatus === 'savings' || owner === 'savings') {
          savings += amt;
        } else if (a.fundState === 'reserved' || a.availabilityStatus === 'reserved' || owner === 'reserved' || o.isLocked || a.isLocked) {
          reserved += amt;
        } else {
          const res = Math.min(amt, Math.max(0, Number(a.reservedAmount) || 0));
          reserved += res;
          spendable += amt - res;
        }
      }
      const rem = Math.max(0, gross - allocSum);
      if (rem > 0) {
        if (o.isLocked) reserved += rem;
        else spendable += rem;
      }
      return;
    }

    const isOwn = o ? (typeof o.hasOwnThisMoney === 'boolean' ? o.hasOwnThisMoney : !isCustom) : !isCustom;
    if (!isOwn || o?.fundState === 'amanat') {
      amanat += gross;
    } else if (o?.fundState === 'savings') {
      savings += gross;
    } else if (o?.fundState === 'reserved' || o?.isLocked) {
      if (isSavingsWallet) savings += gross;
      else reserved += gross;
    } else {
      const res = Math.min(gross, Math.max(0, Number(o?.reservedAmount) || 0));
      reserved += res;
      spendable += gross - res;
    }
  };

  if (snapshot?.sources) {
    for (const [k, v] of Object.entries(snapshot.sources)) {
      if (k === 'bank' && v && typeof v === 'object') {
        for (const [b, amt] of Object.entries(v as Record<string, number>)) {
          if (typeof amt === 'number') addWallet(`bank:${b}`, b, amt, false);
        }
      } else if (k === 'custom' && v && typeof v === 'object') {
        for (const [c, amt] of Object.entries(v as Record<string, number>)) {
          if (typeof amt === 'number') addWallet(`custom:${c}`, c, amt, true);
        }
      } else if (typeof v === 'number') {
        addWallet(k, k, v, false);
      }
    }
  }

  // Expenses due this month (including overdue)
  let expensesDue = 0;
  for (const e of plannedExpenses) {
    if (e.paymentStatus === 'paid') continue;
    const rem = Math.max(0, (Number(e.expectedAmount) || 0) - (Number(e.actualPaidAmount) || 0));
    if (!rem) continue;
    const due = toDate(e.dueDate);
    if (!due || due <= endOfMonth) expensesDue += rem;
  }
  for (const e of expenditures) {
    if (e.isPaid) continue;
    const amt = Math.max(0, Number(e.amount) || 0);
    if (!amt) continue;
    const due = toDate(e.dueDate);
    if (!due || due <= endOfMonth) expensesDue += amt;
  }

  // Loans to pay / receive this month (including overdue)
  let loansToPay = 0;
  let loansToReceive = 0;
  for (const l of loans) {
    if (l.isSettled) continue;
    const rem = Math.max(0, (Number(l.amount) || 0) - (Number(l.paidAmount) || 0));
    if (!rem) continue;
    const due = toDate(l.dueDate);
    if (due && due <= endOfMonth) {
      if (l.type === 'borrow') loansToPay += rem;
      else if (l.type === 'lend') loansToReceive += rem;
    }
  }
  for (const l of liabilities) {
    if (l.status === 'settled') continue;
    const amt = Math.max(0, Number(l.amount) || 0);
    if (!amt) continue;
    const due = toDate(l.dueDate);
    if (l.status === 'overdue' || (due && due <= endOfMonth)) {
      if (l.type === 'borrowed') loansToPay += amt;
      else if (l.type === 'lend') loansToReceive += amt;
    }
  }

  return {
    spendable: Math.round(spendable),
    reserved: Math.round(reserved),
    savings: Math.round(savings),
    amanat: Math.round(amanat),
    expensesDue: Math.round(expensesDue),
    loansToPay: Math.round(loansToPay),
    loansToReceive: Math.round(loansToReceive),
  };
}
