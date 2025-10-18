'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Fab,
} from '@mui/material';
import { Search, Add, FilterList } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoals, GoalsProvider } from '../lib/context/GoalsContext';
import { useAuth } from '../lib/context/userContext';
import { useCustomTheme } from '../lib/context/themeContext';
import { GoalType, GoalPriority, GoalStatus } from '../lib/interface';
import GoalModal from '../components/goals/GoalModal';
import GoalSimpleCard from '../components/goals/GoalSimpleCard';
import { useRouter } from 'next/navigation';
import moment from 'moment';

/* ---------- TYPES & UTILITIES ---------- */

type FirestoreLikeDate =
  | Date
  | string
  | { seconds: number; nanoseconds: number }
  | { toDate: () => Date };

const getDueDate = (rawDate: FirestoreLikeDate | undefined): Date | null => {
  if (!rawDate) return null;

  if (rawDate instanceof Date) return rawDate;

  if (typeof rawDate === 'string') {
    const parsed = new Date(rawDate);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Safely check for Firestore Timestamp-like object
  if (
    typeof rawDate === 'object' &&
    rawDate !== null &&
    'toDate' in rawDate &&
    typeof (rawDate as { toDate: unknown }).toDate === 'function'
  ) {
    return (rawDate as { toDate: () => Date }).toDate();
  }

  // Handle Firestore timestamp literal
  if (
    typeof rawDate === 'object' &&
    rawDate !== null &&
    'seconds' in rawDate &&
    'nanoseconds' in rawDate
  ) {
    const { seconds, nanoseconds } = rawDate as {
      seconds: number;
      nanoseconds: number;
    };
    return new Date(seconds * 1000 + nanoseconds / 1_000_000);
  }

  return null;
};

/* ---------- MAIN COMPONENT ---------- */

const GoalsPageInner: React.FC = () => {
  const { goals, loading } = useGoals();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<GoalType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<GoalStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<GoalPriority | 'all'>(
    'all'
  );
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleViewGoal = (goalId: string) => {
    router.push(`/goals/${goalId}`);
  };

  const filteredGoals = goals.filter((goal) => {
    const matchesSearch =
      goal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      goal.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || goal.type === filterType;
    const matchesStatus =
      filterStatus === 'all' || goal.status === filterStatus;
    const matchesPriority =
      filterPriority === 'all' || goal.priority === filterPriority;

    return matchesSearch && matchesType && matchesStatus && matchesPriority;
  });

  const goalTypes: { value: GoalType | 'all'; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'finance', label: 'Finance' },
    { value: 'health', label: 'Health' },
    { value: 'learning', label: 'Learning' },
    { value: 'habit', label: 'Habit' },
    { value: 'custom', label: 'Custom' },
  ];

  const statusOptions: { value: GoalStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'Not Started', label: 'Not Started' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'On Track', label: 'On Track' },
    { value: 'At Risk', label: 'At Risk' },
    { value: 'Off Track', label: 'Off Track' },
    { value: 'Completed', label: 'Completed' },
  ];

  const priorityOptions: { value: GoalPriority | 'all'; label: string }[] = [
    { value: 'all', label: 'All Priority' },
    { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' },
  ];

  if (loading) {
    return (
      <Box
        sx={{
          backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#f8fafc',
          minHeight: '100vh',
          p: 3,
        }}
      >
        <Box className="max-w-7xl mx-auto">
          <Typography variant="h4" className="font-bold mb-6">
            Loading goals...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#f8fafc',
        minHeight: '100vh',
        p: 3,
      }}
    >
      <Box className="max-w-7xl mx-auto">
        {/* Header */}
        <Box className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <Box>
            <Typography
              variant="h4"
              className="font-bold mb-2"
              sx={{
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
              }}
            >
              My Goals
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
              }}
            >
              Track your progress and achieve your dreams
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateModalOpen(true)}
            sx={{
              backgroundColor: '#3B82F6',
              '&:hover': { backgroundColor: '#2563eb' },
            }}
          >
            Create Goal
          </Button>
        </Box>

        {/* Filters */}
        <Card
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            borderRadius: '1rem',
            mb: 4,
          }}
        >
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-4">
                <TextField
                  fullWidth
                  placeholder="Search goals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                  size="small"
                />
              </div>

              <div className="md:col-span-3">
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={filterType}
                    onChange={(e) =>
                      setFilterType(e.target.value as GoalType | 'all')
                    }
                    label="Type"
                  >
                    {goalTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              <div className="md:col-span-3">
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) =>
                      setFilterStatus(e.target.value as GoalStatus | 'all')
                    }
                    label="Status"
                  >
                    {statusOptions.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              <div className="md:col-span-2">
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filterPriority}
                    onChange={(e) =>
                      setFilterPriority(e.target.value as GoalPriority | 'all')
                    }
                    label="Priority"
                  >
                    {priorityOptions.map((priority) => (
                      <MenuItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>

              <div className="md:col-span-0.5">
                <IconButton>
                  <FilterList />
                </IconButton>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Goals Grid */}
        {filteredGoals.length === 0 ? (
          <Card
            sx={{
              backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
              borderRadius: '1rem',
            }}
          >
            <CardContent className="p-8 text-center">
              <Typography
                variant="h6"
                className="font-semibold mb-2"
                sx={{
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
                }}
              >
                {goals.length === 0
                  ? 'No goals yet'
                  : 'No goals match your filters'}
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  mb: 4,
                }}
              >
                {goals.length === 0
                  ? 'Create your first goal to start tracking your progress!'
                  : 'Try adjusting your search or filter criteria.'}
              </Typography>
              {goals.length === 0 && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setCreateModalOpen(true)}
                  sx={{
                    backgroundColor: '#3B82F6',
                    '&:hover': { backgroundColor: '#2563eb' },
                  }}
                >
                  Create Your First Goal
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {filteredGoals.map((goal, index) => (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <GoalSimpleCard
                    goal={goal}
                    index={index}
                    onClick={() => handleViewGoal(goal.id!)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Stats */}
        {goals.length > 0 && (
          <Box className="mt-8">
            <Typography
              variant="h6"
              className="font-semibold mb-4"
              sx={{
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
              }}
            >
              Goal Statistics
            </Typography>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  <Typography
                    variant="h4"
                    className="font-bold"
                    sx={{ color: '#3B82F6' }}
                  >
                    {goals.length}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                    }}
                  >
                    Total Goals
                  </Typography>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  <Typography
                    variant="h4"
                    className="font-bold"
                    sx={{ color: '#10B981' }}
                  >
                    {goals.filter((g) => g.status === 'Completed').length}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                    }}
                  >
                    Completed
                  </Typography>
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  <Typography
                    variant="h4"
                    className="font-bold"
                    sx={{ color: '#F59E0B' }}
                  >
                    {goals.filter((g) => g.status === 'In Progress').length}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                    }}
                  >
                    In Progress
                  </Typography>
                </CardContent>
              </Card>

              {/* ✅ Overdue (moment-based + type-safe) */}
              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  <Typography
                    variant="h4"
                    className="font-bold"
                    sx={{ color: '#EF4444' }}
                  >
                    {
                      goals.filter((g) => {
                        const due = getDueDate(g.dueDate);
                        if (!due) return false;
                        const now = moment();
                        const diffDays = moment(due).diff(now, 'days');
                        return diffDays < 0 && g.status !== 'Completed';
                      }).length
                    }
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                    }}
                  >
                    Overdue
                  </Typography>
                </CardContent>
              </Card>
            </div>
          </Box>
        )}
      </Box>

      {/* Create Goal Modal */}
      {user && (
        <GoalsProvider userId={user.uid}>
          <GoalModal
            open={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
          />
        </GoalsProvider>
      )}

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add goal"
        onClick={() => setCreateModalOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          backgroundColor: '#3B82F6',
          '&:hover': { backgroundColor: '#2563eb' },
        }}
      >
        <Add />
      </Fab>
    </Box>
  );
};

/* ---------- WRAPPER ---------- */
const GoalsPage: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <GoalsProvider userId={user.uid}>
      <GoalsPageInner />
    </GoalsProvider>
  );
};

export default GoalsPage;
