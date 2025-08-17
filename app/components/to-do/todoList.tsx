'use client';
import {
  Box,
  Checkbox,
  CircularProgress,
  Stack,
  Typography,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import {
  collection,
  Timestamp,
  query,
  where,
  deleteDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore';
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
    routine: { bg: '#10b981', text: '#fff' },
    urgent: { bg: '#f59e0b', text: '#fff' },
    critical: { bg: '#ef4444', text: '#fff' },
  };

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    in_progress: { bg: '#3b82f6', text: '#fff' },
    hold: { bg: '#fbbf24', text: '#000' },
    completed: { bg: '#22c55e', text: '#fff' },
    'left-over': { bg: '#6b7280', text: '#fff' },
  };

  const STATUS_ORDER: Record<string, number> = {
    in_progress: 1,
    hold: 2,
    completed: 3,
    'left-over': 4,
  };

  const getDueDateColor = (dueDate: Date) => {
    const now = moment();
    const due = moment(dueDate);
    const diff = due.diff(now, 'days');

    if (diff < 0) return { bg: '#dc2626', text: '#fff' }; // Overdue
    if (diff === 0) return { bg: '#f97316', text: '#fff' }; // Today
    if (diff <= 2) return { bg: '#facc15', text: '#000' }; // Soon
    return { bg: '#e5e7eb', text: '#111827' }; // Later
  };

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const thirtyDaysAgo = moment()
      .tz('Asia/Karachi')
      .subtract(30, 'days')
      .toDate();
    const thirtyDaysAgoTS = Timestamp.fromDate(thirtyDaysAgo);

    const q = query(
      collection(db, 'todos'),
      where('createdAt', '>=', thirtyDaysAgoTS)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const filteredTodos = snap.docs
          .map((doc) => {
            const data = doc.data() as Todo;
            const dueDate = data.dueDate
              ? data.dueDate instanceof Timestamp
                ? data.dueDate.toDate()
                : data.dueDate
              : null;
            return {
              ...data,
              id: doc.id,
              dueDate,
            };
          })
          .filter((todo) => todo.authorId === user.uid)
          .sort((a, b) => {
            const statusDiff =
              (STATUS_ORDER[a.status || 'left-over'] || 99) -
              (STATUS_ORDER[b.status || 'left-over'] || 99);

            if (statusDiff !== 0) return statusDiff;

            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;

            return b.dueDate.getTime() - a.dueDate.getTime();
          });

        setTodos(filteredTodos);
        setLoading(false);
      },
      (err) => {
        console.error('❌ Error loading todos:', err);
        setLoading(false);
      }
    );

    // Clean up listener on unmount or user change
    return () => unsubscribe();
  }, [user]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      const deletePromises = selectedIds.map((id) =>
        deleteDoc(doc(db, 'todos', id))
      );
      await Promise.all(deletePromises);
      setTodos((prev) =>
        prev.filter((todo) => !selectedIds.includes(todo.id!))
      );
      setSelectedIds([]);
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('❌ Error deleting todos:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box textAlign="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box mt={4}>
      {selectedIds.length > 0 && (
        <Box mb={2} textAlign="right">
          <Button
            variant="contained"
            color="error"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleting}
          >
            {deleting ? (
              <CircularProgress size={20} />
            ) : (
              `Delete (${selectedIds.length})`
            )}
          </Button>
        </Box>
      )}

      {todos.length === 0 ? (
        <Typography>No tasks found.</Typography>
      ) : (
        todos.map((todo) => {
          const selected = selectedIds.includes(todo.id!);
          const dueDate = todo.dueDate as Date | null;
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

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Do you want to delete {selectedIds.length} task
          {selectedIds.length > 1 ? 's' : ''}?
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteSelected}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={20} /> : 'Yes, Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
