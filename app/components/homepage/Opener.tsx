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
  const [progress, setProgress] = useState(0);
  const [remainingTodos, setRemainingTodos] = useState<string[]>([]);
  const [remainingIncomes, setRemainingIncomes] = useState<string[]>([]);
  const [remainingExpenses, setRemainingExpenses] = useState<string[]>([]);
  const [journalWritten, setJournalWritten] = useState<boolean>(false);
  const [moodLogged, setMoodLogged] = useState<boolean>(false);
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
      total += 1;
      const moodDone = moods.length > 0;
      completed += moodDone ? 1 : 0;
      setMoodLogged(moodDone);

      const percentage =
        total === 0 ? 0 : Math.round((completed / total) * 100);
      setProgress(percentage);
      setRemainingTodos(pendingTodos);
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

  // ✅ Reusable Segment Card (smaller)
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
        <div className="rounded-xl flex flex-col items-center justify-center py-4 bg-white/70 backdrop-blur-md border border-gray-200 shadow-sm hover:shadow-md transition-all">
          <div className={`mb-2 ${done ? 'text-green-500' : color} text-2xl`}>
            {icon}
          </div>
          <Typography variant="body2" fontWeight={600}>
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
      <Card className="rounded-2xl shadow-md bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white">
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

            {!loading && hasRemaining && (
              <Link href="/1/plans-remaining">
                <Button
                  variant="contained"
                  color="secondary"
                  className="rounded-full shadow-md"
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
