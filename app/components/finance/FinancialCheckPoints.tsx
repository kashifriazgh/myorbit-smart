'use client';

import { useMemo, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from '@mui/material';
import { useOnboarding } from '@/app/lib/context/onBoardingContext';
import type {
  InitialOnBoarding,
  TotalCashSnapshot,
  IncomeSource,
  Expenditure,
  LoanRecord,
} from '@/app/lib/interface';
import moment from 'moment';
import {
  getDocs,
  query,
  where,
  collection,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';

// ------------------ Stage Types ------------------
interface Stage {
  label: string;
  start: Date;
  from: Date;
  to: Date;
}

interface StageMakerArgs {
  startOfMonth?: number | string;
  today?: Date;
}

// ------------------ Helpers ------------------

function toMoment(value?: Date | Timestamp | null): moment.Moment | null {
  if (!value) return null;
  if (value instanceof Timestamp) {
    try {
      return moment(value.toDate());
    } catch {
      /* ignore */
    }
  }
  return moment(value as Date);
}

// ------------------ Stage Maker ------------------
export function stagesMaker({ today = new Date() }: StageMakerArgs): Stage[] {
  const stages: Stage[] = [];
  const mToday = moment(today).startOf('day');

  const pushStage = (
    rawLabel: string,
    date: moment.Moment,
    from: moment.Moment
  ) => {
    const formatted = date.format('ddd DD MMM YY');
    stages.push({
      label: formatted,
      start: date.toDate(),
      from: from.toDate(),
      to: date.toDate(),
    });
  };

  // Stage 1: Today
  pushStage('Today', mToday, mToday);

  // Generate stages dynamically with proper month boundaries
  for (let i = 1; i <= 4; i++) {
    const startDate = mToday.clone().add(i * 15 - 14, 'days');
    const endDate = mToday.clone().add(i * 15, 'days');

    // Create label with proper month formatting
    let label = '';
    if (startDate.month() === endDate.month()) {
      // Same month
      label = `${startDate.date()}-${endDate.date()} ${startDate.format(
        'MMM'
      )}`;
    } else {
      // Different months
      label = `${startDate.date()} ${startDate.format(
        'MMM'
      )} - ${endDate.date()} ${endDate.format('MMM')}`;
    }

    pushStage(label, endDate, startDate);
  }

  return stages;
}

// ------------------ Calculation Helpers ------------------
function getSourceNumber(
  sources: Record<string, number | undefined | Record<string, number>>,
  keys: string[]
): number {
  if (!sources) return 0;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(sources, k)) {
      return Number(sources[k] ?? 0);
    }
  }
  return 0;
}

function sumSnapshot(snapshot: TotalCashSnapshot): number {
  const sources = snapshot?.sources ?? {
    in_hand: 0,
    easypaisa: 0,
    jazzcash: 0,
    other: 0,
    bank: {},
  };

  const inHand = getSourceNumber(sources, ['in_hand', 'inHand']);
  const easy = getSourceNumber(sources, ['easypaisa', 'easyPaisa']);
  const jazz = getSourceNumber(sources, ['jazzcash', 'jazzCash']);
  const other = getSourceNumber(sources, ['other']);

  let bankTotal = 0;
  const bankField = sources?.bank;
  if (bankField && typeof bankField === 'object') {
    try {
      bankTotal = Object.values(bankField).reduce<number>(
        (acc, v) => acc + Number(v ?? 0),
        0
      );
    } catch {
      bankTotal = 0;
    }
  }

  return inHand + easy + jazz + other + bankTotal;
}

function classifyStatus(amount: number) {
  if (amount >= 40000) return { label: '📈 Strong', color: 'blue' };
  if (amount >= 25000) return { label: '✅ Growth', color: 'green' };
  if (amount >= 15000) return { label: '✅ Stable', color: 'green' };
  if (amount >= 5000) return { label: '⚠ Warning', color: 'orange' };
  return { label: '⛔ Critical', color: 'red' };
}

// Helper function to check if an item's effectiveFromDate is valid for calculation
function isEffectiveDateValid(
  item: IncomeSource | Expenditure,
  calculationDate: moment.Moment
): boolean {
  // If no effectiveFromDate is set, the item is always valid
  if (!item.effectiveFromDate) return true;

  const effectiveDate = toMoment(item.effectiveFromDate);
  if (!effectiveDate) return true;

  // The item is valid if the effective date is today or in the past
  return effectiveDate.isSameOrBefore(calculationDate, 'day');
}

