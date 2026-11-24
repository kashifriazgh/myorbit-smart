import type {
  Expenditure,
  FundOwnershipState,
  Liability,
  LoanRecord,
  PlannedExpense,
  TotalCashSnapshot,
  WalletAllocation,
} from '../interface';

// ============================================================================
// Public Types
// ============================================================================

export type AnalysisPeriodPreset =
  | 'remaining_current_month'
  | 'next_30_days'
  | 'end_of_next_month'
  | 'custom';

export type AffordabilityVerdictCode =
  | 'comfortably_affordable'
  | 'affordable_but_risky'
  | 'conditionally_affordable'
  | 'not_affordable';

export interface AffordabilityVerdict {
  code: AffordabilityVerdictCode;
  label: string;
  color: 'green' | 'amber' | 'blue' | 'red';
  summary: string;
}

export interface ReserveEnvelopePool {
  id: string;
  walletKey: string;
  walletLabel: string;
  purpose: string;
  originalAmount: number;
  allocatedToObligations: number;
  remainingAmount: number;
}

export interface WalletOwnershipSummary {
  walletKey: string;
  label: string;
  grossBalance: number;
  spendable: number;
  reserve: number;
  saving: number;
  amanat: number;
  isLocked: boolean;
}

export interface OwnershipBreakdown {
  totalWalletBalance: number;
  totalSpendable: number;
  totalReserve: number;
  totalSaving: number;
  totalAmanat: number;
  excludedVirtualWalletCount: number;
  wallets: WalletOwnershipSummary[];
  reserveEnvelopes: ReserveEnvelopePool[];
}

export interface ExpenseObligationDetail {
  id: string;
  source: 'plannedExpenses' | 'expenditures';
  title: string;
  category: string;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  reserveCoveredAmount: number;
  uncoveredAmount: number;
  matchedEnvelopeLabel?: string;
  isOverdue: boolean;
  hasUndefinedStatus: boolean;
}

export interface LoanObligationDetail {
  id: string;
  source: 'loans' | 'liabilities';
  direction: 'borrow' | 'lend';
  counterparty: string;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  reserveCoveredAmount: number;
  uncoveredAmount: number;
  matchedEnvelopeLabel?: string;
  isOverdue: boolean;
}

export interface AffordabilityDisclosure {
  code:
    | 'undefined_payment_status'
    | 'conservative_reserve_matching'
    | 'undated_borrowed_loans'
    | 'undated_lent_loans'
    | 'virtual_wallets_excluded'
    | 'allocation_exceeds_wallet_balance'
    | 'existing_deficit';
  severity: 'info' | 'warning';
  title: string;
  message: string;
}

export interface AffordabilityRecommendation {
  type: 'positive' | 'caution' | 'action' | 'warning';
  title: string;
  detail: string;
}

export interface AffordabilityInput {
  purchaseName?: string;
  proposedPurchaseAmount: number;
  emergencyBuffer: number;
  periodPreset?: AnalysisPeriodPreset;
  customPeriodEnd?: Date | string | null;
  /** Reference "today" date (defaults to current date; injectable for deterministic tests) */
  referenceDate?: Date;
  snapshot: TotalCashSnapshot | null;
  plannedExpenses: PlannedExpense[];
  expenditures: Expenditure[];
  loans: LoanRecord[];
  liabilities?: Liability[];
}

export interface AffordabilityResult {
  purchaseName: string;
  proposedPurchaseAmount: number;
  emergencyBuffer: number;
  period: {
    preset: AnalysisPeriodPreset;
    label: string;
    startDate: string;
    endDate: string;
  };
  ownership: OwnershipBreakdown;
  obligations: {
    pendingExpenses: ExpenseObligationDetail[];
    borrowedLoanRepayments: LoanObligationDetail[];
    expectedLoanRecoveries: LoanObligationDetail[];
    totalPendingExpenses: number;
    totalOverdueExpenses: number;
    totalUpcomingLoanRepayments: number;
    totalOverdueLoanRepayments: number;
    totalObligationsGross: number;
    obligationsCoveredByReserve: number;
    uncoveredPendingExpenses: number;
    uncoveredLoanRepayments: number;
    totalUncoveredObligations: number;
    totalExpectedLoanRecoveries: number;
    undatedBorrowedLoanTotal: number;
    undatedLentLoanTotal: number;
  };
  capacity: {
    netSpendableCapacity: number;
    safePurchasingCapacity: number;
    projectedSafePurchasingCapacity: number;
    remainingPostPurchaseSafeBalance: number;
    remainingPostPurchaseNetBalance: number;
    purchaseShortfall: number;
    netShortfall: number;
  };
  verdict: AffordabilityVerdict;
  recommendations: AffordabilityRecommendation[];
  disclosures: AffordabilityDisclosure[];
}

// ============================================================================
// Pure Date Helpers (Timezone-safe local YYYY-MM-DD comparisons)
// ============================================================================

type DateLike =
  | Date
  | string
  | { toDate: () => Date }
  | { seconds: number }
  | null
  | undefined;

