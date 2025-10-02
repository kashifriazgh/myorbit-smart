'use client';

import React, { memo, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
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
import moment from 'moment';

// ✅ Reusable circular progress with overlay label
const CircularProgressWithLabel = memo(({ value }: { value: number }) => {
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
});

CircularProgressWithLabel.displayName = 'CircularProgressWithLabel';

interface ProgressData {
  progress: number;
  overdueTodos: string[];
}

const WelcomeGreeting = memo(() => {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [firstName, setFirstName] = useState('');
  const [progressData, setProgressData] = useState<ProgressData>({
    progress: 0,
    overdueTodos: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchName = useCallback(async () => {
    if (user?.uid) {
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setFirstName(data.firstName || '');
        }
      } catch (error) {
        console.error('Error fetching user name:', error);
      }
    }
  }, [user?.uid]);

  const fetchProgress = useCallback(async () => {
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

      const overdueTodosList: string[] = [];

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

      // ✅ Expenses
      const expenseSnap = await getDocs(
        query(collection(db, 'expenditures'), where('userId', '==', user.uid))
      );
      const expenses = expenseSnap.docs
        .map((doc) => doc.data())
        .filter((e) => e.dueDate && checkDateInRange(e.dueDate));

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

      // ✅ Progress (only today's items, NOT overdue)
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

      setProgressData({
        progress: percentage,
        overdueTodos: overdueTodosList,
      });
    } catch (error) {
      console.error('Error fetching progress data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchName();
  }, [fetchName]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const getMotivationalMessage = (progress: number) => {
    if (progress >= 90) return "Amazing! You're almost done 🎉";
    if (progress >= 50) return 'Great work, keep going 🚀';
    return "Let's crush today's plan 💪";
  };

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
        <CardContent className="flex flex-col lg:flex-row items-center justify-between gap-6 p-6">
          {/* Left Section - Greeting */}
          <Box className="flex flex-col items-start space-y-4 w-full lg:w-1/2">
            <div>
              {loading ? (
                <>
                  <Skeleton width={120} height={20} />
                  <Skeleton width={220} height={28} />
                </>
              ) : (
                <>
                  <Typography
                    variant="body2"
                    className="opacity-80"
                    sx={{
                      color: theme?.mode === 'dark' ? '#ffffff' : '#000000',
                    }}
                  >
                    Welcome back,{' '}
                    <span className="font-semibold">{firstName}</span>
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    sx={{
                      color: theme?.mode === 'dark' ? '#ffffff' : '#000000',
                    }}
                  >
                    {getMotivationalMessage(progressData.progress)}
                  </Typography>
                </>
              )}
            </div>

            {/* Overdue indicator */}
            {!loading && progressData.overdueTodos.length > 0 && (
              <Box className="mt-2">
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor:
                      theme?.mode === 'dark' ? '#7f1d1d' : '#fef2f2',
                    color: theme?.mode === 'dark' ? '#fca5a5' : '#dc2626',
                  }}
                >
                  {progressData.overdueTodos.length}{' '}
                  {progressData.overdueTodos.length === 1
                    ? 'Task is'
                    : 'Tasks are'}{' '}
                  overdue.
                </span>
              </Box>
            )}
          </Box>

          {/* Right Section - Progress Circle */}
          <Box className="flex flex-col items-center justify-center w-full lg:w-1/2">
            {loading ? (
              <Skeleton variant="circular" width={100} height={100} />
            ) : (
              <CircularProgressWithLabel value={progressData.progress} />
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
});

WelcomeGreeting.displayName = 'WelcomeGreeting';

export default WelcomeGreeting;
