'use client';

import React, { useMemo, useEffect, useState } from 'react';
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
// ------------------ Stage Maker ------------------
export function stagesMaker({ today = new Date() }: StageMakerArgs): Stage[] {
  const stages: Stage[] = [];
  const mToday = moment(today).startOf('day');

  const pushStage = (
    rawLabel: string,
    date: moment.Moment,
    from: moment.Moment
  ) => {
    const formatted = date.format('ddd, DD MMM YY');
    const label = `${rawLabel} – ${formatted}`;
    stages.push({
      label,
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
            // Filter items to show only those within this specific stage
            const itemDate =
              item.type === 'one-time'
                ? allIncome.find((d) => d.title === item.title)?.expectedDate
                  ? toMoment(
                      allIncome.find((d) => d.title === item.title)
                        ?.expectedDate
                    )
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
            // Filter items to show only those within this specific stage
            const itemDate =
              item.type === 'one-time'
                ? allExpense.find((d) => d.title === item.title)?.dueDate
                  ? toMoment(
                      allExpense.find((d) => d.title === item.title)?.dueDate
                    )
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

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h6" gutterBottom>
        Financial Timeline
      </Typography>

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
              <Typography variant="subtitle1" fontWeight="bold">
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