export function toStartOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateLike(value: DateLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : toStartOfLocalDay(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Handle YYYY-MM-DD strictly in local time to prevent UTC day-shift
    const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (isoDateOnly) {
      const y = Number(isoDateOnly[1]);
      const m = Number(isoDateOnly[2]) - 1;
      const d = Number(isoDateOnly[3]);
      const parsed = new Date(y, m, d);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : toStartOfLocalDay(parsed);
  }
  if (typeof value === 'object') {
    if ('toDate' in value && typeof value.toDate === 'function') {
      const d = value.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? toStartOfLocalDay(d) : null;
    }
    if ('seconds' in value && typeof value.seconds === 'number') {
      const d = new Date(value.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : toStartOfLocalDay(d);
    }
  }
  return null;
}

export function resolveAnalysisPeriod(
  preset: AnalysisPeriodPreset = 'remaining_current_month',
  referenceDate: Date = new Date(),
  customPeriodEnd?: Date | string | null
): { preset: AnalysisPeriodPreset; label: string; startDate: Date; endDate: Date } {
  const startDate = toStartOfLocalDay(referenceDate);

  if (preset === 'next_30_days') {
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 30);
    return {
      preset,
      label: 'Next 30 Days (incl. overdue)',
      startDate,
      endDate,
    };
  }

  if (preset === 'end_of_next_month') {
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 2, 0);
    return {
      preset,
      label: 'Through End of Next Month (incl. overdue)',
      startDate,
      endDate,
    };
  }

  if (preset === 'custom') {
    const parsedEnd = parseDateLike(customPeriodEnd);
    const endDate =
      parsedEnd && parsedEnd >= startDate
        ? parsedEnd
        : new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    return {
      preset,
      label: `Through ${formatLocalDateKey(endDate)} (incl. overdue)`,
      startDate,
      endDate,
    };
  }

  // Default: remaining current month (including overdue obligations)
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
  return {
    preset: 'remaining_current_month',
    label: 'Remaining Current Month (incl. overdue)',
    startDate,
    endDate,
  };
}

// ============================================================================
// Ownership Analysis (Zero Double-Counting)
// ============================================================================

const SAVINGS_KEYWORD_REGEX = /saving|emergency|goal|fund|invest/i;

