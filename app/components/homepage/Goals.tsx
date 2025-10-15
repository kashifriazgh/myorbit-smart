'use client';

import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress,
  IconButton,
} from '@mui/material';
import { useGoals } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { Goal, GoalType } from '../../lib/interface';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  FitnessCenter,
  School,
  Psychology,
  Category,
  Visibility,
  Add,
  MoreVert,
} from '@mui/icons-material';
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
      return '#10B981'; // green
    case 'health':
      return '#F59E0B'; // amber
    case 'learning':
      return '#3B82F6'; // blue
    case 'habit':
      return '#8B5CF6'; // purple
    default:
      return '#6B7280'; // gray
  }
};

const getPriorityColor = (priority: Goal['priority']) => {
  switch (priority) {
    case 'High':
      return '#EF4444'; // red
    case 'Medium':
      return '#F59E0B'; // amber
    case 'Low':
      return '#10B981'; // green
    default:
      return '#6B7280'; // gray
  }
};

const getStatusColor = (status: Goal['status']) => {
  switch (status) {
    case 'On Track':
      return '#10B981'; // green
    case 'At Risk':
      return '#F59E0B'; // amber
    case 'Off Track':
      return '#EF4444'; // red
    case 'Completed':
      return '#3B82F6'; // blue
    default:
      return '#6B7280'; // gray
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

const getMotivationalMessage = (progress: number) => {
  if (progress >= 80) return "You've already done 80%! Don't stop now 💪";
  if (progress >= 60) return "You're more than halfway there! Keep going 🚀";
  if (progress >= 40) return "Great progress! You're building momentum ⚡";
  if (progress >= 20) return "Every step counts! You're on the right track 🌟";
  return "Every journey begins with a single step. You've got this! 🌱";
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
      whileHover={{ y: -2 }}
    >
      <Card
        className="relative overflow-hidden rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
        sx={{
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          border: `2px solid ${typeColor}20`,
          '&:hover': {
            border: `2px solid ${typeColor}40`,
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

        <CardContent className="p-4">
          {/* Header */}
          <Box className="flex items-start justify-between mb-3">
            <Box className="flex items-center gap-2">
              <Box
                sx={{
                  color: typeColor,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {getGoalTypeIcon(goal.type)}
              </Box>
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
            </Box>
            <IconButton size="small" sx={{ color: '#6B7280' }}>
              <MoreVert />
            </IconButton>
          </Box>

          {/* Title */}
          <Typography
            variant="h6"
            className="font-semibold mb-2 text-gray-800"
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
              fontSize: '1rem',
              lineHeight: 1.4,
            }}
          >
            {goal.title}
          </Typography>

          {/* Progress Section */}
          <Box className="mb-3">
            <Box className="flex justify-between items-center mb-1">
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  fontSize: '0.75rem',
                }}
              >
                Progress
              </Typography>
              <Typography
                variant="body2"
                className="font-semibold"
                sx={{
                  color: typeColor,
                  fontSize: '0.75rem',
                }}
              >
                {goal.progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={goal.progress}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: typeColor,
                  borderRadius: 3,
                },
              }}
            />
          </Box>

          {/* Days Left/Overdue */}
          <Box className="flex justify-between items-center mb-3">
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
            <Chip
              label={goal.status}
              size="small"
              sx={{
                backgroundColor: `${statusColor}20`,
                color: statusColor,
                fontSize: '0.7rem',
                height: '20px',
              }}
            />
          </Box>

          {/* Motivational Message */}
          {goal.progress > 0 && (
            <Typography
              variant="body2"
              className="text-center italic mb-3"
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                fontSize: '0.7rem',
                lineHeight: 1.3,
              }}
            >
              {getMotivationalMessage(goal.progress)}
            </Typography>
          )}

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

const Goals: React.FC = () => {
  const { goals, loading } = useGoals();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const router = useRouter();

  const handleViewGoal = (goalId: string) => {
    router.push(`/goals/${goalId}`);
  };

  const handleCreateGoal = () => {
    router.push('/goals/create');
  };

  if (loading) {
    return (
      <Card
        sx={{
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          borderRadius: '1rem',
          p: 3,
        }}
      >
        <Typography variant="h6" className="font-semibold mb-4">
          Goals
        </Typography>
        <Box className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Box
              key={i}
              sx={{
                height: '200px',
                backgroundColor: theme?.mode === 'dark' ? '#374151' : '#f3f4f6',
                borderRadius: '1rem',
                animation: 'pulse 2s infinite',
              }}
            />
          ))}
        </Box>
      </Card>
    );
  }

  // Filter by logged-in user, status In Progress, sort by priority High > Medium > Low, then take first 4
  const priorityRank: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  const userGoals = goals.filter((g) => g.userId === user?.uid);
  const displayGoals = userGoals
    .filter((g) => g.status === 'In Progress' || g.status === 'Not Started')
    .sort(
      (a, b) =>
        (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
    )
    .slice(0, 4);

  return (
    <Card
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        borderRadius: '1rem',
        p: 3,
      }}
    >
      <Box className="flex justify-between items-center mb-4">
        <Typography
          variant="h6"
          className="font-semibold"
          sx={{
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
          }}
        >
          Goals
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Add />}
          onClick={handleCreateGoal}
          sx={{
            borderColor: '#3B82F6',
            color: '#3B82F6',
            fontSize: '0.75rem',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: '#3B82F610',
              borderColor: '#3B82F6',
            },
          }}
        >
          Add Goal
        </Button>
      </Box>

      {displayGoals.length === 0 ? (
        <Box className="text-center py-8">
          <Typography
            variant="body1"
            sx={{
              color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
              mb: 2,
            }}
          >
            No goals yet. Create your first goal to get started!
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateGoal}
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
      ) : (
        <Box className="grid grid-cols-2 gap-4">
          {displayGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onView={handleViewGoal} />
          ))}
        </Box>
      )}

      {goals.length > 4 && (
        <Box className="text-center mt-4">
          <Button
            variant="text"
            size="small"
            onClick={() => router.push('/goals')}
            sx={{
              color: '#3B82F6',
              fontSize: '0.75rem',
              textTransform: 'none',
            }}
          >
            View All Goals ({goals.length})
          </Button>
        </Box>
      )}
    </Card>
  );
};

export default Goals;