// Helper function to check if a recurring item should be included in a date range
function shouldIncludeRecurringItem(
  item: IncomeSource | Expenditure,
  fromDate: moment.Moment,
  toDate: moment.Moment
): boolean {
  if (item.type !== 'recurring') return false;

  switch (item.frequency) {
    case 'daily':
      return true; // Daily items are included in all ranges
    case 'weekly':
      if (item.dayOfWeek === undefined) return false;
      // Check if the specified day of week falls within the range
      const startWeek = fromDate.clone().startOf('week');
      const endWeek = toDate.clone().endOf('week');
      const currentWeek = startWeek.clone();

      while (currentWeek.isSameOrBefore(endWeek)) {
        const targetDay = currentWeek.clone().day(item.dayOfWeek);
        if (targetDay.isBetween(fromDate, toDate, 'day', '[]')) {
          return true;
        }
        currentWeek.add(1, 'week');
      }
      return false;
    case 'monthly':
      if (item.dayOfMonth === undefined) return false;
      // Check if the specified day of month falls within the range
      const startMonth = fromDate.clone().startOf('month');
      const endMonth = toDate.clone().endOf('month');
      const currentMonth = startMonth.clone();

      while (currentMonth.isSameOrBefore(endMonth)) {
        const targetDay = currentMonth.clone().date(item.dayOfMonth);
        if (targetDay.isBetween(fromDate, toDate, 'day', '[]')) {
          return true;
        }
        currentMonth.add(1, 'month');
      }
      return false;
    default:
      return false;
  }
}

// Helper function to calculate how many times a recurring item occurs in a range
function getRecurringOccurrences(
  item: IncomeSource | Expenditure,
  fromDate: moment.Moment,
  toDate: moment.Moment
): number {
  if (item.type !== 'recurring') return 1;

  switch (item.frequency) {
    case 'daily':
      return toDate.diff(fromDate, 'days') + 1;
    case 'weekly':
      if (item.dayOfWeek === undefined) return 0;
      let weeklyCount = 0;
      const startWeek = fromDate.clone().startOf('week');
      const endWeek = toDate.clone().endOf('week');
      const currentWeek = startWeek.clone();

      while (currentWeek.isSameOrBefore(endWeek)) {
        const targetDay = currentWeek.clone().day(item.dayOfWeek);
        if (targetDay.isBetween(fromDate, toDate, 'day', '[]')) {
          weeklyCount++;
        }
        currentWeek.add(1, 'week');
      }
      return weeklyCount;
    case 'monthly':
      if (item.dayOfMonth === undefined) return 0;
      let monthlyCount = 0;
      const startMonth = fromDate.clone().startOf('month');
      const endMonth = toDate.clone().endOf('month');
      const currentMonth = startMonth.clone();

      while (currentMonth.isSameOrBefore(endMonth)) {
        const targetDay = currentMonth.clone().date(item.dayOfMonth);
        if (targetDay.isBetween(fromDate, toDate, 'day', '[]')) {
          monthlyCount++;
        }
        currentMonth.add(1, 'month');
      }
      return monthlyCount;
    default:
      return 0;
  }
}

type Checkpoint = {
  title: string;
  amount: number;
  status: string;
  color: string;
  details: {
    incomes: number;
    expenses: number;
    loansToRecover: number;
    loansToPay: number;
  };
  items: {
    incomes: Array<{
      title: string;
      amount: number;
      type: string;
      frequency?: string;
    }>;
    expenses: Array<{
      title: string;
      amount: number;
      type: string;
      frequency?: string;
    }>;
    loans: Array<{ title: string; amount: number; type: string }>;
  };
};

