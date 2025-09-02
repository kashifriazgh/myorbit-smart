'use client';
import React from 'react';
import { Box, Typography, LinearProgress, useTheme } from '@mui/material';
import moment from 'moment-timezone';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';

// <-- update this import path if your interface file lives elsewhere -->
import {
  Todo,
  JournalEntry,
  Idea,
  IncomeSource,
  Expenditure,
  MoodEntry,
  TotalCashSnapshot,
} from '@/app/lib/interface';

interface ActivityDay {
  date: string; // YYYY-MM-DD
  tasksCompleted: number;
  score: number; // 0-100
}

const TIMEZONE = 'Asia/Karachi';

export default function MostProductiveDay() {
  const theme = useTheme();
  const { user } = useAuth();

  const [data, setData] = React.useState<ActivityDay | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // ---------- compute start/end according to your rules ----------
        const today = moment().tz(TIMEZONE);
        const weekday = today.isoWeekday(); // 1 = Monday, 7 = Sunday

        let startMoment: moment.Moment;
        let endMoment: moment.Moment;

        if (weekday === 1) {
          // It's Monday -> use last week's Monday..Sunday (exclude today)
          startMoment = today.clone().subtract(1, 'week').startOf('isoWeek'); // last Monday 00:00
          endMoment = startMoment.clone().add(6, 'days').endOf('day'); // last Sunday 23:59:59
        } else {
          // Tue..Sun -> this week's Monday .. today (inclusive)
          startMoment = today.clone().startOf('isoWeek'); // this Monday 00:00
          endMoment = today.clone().endOf('day'); // today 23:59:59
        }

        const start = startMoment.toDate();
        const end = endMoment.toDate();

        console.log(
          '[DEBUG] Date range (Asia/Karachi):',
          startMoment.format(),
          '→',
          endMoment.format()
        );

        // ---------- helper: safe date conversion ----------
        const toJsDate = (val: unknown): Date | null => {
          if (!val) return null;
          if (val instanceof Date) return val;
          // Firestore Timestamp instance (modular SDK)
          if (val instanceof Timestamp) return val.toDate();
          // some objects expose toDate()
          if (typeof (val as { toDate?: unknown })?.toDate === 'function')
            return (val as { toDate: () => Date }).toDate();
          // fallback if ISO string
          if (typeof val === 'string') {
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d;
          }
          return null;
        };

        const inRange = (d: Date | null) => {
          if (!d) return false;
          return d >= start && d <= end;
        };

        // ---------- helper: query each date-field and merge by id ----------
        const fetchDocsByDateFields = async <T extends DocumentData>(
          collName: string,
          dateFields: string[]
        ): Promise<Array<T & { id?: string }>> => {
          const map = new Map<string, T & { id?: string }>();
          await Promise.all(
            dateFields.map(async (field) => {
              try {
                const q = query(
                  collection(db, collName),
                  where(field, '>=', start),
                  where(field, '<=', end)
                );
                const snap = await getDocs(q);
                console.log(
                  `[DEBUG] ${collName} by ${field} -> ${snap.size} docs`
                );
                snap.forEach((doc) => {
                  const docData = doc.data() as T;
                  map.set(doc.id, { id: doc.id, ...docData });
                });
              } catch (err) {
                console.error(`[ERROR] fetching ${collName} by ${field}:`, err);
                // do not throw — continue other fields/collections
              }
            })
          );
          return Array.from(map.values());
        };

        // ---------- fetch collections (choose date fields appropriate) ----------
        // todos: look at completedAt (we care about tasks completed)
        // journals, ideas, moods: createdAt
        // incomeSources / expenditures: both createdAt and updatedAt (merge)
        // totalCashSnapshots: createdAt (and maybe effectiveDate) — include both
        const [
          todos,
          journals,
          ideas,
          incomeSources,
          expenditures,
          moods,
          cashSnapshots,
        ] = await Promise.all([
          fetchDocsByDateFields<Todo>('todos', ['completedAt']), // only completedAt matters for completed tasks
          fetchDocsByDateFields<JournalEntry>('journals', ['createdAt']),
          fetchDocsByDateFields<Idea>('ideas', ['createdAt']),
          fetchDocsByDateFields<IncomeSource>('incomeSources', [
            'createdAt',
            'updatedAt',
          ]),
          fetchDocsByDateFields<Expenditure>('expenditures', [
            'createdAt',
            'updatedAt',
          ]),
          fetchDocsByDateFields<MoodEntry>('moods', [
            'createdAt',
            'recordedAt',
          ]),
          fetchDocsByDateFields<TotalCashSnapshot>('totalCashSnapshots', [
            'createdAt',
            'effectiveDate',
          ]),
        ]);

        console.log('[DEBUG] fetched counts:', {
          todos: todos.length,
          journals: journals.length,
          ideas: ideas.length,
          incomeSources: incomeSources.length,
          expenditures: expenditures.length,
          moods: moods.length,
          cashSnapshots: cashSnapshots.length,
        });

        // ---------- aggregate counts by day ----------
        const counts: Record<string, { tasks: number; score: number }> = {};

        const addActivity = (
          date: Date,
          type: 'tasks' | 'score',
          weight = 1
        ) => {
          const key = moment(date).tz(TIMEZONE).format('YYYY-MM-DD');
          if (!counts[key]) counts[key] = { tasks: 0, score: 0 };
          if (type === 'tasks') counts[key].tasks += weight;
          else counts[key].score += weight;
        };

        // --- TODOS (completedAt) ---
        todos.forEach((t) => {
          // authorId types might be string or something else — cast to string
          const authorId =
            t?.authorId !== undefined ? String(t.authorId) : null;
          const completed = toJsDate((t as Todo).completedAt);
          if (authorId === user.uid && completed && inRange(completed)) {
            addActivity(completed, 'tasks', 1);
          }
        });

        // --- JOURNALS (createdAt) ---
        journals.forEach((j) => {
          const uid = j?.authorId !== undefined ? String(j.authorId) : null;
          const d = toJsDate((j as JournalEntry).createdAt);
          if (uid === user.uid && d && inRange(d)) addActivity(d, 'score', 1);
        });

        // --- IDEAS (createdAt) ---
        ideas.forEach((i) => {
          const uid = (i as Idea)?.authorId ?? (i as Idea)?.authorId ?? null;
          const d = toJsDate((i as Idea).createdAt);
          if (String(uid) === user.uid && d && inRange(d))
            addActivity(d, 'score', 1);
        });

        // --- INCOME SOURCES (updatedAt OR createdAt) ---
        incomeSources.forEach((inc) => {
          if (String((inc as IncomeSource)?.userId) !== user.uid) return;
          // prefer updatedAt if inRange, else createdAt
          const d1 = toJsDate((inc as IncomeSource).updatedAt);
          const d2 = toJsDate((inc as IncomeSource).createdAt);
          const used = d1 && inRange(d1) ? d1 : d2 && inRange(d2) ? d2 : null;
          if (used) addActivity(used, 'score', 1);
        });

        // --- EXPENDITURES (updatedAt OR createdAt) ---
        expenditures.forEach((exp) => {
          if (String((exp as Expenditure)?.userId) !== user.uid) return;
          const d1 = toJsDate((exp as Expenditure).updatedAt);
          const d2 = toJsDate((exp as Expenditure).createdAt);
          const used = d1 && inRange(d1) ? d1 : d2 && inRange(d2) ? d2 : null;
          if (used) addActivity(used, 'score', 1);
        });

        // --- MOODS (createdAt or recordedAt) ---
        moods.forEach((m) => {
          if (String((m as MoodEntry)?.userId) !== user.uid) return;
          const d1 = toJsDate((m as MoodEntry).createdAt);
          const d2 = toJsDate((m as MoodEntry).recordedAt);
          const used = d1 && inRange(d1) ? d1 : d2 && inRange(d2) ? d2 : null;
          if (used) addActivity(used, 'score', 1);
        });

        // --- CASH SNAPSHOTS (createdAt / effectiveDate) ---
        cashSnapshots.forEach((c) => {
          if (String((c as TotalCashSnapshot)?.userId) !== user.uid) return;
          const d1 = toJsDate((c as TotalCashSnapshot).createdAt);
          const d2 = toJsDate((c as TotalCashSnapshot).effectiveDate);
          const used = d1 && inRange(d1) ? d1 : d2 && inRange(d2) ? d2 : null;
          if (used) addActivity(used, 'score', 1);
        });

        console.log('[DEBUG] counts after processing:', counts);

        // ---------- compute best day ----------
        if (Object.keys(counts).length === 0) {
          setData(null);
          setLoading(false);
          return;
        }

        let bestDay: ActivityDay | null = null;
        Object.entries(counts).forEach(([date, { tasks, score }]) => {
          if (
            !bestDay ||
            score > bestDay.score ||
            (score === bestDay.score && tasks > bestDay.tasksCompleted)
          ) {
            bestDay = { date, tasksCompleted: tasks, score };
          }
        });

        if (bestDay) {
          const maxScore = Math.max(
            ...Object.values(counts).map((c) => c.score)
          );
          const focusScore = maxScore
            ? Math.round((bestDay.score / maxScore) * 100)
            : 0;
          setData({
            date: bestDay.date,
            tasksCompleted: bestDay.tasksCompleted,
            score: focusScore,
          });
        } else {
          setData(null);
        }
      } catch (err: unknown) {
        console.error('[ERROR] MostProductiveDay fetch:', err);
        const message =
          err &&
          typeof err === 'object' &&
          'message' in err &&
          typeof err.message === 'string'
            ? err.message
            : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ---------- UI states ----------
  if (!user) {
    return <Typography color="error">⚠ Login required</Typography>;
  }

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2">Fetching productivity data...</Typography>
        <LinearProgress sx={{ mt: 1 }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="error">
          Error: {error}
        </Typography>
      </Box>
    );
  }

  if (!data) {
    return null;
  }

  // ---------- final render ----------
  const formattedDate = moment.tz(data.date, TIMEZONE).format('dddd, MMM D');
  const primaryColor = theme.palette.mode === 'dark' ? '#4ade80' : '#059669';
  const bgColor = theme.palette.mode === 'dark' ? '#1e293b' : '#f0fdf4';
  const borderColor = theme.palette.mode === 'dark' ? '#15803d' : '#bbf7d0';

  return (
    <Box
      sx={{
        background: bgColor,
        borderRadius: 2,
        px: 3,
        py: 2.5,
        border: `1px solid ${borderColor}`,
        boxShadow: '0px 2px 8px rgba(0,0,0,0.05)',
        minWidth: 300,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          color: primaryColor,
          fontWeight: 700,
          fontSize: '0.9rem',
          mb: 1.5,
        }}
      >
        🌟 Most Productive Day
      </Typography>

      <Typography
        variant="h6"
        fontWeight="bold"
        sx={{ color: theme.palette.text.primary, mb: 0.5 }}
      >
        {formattedDate}
      </Typography>

      <Typography
        variant="body2"
        sx={{ color: theme.palette.text.secondary, mb: 1 }}
      >
        Tasks Completed: <strong>{data.tasksCompleted}</strong>
      </Typography>

      <Typography
        variant="body2"
        sx={{
          color: theme.palette.text.secondary,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        Focus Score: <strong>{data.score}%</strong>
      </Typography>

      <LinearProgress
        variant="determinate"
        value={data.score}
        sx={{
          height: 8,
          borderRadius: 4,
          mt: 0.5,
          backgroundColor:
            theme.palette.mode === 'dark' ? '#334155' : '#d1fae5',
          '& .MuiLinearProgress-bar': { backgroundColor: primaryColor },
        }}
      />
    </Box>
  );
}
