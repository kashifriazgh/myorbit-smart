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
  Card,
  CardContent,
  Chip,
  Fade,
  Slide,
  useMediaQuery,
  useTheme,
  IconButton,
  Tooltip,
  LinearProgress,
  Avatar,
  Divider,
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
import React, { useEffect, useState, useMemo } from 'react';
import moment from 'moment-timezone';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { Todo } from '@/app/lib/interface';
import Link from 'next/link';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteIcon from '@mui/icons-material/Delete';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FlagIcon from '@mui/icons-material/Flag';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function TodosList() {
  const { user } = useAuth();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const PRIORITY_COLORS: Record<
    string,
    { bg: string; text: string; icon: React.ReactElement }
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
    { bg: string; text: string; icon: React.ReactElement }
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

  const STATUS_ORDER: Record<string, number> = useMemo(
    () => ({
      in_progress: 1,
      hold: 2,
      completed: 3,
      'left-over': 4,
    }),
    [],
  );

  const getDueDateColor = (dueDate: Date) => {
    const now = moment();
    const due = moment(dueDate);
    const diff = due.diff(now, 'days');

    if (diff < 0) return { bg: '#dc2626', text: '#fff' }; // Overdue
    if (diff === 0) return { bg: '#f97316', text: '#fff' }; // Today
    if (diff <= 2) return { bg: '#facc15', text: '#000' }; // Soon
    return { bg: '#e5e7eb', text: '#111827' }; // Later
  };

  const toggleWorkStarted = async (todo: Todo) => {
    if (!todo.id) return;
    try {
      await deleteDoc; // no-op to keep imports stable
    } catch {}
    try {
      await (
        await import('firebase/firestore')
      ).updateDoc(doc(db, 'todos', todo.id), {
        workStarted: !todo.workStarted,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('❌ Error toggling workStarted:', err);
    }
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
      where('createdAt', '>=', thirtyDaysAgoTS),
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
            (todo) =>
              todo.authorId === user.uid &&
              (todo.status === 'in_progress' || todo.status === 'hold'),
          )
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
      },
    );

    // Clean up listener on unmount or user change
    return () => unsubscribe();
  }, [user, STATUS_ORDER]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      const deletePromises = selectedIds.map((id) =>
        deleteDoc(doc(db, 'todos', id)),
      );
      await Promise.all(deletePromises);
      setTodos((prev) =>
        prev.filter((todo) => !selectedIds.includes(todo.id!)),
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
          Loading your tasks...
        </Typography>
      </Box>
    );
  }

  return (
    <Box mt={4}>
      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Fade in={true}>
          <Card
            elevation={2}
            sx={{
              mb: 3,
              p: 2,
              background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
              color: 'white',
            }}
          >
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="h6" fontWeight="bold">
                {selectedIds.length} task{selectedIds.length > 1 ? 's' : ''}{' '}
                selected
              </Typography>
              <Button
                variant="contained"
                color="inherit"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={deleting}
                startIcon={
                  deleting ? <CircularProgress size={20} /> : <DeleteIcon />
                }
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                {deleting ? 'Deleting...' : 'Delete Selected'}
              </Button>
            </Box>
          </Card>
        </Fade>
      )}

      {/* Tasks List */}
      {todos.length === 0 ? (
        <Fade in={true} timeout={800}>
          <Card
            elevation={2}
            sx={{
              textAlign: 'center',
              p: 6,
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
              border: '2px dashed',
              borderColor: 'primary.main',
              opacity: 0.8,
            }}
          >
            <Avatar
              sx={{
                width: 80,
                height: 80,
                mx: 'auto',
                mb: 3,
                bgcolor: 'primary.main',
                opacity: 0.8,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography
              variant="h5"
              fontWeight="bold"
              gutterBottom
              color="primary"
            >
              No Active Tasks
            </Typography>
            <Typography variant="body1" color="text.secondary">
              All caught up! Create a new task to get started.
            </Typography>
          </Card>
        </Fade>
      ) : (
        <Stack spacing={2}>
          {todos.map((todo, index) => {
            const selected = selectedIds.includes(todo.id!);
            const dueDate = todo.dueDate as Date | null;
            const statusInfo =
              STATUS_COLORS[todo.status] || STATUS_COLORS['left-over'];
            const priorityInfo =
              PRIORITY_COLORS[todo.priority] || PRIORITY_COLORS['routine'];

            return (
              <Slide
                key={todo.id}
                direction="up"
                in={true}
                timeout={600 + index * 100}
              >
                <Card
                  elevation={selected ? 8 : 2}
                  sx={{
                    transition: 'all 0.3s ease',
                    border: selected
                      ? `2px solid ${muiTheme.palette.primary.main}`
                      : `1px solid ${muiTheme.palette.divider}`,
                    backgroundColor: selected
                      ? muiTheme.palette.mode === 'dark'
                        ? 'rgba(25, 118, 210, 0.1)'
                        : 'rgba(25, 118, 210, 0.05)'
                      : 'inherit',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: muiTheme.shadows[8],
                    },
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Status Indicator Bar */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      backgroundColor: statusInfo.bg,
                    }}
                  />

                  <CardContent sx={{ p: isMobile ? 2 : 3, pt: 3 }}>
                    <Box display="flex" alignItems="flex-start" gap={2}>
                      {/* Selection Checkbox */}
                      <Checkbox
                        checked={selected}
                        onChange={() => toggleSelect(todo.id!)}
                        sx={{
                          mt: -0.5,
                          '&.Mui-checked': {
                            color: muiTheme.palette.primary.main,
                          },
                        }}
                      />

                      {/* Main Content */}
                      <Box flexGrow={1}>
                        {/* Blinking indicator if work started */}
                        {todo.workStarted && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 10,
                              right: 10,
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: 'success.main',
                              boxShadow: '0 0 0 0 rgba(34,197,94, 0.7)',
                              animation: 'pulse 1.2s infinite',
                              '@keyframes pulse': {
                                '0%': {
                                  boxShadow: '0 0 0 0 rgba(34,197,94, 0.7)',
                                },
                                '70%': {
                                  boxShadow: '0 0 0 8px rgba(34,197,94, 0)',
                                },
                                '100%': {
                                  boxShadow: '0 0 0 0 rgba(34,197,94, 0)',
                                },
                              },
                            }}
                          />
                        )}
                        {/* Title */}
                        <Link
                          href={`/to-do/${todo.id}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            sx={{
                              cursor: 'pointer',
                              color: 'inherit',
                              mb: 1,
                              '&:hover': {
                                color: muiTheme.palette.primary.main,
                                textDecoration: 'underline',
                              },
                            }}
                          >
                            {todo.title}
                          </Typography>
                        </Link>

                        {/* Description */}
                        {todo.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2, lineHeight: 1.5 }}
                          >
                            {todo.description}
                          </Typography>
                        )}

                        {/* Progress Bar */}
                        {todo.progressPercent > 0 && (
                          <Box mb={2}>
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                              mb={1}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Progress
                              </Typography>
                              <Typography variant="caption" fontWeight="bold">
                                {todo.progressPercent}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={todo.progressPercent}
                              sx={{
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: muiTheme.palette.grey[200],
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 3,
                                  backgroundColor: statusInfo.bg,
                                },
                              }}
                            />
                          </Box>
                        )}

                        {/* Tags and Info */}
                        <Stack
                          direction="row"
                          spacing={1}
                          flexWrap="wrap"
                          gap={1}
                          alignItems="center"
                        >
                          {/* Status Chip */}
                          <Chip
                            icon={statusInfo.icon}
                            label={todo.status?.replace('_', ' ')}
                            size="small"
                            sx={{
                              backgroundColor: statusInfo.bg,
                              color: statusInfo.text,
                              fontWeight: 600,
                              '& .MuiChip-icon': {
                                color: statusInfo.text,
                              },
                            }}
                          />

                          {/* Priority Chip */}
                          <Chip
                            icon={priorityInfo.icon}
                            label={todo.priority}
                            size="small"
                            variant="outlined"
                            sx={{
                              borderColor: priorityInfo.bg,
                              color: priorityInfo.bg,
                              fontWeight: 600,
                              '& .MuiChip-icon': {
                                color: priorityInfo.bg,
                              },
                            }}
                          />

                          {/* Due Date */}
                          {dueDate && (
                            <Chip
                              icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                              label={`Due: ${moment(dueDate).format('MMM D')}`}
                              size="small"
                              variant="outlined"
                              sx={{
                                ...getDueDateColor(dueDate),
                                fontWeight: 600,
                                '& .MuiChip-icon': {
                                  color: getDueDateColor(dueDate).text,
                                },
                              }}
                            />
                          )}
                          {/* Assignee (overall task) */}
                          {todo.assignee && (
                            <Chip
                              label={todo.assignee}
                              size="small"
                              variant="outlined"
                              avatar={
                                <Avatar
                                  sx={{ width: 20, height: 20, fontSize: 12 }}
                                >
                                  {String(todo.assignee)
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase()}
                                </Avatar>
                              }
                              sx={{ fontWeight: 600 }}
                            />
                          )}
                        </Stack>
                      </Box>

                      {/* Action Buttons */}
                      <Box display="flex" flexDirection="column" gap={1}>
                        <Tooltip
                          title={todo.workStarted ? 'Stop Work' : 'Work Start'}
                        >
                          <IconButton
                            size="small"
                            onClick={() => toggleWorkStarted(todo)}
                          >
                            {todo.workStarted ? (
                              <PauseIcon fontSize="small" />
                            ) : (
                              <PlayArrowIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Task">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedIds([todo.id!]);
                              setDeleteDialogOpen(true);
                            }}
                            sx={{
                              color: muiTheme.palette.error.main,
                              '&:hover': {
                                backgroundColor: muiTheme.palette.error.light,
                                color: 'white',
                              },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Slide>
            );
          })}
        </Stack>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <DeleteIcon color="error" />
            Confirm Delete
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body1">
            Are you sure you want to delete {selectedIds.length} task
            {selectedIds.length > 1 ? 's' : ''}? This action cannot be undone.
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            All progress and data associated with these tasks will be
            permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteSelected}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting && <CircularProgress size={18} />}
          >
            {deleting ? 'Deleting...' : 'Delete Tasks'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