// ------------------ Stage Calculation ------------------
async function calculateStages(
  userId: string,
  stages: Stage[]
): Promise<Checkpoint[]> {
  const results: Checkpoint[] = [];

  const snapshotsQ = await getDocs(
    query(collection(db, 'totalCashSnapshots'), where('userId', '==', userId))
  );
  const snapshots = snapshotsQ.docs.map((d) => d.data() as TotalCashSnapshot);

  let latestSnapshot: TotalCashSnapshot | undefined;
  let latestWhen: moment.Moment | null = null;
  snapshots.forEach((s) => {
    const eff =
      toMoment(s.effectiveDate) ||
      toMoment(s.updatedAt) ||
      toMoment(s.createdAt);
    if (eff && (!latestWhen || eff.isAfter(latestWhen))) {
      latestWhen = eff;
      latestSnapshot = s;
    }
  });

  const currentAmount = latestSnapshot ? sumSnapshot(latestSnapshot) : 0;

  const [incomeSnap, expSnap, loanSnap] = await Promise.all([
    getDocs(
      query(collection(db, 'incomeSources'), where('userId', '==', userId))
    ),
    getDocs(
      query(collection(db, 'expenditures'), where('userId', '==', userId))
    ),
    getDocs(query(collection(db, 'loans'), where('userId', '==', userId))),
  ]);

  const allIncome = incomeSnap.docs.map((d) => d.data() as IncomeSource);
  const allExpense = expSnap.docs.map((d) => d.data() as Expenditure);
  const allLoans = loanSnap.docs.map((d) => d.data() as LoanRecord);

  const mToday = moment().startOf('day');

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const fromDate = moment(stage.from);
    const toDate = moment(stage.to);

    // For cumulative calculation, we need to consider items from the beginning up to this stage
    const cumulativeFromDate = i === 0 ? mToday : mToday.clone().add(1, 'day');
    const cumulativeToDate = toDate;

    // For dialog items, we only show items within this specific stage range
    const stageFromDate = fromDate;
    const stageToDate = toDate;

    // Calculate expected income (cumulative)
    let expectedIncome = 0;
    const incomeItems: Array<{
      title: string;
      amount: number;
      type: string;
      frequency?: string;
    }> = [];

    allIncome
      .filter((d) => d.isReceived !== true)
      .forEach((d) => {
        // Check if the item's effectiveFromDate is valid for this calculation
        if (!isEffectiveDateValid(d, cumulativeToDate)) {
          return; // Skip this item if it's not yet effective
        }

        let shouldInclude = false;
        let occurrences = 1;

        if (d.type === 'one-time' && d.expectedDate) {
          const when = toMoment(d.expectedDate);
          shouldInclude = when
            ? when.isBetween(cumulativeFromDate, cumulativeToDate, 'day', '[]')
            : false;
        } else if (d.type === 'recurring') {
          shouldInclude = shouldIncludeRecurringItem(
            d,
            cumulativeFromDate,
            cumulativeToDate
          );
          occurrences = getRecurringOccurrences(
            d,
            cumulativeFromDate,
            cumulativeToDate
          );
        }

        if (shouldInclude) {
          const totalAmount = Number(d.amount || 0) * occurrences;
          expectedIncome += totalAmount;
          incomeItems.push({
            title: d.title,
            amount: totalAmount,
            type: d.type,
            frequency: d.frequency,
          });
        }
      });

    // Calculate expected expenses (cumulative)
    let expectedExpense = 0;
    const expenseItems: Array<{
      title: string;
      amount: number;
      type: string;
      frequency?: string;
    }> = [];

    allExpense
      .filter((d) => d.isPaid !== true)
      .forEach((d) => {
        // Check if the item's effectiveFromDate is valid for this calculation
        if (!isEffectiveDateValid(d, cumulativeToDate)) {
          return; // Skip this item if it's not yet effective
        }

        let shouldInclude = false;
        let occurrences = 1;

        if (d.type === 'one-time' && d.dueDate) {
          const when = toMoment(d.dueDate);
          shouldInclude = when
            ? when.isBetween(cumulativeFromDate, cumulativeToDate, 'day', '[]')
            : false;
        } else if (d.type === 'recurring') {
          shouldInclude = shouldIncludeRecurringItem(
            d,
            cumulativeFromDate,
            cumulativeToDate
          );
          occurrences = getRecurringOccurrences(
            d,
            cumulativeFromDate,
            cumulativeToDate
          );
        }

        if (shouldInclude) {
          const totalAmount = Number(d.amount || 0) * occurrences;
          expectedExpense += totalAmount;
          expenseItems.push({
            title: d.title,
            amount: totalAmount,
            type: d.type,
            frequency: d.frequency,
          });
        }
      });

    let loansToRecover = 0;
    let loansToPay = 0;
    const loanItems: Array<{ title: string; amount: number; type: string }> =
      [];

    allLoans
      .filter((l) => l.isSettled !== true)
      .forEach((l) => {
        if (!l.dueDate) return;
        const when = toMoment(l.dueDate);
        if (!when) return;
        if (!when.isBetween(cumulativeFromDate, cumulativeToDate, 'day', '[]'))
          return;
        const amt = Number(l.amount || 0);
        if (l.type === 'lend') {
          loansToRecover += amt;
          loanItems.push({
            title: `Lend to ${l.counterparty}`,
            amount: amt,
            type: 'lend',
          });
        }
        if (l.type === 'borrow') {
          loansToPay += amt;
          loanItems.push({
            title: `Borrow from ${l.counterparty}`,
            amount: amt,
            type: 'borrow',
          });
        }
      });

    // Calculate the final amount for this stage
    const stageAmount =
      currentAmount +
      expectedIncome +
      loansToRecover -
      expectedExpense -
      loansToPay;

    const { label, color } = classifyStatus(stageAmount);
    results.push({
      title: stage.label,
      amount: stageAmount,
      status: label,
      color,
      details: {
        incomes: expectedIncome,
        expenses: expectedExpense,
        loansToRecover,
        loansToPay,
      },
      items: {
        incomes: incomeItems
          .filter((item) => {
            const originalItem = allIncome.find((d) => d.title === item.title);
            if (!originalItem) return false;

            // Check if the item's effectiveFromDate is valid for this stage
            if (!isEffectiveDateValid(originalItem, stageToDate)) {
              return false;
            }

            // Filter items to show only those within this specific stage
            const itemDate =
              item.type === 'one-time'
                ? originalItem.expectedDate
                  ? toMoment(originalItem.expectedDate)
                  : null
                : null;
            return (
              !itemDate ||
              itemDate.isBetween(stageFromDate, stageToDate, 'day', '[]')
            );
          })
          .map((item) => {
            // For recurring items, recalculate amount for this specific stage only
            if (item.type === 'recurring') {
              const originalItem = allIncome.find(
                (d) => d.title === item.title
              );
              if (originalItem) {
                const stageOccurrences = getRecurringOccurrences(
                  originalItem,
                  stageFromDate,
                  stageToDate
                );
                return {
                  ...item,
                  amount: Number(originalItem.amount || 0) * stageOccurrences,
                };
              }
            }
            return item;
          })
          .filter((item) => {
            // Filter out items with 0 amount (recurring items that don't occur in this stage)
            return item.amount > 0;
          }),
        expenses: expenseItems
          .filter((item) => {
            const originalItem = allExpense.find((d) => d.title === item.title);
            if (!originalItem) return false;

            // Check if the item's effectiveFromDate is valid for this stage
            if (!isEffectiveDateValid(originalItem, stageToDate)) {
              return false;
            }

            // Filter items to show only those within this specific stage
            const itemDate =
              item.type === 'one-time'
                ? originalItem.dueDate
                  ? toMoment(originalItem.dueDate)
                  : null
                : null;
            return (
              !itemDate ||
              itemDate.isBetween(stageFromDate, stageToDate, 'day', '[]')
            );
          })
          .map((item) => {
            // For recurring items, recalculate amount for this specific stage only
            if (item.type === 'recurring') {
              const originalItem = allExpense.find(
                (d) => d.title === item.title
              );
              if (originalItem) {
                const stageOccurrences = getRecurringOccurrences(
                  originalItem,
                  stageFromDate,
                  stageToDate
                );
                return {
                  ...item,
                  amount: Number(originalItem.amount || 0) * stageOccurrences,
                };
              }
            }
            return item;
          })
          .filter((item) => {
            // Filter out items with 0 amount (recurring items that don't occur in this stage)
            return item.amount > 0;
          }),
        loans: loanItems.filter((item) => {
          // Filter loans to show only those within this specific stage
          const loan = allLoans.find(
            (l) =>
              (l.type === 'lend' && item.title.includes(l.counterparty)) ||
              (l.type === 'borrow' && item.title.includes(l.counterparty))
          );
          if (!loan?.dueDate) return false;
          const loanDate = toMoment(loan.dueDate);
          return (
            loanDate &&
            loanDate.isBetween(stageFromDate, stageToDate, 'day', '[]')
          );
        }),
      },
    });
  }

  return results;
}

