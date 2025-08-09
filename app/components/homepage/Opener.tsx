'use client';

import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useEffect, useState } from 'react';
import moment from 'moment';
import { Assignment, AttachMoney, Book } from '@mui/icons-material';
import Link from 'next/link';

function CircularProgressWithLabel({ value }: { value: number }) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      {/* Neutral background circle */}
      <CircularProgress
        variant="determinate"
        value={100}
        size={100}
        thickness={5}
        sx={{ color: 'lightgray', position: 'absolute' }}
      />
      {/* Actual progress overlay */}
      <CircularProgress
        variant="determinate"
        value={value}
        size={100}
        thickness={5}
        color="primary"
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="caption"
          component="div"
          color="textPrimary"
          fontWeight="bold"
          fontSize="1rem"
        >
          {`${Math.round(value)}%`}
        </Typography>
      </Box>
    </Box>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [progress, setProgress] = useState(0);
  const [remainingTodos, setRemainingTodos] = useState<string[]>([]);
  const [remainingIncomes, setRemainingIncomes] = useState<string[]>([]);
  const [remainingExpenses, setRemainingExpenses] = useState<string[]>([]);
  const [journalWritten, setJournalWritten] = useState<boolean>(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    const fetchName = async () => {
      if (user?.uid) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setFirstName(data.firstName || '');
          setLastName(data.lastName || '');
        }
      }
    };
    fetchName();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchProgress = async () => {
      const today = moment().startOf('day');
      const endOfToday = moment().endOf('day');
      let total = 0;
      let completed = 0;

      const checkDateInRange = (date: Date | Timestamp) => {
        const momentDate = moment(
          date instanceof Timestamp ? date.toDate() : date
        );
        return momentDate.isBetween(today, endOfToday, 'day', '[]');
      };

      const pendingTodos: string[] = [];
      const pendingIncomes: string[] = [];
      const pendingExpenses: string[] = [];

      const todoSnap = await getDocs(
        query(collection(db, 'todos'), where('authorId', '==', user.uid))
      );
      const todos = todoSnap.docs
        .map((doc) => doc.data())
        .filter((todo) => todo.dueDate && checkDateInRange(todo.dueDate));
      total += todos.length;
      completed += todos.filter((t) => t.status === 'completed').length;
      todos.forEach((todo) => {
        if (todo.status !== 'completed') {
          pendingTodos.push(todo.title || 'Unnamed Todo');
        }
      });

      const incomeSnap = await getDocs(
        query(collection(db, 'incomeSources'), where('userId', '==', user.uid))
      );
      const incomes = incomeSnap.docs
        .map((doc) => doc.data())
        .filter((i) => i.expectedDate && checkDateInRange(i.expectedDate));
      total += incomes.length;
      completed += incomes.filter((i) => i.isReceived).length;
      incomes.forEach((income) => {
        if (!income.isReceived) {
          pendingIncomes.push(income.source || 'Unnamed Income');
        }
      });

      const expenseSnap = await getDocs(
        query(collection(db, 'expenditures'), where('userId', '==', user.uid))
      );
      const expenses = expenseSnap.docs
        .map((doc) => doc.data())
        .filter((e) => e.dueDate && checkDateInRange(e.dueDate));
      total += expenses.length;
      completed += expenses.filter((e) => e.isPaid).length;
      expenses.forEach((expense) => {
        if (!expense.isPaid) {
          pendingExpenses.push(expense.title || 'Unnamed Expense');
        }
      });

      const journalSnap = await getDocs(
        query(collection(db, 'journals'), where('authorId', '==', user.uid))
      );
      const journals = journalSnap.docs
        .map((doc) => doc.data())
        .filter((j) => j.createdAt && checkDateInRange(j.createdAt));
      total += 1;
      const journalDone = journals.length > 0;
      completed += journalDone ? 1 : 0;
      setJournalWritten(journalDone);

      const percentage =
        total === 0 ? 0 : Math.round((completed / total) * 100);
      setProgress(percentage);
      setRemainingTodos(pendingTodos);
      setRemainingIncomes(pendingIncomes);
      setRemainingExpenses(pendingExpenses);
    };

    fetchProgress();
  }, [user]);

  const totalPayments = remainingIncomes.length + remainingExpenses.length;
  const hasRemaining =
    remainingTodos.length > 0 || totalPayments > 0 || !journalWritten;

  return (
    <Box className="p-4 space-y-6">
      <Card className="bg-[#0A1930] text-white rounded-2xl">
        <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Left Section */}
          <Box className="flex flex-col justify-between space-y-4">
            <div>
              <Typography variant="body2" color="textSecondary">
                Welcome {firstName} {lastName}
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {progress >= 90
                  ? "Excellent, Today's plan is almost done"
                  : progress >= 50
                  ? "Great, you're halfway through"
                  : 'Keep going, you can do more today!'}
              </Typography>
            </div>

            {hasRemaining && (
              <Link href="/1/plans-remaining" className="mt-auto md:mt-0">
                <Button
                  variant="outlined"
                  color="secondary"
                  className="w-full md:w-auto"
                >
                  See all remaining plan
                </Button>
              </Link>
            )}
          </Box>

          {/* Right Section */}
          <Box className="flex flex-col items-center justify-center space-y-3">
            <CircularProgressWithLabel value={progress} />

            <Box className="text-sm font-semibold flex flex-col items-center text-gray-900 dark:text-gray-100">
              <Box className="flex items-center gap-2">
                <span className="text-blue-500">
                  <Assignment fontSize="small" />
                </span>
                <span>{remainingTodos.length}</span>
                <span className="text-gray-500">&bull;</span>

                <span className="text-green-500">
                  <AttachMoney fontSize="small" />
                </span>
                <span>{totalPayments}</span>
                <span className="text-gray-500">&bull;</span>

                <span className="text-purple-500">
                  <Book fontSize="small" />
                </span>
                <span>{journalWritten ? '0' : '1'}</span>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
