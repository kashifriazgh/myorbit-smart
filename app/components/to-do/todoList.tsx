'use client';
import {
  Box,
  CircularProgress,
  Typography,
  FormControl,
  InputLabel,
  Select,
  Stack,
  Chip,
  Divider,
  Collapse,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { Todo } from '@/app/lib/interface';
import moment from 'moment-timezone';

export default function TodosList() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filter, setFilter] = useState({
    priority: 'all',
    status: 'all',
    scope: 'all',
  });

  const fetchTodos = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'todos'));
      const now = moment().tz('Asia/Karachi');
      const startDate = now.clone().subtract(30, 'days').startOf('day');
      const endDate = now.clone().endOf('day');

      const data: Todo[] = snap.docs
        .map((doc) => {
          const d = doc.data() as Todo;
          return {
            ...d,
            id: doc.id,
          };
        })
        .filter((todo) => {
          const isOwn = todo.authorId === user.uid;
          const isShared =
            Array.isArray(todo.sharedWith) &&
            todo.sharedWith.includes(user.uid);
          const scopeMatch =
            filter.scope === 'all' ||
            (filter.scope === 'own' && isOwn) ||
            (filter.scope === 'shared' && isShared);

          const priorityMatch =
            filter.priority === 'all' || todo.priority === filter.priority;
          const statusMatch =
            filter.status === 'all' || todo.status === filter.status;

          const createdAt = todo.createdAt as unknown as Timestamp;
          const createdMoment = createdAt?.seconds
            ? moment.unix(createdAt.seconds).tz('Asia/Karachi')
            : null;

          const dateMatch = createdMoment
            ? createdMoment.isBetween(startDate, endDate, null, '[]')
            : false;

          return scopeMatch && priorityMatch && statusMatch && dateMatch;
        });

      const sorted = data.sort((a, b) => {
        const t1 =
          a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : (a.createdAt as Timestamp)?.toMillis?.() || 0;

        const t2 =
          b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : (b.createdAt as Timestamp)?.toMillis?.() || 0;

        return t2 - t1;
      });

      setTodos(sorted);
    } catch (error) {
      console.error('❌ Failed to fetch todos:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTodos();
  }, [user, filter]);

  if (!theme) return null;

  return (
    <Box mt={4}>
      {/* Filters */}
      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
        <FormControl size="small">
          <InputLabel>Priority</InputLabel>
          <Select
            native
            value={filter.priority}
            onChange={(e) =>
              setFilter((f) => ({ ...f, priority: e.target.value }))
            }
          >
            <option value="all">All</option>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="critical">Critical</option>
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Status</InputLabel>
          <Select
            native
            value={filter.status}
            onChange={(e) =>
              setFilter((f) => ({ ...f, status: e.target.value }))
            }
          >
            <option value="all">All</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="hold">Hold</option>
            <option value="left-over">Left Over</option>
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Scope</InputLabel>
          <Select
            native
            value={filter.scope}
            onChange={(e) =>
              setFilter((f) => ({ ...f, scope: e.target.value }))
            }
          >
            <option value="all">All</option>
            <option value="own">Own</option>
            <option value="shared">Shared</option>
          </Select>
        </FormControl>
      </Stack>

      {/* Loader / No Data / List */}
      {loading ? (
        <Box display="flex" justifyContent="center" mt={6}>
          <CircularProgress />
        </Box>
      ) : todos.length === 0 ? (
        <Typography>No tasks found.</Typography>
      ) : (
        todos.map((todo) => {
          const isExpanded = expandedId === todo.id;
          return (
            <Box
              key={todo.id}
              p={2}
              mb={2}
              onClick={() =>
                setExpandedId((prev) => (prev === todo.id ? null : todo.id))
              }
              sx={{
                border: `1px solid ${
                  theme.mode === 'dark' ? '#475569' : '#d0d0d0'
                }`,
                borderRadius: 2,
                bgcolor: theme.mode === 'dark' ? '#1e293b' : '#fff',
                boxShadow:
                  theme.mode === 'dark'
                    ? '0 1px 4px rgba(0,0,0,0.2)'
                    : '0 1px 4px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                color: theme.mode === 'dark' ? '#f1f5f9' : 'inherit',
              }}
            >
              <Typography fontWeight="bold">{todo.title}</Typography>
              <Box mt={1} display="flex" gap={1} flexWrap="wrap">
                <Chip size="small" label={`Priority: ${todo.priority}`} />
                <Chip size="small" label={`Status: ${todo.status}`} />
              </Box>

              <Collapse in={isExpanded}>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="body2" gutterBottom>
                  Progress: {todo.progressPercent}%
                </Typography>

                {todo.steps && todo.steps.length > 0 && (
                  <Box>
                    <Typography fontWeight={600} mb={0.5}>
                      Sub Tasks:
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {todo.steps.map((s, i) => (
                        <li key={i}>
                          {s.text} – {s.status}
                        </li>
                      ))}
                    </ul>
                  </Box>
                )}

                {todo.notes && (
                  <Box mt={1}>
                    <Typography fontWeight={600}>Notes:</Typography>
                    <Typography variant="body2">{todo.notes}</Typography>
                  </Box>
                )}
              </Collapse>
            </Box>
          );
        })
      )}
    </Box>
  );
}