function sanitizeMoney(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

function normalizeLabel(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function classifyAllocationState(
  alloc: WalletAllocation,
  walletIsLocked: boolean,
  isSavingsWallet: boolean
): FundOwnershipState {
  const ownerLower = normalizeLabel(alloc.owner);
  const isSelf = ownerLower === 'you' || ownerLower === 'self' || ownerLower === '';
  const isSavingsAlloc = isSavingsWallet || SAVINGS_KEYWORD_REGEX.test(alloc.purpose || '');

  // 1. Explicit 4-state fundState / availabilityStatus
  if (alloc.fundState === 'amanat' || alloc.availabilityStatus === 'external') {
    return 'amanat';
  }
  if (
    alloc.fundState === 'savings' ||
    alloc.availabilityStatus === 'savings' ||
    ownerLower === 'savings'
  ) {
    return 'savings';
  }
  if (
    alloc.fundState === 'reserved' ||
    alloc.availabilityStatus === 'reserved' ||
    ownerLower === 'reserved'
  ) {
    return 'reserved';
  }
  if (alloc.fundState === 'spendable') {
    return walletIsLocked || alloc.isLocked ? 'reserved' : 'spendable';
  }

  // 2. Fallback for legacy allocations without explicit fundState
  if (!isSelf) {
    return 'amanat';
  }
  if (walletIsLocked || alloc.isLocked) {
    return isSavingsAlloc ? 'savings' : 'reserved';
  }
  return 'spendable';
}

export function analyzeWalletOwnership(
  snapshot: TotalCashSnapshot | null,
  disclosures?: AffordabilityDisclosure[]
): OwnershipBreakdown {
  const result: OwnershipBreakdown = {
    totalWalletBalance: 0,
    totalSpendable: 0,
    totalReserve: 0,
    totalSaving: 0,
    totalAmanat: 0,
    excludedVirtualWalletCount: 0,
    wallets: [],
    reserveEnvelopes: [],
  };

  if (!snapshot || !snapshot.sources) return result;

  const { sources, sourceOwnership } = snapshot;
  let allocationExceedsBalanceCount = 0;

  const processWallet = (
    walletKey: string,
    label: string,
    rawBalance: number,
    isCustom: boolean
  ) => {
    const o = sourceOwnership?.[walletKey];
    const isVirtual = Boolean(o?.parentWalletKey || o?.isVirtual);
    if (isVirtual) {
      result.excludedVirtualWalletCount += 1;
      return;
    }

    const grossBalance = sanitizeMoney(rawBalance);
    if (grossBalance <= 0) return;

    const isLocked = Boolean(o?.isLocked);
    const isSavingsWallet = SAVINGS_KEYWORD_REGEX.test(`${o?.purpose || ''} ${label}`);

    let wSpendable = 0;
    let wReserve = 0;
    let wSaving = 0;
    let wAmanat = 0;

    if (o?.allocations && o.allocations.length > 0) {
      const positiveAllocs = o.allocations.filter((a) => sanitizeMoney(a.amount) > 0);
      const rawAllocatedTotal = positiveAllocs.reduce((sum, a) => sum + sanitizeMoney(a.amount), 0);

      // Guard against data drift where envelope sum exceeds gross wallet balance:
      // scale envelopes proportionally so wallet + envelopes NEVER double-count or exceed actual balance.
      const scaleFactor =
        rawAllocatedTotal > grossBalance && rawAllocatedTotal > 0
          ? grossBalance / rawAllocatedTotal
          : 1;

      if (scaleFactor < 1) {
        allocationExceedsBalanceCount += 1;
      }

      let allocatedUsed = 0;

      for (const alloc of positiveAllocs) {
        const effectiveAmt = sanitizeMoney(sanitizeMoney(alloc.amount) * scaleFactor);
        if (effectiveAmt <= 0) continue;
        allocatedUsed += effectiveAmt;

        const state = classifyAllocationState(alloc, isLocked, isSavingsWallet);

        if (state === 'amanat') {
          wAmanat += effectiveAmt;
        } else if (state === 'savings') {
          wSaving += effectiveAmt;
        } else if (state === 'reserved') {
          wReserve += effectiveAmt;
          result.reserveEnvelopes.push({
            id: alloc.id || `${walletKey}_${result.reserveEnvelopes.length}`,
            walletKey,
            walletLabel: label,
            purpose: (alloc.purpose || '').trim(),
            originalAmount: effectiveAmt,
            allocatedToObligations: 0,
            remainingAmount: effectiveAmt,
          });
        } else {
          // Spendable envelope — still respect any legacy `reservedAmount` on the envelope
          const legacyRes = Math.min(
            effectiveAmt,
            sanitizeMoney(sanitizeMoney(alloc.reservedAmount) * scaleFactor)
          );
          const usable = Math.max(0, sanitizeMoney(effectiveAmt - legacyRes));
          if (legacyRes > 0) {
            const isSavingsAlloc = isSavingsWallet || SAVINGS_KEYWORD_REGEX.test(alloc.purpose || '');
            if (isSavingsAlloc) {
              wSaving += legacyRes;
            } else {
              wReserve += legacyRes;
              if ((alloc.purpose || '').trim()) {
                result.reserveEnvelopes.push({
                  id: `${alloc.id || walletKey}_res`,
                  walletKey,
                  walletLabel: label,
                  purpose: (alloc.purpose || '').trim(),
                  originalAmount: legacyRes,
                  allocatedToObligations: 0,
                  remainingAmount: legacyRes,
                });
              }
            }
          }
          wSpendable += usable;
        }
      }

      // Remainder of wallet balance not assigned to any envelope
      const remainder = Math.max(0, sanitizeMoney(grossBalance - allocatedUsed));
      if (remainder > 0) {
        const walletDefaultOwn =
          typeof o.hasOwnThisMoney === 'boolean' ? o.hasOwnThisMoney : !isCustom;
        if (!walletDefaultOwn || o.fundState === 'amanat') {
          wAmanat += remainder;
        } else if (o.fundState === 'savings') {
          wSaving += remainder;
        } else if (o.fundState === 'reserved') {
          wReserve += remainder;
        } else if (isLocked) {
          if (isSavingsWallet) wSaving += remainder;
          else wReserve += remainder;
        } else {
          wSpendable += remainder;
        }
      }
    } else {
      // Wallet without envelopes
      const isOwn = o
        ? typeof o.hasOwnThisMoney === 'boolean'
          ? o.hasOwnThisMoney
          : !isCustom
        : !isCustom;

      if (!isOwn || o?.fundState === 'amanat') {
        wAmanat += grossBalance;
      } else if (o?.fundState === 'savings') {
        wSaving += grossBalance;
      } else if (o?.fundState === 'reserved') {
        wReserve += grossBalance;
        if ((o.purpose || '').trim()) {
          result.reserveEnvelopes.push({
            id: `wallet_res_${walletKey}`,
            walletKey,
            walletLabel: label,
            purpose: (o.purpose || '').trim(),
            originalAmount: grossBalance,
            allocatedToObligations: 0,
            remainingAmount: grossBalance,
          });
        }
      } else if (isLocked) {
        if (isSavingsWallet) wSaving += grossBalance;
        else wReserve += grossBalance;
      } else {
        const res = Math.min(grossBalance, Math.max(0, sanitizeMoney(o?.reservedAmount)));
        const usable = Math.max(0, sanitizeMoney(grossBalance - res));
        if (res > 0) {
          if (isSavingsWallet) {
            wSaving += res;
          } else {
            wReserve += res;
            if ((o?.purpose || '').trim()) {
              result.reserveEnvelopes.push({
                id: `wallet_res_${walletKey}`,
                walletKey,
                walletLabel: label,
                purpose: (o?.purpose || '').trim(),
                originalAmount: res,
                allocatedToObligations: 0,
                remainingAmount: res,
              });
            }
          }
        }
        wSpendable += usable;
      }
    }

    wSpendable = sanitizeMoney(wSpendable);
    wReserve = sanitizeMoney(wReserve);
    wSaving = sanitizeMoney(wSaving);
    wAmanat = sanitizeMoney(wAmanat);

    result.totalWalletBalance = sanitizeMoney(result.totalWalletBalance + grossBalance);
    result.totalSpendable = sanitizeMoney(result.totalSpendable + wSpendable);
    result.totalReserve = sanitizeMoney(result.totalReserve + wReserve);
    result.totalSaving = sanitizeMoney(result.totalSaving + wSaving);
    result.totalAmanat = sanitizeMoney(result.totalAmanat + wAmanat);

    result.wallets.push({
      walletKey,
      label,
      grossBalance,
      spendable: wSpendable,
      reserve: wReserve,
      saving: wSaving,
      amanat: wAmanat,
      isLocked,
    });
  };

  const builtinLabels: Record<string, string> = {
    in_hand: 'Cash in Hand',
    easypaisa: 'Easypaisa',
    jazzcash: 'JazzCash',
    other: 'Other Wallet',
  };

  for (const [key, val] of Object.entries(sources)) {
    if (key === 'bank' && typeof val === 'object' && val !== null) {
      for (const [bankName, bankAmt] of Object.entries(val as Record<string, number>)) {
        if (typeof bankAmt === 'number') {
          processWallet(`bank:${bankName}`, bankName, bankAmt, false);
        }
      }
    } else if (key === 'custom' && typeof val === 'object' && val !== null) {
      for (const [customName, customAmt] of Object.entries(val as Record<string, number>)) {
        if (typeof customAmt === 'number') {
          processWallet(`custom:${customName}`, customName, customAmt, true);
        }
      }
    } else if (typeof val === 'number') {
      processWallet(key, builtinLabels[key] || key, val, false);
    }
  }

  if (disclosures) {
    if (result.excludedVirtualWalletCount > 0) {
      disclosures.push({
        code: 'virtual_wallets_excluded',
        severity: 'info',
        title: 'Virtual wallets excluded from totals',
        message: `${result.excludedVirtualWalletCount} virtual wallet(s) backed by parent wallets were excluded so your funds are never double-counted.`,
      });
    }
    if (allocationExceedsBalanceCount > 0) {
      disclosures.push({
        code: 'allocation_exceeds_wallet_balance',
        severity: 'warning',
        title: 'Envelope totals exceeded wallet balance',
        message: `${allocationExceedsBalanceCount} wallet(s) had envelope allocations exceeding their recorded wallet balance. Envelopes were capped proportionally to the actual wallet balance to avoid overstating capacity.`,
      });
    }
  }

  return result;
}

// ============================================================================
// Conservative Reserve Matching (Never Double-Allocates a Reserve Pool)
// ============================================================================

function matchReservePool(
  targetTitle: string,
  requiredAmount: number,
  reserveEnvelopes: ReserveEnvelopePool[],
  explicitEnvelopeId?: string | null,
  explicitEnvelopeName?: string | null
): { coveredAmount: number; matchedLabel?: string } {
  if (requiredAmount <= 0 || reserveEnvelopes.length === 0) {
    return { coveredAmount: 0 };
  }

  const normalizedTitle = normalizeLabel(targetTitle);
  const normalizedExplicitName = normalizeLabel(explicitEnvelopeName);

  // 1. Explicit envelope ID match (e.g. loan linked to a reserved envelope)
  if (explicitEnvelopeId) {
    const byId = reserveEnvelopes.find(
      (pool) => pool.id === explicitEnvelopeId && pool.remainingAmount > 0
    );
    if (byId) {
      const used = Math.min(requiredAmount, byId.remainingAmount);
      byId.remainingAmount = sanitizeMoney(byId.remainingAmount - used);
      byId.allocatedToObligations = sanitizeMoney(byId.allocatedToObligations + used);
      return {
        coveredAmount: sanitizeMoney(used),
        matchedLabel: `${byId.purpose || byId.walletLabel} (${byId.walletLabel})`,
      };
    }
  }

  // 2. Exact case-insensitive purpose match on explicitly reserved envelopes
  const candidates = [normalizedExplicitName, normalizedTitle].filter(Boolean);
  if (candidates.length === 0) return { coveredAmount: 0 };

  let totalCovered = 0;
  const matchedNames: string[] = [];

  for (const pool of reserveEnvelopes) {
    if (pool.remainingAmount <= 0) continue;
    const poolPurpose = normalizeLabel(pool.purpose);
    if (!poolPurpose) continue;

    if (candidates.includes(poolPurpose)) {
      const stillNeeded = sanitizeMoney(requiredAmount - totalCovered);
      if (stillNeeded <= 0) break;
      const used = Math.min(stillNeeded, pool.remainingAmount);
      pool.remainingAmount = sanitizeMoney(pool.remainingAmount - used);
      pool.allocatedToObligations = sanitizeMoney(pool.allocatedToObligations + used);
      totalCovered = sanitizeMoney(totalCovered + used);
      matchedNames.push(`${pool.purpose} (${pool.walletLabel})`);
    }
  }

  return {
    coveredAmount: totalCovered,
    matchedLabel: matchedNames.length > 0 ? matchedNames.join(', ') : undefined,
  };
}

// ============================================================================
// Core Deterministic Calculation Engine
// ============================================================================

export function calculateAffordability(input: AffordabilityInput): AffordabilityResult {
  const referenceDate = toStartOfLocalDay(input.referenceDate ?? new Date());
  const proposedPurchaseAmount = Math.max(0, sanitizeMoney(input.proposedPurchaseAmount));
  const emergencyBuffer = Math.max(0, sanitizeMoney(input.emergencyBuffer));
  const purchaseName = (input.purchaseName || '').trim() || 'Proposed Purchase';

  const period = resolveAnalysisPeriod(
    input.periodPreset ?? 'remaining_current_month',
    referenceDate,
    input.customPeriodEnd
  );

  const disclosures: AffordabilityDisclosure[] = [];

  // 1. Wallet & Envelope Ownership Analysis
  const ownership = analyzeWalletOwnership(input.snapshot, disclosures);

  // Clone reserve pools for deterministic single-use matching
  const workingReservePools: ReserveEnvelopePool[] = ownership.reserveEnvelopes.map((p) => ({
    ...p,
  }));

  // 2. Financial Obligations Analysis
  const pendingExpenses: ExpenseObligationDetail[] = [];
  let undefinedStatusExpenseCount = 0;

  // 2a. Planned Expenses
  for (const exp of input.plannedExpenses || []) {
    const rawStatus = exp.paymentStatus as string | undefined;
    const hasUndefinedStatus = !rawStatus;

    if (rawStatus === 'paid') continue;

    const expectedAmount = Math.max(0, sanitizeMoney(exp.expectedAmount));
    const paidAmount = Math.max(0, sanitizeMoney(exp.actualPaidAmount));
    const remainingAmount = Math.max(0, sanitizeMoney(expectedAmount - paidAmount));
    if (remainingAmount <= 0) continue;

    // Determine effective due date(s) within or before periodEnd
    let effectiveDueDate: Date | null = null;
    if (Array.isArray(exp.dueDates) && exp.dueDates.length > 0) {
      const parsedDates = exp.dueDates
        .map((d) => parseDateLike(d))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());

      // Take the earliest due date that is <= period.endDate
      const inWindow = parsedDates.filter((d) => d <= period.endDate);
      if (inWindow.length === 0) continue;
      effectiveDueDate = inWindow[0];
    } else {
      effectiveDueDate = parseDateLike(exp.dueDate);
      // If a due date exists and is strictly after the analysis period, exclude it
      if (effectiveDueDate && effectiveDueDate > period.endDate) {
        continue;
      }
      // If dueDate is empty/null, include as unscheduled obligation for the current period
    }

    const isOverdue =
      rawStatus === 'overdue' || (effectiveDueDate !== null && effectiveDueDate < referenceDate);

    if (hasUndefinedStatus) {
      undefinedStatusExpenseCount += 1;
    }

    pendingExpenses.push({
      id: exp.id || `planned_${pendingExpenses.length}`,
      source: 'plannedExpenses',
      title: exp.title || 'Untitled Expense',
      category: exp.category || 'General',
      dueDate: effectiveDueDate ? formatLocalDateKey(effectiveDueDate) : null,
      totalAmount: expectedAmount,
      paidAmount,
      remainingAmount,
      reserveCoveredAmount: 0,
      uncoveredAmount: remainingAmount,
      isOverdue,
      hasUndefinedStatus,
    });
  }

  // 2b. Expenditures (legacy/recurring expenditures collection)
  for (const exp of input.expenditures || []) {
    if (exp.isPaid === true) continue;

    const hasUndefinedStatus = exp.isPaid === undefined;
    const totalAmount = Math.max(0, sanitizeMoney(exp.amount));
    if (totalAmount <= 0) continue;

    const effectiveDueDate = parseDateLike(exp.dueDate);
    if (effectiveDueDate && effectiveDueDate > period.endDate) {
      continue;
    }

    // Account for any partial payments recorded in paymentHistory for the current month/period
    const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const paidInPeriod = Array.isArray(exp.paymentHistory)
      ? exp.paymentHistory.reduce((sum, entry) => {
          const entryDate = parseDateLike(entry.date);
          if (entryDate && entryDate >= monthStart && entryDate <= period.endDate) {
            return sum + Math.max(0, sanitizeMoney(entry.amount));
          }
          return sum;
        }, 0)
      : 0;

    const remainingAmount = Math.max(0, sanitizeMoney(totalAmount - paidInPeriod));
    if (remainingAmount <= 0) continue;

    const isOverdue = effectiveDueDate !== null && effectiveDueDate < referenceDate;

    if (hasUndefinedStatus) {
      undefinedStatusExpenseCount += 1;
    }

    pendingExpenses.push({
      id: exp.id || `exp_${pendingExpenses.length}`,
      source: 'expenditures',
      title: exp.title || 'Untitled Expenditure',
      category: exp.category || 'General',
      dueDate: effectiveDueDate ? formatLocalDateKey(effectiveDueDate) : null,
      totalAmount,
      paidAmount: Math.min(totalAmount, paidInPeriod),
      remainingAmount,
      reserveCoveredAmount: 0,
      uncoveredAmount: remainingAmount,
      isOverdue,
      hasUndefinedStatus,
    });
  }

  // Sort pending expenses deterministically: overdue first, then earliest due date, then title
  pendingExpenses.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.title.localeCompare(b.title);
  });

  // Match pending expenses against designated Reserve envelopes (deterministic, single-use)
  for (const item of pendingExpenses) {
    const match = matchReservePool(item.title, item.remainingAmount, workingReservePools);
    item.reserveCoveredAmount = match.coveredAmount;
    item.uncoveredAmount = sanitizeMoney(item.remainingAmount - match.coveredAmount);
    item.matchedEnvelopeLabel = match.matchedLabel;
  }

  // 2c. Loans & Liabilities
  const borrowedLoanRepayments: LoanObligationDetail[] = [];
  const expectedLoanRecoveries: LoanObligationDetail[] = [];
  let undatedBorrowedLoanTotal = 0;
  let undatedLentLoanTotal = 0;

  for (const loan of input.loans || []) {
    if (loan.isSettled) continue;

    const totalAmount = Math.max(0, sanitizeMoney(loan.amount));
    const paidAmount = Math.max(0, sanitizeMoney(loan.paidAmount));
    const remainingAmount = Math.max(0, sanitizeMoney(totalAmount - paidAmount));
    if (remainingAmount <= 0) continue;

    const dueDate = parseDateLike(loan.dueDate);

    if (loan.type === 'borrow') {
      if (!dueDate) {
        undatedBorrowedLoanTotal = sanitizeMoney(undatedBorrowedLoanTotal + remainingAmount);
        continue;
      }
      if (dueDate > period.endDate) continue;

      const isOverdue = dueDate < referenceDate;
      const match = matchReservePool(
        loan.counterparty || '',
        remainingAmount,
        workingReservePools,
        loan.fromEnvelopeId,
        loan.fromEnvelopeName
      );

      borrowedLoanRepayments.push({
        id: loan.id || `loan_borrow_${borrowedLoanRepayments.length}`,
        source: 'loans',
        direction: 'borrow',
        counterparty: loan.counterparty || 'Unnamed Lender',
        dueDate: formatLocalDateKey(dueDate),
        totalAmount,
        paidAmount,
        remainingAmount,
        reserveCoveredAmount: match.coveredAmount,
        uncoveredAmount: sanitizeMoney(remainingAmount - match.coveredAmount),
        matchedEnvelopeLabel: match.matchedLabel,
        isOverdue,
      });
    } else if (loan.type === 'lend') {
      if (!dueDate) {
        undatedLentLoanTotal = sanitizeMoney(undatedLentLoanTotal + remainingAmount);
        continue;
      }
      if (dueDate > period.endDate) continue;

      const isOverdue = dueDate < referenceDate;
      expectedLoanRecoveries.push({
        id: loan.id || `loan_lend_${expectedLoanRecoveries.length}`,
        source: 'loans',
        direction: 'lend',
        counterparty: loan.counterparty || 'Unnamed Borrower',
        dueDate: formatLocalDateKey(dueDate),
        totalAmount,
        paidAmount,
        remainingAmount,
        reserveCoveredAmount: 0,
        uncoveredAmount: remainingAmount,
        isOverdue,
      });
    }
  }

  for (const liab of input.liabilities || []) {
    if (liab.status === 'settled') continue;

    const remainingAmount = Math.max(0, sanitizeMoney(liab.amount));
    if (remainingAmount <= 0) continue;

    const dueDate = parseDateLike(liab.dueDate);

    if (liab.type === 'borrowed') {
      const isOverdue = liab.status === 'overdue' || (dueDate !== null && dueDate < referenceDate);
      if (!dueDate && !isOverdue) {
        undatedBorrowedLoanTotal = sanitizeMoney(undatedBorrowedLoanTotal + remainingAmount);
        continue;
      }
      if (dueDate && dueDate > period.endDate && !isOverdue) continue;

      const match = matchReservePool(
        liab.personName || '',
        remainingAmount,
        workingReservePools
      );

      borrowedLoanRepayments.push({
        id: liab.id || `liab_borrow_${borrowedLoanRepayments.length}`,
        source: 'liabilities',
        direction: 'borrow',
        counterparty: liab.personName || 'Unnamed Lender',
        dueDate: dueDate ? formatLocalDateKey(dueDate) : null,
        totalAmount: remainingAmount,
        paidAmount: 0,
        remainingAmount,
        reserveCoveredAmount: match.coveredAmount,
        uncoveredAmount: sanitizeMoney(remainingAmount - match.coveredAmount),
        matchedEnvelopeLabel: match.matchedLabel,
        isOverdue,
      });
    } else if (liab.type === 'lend') {
      const isOverdue = liab.status === 'overdue' || (dueDate !== null && dueDate < referenceDate);
      if (!dueDate && !isOverdue) {
        undatedLentLoanTotal = sanitizeMoney(undatedLentLoanTotal + remainingAmount);
        continue;
      }
      if (dueDate && dueDate > period.endDate && !isOverdue) continue;

      expectedLoanRecoveries.push({
        id: liab.id || `liab_lend_${expectedLoanRecoveries.length}`,
        source: 'liabilities',
        direction: 'lend',
        counterparty: liab.personName || 'Unnamed Borrower',
        dueDate: dueDate ? formatLocalDateKey(dueDate) : null,
        totalAmount: remainingAmount,
        paidAmount: 0,
        remainingAmount,
        reserveCoveredAmount: 0,
        uncoveredAmount: remainingAmount,
        isOverdue,
      });
    }
  }

  // Update ownership reserve envelopes with actual allocated/remaining amounts
  ownership.reserveEnvelopes = workingReservePools;

  // 3. Aggregate Totals
  const totalPendingExpenses = sanitizeMoney(
    pendingExpenses.reduce((sum, e) => sum + e.remainingAmount, 0)
  );
  const totalOverdueExpenses = sanitizeMoney(
    pendingExpenses.filter((e) => e.isOverdue).reduce((sum, e) => sum + e.remainingAmount, 0)
  );
  const uncoveredPendingExpenses = sanitizeMoney(
    pendingExpenses.reduce((sum, e) => sum + e.uncoveredAmount, 0)
  );

  const totalUpcomingLoanRepayments = sanitizeMoney(
    borrowedLoanRepayments.reduce((sum, l) => sum + l.remainingAmount, 0)
  );
  const totalOverdueLoanRepayments = sanitizeMoney(
    borrowedLoanRepayments.filter((l) => l.isOverdue).reduce((sum, l) => sum + l.remainingAmount, 0)
  );
  const uncoveredLoanRepayments = sanitizeMoney(
    borrowedLoanRepayments.reduce((sum, l) => sum + l.uncoveredAmount, 0)
  );

  const totalObligationsGross = sanitizeMoney(totalPendingExpenses + totalUpcomingLoanRepayments);
  const obligationsCoveredByReserve = sanitizeMoney(
    pendingExpenses.reduce((sum, e) => sum + e.reserveCoveredAmount, 0) +
      borrowedLoanRepayments.reduce((sum, l) => sum + l.reserveCoveredAmount, 0)
  );
  const totalUncoveredObligations = sanitizeMoney(
    uncoveredPendingExpenses + uncoveredLoanRepayments
  );
  const totalExpectedLoanRecoveries = sanitizeMoney(
    expectedLoanRecoveries.reduce((sum, l) => sum + l.remainingAmount, 0)
  );

  // 4. Core Capacity Formulas (NEVER clamp negative balances to 0)
  const netSpendableCapacity = sanitizeMoney(ownership.totalSpendable - totalUncoveredObligations);
  const safePurchasingCapacity = sanitizeMoney(netSpendableCapacity - emergencyBuffer);
  const projectedSafePurchasingCapacity = sanitizeMoney(
    safePurchasingCapacity + totalExpectedLoanRecoveries
  );
  const remainingPostPurchaseSafeBalance = sanitizeMoney(
    safePurchasingCapacity - proposedPurchaseAmount
  );
  const remainingPostPurchaseNetBalance = sanitizeMoney(
    netSpendableCapacity - proposedPurchaseAmount
  );
  const purchaseShortfall = Math.max(
    0,
    sanitizeMoney(proposedPurchaseAmount - safePurchasingCapacity)
  );
  const netShortfall = Math.max(0, sanitizeMoney(proposedPurchaseAmount - netSpendableCapacity));

  // 5. Verdict Classification (strict priority order)
  let verdict: AffordabilityVerdict;

  if (proposedPurchaseAmount <= safePurchasingCapacity) {
    verdict = {
      code: 'comfortably_affordable',
      label: 'Comfortably Affordable',
      color: 'green',
      summary: `You can afford ${purchaseName} while keeping all uncovered obligations and your emergency buffer intact.`,
    };
  } else if (proposedPurchaseAmount <= netSpendableCapacity) {
    verdict = {
      code: 'affordable_but_risky',
      label: 'Affordable but Risky',
      color: 'amber',
      summary: `Your spendable funds cover ${purchaseName} and obligations, but this purchase dips into your emergency buffer.`,
    };
  } else if (
    totalExpectedLoanRecoveries > 0 &&
    proposedPurchaseAmount <= projectedSafePurchasingCapacity
  ) {
    verdict = {
      code: 'conditionally_affordable',
      label: 'Conditionally Affordable',
      color: 'blue',
      summary: `Not safely affordable today, but becomes affordable if expected lent loan recoveries are collected on time.`,
    };
  } else {
    verdict = {
      code: 'not_affordable',
      label: 'Not Affordable',
      color: 'red',
      summary: `This purchase exceeds your safe purchasing capacity and would compromise your obligations or buffer.`,
    };
  }

  // 6. Disclosures
  if (undefinedStatusExpenseCount > 0) {
    disclosures.push({
      code: 'undefined_payment_status',
      severity: 'warning',
      title: 'Expenses with undefined payment status',
      message: `${undefinedStatusExpenseCount} expense record(s) did not specify a payment status and were conservatively treated as unpaid.`,
    });
  }

  const unmatchedReserveFunds = sanitizeMoney(ownership.totalReserve - obligationsCoveredByReserve);
  if (unmatchedReserveFunds > 0 && totalUncoveredObligations > 0) {
    disclosures.push({
      code: 'conservative_reserve_matching',
      severity: 'info',
      title: 'Conservative Reserve matching applied',
      message: `Rs. ${unmatchedReserveFunds.toLocaleString('en-PK')} in Reserve funds had no exact title/envelope link to pending obligations. To stay conservative, unlinked Reserve funds were not assumed to cover unrelated obligations.`,
    });
  }

  if (undatedBorrowedLoanTotal > 0) {
    disclosures.push({
      code: 'undated_borrowed_loans',
      severity: 'warning',
      title: 'Undated borrowed loans excluded from period window',
      message: `Rs. ${undatedBorrowedLoanTotal.toLocaleString('en-PK')} in active borrowed loan(s) have no due date set and were not deducted from this period. Add due dates on the Loans page for exact planning.`,
    });
  }

  if (undatedLentLoanTotal > 0) {
    disclosures.push({
      code: 'undated_lent_loans',
      severity: 'info',
      title: 'Undated lent loans excluded from expected recoveries',
      message: `Rs. ${undatedLentLoanTotal.toLocaleString('en-PK')} in active lent loan(s) have no due date and were excluded from expected recoveries.`,
    });
  }

  if (netSpendableCapacity < 0) {
    disclosures.push({
      code: 'existing_deficit',
      severity: 'warning',
      title: 'Existing spendable deficit detected',
      message: `Your uncovered obligations exceed your current Spendable balance by Rs. ${Math.abs(netSpendableCapacity).toLocaleString('en-PK')} even before this purchase.`,
    });
  }

  // 7. Context-Aware Recommendations (NEVER recommend Amanat, NEVER auto-recommend withdrawing Savings or repurposing Reserve)
  const recommendations: AffordabilityRecommendation[] = [];
  const fmt = (n: number) => `Rs. ${Math.abs(n).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

  if (verdict.code === 'comfortably_affordable') {
    recommendations.push({
      type: 'positive',
      title: 'Safe to proceed',
      detail: `After paying for ${purchaseName} (${fmt(proposedPurchaseAmount)}), you will still retain ${fmt(remainingPostPurchaseSafeBalance)} above your ${fmt(emergencyBuffer)} emergency buffer and all ${fmt(totalUncoveredObligations)} in uncovered obligations.`,
    });
    if (totalOverdueExpenses + totalOverdueLoanRepayments > 0) {
      recommendations.push({
        type: 'caution',
        title: 'Clear overdue obligations first',
        detail: `You have ${fmt(totalOverdueExpenses + totalOverdueLoanRepayments)} in overdue expenses or repayments. Settle those first so late fees or commitments do not slip.`,
      });
    }
  } else if (verdict.code === 'affordable_but_risky') {
    const bufferImpact = sanitizeMoney(proposedPurchaseAmount - Math.max(0, safePurchasingCapacity));
    recommendations.push({
      type: 'caution',
      title: 'Emergency buffer would be reduced',
      detail: `Proceeding now leaves ${fmt(remainingPostPurchaseNetBalance)} after obligations, which reduces your ${fmt(emergencyBuffer)} emergency buffer by ${fmt(bufferImpact)}.`,
    });
    recommendations.push({
      type: 'action',
      title: 'Consider waiting or lowering the budget',
      detail:
        safePurchasingCapacity > 0
          ? `To keep your full emergency buffer intact, limit this purchase to ${fmt(safePurchasingCapacity)} or wait until additional Spendable income arrives.`
          : `Delay this purchase until your Spendable balance grows by at least ${fmt(purchaseShortfall)}.`,
    });
  } else if (verdict.code === 'conditionally_affordable') {
    const neededRecovery = sanitizeMoney(proposedPurchaseAmount - safePurchasingCapacity);
    recommendations.push({
      type: 'caution',
      title: 'Wait until lent loan recoveries are received',
      detail: `You currently have a safe shortfall of ${fmt(neededRecovery)}, but ${fmt(totalExpectedLoanRecoveries)} in lent loan recoveries are expected in this period. Do not commit to the purchase until those funds are actually in your Spendable wallet.`,
    });
    recommendations.push({
      type: 'action',
      title: 'Follow up on due recoveries',
      detail: `Confirm repayment dates with borrowers before making this purchase so your obligations and emergency buffer remain protected.`,
    });
  } else {
    recommendations.push({
      type: 'warning',
      title: 'Delay this purchase',
      detail:
        netSpendableCapacity < 0
          ? `You already have a spendable deficit of ${fmt(netSpendableCapacity)} against upcoming obligations. Focus on covering existing commitments before new discretionary purchases.`
          : `This purchase creates a safe capacity shortfall of ${fmt(purchaseShortfall)} (and exceeds net spendable capacity by ${fmt(netShortfall)}).`,
    });
    if (totalOverdueExpenses + totalOverdueLoanRepayments > 0) {
      recommendations.push({
        type: 'action',
        title: 'Prioritize overdue obligations',
        detail: `Clear ${fmt(totalOverdueExpenses + totalOverdueLoanRepayments)} in overdue expenses and borrowed loan repayments first.`,
      });
    }
    if (safePurchasingCapacity > 0) {
      recommendations.push({
        type: 'action',
        title: 'Alternative budget ceiling',
        detail: `Your current maximum safe purchase amount without touching your buffer, Reserve, Savings, or Amanat is ${fmt(safePurchasingCapacity)}.`,
      });
    }
  }

  // Always explicitly affirm protection of Amanat and Savings when present
  if (ownership.totalAmanat > 0) {
    recommendations.push({
      type: 'positive',
      title: 'Amanat funds strictly excluded',
      detail: `${fmt(ownership.totalAmanat)} held as third-party Amanat was completely excluded from your purchasing capacity.`,
    });
  }
  if (ownership.totalSaving > 0 && verdict.code !== 'comfortably_affordable') {
    recommendations.push({
      type: 'caution',
      title: 'Long-term Savings protected',
      detail: `${fmt(ownership.totalSaving)} in Savings was excluded from normal purchasing capacity to protect your long-term goals.`,
    });
  }

  return {
    purchaseName,
    proposedPurchaseAmount,
    emergencyBuffer,
    period: {
      preset: period.preset,
      label: period.label,
      startDate: formatLocalDateKey(period.startDate),
      endDate: formatLocalDateKey(period.endDate),
    },
    ownership,
    obligations: {
      pendingExpenses,
      borrowedLoanRepayments,
      expectedLoanRecoveries,
      totalPendingExpenses,
      totalOverdueExpenses,
      totalUpcomingLoanRepayments,
      totalOverdueLoanRepayments,
      totalObligationsGross,
      obligationsCoveredByReserve,
      uncoveredPendingExpenses,
      uncoveredLoanRepayments,
      totalUncoveredObligations,
      totalExpectedLoanRecoveries,
      undatedBorrowedLoanTotal,
      undatedLentLoanTotal,
    },
    capacity: {
      netSpendableCapacity,
      safePurchasingCapacity,
      projectedSafePurchasingCapacity,
      remainingPostPurchaseSafeBalance,
      remainingPostPurchaseNetBalance,
      purchaseShortfall,
      netShortfall,
    },
    verdict,
    recommendations,
    disclosures,
  };
}
