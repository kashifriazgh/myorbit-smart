'use client';

import React, { memo, useEffect, useState, useCallback } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
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
import ProductivityEditor from '../global/QuickEditor';

interface HeaderData {
  firstName: string;
  totalTasks: number;
}

const HomepageHeader = memo(() => {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [headerData, setHeaderData] = useState<HeaderData>({
    firstName: '',
    totalTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchHeaderData = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      // Fetch user name
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      let firstName = '';
      if (userSnap.exists()) {
        const userData = userSnap.data();
        firstName = userData.firstName || '';
      }

      // Fetch total tasks count
      const today = moment().startOf('day');
      const endOfToday = moment().endOf('day');

      const checkDateInRange = (date: Date | Timestamp) => {
        const momentDate = moment(
          date instanceof Timestamp ? date.toDate() : date
        );
        return momentDate.isBetween(today, endOfToday, 'day', '[]');
      };

      // Get todos
      const todoSnap = await getDocs(
        query(collection(db, 'todos'), where('authorId', '==', user.uid))
      );
      const todos = todoSnap.docs.map((doc) => doc.data());
      const todayTodos = todos.filter(
        (todo) => todo.dueDate && checkDateInRange(todo.dueDate)
      );

      // Get incomes
      const incomeSnap = await getDocs(
        query(collection(db, 'incomeSources'), where('userId', '==', user.uid))
      );
      const incomes = incomeSnap.docs
        .map((doc) => doc.data())
        .filter((i) => i.expectedDate && checkDateInRange(i.expectedDate));

      // Get expenses
      const expenseSnap = await getDocs(
        query(collection(db, 'expenditures'), where('userId', '==', user.uid))
      );
      const expenses = expenseSnap.docs
        .map((doc) => doc.data())
        .filter((e) => e.dueDate && checkDateInRange(e.dueDate));

      // Get journals
      const journalSnap = await getDocs(
        query(collection(db, 'journals'), where('userId', '==', user.uid))
      );
      const journals = journalSnap.docs
        .map((doc) => doc.data())
        .filter((j) => j.createdAt && checkDateInRange(j.createdAt));

      // Get moods
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

      const totalTasks =
        todayTodos.length +
        incomes.length +
        expenses.length +
        (journals.length > 0 ? 1 : 0) +
        (moods.length > 0 ? 1 : 0);

      setHeaderData({ firstName, totalTasks });
    } catch (error) {
      console.error('Error fetching header data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchHeaderData();
  }, [fetchHeaderData]);

  return (
    <Box className="w-full mb-6">
      <div
        className="rounded-2xl shadow-lg p-6"
        style={{
          background:
            theme?.mode === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #ffffff 100%)',
          border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Greeting Section */}
          <div className="flex-1 lg:w-[40%]">
            {loading ? (
              <div className="space-y-2">
                <Skeleton variant="text" width={200} height={40} />
                <Skeleton variant="text" width={180} height={24} />
              </div>
            ) : (
              <div>
                <Typography
                  variant="h3"
                  sx={{
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
                    fontSize: '2rem',
                    lineHeight: 1.2,
                    mb: 1,
                  }}
                >
                  Hello,{' '}
                  <span style={{ fontWeight: 'bold' }}>
                    {headerData.firstName}
                  </span>
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
                    fontSize: '1rem',
                    fontWeight: 500,
                  }}
                >
                  You have {headerData.totalTasks} activities today
                </Typography>
              </div>
            )}
          </div>

          {/* Search Section */}
          <div className="flex-1 lg:w-[60%]">
            {loading ? (
              <Skeleton variant="rounded" height={56} />
            ) : (
              <ProductivityEditor variant="compact" />
            )}
          </div>
        </div>
      </div>
    </Box>
  );
});

HomepageHeader.displayName = 'HomepageHeader';

export default HomepageHeader;
