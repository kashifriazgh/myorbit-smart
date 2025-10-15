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
  Chip,
  IconButton,
  Fab,
} from '@mui/material';
import {
  Search,
  Add,
  FilterList,
  TrendingUp,
  FitnessCenter,
  School,
  Psychology,
  Category,
  Visibility,
  MoreVert,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoals, GoalsProvider } from '../lib/context/GoalsContext';
import { useAuth } from '../lib/context/userContext';
import { useCustomTheme } from '../lib/context/themeContext';
import { Goal, GoalType, GoalPriority, GoalStatus } from '../lib/interface';
import GoalModal from '../components/goals/GoalModal';
import { useRouter } from 'next/navigation';

const getGoalTypeIcon = (type: GoalType) => {
  switch (type) {
    case 'finance':
      return <TrendingUp />;
    case 'health':
      return <FitnessCenter />;
    case 'learning':
      return <School />;
    case 'habit':
      return <Psychology />;
    default:
      return <Category />;
  }
};

const getGoalTypeColor = (type: GoalType) => {
  switch (type) {
    case 'finance':
      return '#10B981';
    case 'health':
      return '#F59E0B';
    case 'learning':
      return '#3B82F6';
    case 'habit':
      return '#8B5CF6';
    default:
      return '#6B7280';
  }
};

const getPriorityColor = (priority: GoalPriority) => {
  switch (priority) {
    case 'High':
      return '#EF4444';
    case 'Medium':
      return '#F59E0B';
    case 'Low':
      return '#10B981';
    default:
      return '#6B7280';
  }
};

const getStatusColor = (status: GoalStatus) => {
  switch (status) {
    case 'On Track':
      return '#10B981';
    case 'At Risk':
      return '#F59E0B';
    case 'Off Track':
      return '#EF4444';
    case 'Completed':
      return '#3B82F6';
    default:
      return '#6B7280';
  }
};

