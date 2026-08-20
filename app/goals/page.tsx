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
  Fab,
  Divider,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import Add from '@mui/icons-material/Add';
import FilterList from '@mui/icons-material/FilterList';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoals } from '../lib/context/GoalsContext';
import { useAuth } from '../lib/context/userContext';
import { useCustomTheme } from '../lib/context/themeContext';
import { GoalType, GoalPriority, GoalStatus } from '../lib/interface';
import GoalModal from '../components/goals/GoalModal';
import GoalSimpleCard from '../components/goals/GoalSimpleCard';
import { useRouter } from 'next/navigation';
import moment from 'moment';

/* ---------- DATE UTILS ---------- */

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
  if (
    typeof rawDate === 'object' &&
    rawDate !== null &&
    'toDate' in rawDate &&
    typeof (rawDate as { toDate: unknown }).toDate === 'function'
  ) {
    return (rawDate as { toDate: () => Date }).toDate();
  }
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

/* ---------- MAIN PAGE ---------- */

const GoalsPageInner: React.FC = () => {
  const { goals, loading } = useGoals();
  const { user, loading: authLoading } = useAuth();
  const { theme } = useCustomTheme();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<GoalType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<GoalStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<GoalPriority | 'all'>(
    'all',
  );
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false); // ✅ collapsed by default

  const handleViewGoal = (goalId: string) => {
    router.push(`/goals/${goalId}`);
  };

  const userGoals = React.useMemo(() => {
    if (!user?.uid) return [];
    return goals.filter((g) => g.userId === user.uid);
  }, [goals, user?.uid]);

  const filteredGoals = userGoals.filter((goal) => {
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

  const overdueCount = userGoals.filter((g) => {
    const due = getDueDate(g.dueDate);
    if (!due) return false;
    return moment(due).isBefore(moment()) && g.status !== 'Completed';
  }).length;

  if (loading || authLoading) return null;

  return (
    <Box
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#f8fafc',
        minHeight: '100vh',
        p: 3,
      }}
    >
      <Box className="max-w-7xl mx-auto">
        {/* HEADER */}
        <Box className="flex justify-between items-center mb-6">
          <Box>
            <Typography
              variant="h4"
              className="font-bold"
              sx={{ color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a' }}
            >
              🎯 My Goals
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280' }}
            >
              Track progress with clarity
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateModalOpen(true)}
            sx={{
              backgroundColor: '#3B82F6',
              '&:hover': { backgroundColor: '#2563eb' },
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Create Goal
          </Button>
        </Box>

        {/* STATS + FILTER BAR */}
        <Card
          sx={{
            mb: 4,
            borderRadius: '0.75rem',
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
          }}
        >
          <CardContent className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              {/* STATS (COMPACT ONE LINE) */}
              <div className="flex justify-between text-sm">
                <span>
                  Total: <b>{userGoals.length}</b>
                </span>
                <span>
                  Completed:{' '}
                  <b>{userGoals.filter((g) => g.status === 'Completed').length}</b>
                </span>
                <span>
                  In Progress:{' '}
                  <b>
                    {userGoals.filter((g) => g.status === 'In Progress').length}
                  </b>
                </span>
                <span className="text-red-500">
                  Overdue: <b>{overdueCount}</b>
                </span>
              </div>

              {/* FILTER TOGGLE */}
              <div className="flex justify-end">
                <Button
                  size="small"
                  startIcon={<FilterList />}
                  onClick={() => setFiltersOpen((v) => !v)}
                  sx={{ textTransform: 'none' }}
                >
                  Filters
                </Button>
              </div>
            </div>
          </CardContent>

          {/* COLLAPSIBLE FILTERS */}
          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Divider />
                <CardContent className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <TextField
                      size="small"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <FormControl size="small">
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={filterType}
                        label="Type"
                        onChange={(e) => setFilterType(e.target.value)}
                      >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="finance">Finance</MenuItem>
                        <MenuItem value="health">Health</MenuItem>
                        <MenuItem value="learning">Learning</MenuItem>
                        <MenuItem value="habit">Habit</MenuItem>
                        <MenuItem value="work">Work</MenuItem>
                        <MenuItem value="lifestyle">Lifestyle</MenuItem>
                        <MenuItem value="custom">Custom</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={filterStatus}
                        label="Status"
                        onChange={(e) => setFilterStatus(e.target.value)}
                      >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="Not Started">Not Started</MenuItem>
                        <MenuItem value="In Progress">In Progress</MenuItem>
                        <MenuItem value="Completed">Completed</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl size="small">
                      <InputLabel>Priority</InputLabel>
                      <Select
                        value={filterPriority}
                        label="Priority"
                        onChange={(e) => setFilterPriority(e.target.value)}
                      >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="Low">Low</MenuItem>
                        <MenuItem value="Medium">Medium</MenuItem>
                        <MenuItem value="High">High</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* GOALS GRID */}
        {userGoals.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              px: 3,
              borderRadius: '1rem',
              backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
              border: `1px dashed ${theme?.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
              textAlign: 'center',
              mt: 4,
            }}
          >
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                mb: 1,
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
              }}
            >
              No goals available
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
                mb: 3,
                maxWidth: '400px',
              }}
            >
              Start tracking your progress by defining your first goal. Click the button below to get started!
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateModalOpen(true)}
              sx={{
                backgroundColor: '#3B82F6',
                '&:hover': { backgroundColor: '#2563eb' },
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '0.5rem',
              }}
            >
              Create Goal
            </Button>
          </Box>
        ) : filteredGoals.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
              px: 3,
              borderRadius: '1rem',
              backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
              border: `1px dashed ${theme?.mode === 'dark' ? '#334155' : '#cbd5e1'}`,
              textAlign: 'center',
              mt: 2,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                mb: 1,
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
              }}
            >
              No matching goals found
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
              }}
            >
              Try adjusting your search terms or filters to find what you&apos;re looking for.
            </Typography>
          </Box>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredGoals.map((goal, index) => (
              <GoalSimpleCard
                key={goal.id}
                goal={goal}
                index={index}
                onClick={() => handleViewGoal(goal.id!)}
              />
            ))}
          </div>
        )}
      </Box>

      {/* MODAL */}
      <GoalModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      {/* FAB */}
      <Fab
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

export default GoalsPageInner;
