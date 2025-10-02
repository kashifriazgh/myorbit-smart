'use client';

import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
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
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import moment from 'moment';
import {
  Assignment,
  AttachMoney,
  Book,
  EmojiEmotions,
  CheckCircle,
} from '@mui/icons-material';
import Link from 'next/link';
import { Theme } from '@/app/lib/interface';

interface TaskData {
  remainingTodos: string[];
  remainingIncomes: string[];
  remainingExpenses: string[];
  journalWritten: boolean;
  moodLogged: boolean;
}

// ✅ Reusable Segment Card Component
const SegmentCard = memo(
  ({
    icon,
    label,
    count,
    done,
    color,
    loading,
    href,
    theme,
  }: {
    icon: React.ReactNode;
    label: string;
    count: number;
    done: boolean;
    color: string;
    loading: boolean;
    href?: string;
    theme: Theme;
  }) => {
    const cardContent = (
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

    return href ? <Link href={href}>{cardContent}</Link> : cardContent;
  }
);

SegmentCard.displayName = 'SegmentCard';

const RemainingTasks = memo(() => {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [taskData, setTaskData] = useState<TaskData>({
    remainingTodos: [],
    remainingIncomes: [],
    remainingExpenses: [],
    journalWritten: false,
    moodLogged: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchTaskData = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const today = moment().startOf('day');
      const endOfToday = moment().endOf('day');

      const checkDateInRange = (date: Date | Timestamp) => {
        const momentDate = moment(
          date instanceof Timestamp ? date.toDate() : date
        );
        return momentDate.isBetween(today, endOfToday, 'day', '[]');
      };

      const pendingTodos: string[] = [];
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

      todayTodos.forEach((todo) => {
        if (todo.status !== 'completed') {
          pendingTodos.push(todo.title || 'Unnamed Todo');
        }
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
        query(collection(db, 'journals'), where('userId', '==', user.uid))
      );
      const journals = journalSnap.docs
        .map((doc) => doc.data())
        .filter((j) => j.createdAt && checkDateInRange(j.createdAt));
      const journalDone = journals.length > 0;

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

      setTaskData({
        remainingTodos: pendingTodos,
        remainingIncomes: pendingIncomes,
        remainingExpenses: pendingExpenses,
        journalWritten: journalDone,
        moodLogged: moodDone,
      });
    } catch (error) {
      console.error('Error fetching task data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchTaskData();
  }, [fetchTaskData]);

  const totalPayments = useMemo(
    () => taskData.remainingIncomes.length + taskData.remainingExpenses.length,
    [taskData.remainingIncomes.length, taskData.remainingExpenses.length]
  );

  const hasRemaining = useMemo(
    () =>
      taskData.remainingTodos.length > 0 ||
      totalPayments > 0 ||
      !taskData.journalWritten ||
      !taskData.moodLogged,
    [
      taskData.remainingTodos.length,
      totalPayments,
      taskData.journalWritten,
      taskData.moodLogged,
    ]
  );

  if (!hasRemaining && !loading) {
    return null; // Don't render if nothing is remaining and not loading
  }

  return (
    <Box className="p-4">
      <Card
        className="rounded-2xl shadow-md"
        sx={{
          background:
            theme?.mode === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)'
              : '#ffffff',
          color: theme?.mode === 'dark' ? '#ffffff' : '#000000',
        }}
      >
        <CardContent className="p-6">
          {/* Title */}
          <Box className="mb-6">
            {loading ? (
              <Skeleton width={200} height={28} />
            ) : (
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{
                  color: theme?.mode === 'dark' ? '#ffffff' : '#000000',
                }}
              >
                What&#39;s Remaining for Today
              </Typography>
            )}
          </Box>

          {/* Segments Grid */}
          <div className="grid grid-cols-2 gap-3 w-full mb-6">
            <SegmentCard
              icon={<Assignment />}
              label="Tasks"
              count={taskData.remainingTodos.length}
              done={taskData.remainingTodos.length === 0}
              color="text-blue-600 bg-blue-100"
              loading={loading}
              href={taskData.remainingTodos.length > 0 ? '/to-do' : undefined}
              theme={theme}
            />
            <SegmentCard
              icon={<AttachMoney />}
              label="Payments"
              count={totalPayments}
              done={totalPayments === 0}
              color="text-green-600 bg-green-100"
              loading={loading}
              href={totalPayments > 0 ? '/finance' : undefined}
              theme={theme}
            />
            <SegmentCard
              icon={<Book />}
              label="Journal"
              count={1}
              done={taskData.journalWritten}
              color="text-purple-600 bg-purple-100"
              loading={loading}
              href={!taskData.journalWritten ? '/journals' : undefined}
              theme={theme}
            />
            <SegmentCard
              icon={<EmojiEmotions />}
              label="Mood"
              count={1}
              done={taskData.moodLogged}
              color="text-amber-600 bg-amber-100"
              loading={loading}
              theme={theme}
            />
          </div>

          {/* See Remaining Plans Button */}
          {!loading && hasRemaining && (
            <Box className="flex justify-center">
              <Link href="/1/plans-remaining">
                <Button
                  variant="contained"
                  color="secondary"
                  className="rounded-full shadow-md"
                >
                  See Remaining Plans
                </Button>
              </Link>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
});

RemainingTasks.displayName = 'RemainingTasks';

export default RemainingTasks;