const getDaysLeft = (dueDate) => {
  const now = new Date();
  if (!dueDate) return 0;

  let due: Date;
  if (typeof dueDate?.toDate === 'function') {
    // Firestore Timestamp
    due = dueDate.toDate();
  } else if (dueDate?.seconds && dueDate?.nanoseconds !== undefined) {
    // Firestore Timestamp object with seconds/nanoseconds
    due = new Date(dueDate.seconds * 1000 + dueDate.nanoseconds / 1000000);
  } else {
    // Regular Date or other format
    due = new Date(dueDate);
  }

  if (isNaN(due.getTime())) return 0;
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

interface GoalCardProps {
  goal: Goal;
  onView: (goalId: string) => void;
}

const GoalCard: React.FC<GoalCardProps> = ({ goal, onView }) => {
  const { theme } = useCustomTheme();
  const daysLeft = getDaysLeft(goal.dueDate);
  const isOverdue = daysLeft < 0;
  const typeColor = getGoalTypeColor(goal.type);
  const priorityColor = getPriorityColor(goal.priority);
  const statusColor = getStatusColor(goal.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
    >
      <Card
        className="relative overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer h-full"
        sx={{
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          border: `2px solid ${typeColor}20`,
          '&:hover': {
            border: `2px solid ${typeColor}40`,
            transform: 'translateY(-4px)',
          },
        }}
        onClick={() => onView(goal.id!)}
      >
        {/* Priority Color Bar */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            backgroundColor: priorityColor,
          }}
        />

        <CardContent className="p-6 h-full flex flex-col">
          {/* Header */}
          <Box className="flex items-start justify-between mb-4">
            <Box className="flex items-center gap-3">
              <Box
                sx={{
                  color: typeColor,
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: `${typeColor}20`,
                  borderRadius: '50%',
                  p: 1,
                }}
              >
                {getGoalTypeIcon(goal.type)}
              </Box>
              <Box>
                <Chip
                  label={goal.type}
                  size="small"
                  sx={{
                    backgroundColor: `${typeColor}20`,
                    color: typeColor,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                />
                <Chip
                  label={goal.priority}
                  size="small"
                  sx={{
                    backgroundColor: `${priorityColor}20`,
                    color: priorityColor,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    ml: 1,
                  }}
                />
              </Box>
            </Box>
            <IconButton size="small" sx={{ color: '#6B7280' }}>
              <MoreVert />
            </IconButton>
          </Box>

          {/* Title */}
          <Typography
            variant="h6"
            className="font-semibold mb-3 text-gray-800 flex-1"
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
              fontSize: '1.1rem',
              lineHeight: 1.4,
              minHeight: '2.8rem',
            }}
          >
            {goal.title}
          </Typography>

          {/* Description */}
          {goal.description && (
            <Typography
              variant="body2"
              className="mb-4 text-gray-600"
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {goal.description}
            </Typography>
          )}

          {/* Progress Section */}
          <Box className="mb-4">
            <Box className="flex justify-between items-center mb-2">
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                Progress
              </Typography>
              <Typography
                variant="body2"
                className="font-bold"
                sx={{
                  color: typeColor,
                  fontSize: '0.875rem',
                }}
              >
                {goal.progress}%
              </Typography>
            </Box>
            <Box
              sx={{
                width: '100%',
                height: '8px',
                backgroundColor: theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${goal.progress}%` }}
                transition={{ duration: 1, delay: 0.2 }}
                style={{
                  height: '100%',
                  backgroundColor: typeColor,
                  borderRadius: '4px',
                }}
              />
            </Box>
          </Box>

          {/* Status and Days Left */}
          <Box className="flex justify-between items-center mb-4">
            <Chip
              label={goal.status}
              size="small"
              sx={{
                backgroundColor: `${statusColor}20`,
                color: statusColor,
                fontSize: '0.7rem',
                height: '24px',
                fontWeight: 600,
              }}
            />
            <Typography
              variant="body2"
              sx={{
                color: isOverdue
                  ? '#EF4444'
                  : theme?.mode === 'dark'
                  ? '#94a3b8'
                  : '#6b7280',
                fontSize: '0.75rem',
                fontWeight: isOverdue ? 600 : 400,
              }}
            >
              {isOverdue
                ? `${Math.abs(daysLeft)} days overdue`
                : `${daysLeft} days left`}
            </Typography>
          </Box>

          {/* Steps Count */}
          <Box className="flex justify-between items-center mb-4">
            <Typography
              variant="body2"
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                fontSize: '0.75rem',
              }}
            >
              {goal.steps.filter((s) => s.completed).length} of{' '}
              {goal.steps.length} steps completed
            </Typography>
            {goal.timeline && (
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  fontSize: '0.75rem',
                }}
              >
                {goal.timeline}
              </Typography>
            )}
          </Box>

          {/* View Button */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<Visibility />}
            fullWidth
            sx={{
              borderColor: typeColor,
              color: typeColor,
              fontSize: '0.75rem',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: `${typeColor}10`,
                borderColor: typeColor,
              },
            }}
          >
            View Details
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

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
              '&:hover': {
                backgroundColor: '#2563eb',
              },
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
                    '&:hover': {
                      backgroundColor: '#2563eb',
                    },
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
                  <GoalCard goal={goal} onView={handleViewGoal} />
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

              <Card className="rounded-xl">
                <CardContent className="p-4 text-center">
                  <Typography
                    variant="h4"
                    className="font-bold"
                    sx={{ color: '#EF4444' }}
                  >
                    {
                      goals.filter((g) => {
                        const daysLeft = getDaysLeft(g.dueDate);
                        return daysLeft < 0 && g.status !== 'Completed';
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
          '&:hover': {
            backgroundColor: '#2563eb',
          },
        }}
      >
        <Add />
      </Fab>
    </Box>
  );
};

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
