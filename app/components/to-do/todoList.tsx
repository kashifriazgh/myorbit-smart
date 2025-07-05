'use client';
import {
  Box,
  Checkbox,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import moment from 'moment-timezone';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Todo } from '@/app/lib/interface';
import Link from 'next/link';

export default function TodosList() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
    routine: { bg: '#10b981', text: '#fff' }, // green - low urgency
    urgent: { bg: '#f59e0b', text: '#fff' }, // amber - medium urgency
    critical: { bg: '#ef4444', text: '#fff' }, // red - high urgency
  };

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    in_progress: { bg: '#3b82f6', text: '#fff' }, // blue
    hold: { bg: '#fbbf24', text: '#000' }, // yellow
    completed: { bg: '#22c55e', text: '#fff' }, // green
    'left-over': { bg: '#6b7280', text: '#fff' }, // gray
  };

  const getDueDateColor = (dueDate: Date) => {
    const now = moment();
    const due = moment(dueDate);
    const diff = due.diff(now, 'days');

    if (diff < 0) return { bg: '#dc2626', text: '#fff' }; // overdue
    if (diff === 0) return { bg: '#f97316', text: '#fff' }; // due today
    if (diff <= 2) return { bg: '#facc15', text: '#000' }; // due soon
    return { bg: '#e5e7eb', text: '#111827' }; // default
  };

  const fetchTodos = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const snap = await getDocs(collection(db, 'todos'));
      const now = moment().tz('Asia/Karachi');
      const recentTodos = snap.docs
        .map((doc) => ({ ...doc.data(), id: doc.id } as Todo))
        .filter((todo) => {
          const createdAt = (todo.createdAt as unknown as Timestamp)?.seconds
            ? moment
                .unix((todo.createdAt as unknown as Timestamp).seconds)
                .tz('Asia/Karachi')
            : null;
          return (
            todo.authorId === user.uid &&
            createdAt?.isAfter(now.clone().subtract(30, 'days'))
          );
        });

      setTodos(recentTodos);
    } catch (err) {
      console.error('❌ Error loading todos:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    fetchTodos();
  }, [user]);

  if (loading) {
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box mt={4}>
      {todos.length === 0 ? (
        <Typography>No tasks found.</Typography>
      ) : (
        todos.map((todo) => {
          const selected = selectedIds.includes(todo.id!);
          const dueDate = (todo.dueDate as unknown as Timestamp)?.toDate?.();
          return (
            <Box
              key={todo.id}
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
                border: `1px solid ${
                  theme.mode === 'dark' ? '#334155' : '#d4d4d4'
                }`,
                bgcolor: selected
                  ? theme.mode === 'dark'
                    ? '#1e40af'
                    : '#dbeafe'
                  : theme.mode === 'dark'
                  ? '#1e293b'
                  : '#fff',
                color: theme.mode === 'dark' ? '#f1f5f9' : 'inherit',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Checkbox
                  checked={selected}
                  onChange={() => toggleSelect(todo.id!)}
                  size="small"
                />
                <Link href={`/to-do/${todo.id}`}>
                  <Typography
                    fontWeight={600}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {todo.title}
                  </Typography>
                </Link>
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                mt={0.5}
                ml={4}
                flexWrap="wrap"
              >
                {todo.status && (
                  <Box
                    sx={{
                      px: 1,
                      py: 0.2,
                      borderRadius: 1,
                      fontSize: 11,
                      bgcolor: STATUS_COLORS[todo.status]?.bg,
                      color: STATUS_COLORS[todo.status]?.text,
                    }}
                  >
                    {todo.status}
                  </Box>
                )}
                {todo.priority && (
                  <Box
                    sx={{
                      px: 1,
                      py: 0.2,
                      borderRadius: 1,
                      fontSize: 11,
                      bgcolor: PRIORITY_COLORS[todo.priority]?.bg,
                      color: PRIORITY_COLORS[todo.priority]?.text,
                    }}
                  >
                    {todo.priority}
                  </Box>
                )}
                {dueDate && (
                  <Box
                    sx={{
                      px: 1,
                      py: 0.2,
                      borderRadius: 1,
                      fontSize: 11,
                      ...getDueDateColor(dueDate),
                    }}
                  >
                    Due: {moment(dueDate).format('MMM D, YYYY')}
                  </Box>
                )}
              </Stack>
            </Box>
          );
        })
      )}
    </Box>
  );
}