// ------------------ Component ------------------
export default function FinancialTimeline() {
  const ctx = useOnboarding();
  const onboarding = ctx?.onboarding as InitialOnBoarding | null | undefined;
  const { user } = useAuth();
  const [dynamicCheckpoints, setDynamicCheckpoints] = useState<Checkpoint[]>(
    []
  );
  const [selectedPoint, setSelectedPoint] = useState<Checkpoint | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'sheet'>('cards');

  const stages = useMemo(() => {
    let startOfMonthValue: number | string = 1;
    if (onboarding?.startOfMonth?.value) {
      startOfMonthValue = onboarding.startOfMonth.value;
    }
    return stagesMaker({ startOfMonth: startOfMonthValue });
  }, [onboarding?.startOfMonth?.value]);

  useEffect(() => {
    if (user?.uid && stages.length) {
      calculateStages(user.uid, stages)
        .then((res) => setDynamicCheckpoints(res))
        .catch((err) => {
          console.error('❌ Error in calculateStages:', err);
          setDynamicCheckpoints([]);
        });
    } else {
      setDynamicCheckpoints([]);
    }
  }, [user?.uid, stages]);

  // Sheet View Component
  const SheetView = () => {
    let initialAmount = 0;
    // Get the initial amount from the first checkpoint calculation
    if (dynamicCheckpoints.length > 0) {
      const firstCheckpoint = dynamicCheckpoints[0];
      // Calculate initial amount by subtracting all changes from first checkpoint
      initialAmount =
        firstCheckpoint.amount -
        firstCheckpoint.details.incomes +
        firstCheckpoint.details.expenses +
        firstCheckpoint.details.loansToPay -
        firstCheckpoint.details.loansToRecover;
    }

    // Helper function to get stage header with date ranges
    const getStageHeader = (index: number, point: Checkpoint) => {
      if (index === 0) {
        return `Today (${moment().format('D MMM YY')})`;
      }

      // Prefer using the stage title (point.title) if available — this avoids
      // an "unused parameter" lint error while keeping a readable header.
      if (point?.title) {
        return `After ${index * 15} Days — ${point.title}`;
      }

      const startDate = moment().add((index - 1) * 15 + 1, 'days');
      const endDate = moment().add(index * 15, 'days');

      return `After ${index * 15} Days (${startDate.format(
        'D MMM'
      )} - ${endDate.format('D MMM YY')})`;
    };

    // Helper function to get financial direction icon
    const getFinancialIcon = (
      currentAmount: number,
      previousAmount: number
    ) => {
      if (currentAmount > previousAmount) {
        return { icon: '📈', color: '#2e7d32', direction: 'UP' };
      } else if (currentAmount < previousAmount) {
        return { icon: '📉', color: '#d32f2f', direction: 'DOWN' };
      } else {
        return { icon: '➡️', color: '#ed6c02', direction: 'STABLE' };
      }
    };

    return (
      <Box sx={{ mt: 2 }}>
        {dynamicCheckpoints.map((point, index) => {
          const totalDays = (index + 1) * 15;
          const previousAmount =
            index === 0 ? initialAmount : dynamicCheckpoints[index - 1].amount;
          const financialDirection = getFinancialIcon(
            point.amount,
            previousAmount
          );

          return (
            <Card key={index} sx={{ mb: 3, borderRadius: 2, boxShadow: 2 }}>
              <CardContent sx={{ p: 3 }}>
                {/* Stage Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    sx={{
                      color: 'primary.main',
                      flex: 1,
                      borderBottom: '2px solid',
                      borderColor: 'primary.main',
                      pb: 1,
                    }}
                  >
                    {getStageHeader(index, point)}
                  </Typography>
                  <Box sx={{ ml: 2, textAlign: 'center' }}>
                    <Typography
                      variant="h4"
                      sx={{
                        fontSize: '2rem',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                      }}
                    >
                      {financialDirection.icon}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: financialDirection.color,
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                      }}
                    >
                      {financialDirection.direction}
                    </Typography>
                  </Box>
                </Box>

                {/* Expected/Payable Expenses */}
                {point.items.expenses.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        color: 'error.main',
                        fontWeight: 'bold',
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      💸 Expected/Payable Expenses:
                    </Typography>
                    {point.items.expenses.map((expense, expIndex) => (
                      <Box key={expIndex} sx={{ ml: 2, mb: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.primary',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <span style={{ fontSize: '1.1em' }}>❌</span>
                          {String.fromCharCode(105 + expIndex)}. {expense.title}{' '}
                          {expense.type === 'recurring' &&
                            `(${expense.frequency})`}{' '}
                          -{' '}
                          <span
                            style={{ color: '#d32f2f', fontWeight: 'bold' }}
                          >
                            Rs {expense.amount.toLocaleString()}
                            {expense.type === 'recurring' &&
                              expense.frequency === 'daily' && (
                                <span
                                  style={{ fontSize: '0.85em', color: '#666' }}
                                >
                                  {' '}
                                  (daily {(expense.amount / 15).toFixed(0)} × 15
                                  days)
                                </span>
                              )}
                          </span>
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Expected/Recoverable Income */}
                {point.items.incomes.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        color: 'success.main',
                        fontWeight: 'bold',
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      💰 Expected/Recoverable Income:
                    </Typography>
                    {point.items.incomes.map((income, incIndex) => (
                      <Box key={incIndex} sx={{ ml: 2, mb: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.primary',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <span style={{ fontSize: '1.1em' }}>✅</span>
                          {String.fromCharCode(105 + incIndex)}. {income.title}{' '}
                          {income.type === 'recurring' &&
                            `(${income.frequency})`}{' '}
                          +{' '}
                          <span
                            style={{ color: '#2e7d32', fontWeight: 'bold' }}
                          >
                            Rs {income.amount.toLocaleString()}
                          </span>
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Loans */}
                {point.items.loans.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        color: 'info.main',
                        fontWeight: 'bold',
                        mb: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      🏦 Loans:
                    </Typography>
                    {point.items.loans.map((loan, loanIndex) => (
                      <Box key={loanIndex} sx={{ ml: 2, mb: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.primary',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <span style={{ fontSize: '1.1em' }}>
                            {loan.type === 'lend' ? '💸' : '🔄'}
                          </span>
                          {String.fromCharCode(105 + loanIndex)}. {loan.title}{' '}
                          <span
                            style={{
                              color:
                                loan.type === 'lend' ? '#2e7d32' : '#d32f2f',
                              fontWeight: 'bold',
                            }}
                          >
                            {loan.type === 'lend' ? '+' : '-'}Rs{' '}
                            {loan.amount.toLocaleString()}
                          </span>
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Stage Summary */}
                <Divider sx={{ my: 2 }} />
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor:
                      point.amount > initialAmount
                        ? 'rgba(76, 175, 80, 0.1)'
                        : 'rgba(244, 67, 54, 0.1)',
                    p: 2,
                    borderRadius: 1,
                    border: `1px solid ${
                      point.amount > initialAmount ? '#4caf50' : '#f44336'
                    }`,
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    fontWeight="bold"
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    🎯 End of {totalDays} days:
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    sx={{
                      color:
                        point.amount > initialAmount
                          ? 'success.dark'
                          : 'error.dark',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    {point.amount > previousAmount
                      ? '💰'
                      : point.amount < previousAmount
                      ? '⚠️'
                      : '💳'}{' '}
                    Rs {point.amount.toLocaleString()}
                  </Typography>
                </Box>

                {/* Show calculation breakdown */}
                <Box
                  sx={{ mt: 1, fontSize: '0.85em', color: 'text.secondary' }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      flexWrap: 'wrap',
                    }}
                  >
                    🧮 Calculation: Current Amount
                    {point.details.incomes > 0 && (
                      <span
                        style={{
                          color: '#2e7d32',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        + 💰 Rs {point.details.incomes.toLocaleString()}
                      </span>
                    )}
                    {point.details.expenses > 0 && (
                      <span
                        style={{
                          color: '#d32f2f',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        - 💸 Rs {point.details.expenses.toLocaleString()}
                      </span>
                    )}
                    {point.details.loansToRecover > 0 && (
                      <span
                        style={{
                          color: '#2e7d32',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        + 🏦 Rs {point.details.loansToRecover.toLocaleString()}
                      </span>
                    )}
                    {point.details.loansToPay > 0 && (
                      <span
                        style={{
                          color: '#d32f2f',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        - 🔄 Rs {point.details.loansToPay.toLocaleString()}
                      </span>
                    )}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 4 }}>
      {/* Header with View Toggle */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h6">Financial Timeline</Typography>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, newMode) => newMode && setViewMode(newMode)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              px: 2,
              py: 0.5,
              fontSize: '0.875rem',
            },
          }}
        >
          <ToggleButton value="cards">📊 Cards View</ToggleButton>
          <ToggleButton value="sheet">📋 Sheet View</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Conditional Rendering based on view mode */}
      {viewMode === 'cards' ? (
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            overflowX: 'auto',
            scrollbarWidth: 'thin',
            pb: 1,
            '&::-webkit-scrollbar': { height: 8 },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#ccc',
              borderRadius: 4,
            },
          }}
        >
          {dynamicCheckpoints.map((point, index) => (
            <Card
              key={index}
              onClick={() => setSelectedPoint(point)}
              sx={{
                minWidth: { xs: 160, sm: 220 },
                maxWidth: { xs: 160, sm: 220 },
                flexShrink: 0,
                borderRadius: 2,
                boxShadow: 3,
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <CardContent>
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  sx={{
                    background:
                      'linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #FFEAA7)',
                    backgroundSize: '300% 300%',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'gradientShift 3s ease infinite',
                    '@keyframes gradientShift': {
                      '0%': { backgroundPosition: '0% 50%' },
                      '50%': { backgroundPosition: '100% 50%' },
                      '100%': { backgroundPosition: '0% 50%' },
                    },
                  }}
                >
                  {point.title}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ color: point.color, fontWeight: 'bold' }}
                >
                  ₨{point.amount.toLocaleString()}
                </Typography>
                <Typography variant="body2">{point.status}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <SheetView />
      )}

      {/* Dialog for details */}
      <Dialog
        open={!!selectedPoint}
        onClose={() => setSelectedPoint(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Details – {selectedPoint?.title}</DialogTitle>
        <DialogContent dividers>
          {selectedPoint && (
            <Box>
              {/* Detailed Breakdown */}
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Detailed Breakdown
              </Typography>

              {/* Borderless Table Format */}
              <Box sx={{ mt: 2 }}>
                {/* Incomes */}
                {selectedPoint.items.incomes.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      color="green"
                      sx={{ mb: 1, fontWeight: 'bold' }}
                    >
                      💰 Expected/Recoverable Income:
                    </Typography>
                    {selectedPoint.items.incomes.map((item, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          py: 0.5,
                          px: 1,
                          backgroundColor: 'rgba(76, 175, 80, 0.05)',
                          borderRadius: 1,
                          mb: 0.5,
                        }}
                      >
                        <Typography variant="body2">
                          {item.title}
                          {item.type === 'recurring' && ` (${item.frequency})`}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="green"
                          fontWeight="bold"
                        >
                          +₨{item.amount.toLocaleString()}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Expenses */}
                {selectedPoint.items.expenses.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      color="red"
                      sx={{ mb: 1, fontWeight: 'bold' }}
                    >
                      💸 Expected/Payable Expenses:
                    </Typography>
                    {selectedPoint.items.expenses.map((item, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          py: 0.5,
                          px: 1,
                          backgroundColor: 'rgba(244, 67, 54, 0.05)',
                          borderRadius: 1,
                          mb: 0.5,
                        }}
                      >
                        <Typography variant="body2">
                          {item.title}
                          {item.type === 'recurring' && ` (${item.frequency})`}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="red"
                          fontWeight="bold"
                        >
                          -₨{item.amount.toLocaleString()}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Loans */}
                {selectedPoint.items.loans.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="subtitle2"
                      color="blue"
                      sx={{ mb: 1, fontWeight: 'bold' }}
                    >
                      🏦 Loans:
                    </Typography>
                    {selectedPoint.items.loans.map((item, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          py: 0.5,
                          px: 1,
                          backgroundColor: 'rgba(33, 150, 243, 0.05)',
                          borderRadius: 1,
                          mb: 0.5,
                        }}
                      >
                        <Typography variant="body2">{item.title}</Typography>
                        <Typography
                          variant="body2"
                          color={item.type === 'lend' ? 'green' : 'red'}
                          fontWeight="bold"
                        >
                          {item.type === 'lend' ? '+' : '-'}₨
                          {item.amount.toLocaleString()}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              {selectedPoint.items.incomes.length === 0 &&
                selectedPoint.items.expenses.length === 0 &&
                selectedPoint.items.loans.length === 0 && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: 'center', py: 2 }}
                  >
                    No items in this time period
                  </Typography>
                )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPoint(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
