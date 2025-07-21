'use client';

import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  Stack,
  Divider,
  Paper,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

interface Todo {
  id: string;
  title?: string;
  createdAt?: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

const weekdayMap: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

export default function MostFocusedTime() {
  const [loading, setLoading] = useState(true);
  const [focusedData, setFocusedData] = useState<{
    mostFocusedHours: number[];
    mostFocusedDays: number[];
    peakTimestamps: Date[];
  } | null>(null);

  const [hourFrequency, setHourFrequency] = useState<number[]>([]);
  const [dayFrequency, setDayFrequency] = useState<number[]>([]);
  const [todosList, setTodosList] = useState<Todo[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const allTimestamps: Date[] = [];

        const collectTimestamps = async (colName: string, fields: string[]) => {
          const snap = await getDocs(collection(db, colName));
          snap.forEach((doc) => {
            const data = doc.data();
            fields.forEach((field) => {
              const ts = data[field];
              if (ts?.toDate) {
                allTimestamps.push(ts.toDate());
              }
            });
          });
        };

        // Collect timestamps from relevant collections
        await Promise.all([
          collectTimestamps('ideas', ['createdAt']),
          collectTimestamps('todos', ['createdAt', 'updatedAt', 'completedAt']),
          collectTimestamps('journals', ['createdAt']),
          collectTimestamps('incomeSources', ['expectedDate', 'receivedAt']),
          collectTimestamps('expenditures', ['expectedDate', 'paidAt']),
          collectTimestamps('buyItems', ['createdAt', 'boughtAt']),
          collectTimestamps('cashTransactions', ['createdAt']),
          collectTimestamps('totalCashSnapshots', ['createdAt']),
        ]);

        // Calculate hour and day frequency
        const hourFreq = new Array(24).fill(0);
        const dayFreq = new Array(7).fill(0);

        allTimestamps.forEach((ts) => {
          hourFreq[ts.getHours()]++;
          dayFreq[ts.getDay()]++;
        });

        setHourFrequency(hourFreq);
        setDayFrequency(dayFreq);

        const maxHourCount = Math.max(...hourFreq);
        const maxDayCount = Math.max(...dayFreq);

        const mostFocusedHours = hourFreq
          .map((count, hour) => ({ hour, count }))
          .filter(({ count }) => count === maxHourCount)
          .map(({ hour }) => hour);

        const mostFocusedDays = dayFreq
          .map((count, day) => ({ day, count }))
          .filter(({ count }) => count === maxDayCount)
          .map(({ day }) => day);

        const peakTimestamps = allTimestamps.filter((ts) =>
          mostFocusedHours.includes(ts.getHours())
        );

        setFocusedData({
          mostFocusedHours,
          mostFocusedDays,
          peakTimestamps,
        });

        // Load todos
        const todosSnap = await getDocs(collection(db, 'todos'));
        const todos: Todo[] = todosSnap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || 'Untitled',
            createdAt: data.createdAt?.toDate?.(),
            updatedAt: data.updatedAt?.toDate?.(),
            completedAt: data.completedAt?.toDate?.(),
          };
        });
        setTodosList(todos);
      } catch (error) {
        console.error('Error fetching focused time data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Box p={2}>
        <CircularProgress size={20} />
        <Typography ml={1} display="inline">
          Analyzing activity...
        </Typography>
      </Box>
    );
  }

  if (!focusedData) return <Typography>No data available.</Typography>;

  return (
    <Box p={2}>
      <Typography variant="h6" gutterBottom>
        ⏱ Most Focused Time
      </Typography>

      <Typography fontWeight="medium">Most Active Hour(s):</Typography>
      <Stack direction="row" spacing={1} my={1}>
        {focusedData.mostFocusedHours.map((hour) => (
          <Chip key={hour} label={`${hour}:00 - ${hour + 1}:00`} />
        ))}
      </Stack>

      <Typography fontWeight="medium">Most Active Day(s):</Typography>
      <Stack direction="row" spacing={1} my={1}>
        {focusedData.mostFocusedDays.map((day) => (
          <Chip key={day} label={weekdayMap[day]} />
        ))}
      </Stack>

      <Divider sx={{ my: 3 }} />

      {focusedData.peakTimestamps.length > 0 && (
        <>
          <Typography fontWeight="medium" mt={3}>
            Sample Peak Hour Timestamps:
          </Typography>
          <Stack spacing={0.5} mt={1}>
            {focusedData.peakTimestamps.slice(0, 10).map((ts, idx) => (
              <Typography key={idx} variant="body2">
                {ts.toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Typography>
            ))}
          </Stack>
        </>
      )}

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        🗂 All Todos (Timestamps)
      </Typography>
      <Stack spacing={2}>
        {todosList.map((todo) => (
          <Paper key={todo.id} variant="outlined" sx={{ p: 2 }}>
            <Typography fontWeight="bold">{todo.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              Created: {todo.createdAt?.toLocaleString() || 'N/A'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Updated: {todo.updatedAt?.toLocaleString() || 'N/A'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Completed: {todo.completedAt?.toLocaleString() || 'Not completed'}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Typography fontWeight="medium">📊 Full Day Frequency:</Typography>
      <Stack direction="row" spacing={1} my={1}>
        {dayFrequency.map((count, day) => (
          <Chip key={day} label={`${weekdayMap[day]} - ${count}`} />
        ))}
      </Stack>

      <Typography fontWeight="medium" mt={2}>
        🕒 Full Hour Frequency:
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" mt={1}>
        {hourFrequency.map((count, hour) => (
          <Chip key={hour} label={`${hour}:00 - ${count}`} />
        ))}
      </Stack>
    </Box>
  );
}
