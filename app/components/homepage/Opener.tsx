'use client';

import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Skeleton,
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
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useEffect, useState } from 'react';
import moment from 'moment';
import {
  Assignment,
  AttachMoney,
  Book,
  EmojiEmotions,
  CheckCircle,
} from '@mui/icons-material';
import Link from 'next/link';

// ✅ Reusable circular progress with overlay label
function CircularProgressWithLabel({ value }: { value: number }) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={100}
        thickness={5}
        sx={{ color: '#e5e7eb', position: 'absolute' }}
      />
      <CircularProgress
        variant="determinate"
        value={value}
        size={100}
        thickness={5}
        sx={{ color: '#3b82f6' }}
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
        <Typography variant="body1" fontWeight="bold" color="textPrimary">
          {`${Math.round(value)}%`}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          Complete
        </Typography>
      </Box>
    </Box>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [progress, setProgress] = useState(0);
  const [remainingTodos, setRemainingTodos] = useState<string[]>([]);
  const [remainingIncomes, setRemainingIncomes] = useState<string[]>([]);
  const [remainingExpenses, setRemainingExpenses] = useState<string[]>([]);
  const [journalWritten, setJournalWritten] = useState<boolean>(false);
  const [moodLogged, setMoodLogged] = useState<boolean>(false);
  const [overdueTodos, setOverdueTodos] = useState<string[]>([]);
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchName = async () => {
      if (user?.uid) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setFirstName(data.firstName || '');
        }
      }
    };
    fetchName();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchProgress = async () => {
      setLoading(true);
      const today = moment().startOf('day');
      const endOfToday = moment().endOf('day');

      const checkDateInRange = (date: Date | Timestamp) => {
        const momentDate = moment(
          date instanceof Timestamp ? date.toDate() : date
        );
        return momentDate.isBetween(today, endOfToday, 'day', '[]');
      };

      const pendingTodos: string[] = [];
      const overdueTodosList: string[] = [];
      const pendingIncomes: string[] = [];
      const pendingExpenses: string[] = [];

      // ✅ Todos
      const todoSnap = await getDocs(
        query(collection(db, 'todos'), where('authorId', '==', user.uid))
      );
      const todos = todoSnap.docs.map((doc) => doc.data());

      const todayTodos = todos.filter(
        (todo) => todo.dueDate && checkDateInRange(todo.dueDate)
      );
      const overdue = todos.filter(
        (todo) =>
          todo.dueDate &&
          moment(
            todo.dueDate.toDate ? todo.dueDate.toDate() : todo.dueDate
          ).isBefore(today, 'day') &&
          todo.status !== 'completed'
      );

      todayTodos.forEach((todo) => {
        if (todo.status !== 'completed') {
          pendingTodos.push(todo.title || 'Unnamed Todo');
        }
      });

      overdue.forEach((todo) => {
        overdueTodosList.push(todo.title || 'Unnamed Todo');
      });

      // ✅ Incomes
      const incomeSnap = await getDocs(
        query(collection(db, 'incomeSources'), where('userId', '==', user.uid))
      );
      const incomes = incomeSnap.docs
        .map((doc) => doc.data())
        .filter((i) => i.expectedDate && checkDateInRange(i.expectedDate));
      incomes.forEach((income) => {
        if (!income.isReceived) {
          pendingIncomes.push(income.source || 'Unnamed Income');
        }
      });

      // ✅ Expenses
      const expenseSnap = await getDocs(
        query(collection(db, 'expenditures'), where('userId', '==', user.uid))
      );
      const expenses = expenseSnap.docs
        .map((doc) => doc.data())
        .filter((e) => e.dueDate && checkDateInRange(e.dueDate));
      expenses.forEach((expense) => {
        if (!expense.isPaid) {
          pendingExpenses.push(expense.title || 'Unnamed Expense');
        }
      });

      // ✅ Journal
      const journalSnap = await getDocs(
        query(collection(db, 'journals'), where('authorId', '==', user.uid))
      );
      const journals = journalSnap.docs
        .map((doc) => doc.data())
        .filter((j) => j.createdAt && checkDateInRange(j.createdAt));
      const journalDone = journals.length > 0;
      setJournalWritten(journalDone);

      // ✅ Mood
      const moodSnap = await getDocs(
        query(collection(db, 'moods'), where('userId', '==', user.uid))
      );
      const moods = moodSnap.docs
        .map((doc) => doc.data())
        .filter(
          (m) =>
            (m.recordedAt && checkDateInRange(m.recordedAt)) ||
            (m.createdAt && checkDateInRange(m.createdAt))
        );
      const moodDone = moods.length > 0;
      setMoodLogged(moodDone);

      // ✅ Progress (only today’s items, NOT overdue)
      const totalItems =
        todayTodos.length + incomes.length + expenses.length + 2;
      const completedItems =
        todayTodos.filter((t) => t.status === 'completed').length +
        incomes.filter((i) => i.isReceived).length +
        expenses.filter((e) => e.isPaid).length +
        (journalDone ? 1 : 0) +
        (moodDone ? 1 : 0);

      const percentage =
        totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

      setProgress(percentage);
      setRemainingTodos(pendingTodos);
      setOverdueTodos(overdueTodosList);
      setRemainingIncomes(pendingIncomes);
      setRemainingExpenses(pendingExpenses);
      setLoading(false);
    };

    fetchProgress();
  }, [user]);

  const totalPayments = remainingIncomes.length + remainingExpenses.length;
  const hasRemaining =
    remainingTodos.length > 0 ||
    totalPayments > 0 ||
    !journalWritten ||
    !moodLogged;

  // ✅ Reusable Segment Card
  const SegmentCard = ({
    icon,
    label,
    count,
    done,
    color,
    loading,
  }: {
    icon: React.ReactNode;
    label: string;
    count: number;
    done: boolean;
    color: string;
    loading: boolean;
  }) => (
    <div className="w-full">
      {loading ? (
        <Skeleton variant="rounded" height={100} />
      ) : (
        <div
          className="rounded-xl flex flex-col items-center justify-center py-4 backdrop-blur-md shadow-sm hover:shadow-md transition-all"
          style={{
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            borderColor: theme?.mode === 'dark' ? '#334155' : '#e5e7eb',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
        >
          <div className={`mb-2 ${done ? 'text-green-500' : color} text-2xl`}>
            {icon}
          </div>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
            }}
          >
            {label}
          </Typography>
          <div className="mt-1">
            {done ? (
              <CheckCircle className="text-green-500 text-lg" />
            ) : (
              <span
                className={`px-3 py-0.5 text-xs font-semibold rounded-full ${color}`}
              >
                {count}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Box className="p-4">
      <Card
        className="rounded-2xl shadow-md text-white"
        sx={{
          background:
            theme?.mode === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)'
              : 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1e3a8a 100%)',
        }}
      >
        <CardContent className="flex flex-col lg:flex-row items-center justify-between gap-6 p-6">
          {/* Left Section */}
          <Box className="flex flex-col items-start space-y-4 w-full lg:w-1/2">
            <div>
              {loading ? (
                <>
                  <Skeleton width={120} height={20} />
                  <Skeleton width={220} height={28} />
                </>
              ) : (
                <>
                  <Typography variant="body2" className="opacity-80">
                    Welcome back,{' '}
                    <span className="font-semibold">{firstName}</span>
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {progress >= 90
                      ? "Amazing! You're almost done 🎉"
                      : progress >= 50
                      ? 'Great work, keep going 🚀'
                      : "Let's crush today's plan 💪"}
                  </Typography>
                </>
              )}
            </div>

            {/* Overdue indicator */}
            {!loading && overdueTodos.length > 0 && (
              <Box className="mt-2">
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor:
                      theme?.mode === 'dark' ? '#7f1d1d' : '#fef2f2',
                    color: theme?.mode === 'dark' ? '#fca5a5' : '#dc2626',
                  }}
                >
                  {overdueTodos.length}{' '}
                  {overdueTodos.length === 1 ? 'Task is' : 'Tasks are'} overdue.
                </span>
              </Box>
            )}

            {!loading && hasRemaining && (
              <Link href="/1/plans-remaining">
                <Button
                  variant="contained"
                  color="secondary"
                  className="rounded-full shadow-md mt-2"
                >
                  See Remaining Plans
                </Button>
              </Link>
            )}
          </Box>

          {/* Right Section */}
          <Box className="flex flex-col items-center justify-center w-full lg:w-1/2">
            {loading ? (
              <Skeleton variant="circular" width={100} height={100} />
            ) : (
              <CircularProgressWithLabel value={progress} />
            )}

            {/* Segments */}
            <div className="grid grid-cols-2 gap-3 w-full mt-6">
              <SegmentCard
                icon={<Assignment />}
                label="Tasks"
                count={remainingTodos.length}
                done={remainingTodos.length === 0}
                color="text-blue-600 bg-blue-100"
                loading={loading}
              />
              <SegmentCard
                icon={<AttachMoney />}
                label="Payments"
                count={totalPayments}
                done={totalPayments === 0}
                color="text-green-600 bg-green-100"
                loading={loading}
              />
              <SegmentCard
                icon={<Book />}
                label="Journal"
                count={1}
                done={journalWritten}
                color="text-purple-600 bg-purple-100"
                loading={loading}
              />
              <SegmentCard
                icon={<EmojiEmotions />}
                label="Mood"
                count={1}
                done={moodLogged}
                color="text-amber-600 bg-amber-100"
                loading={loading}
              />
            </div>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
