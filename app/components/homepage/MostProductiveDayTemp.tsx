'use client';

import {
  Box,
  Typography,
  CircularProgress,
  Divider,
  Stack,
  Paper,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import moment from 'moment-timezone';

interface Entry {
  id: string;
  createdAt: Timestamp | Date;
  completedAt?: Timestamp | Date;
  authorId?: string;
  userId?: string;
  title?: string;
  content?: string;
}

interface DailyData {
  date: string;
  journals: Entry[];
  ideasCount: number;
  tasksCount: number;
  tasksCompletedCount: number;
  incomesCount: number;
  productivityScore?: number;
}

export default function MostProductiveDay() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [daysData, setDaysData] = useState<DailyData[]>([]);
  const [bestDay, setBestDay] = useState<DailyData | null>(null);

  useEffect(() => {
    const fetchProductivity = async () => {
      if (!user) return;

      setLoading(true);
      const now = moment().tz('Asia/Karachi');
      const startDate = now.clone().subtract(6, 'days').startOf('day');

      try {
        // Fetch all collections
        const [journalSnap, ideaSnap, todoSnap, incomeSnap] = await Promise.all(
          [
            getDocs(collection(db, 'journals')),
            getDocs(collection(db, 'ideas')),
            getDocs(collection(db, 'todos')),
            getDocs(collection(db, 'incomeSources')),
          ]
        );

        const parseDate = (ts: Timestamp | Date) =>
          ts instanceof Timestamp ? ts.toDate() : ts;

        const filterAndGroupByDate = (
          entries: Entry[],
          key: 'authorId' | 'userId',
          dateField: 'createdAt' | 'completedAt' = 'createdAt'
        ) => {
          const grouped: Record<string, Entry[]> = {};
          entries
            .filter((e) => e[key] === user.uid && e[dateField])
            .forEach((entry) => {
              const date = moment(parseDate(entry[dateField]!))
                .tz('Asia/Karachi')
                .startOf('day');
              if (date.isBefore(startDate)) return;

              const dateKey = date.format('YYYY-MM-DD');
              if (!grouped[dateKey]) grouped[dateKey] = [];
              grouped[dateKey].push(entry);
            });
          return grouped;
        };

        const journals = filterAndGroupByDate(
          journalSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Entry)),
          'authorId'
        );
        const ideas = filterAndGroupByDate(
          ideaSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Entry)),
          'authorId'
        );
        const todosCreated = filterAndGroupByDate(
          todoSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Entry)),
          'authorId',
          'createdAt'
        );
        const todosCompleted = filterAndGroupByDate(
          todoSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Entry)),
          'authorId',
          'completedAt'
        );
        const incomes = filterAndGroupByDate(
          incomeSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Entry)),
          'userId'
        );

        const finalDays: DailyData[] = [];

        for (let i = 0; i < 7; i++) {
          const day = startDate.clone().add(i, 'days');
          const key = day.format('YYYY-MM-DD');

          finalDays.push({
            date: key,
            journals: journals[key] || [],
            ideasCount: ideas[key]?.length || 0,
            tasksCount: todosCreated[key]?.length || 0,
            tasksCompletedCount: todosCompleted[key]?.length || 0,
            incomesCount: incomes[key]?.length || 0,
          });
        }

        const scoredDays = await Promise.all(
          finalDays.map(async (day) => {
            if (day.journals.length === 0)
              return { ...day, productivityScore: 0 };

            const response = await fetch('/api/ideas/improve-idea', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                value: `
Date: ${day.date}
Journals:\n${day.journals
                  .map(
                    (j, i) =>
                      `#${i + 1} ${j.title || 'Untitled'}\n${j.content || ''}`
                  )
                  .join('\n\n')}
Ideas Created: ${day.ideasCount}
Tasks Created: ${day.tasksCount}
Tasks Completed: ${day.tasksCompletedCount}
Incomes Received: ${day.incomesCount}
`.trim(),
                instructions: `
You're a productivity evaluator. Based on the user's journal entries, number of ideas, tasks created, tasks completed, and incomes for a specific day, rate that day on a scale of 1 to 100 in terms of productivity. Only return the number, no explanation.
        `.trim(),
              }),
            });

            const data = await response.json();
            const score = parseInt(data.result?.match(/\d+/)?.[0] || '0', 10);
            return { ...day, productivityScore: score };
          })
        );

        const mostProductive = scoredDays.reduce((acc, curr) => {
          return curr.productivityScore! > (acc?.productivityScore || 0)
            ? curr
            : acc;
        }, null as DailyData | null);

        setDaysData(scoredDays);
        setBestDay(mostProductive);
      } catch (err) {
        console.error('🔥 Error in productivity analysis:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProductivity();
  }, [user]);

  if (loading) {
    return (
      <Box mt={4}>
        <CircularProgress />
        <Typography mt={2}>Analyzing productivity...</Typography>
      </Box>
    );
  }

  return (
    <Box mt={4}>
      <Typography variant="h6" gutterBottom>
        🏆 Most Productive Day: {bestDay?.date} ({bestDay?.productivityScore})
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Typography variant="subtitle1" gutterBottom>
        🧪 Debug: Last 7 Days Activity
      </Typography>

      <Stack spacing={2}>
        {daysData.map((day) => (
          <Paper key={day.date} sx={{ p: 2, bgcolor: '#f9f9f9' }}>
            <Typography variant="subtitle2">
              📅 {day.date} – Score: {day.productivityScore}
            </Typography>
            <Typography variant="body2">
              Journals: {day.journals.length} | Ideas: {day.ideasCount} | Tasks
              Created: {day.tasksCount} | Tasks Completed:{' '}
              {day.tasksCompletedCount} | Incomes: {day.incomesCount}
            </Typography>
            {day.journals.map((j, i) => (
              <Box key={j.id} sx={{ mt: 1, pl: 1 }}>
                <Typography variant="caption">
                  📝 {i + 1}. {j.title || 'Untitled'}
                </Typography>
              </Box>
            ))}
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
