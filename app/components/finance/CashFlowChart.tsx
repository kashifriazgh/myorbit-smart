'use client';
import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { CashTransaction } from '@/app/lib/interface';
import {
  subMonths,
  format,
  startOfWeek,
  startOfDay,
  isAfter,
  differenceInDays,
} from 'date-fns';

type Range = '1m' | '3m' | '6m';

const rangeMap: Record<Range, number> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
};

const getBucketLabel = (date: Date, range: Range) => {
  if (range === '1m') return format(startOfDay(date), 'MMM d');
  if (range === '3m') return format(startOfWeek(date), 'MMM d');
  return format(date, 'MMM yyyy');
};

export default function CashFlowChart() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>('6m');
  const [chartData, setChartData] = useState<
    { name: string; earned: number; spent: number }[]
  >([]);

  useEffect(() => {
    if (!user) return;

    const checkAndSetInitialRange = async () => {
      const txnsRef = collection(db, 'cashTransactions');
      const q = query(txnsRef, where('userId', '==', user.uid));
      const snap = await getDocs(q);

      let minDate: Date | null = null;

      snap.docs.forEach((doc) => {
        const txn = doc.data() as CashTransaction;
        if (txn.createdAt) {
          const createdDate =
            txn.createdAt instanceof Timestamp
              ? txn.createdAt.toDate()
              : new Date(txn.createdAt);
          if (!minDate || createdDate < minDate) {
            minDate = createdDate;
          }
        }
      });

      if (minDate) {
        const daysSince = differenceInDays(new Date(), minDate);
        if (daysSince <= 90) setRange('1m');
        else setRange('6m');
      }
    };

    checkAndSetInitialRange();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const cutoff = subMonths(new Date(), rangeMap[range]);
      const txnsRef = collection(db, 'cashTransactions');
      const q = query(txnsRef, where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const grouped: Record<string, { earned: number; spent: number }> = {};

      snap.docs.forEach((d) => {
        const txn = d.data() as CashTransaction;
        let date: Date;
        if (txn.createdAt instanceof Timestamp) date = txn.createdAt.toDate();
        else date = new Date(txn.createdAt);
        if (!isAfter(date, cutoff)) return;
        const label = getBucketLabel(date, range);
        grouped[label] = grouped[label] || { earned: 0, spent: 0 };

        if (txn.type === 'add') {
          grouped[label].earned += txn.amount;
        } else if (txn.type === 'deduct') {
          grouped[label].spent += txn.amount;
        }
        // ✅ skip freeze_transfer completely
      });

      const sorted = Object.keys(grouped).sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      );

      const result = sorted.map((name) => ({
        name,
        earned: grouped[name]?.earned || 0,
        spent: grouped[name]?.spent || 0,
      }));

      setChartData(result);
    };
    fetch();
  }, [user, range]);

  return (
    <Box mt={4}>
      <Typography variant="h6" fontWeight="bold">
        Cash Flow Overview
      </Typography>

      <ToggleButtonGroup
        value={range}
        exclusive
        onChange={(_, val) => val && setRange(val)}
        sx={{ my: 2 }}
      >
        <ToggleButton value="1m">Last Month</ToggleButton>
        <ToggleButton value="3m">Last 3 Months</ToggleButton>
        <ToggleButton value="6m">Last 6 Months</ToggleButton>
      </ToggleButtonGroup>

      {chartData.length === 0 ? (
        <Box
          textAlign="center"
          py={6}
          px={2}
          sx={{ border: '1px dashed #ccc', borderRadius: 2 }}
        >
          <Typography variant="body1" color="text.secondary">
            Make a transaction to see a chart view.
          </Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value) => `Rs ${value.toLocaleString()}`} />
            <Legend />
            <Line
              type="monotone"
              dataKey="earned"
              stroke="#22c55e"
              name="Earned"
            />
            <Line
              type="monotone"
              dataKey="spent"
              stroke="#ef4444"
              name="Spent"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
}
