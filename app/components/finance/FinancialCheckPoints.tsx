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
  List,
  ListItem,
  ListItemText,
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
function clampMonthDay(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(31, Math.max(1, Math.floor(n)));
}

function getFinancialMonthBounds(today: moment.Moment, sdom: number) {
  const day = today.date();
  let start: moment.Moment;
  if (day >= sdom) {
    start = today.clone().date(sdom).startOf('day');
  } else {
    start = today.clone().subtract(1, 'month').date(sdom).startOf('day');
  }
  const end = start.clone().add(1, 'month').subtract(1, 'day').endOf('day');
  return { start, end };
}

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
export function stagesMaker({
  startOfMonth = 1,
  today = new Date(),
}: StageMakerArgs): Stage[] {
  const stages: Stage[] = [];
  const sdom =
    typeof startOfMonth === 'string'
      ? clampMonthDay(parseInt(startOfMonth, 10))
      : clampMonthDay(startOfMonth ?? 1);

  const mToday = moment(today).startOf('day');
  const { start: fmStart, end: fmEnd } = getFinancialMonthBounds(mToday, sdom);

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

  pushStage('Today', mToday, mToday);
  pushStage('After 7 days', mToday.clone().add(7, 'days'), mToday);
  pushStage('After 15 days', mToday.clone().add(15, 'days'), mToday);
  pushStage('End of current month', fmEnd, mToday);

  const nextFmStart = fmStart.clone().add(1, 'month');
  const nextFmEnd = fmEnd.clone().add(1, 'month');
  const midNext = nextFmStart
    .clone()
    .add(Math.floor(nextFmEnd.diff(nextFmStart, 'days') / 2), 'days');
  pushStage('Mid of next month', midNext, mToday);
  pushStage('End of next month', nextFmEnd, mToday);

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

  let currentAmount = latestSnapshot ? sumSnapshot(latestSnapshot) : 0;

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

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const fromDate = moment(stage.from);
    const toDate = moment(stage.to);

    const expectedIncome = allIncome
      .filter((d) => d.expectedDate && d.isReceived !== true)
      .filter((d) => {
        const when = toMoment(d.expectedDate);
        return when ? when.isBetween(fromDate, toDate, 'day', '[]') : false;
      })
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);

    const expectedExpense = allExpense
      .filter((d) => d.dueDate && d.isPaid !== true)
      .filter((d) => {
        const when = toMoment(d.dueDate);
        return when ? when.isBetween(fromDate, toDate, 'day', '[]') : false;
      })
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);

    let loansToRecover = 0;
    let loansToPay = 0;
    allLoans
      .filter((l) => l.isSettled !== true)
      .forEach((l) => {
        if (!l.dueDate) return;
        const when = toMoment(l.dueDate);
        if (!when) return;
        if (!when.isBetween(fromDate, toDate, 'day', '[]')) return;
        const amt = Number(l.amount || 0);
        if (l.type === 'lend') loansToRecover += amt;
        if (l.type === 'borrow') loansToPay += amt;
      });

    currentAmount =
      currentAmount +
      expectedIncome +
      loansToRecover -
      expectedExpense -
      loansToPay;

    const { label, color } = classifyStatus(currentAmount);
    results.push({
      title: stage.label,
      amount: currentAmount,
      status: label,
      color,
      details: {
        incomes: expectedIncome,
        expenses: expectedExpense,
        loansToRecover,
        loansToPay,
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
                ₹{point.amount.toLocaleString()}
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
            <List>
              <ListItem>
                <ListItemText
                  primary="Expected Income"
                  secondary={`+ ₹${selectedPoint.details.incomes.toLocaleString()}`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Expected Expenses"
                  secondary={`- ₹${selectedPoint.details.expenses.toLocaleString()}`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Loans to Recover"
                  secondary={`+ ₹${selectedPoint.details.loansToRecover.toLocaleString()}`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Loans to Pay"
                  secondary={`- ₹${selectedPoint.details.loansToPay.toLocaleString()}`}
                />
              </ListItem>
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPoint(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
