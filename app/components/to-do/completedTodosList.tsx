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
  useTheme,
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
import React, { useEffect, useState } from 'react';
import moment from 'moment-timezone';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { Todo } from '@/app/lib/interface';
import Link from 'next/link';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FlagIcon from '@mui/icons-material/Flag';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

export default function CompletedTodosList() {
  const { user } = useAuth();
  const muiTheme = useTheme();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const PRIORITY_COLORS: Record<
    string,
    { bg: string; text: string; icon: React.ReactNode }
  > = {
    routine: {
      bg: '#10b981',
      text: '#fff',
      icon: <FlagIcon sx={{ fontSize: 14 }} />,
    },
    urgent: {
      bg: '#f59e0b',
      text: '#fff',
      icon: <FlagIcon sx={{ fontSize: 14 }} />,
    },
    critical: {
      bg: '#ef4444',
      text: '#fff',
      icon: <FlagIcon sx={{ fontSize: 14 }} />,
    },
  };

  const STATUS_COLORS: Record<
    string,
    { bg: string; text: string; icon: React.ReactNode }
  > = {
    in_progress: {
      bg: '#3b82f6',
      text: '#fff',
      icon: <PlayArrowIcon sx={{ fontSize: 14 }} />,
    },
    hold: {
      bg: '#fbbf24',
      text: '#000',
      icon: <PauseIcon sx={{ fontSize: 14 }} />,
    },
    completed: {
      bg: '#22c55e',
      text: '#fff',
      icon: <CheckCircleIcon sx={{ fontSize: 14 }} />,
    },
    'left-over': {
      bg: '#6b7280',
      text: '#fff',
      icon: <AccessTimeIcon sx={{ fontSize: 14 }} />,
    },
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
          .filter(
            (todo) => todo.authorId === user.uid && todo.status === 'completed'
          )
          .sort((a, b) => {
            // Sort by completion date (most recent first)
            const aCompletedAt =
              a.completedAt instanceof Timestamp
                ? a.completedAt.toDate()
                : a.completedAt;
            const bCompletedAt =
              b.completedAt instanceof Timestamp
                ? b.completedAt.toDate()
                : b.completedAt;

            if (!aCompletedAt && !bCompletedAt) return 0;
            if (!aCompletedAt) return 1;
            if (!bCompletedAt) return -1;

            return bCompletedAt.getTime() - aCompletedAt.getTime();
          });

        setTodos(filteredTodos);
        setLoading(false);
      },
      (err) => {
        console.error('❌ Error loading completed todos:', err);
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
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size={48} />
        <Typography variant="body2" color="text.secondary">
          Loading completed tasks...
        </Typography>
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
        <Box textAlign="center" py={6}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            🎉 No completed tasks found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Complete some tasks to see them here!
          </Typography>
        </Box>
      ) : (
        todos.map((todo) => {
          const selected = selectedIds.includes(todo.id!);
          const dueDate = todo.dueDate as Date | null;
          const completedAt =
            todo.completedAt instanceof Timestamp
              ? todo.completedAt.toDate()
              : todo.completedAt;

          return (
            <Box
              key={todo.id}
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
                border: `1px solid ${
                  muiTheme.palette.mode === 'dark' ? '#334155' : '#d4d4d4'
                }`,
                bgcolor: selected
                  ? muiTheme.palette.mode === 'dark'
                    ? '#1e40af'
                    : '#dbeafe'
                  : muiTheme.palette.mode === 'dark'
                  ? '#1e293b'
                  : '#fff',
                color: muiTheme.palette.mode === 'dark' ? '#f1f5f9' : 'inherit',
                opacity: 0.8,
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  backgroundColor: '#22c55e',
                  borderRadius: '2px 0 0 2px',
                },
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
                      textDecoration: 'line-through',
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
                {completedAt && (
                  <Box
                    sx={{
                      px: 1,
                      py: 0.2,
                      borderRadius: 1,
                      fontSize: 11,
                      bgcolor: '#22c55e',
                      color: '#fff',
                    }}
                  >
                    Completed: {moment(completedAt).format('MMM D, YYYY')}
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
          Do you want to delete {selectedIds.length} completed task
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
