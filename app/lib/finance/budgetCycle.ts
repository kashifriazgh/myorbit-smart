const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface BudgetCycle {
  year: number;
  month: number; // 0-indexed (0 = Jan ... 11 = Dec)
  name: string;
  label: string; // e.g. "December 2026"
  startDate: Date;
  endDate: Date;
  rangeLabel: string; // e.g. "25 Nov – 24 Dec"
  startDay: number;
}

/**
 * Valid salary / budget month start days:
 * - 1..14: starts that calendar month when the day arrives (e.g. 5 Dec starts Dec)
 * - 21..31: starts the NEXT calendar month on that day (e.g. 25 Nov starts Dec)
 * - 15..20: NOT allowed
 */
export function isValidBudgetStartDay(day: number): boolean {
  if (!Number.isInteger(day)) return false;
  return (day >= 1 && day <= 14) || (day >= 21 && day <= 31);
}

export function normalizeBudgetStartDay(day?: number | null): number {
  const n = Math.round(Number(day));
  return isValidBudgetStartDay(n) ? n : 1;
}

function clampDay(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(1, day), lastDay);
}

function formatShort(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/**
 * Compute the active (offset = 0) or subsequent (offset = 1, ...) budget month cycle
 * for a given startDay and reference date.
 */
export function getBudgetCycle(
  rawStartDay = 1,
  now: Date = new Date(),
  offset = 0
): BudgetCycle {
  const startDay = normalizeBudgetStartDay(rawStartDay);
  const y = now.getFullYear();
  const m = now.getMonth();
  const todayDate = now.getDate();

  const baseYear = y;
  let baseMonth = m;

  if (startDay >= 21) {
    // 21..31: when this day arrives in month M, it starts budget month M+1
    const triggerDay = clampDay(y, m, startDay);
    if (todayDate >= triggerDay) {
      baseMonth = m + 1;
    }
  } else {
    // 1..14: before this day arrives in month M, we are still in budget month M-1
    const triggerDay = clampDay(y, m, startDay);
    if (todayDate < triggerDay) {
      baseMonth = m - 1;
    }
  }

  const target = new Date(baseYear, baseMonth + offset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();

  let startDate: Date;
  let nextStart: Date;

  if (startDay >= 21) {
    const prevAnchor = new Date(year, month - 1, 1);
    const py = prevAnchor.getFullYear();
    const pm = prevAnchor.getMonth();
    startDate = new Date(py, pm, clampDay(py, pm, startDay), 0, 0, 0, 0);
    nextStart = new Date(year, month, clampDay(year, month, startDay), 0, 0, 0, 0);
  } else {
    startDate = new Date(year, month, clampDay(year, month, startDay), 0, 0, 0, 0);
    const nextAnchor = new Date(year, month + 1, 1);
    const ny = nextAnchor.getFullYear();
    const nm = nextAnchor.getMonth();
    nextStart = new Date(ny, nm, clampDay(ny, nm, startDay), 0, 0, 0, 0);
  }

  const endDate = new Date(
    nextStart.getFullYear(),
    nextStart.getMonth(),
    nextStart.getDate() - 1,
    23,
    59,
    59,
    999
  );

  return {
    year,
    month,
    name: MONTH_NAMES[month],
    label: `${MONTH_NAMES[month]} ${year}`,
    startDate,
    endDate,
    rangeLabel: `${formatShort(startDate)} – ${formatShort(endDate)}`,
    startDay,
  };
}
