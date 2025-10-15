'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Avatar,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  TrendingUp,
  FitnessCenter,
  School,
  Psychology,
  Category,
  CheckCircle,
  RadioButtonUnchecked,
  Schedule,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoals, GoalsProvider } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { Goal, GoalType } from '../../lib/interface';
import GoalModal from '../../components/goals/GoalModal';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`goal-tabpanel-${index}`}
      aria-labelledby={`goal-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

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

const getPriorityColor = (priority: Goal['priority']) => {
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

const getStatusColor = (status: Goal['status']) => {
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

const formatDateSafe = (d) => {
  if (!d) return '';

  let date: Date;
  if (typeof d?.toDate === 'function') {
    // Firestore Timestamp
    date = d.toDate();
  } else if (d?.seconds && d?.nanoseconds !== undefined) {
    // Firestore Timestamp object with seconds/nanoseconds
    date = new Date(d.seconds * 1000 + d.nanoseconds / 1000000);
  } else {
    // Regular Date or other format
    date = new Date(d);
  }

  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString();
};

const formatStepDate = (date) => {
  if (!date) return '';

  let d: Date;
  if (typeof date?.toDate === 'function') {
    // Firestore Timestamp
    d = date.toDate();
  } else if (date?.seconds && date?.nanoseconds !== undefined) {
    // Firestore Timestamp object with seconds/nanoseconds
    d = new Date(date.seconds * 1000 + date.nanoseconds / 1000000);
  } else if (date instanceof Date) {
    d = date;
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleDateString();
};

const GoalDetailInner: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { goals, updateStepStatus, deleteGoal } = useGoals();
  const { user } = useAuth();
  const { theme } = useCustomTheme();

  const [tabValue, setTabValue] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const goal = goals.find((g) => g.id === params.id);

  // Move all useMemo hooks before early return to maintain hook order
  const typeColor = useMemo(
    () => (goal ? getGoalTypeColor(goal.type) : '#6B7280'),
    [goal?.type]
  );
  const priorityColor = useMemo(
    () => (goal ? getPriorityColor(goal.priority) : '#6B7280'),
    [goal?.priority]
  );
  const statusColor = useMemo(
    () => (goal ? getStatusColor(goal.status) : '#6B7280'),
    [goal?.status]
  );
  const daysLeft = useMemo(
    () => (goal ? getDaysLeft(goal.dueDate) : 0),
    [goal?.dueDate]
  );
  const isOverdue = daysLeft < 0;

  useEffect(() => {
    if (!goal && goals.length > 0) {
      router.push('/goals');
    }
  }, [goal, goals, router]);

  if (!goal) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{
          backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#f8fafc',
        }}
      >
        <Typography variant="h6">Goal not found</Typography>
      </Box>
    );
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleStepToggle = async (stepId: string, completed: boolean) => {
    try {
      await updateStepStatus(goal.id!, stepId, completed);
    } catch (error) {
      console.error('Error updating step:', error);
    }
  };

  const handleDeleteGoal = async () => {
    setLoading(true);
    try {
      await deleteGoal(goal.id!);
      router.push('/goals');
    } catch (error) {
      console.error('Error deleting goal:', error);
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const OverviewTab = () => (
    <Box className="space-y-6">
      {/* Goal Header */}
      <Card
        sx={{
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          borderRadius: '1rem',
        }}
      >
        <CardContent className="p-6">
          <Box className="flex items-start justify-between mb-4">
            <Box className="flex items-center gap-3">
              <Avatar
                sx={{
                  backgroundColor: `${typeColor}20`,
                  color: typeColor,
                  width: 48,
                  height: 48,
                }}
              >
                {getGoalTypeIcon(goal.type)}
              </Avatar>
              <Box>
                <Typography
                  variant="h5"
                  className="font-bold"
                  sx={{
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
                  }}
                >
                  {goal.title}
                </Typography>
                <Box className="flex items-center gap-2 mt-1">
                  <Chip
                    label={goal.type}
                    size="small"
                    sx={{
                      backgroundColor: `${typeColor}20`,
                      color: typeColor,
                      fontWeight: 600,
                    }}
                  />
                  <Chip
                    label={goal.priority}
                    size="small"
                    sx={{
                      backgroundColor: `${priorityColor}20`,
                      color: priorityColor,
                      fontWeight: 600,
                    }}
                  />
                </Box>
              </Box>
            </Box>

            <Box className="flex gap-2">
              <IconButton
                onClick={() => setEditModalOpen(true)}
                sx={{ color: '#3B82F6' }}
              >
                <Edit />
              </IconButton>
              <IconButton
                onClick={() => setDeleteDialogOpen(true)}
                sx={{ color: '#EF4444' }}
              >
                <Delete />
              </IconButton>
            </Box>
          </Box>

          {goal.description && (
            <Typography
              variant="body1"
              className="mb-4"
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                lineHeight: 1.6,
              }}
            >
              {goal.description}
            </Typography>
          )}

          {/* Progress Section */}
          <Box className="mb-4">
            <Box className="flex justify-between items-center mb-2">
              <Typography
                variant="h6"
                className="font-semibold"
                sx={{
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
                }}
              >
                Progress
              </Typography>
              <Typography
                variant="h6"
                className="font-bold"
                sx={{ color: typeColor }}
              >
                {goal.progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={goal.progress}
              sx={{
                height: 12,
                borderRadius: 6,
                backgroundColor: theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: typeColor,
                  borderRadius: 6,
                },
              }}
            />
          </Box>

          {/* Status and Timeline */}
          <Box className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Box
              className="text-center p-4 border rounded-lg"
              sx={{
                borderColor: theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  mb: 1,
                }}
              >
                Status
              </Typography>
              <Chip
                label={goal.status}
                sx={{
                  backgroundColor: `${statusColor}20`,
                  color: statusColor,
                  fontWeight: 600,
                }}
              />
            </Box>

            <Box
              className="text-center p-4 border rounded-lg"
              sx={{
                borderColor: theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  mb: 1,
                }}
              >
                Due Date
              </Typography>
              <Typography
                variant="body1"
                className="font-semibold"
                sx={{
                  color: isOverdue
                    ? '#EF4444'
                    : theme?.mode === 'dark'
                    ? '#f1f5f9'
                    : '#1f2937',
                }}
              >
                {formatDateSafe(goal.dueDate)}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: isOverdue
                    ? '#EF4444'
                    : theme?.mode === 'dark'
                    ? '#94a3b8'
                    : '#6b7280',
                }}
              >
                {isOverdue
                  ? `${Math.abs(daysLeft)} days overdue`
                  : `${daysLeft} days left`}
              </Typography>
            </Box>

            <Box
              className="text-center p-4 border rounded-lg"
              sx={{
                borderColor: theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  mb: 1,
                }}
              >
                Timeline
              </Typography>
              <Typography
                variant="body1"
                className="font-semibold"
                sx={{
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
                }}
              >
                {goal.timeline || 'Not specified'}
              </Typography>
            </Box>
          </Box>

          {/* Additional Info */}
          {(goal.category || goal.tags?.length) && (
            <Box className="mt-4">
              {goal.category && (
                <Box className="mb-2">
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                      mb: 1,
                    }}
                  >
                    Category
                  </Typography>
                  <Chip label={goal.category} size="small" variant="outlined" />
                </Box>
              )}

              {goal.tags && goal.tags.length > 0 && (
                <Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                      mb: 1,
                    }}
                  >
                    Tags
                  </Typography>
                  <Box className="flex flex-wrap gap-1">
                    {goal.tags.map((tag, index) => (
                      <Chip
                        key={index}
                        label={tag}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* AI Summary */}
      {goal.aiSummary && (
        <Card
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            borderRadius: '1rem',
          }}
        >
          <CardContent className="p-6">
            <Typography
              variant="h6"
              className="font-semibold mb-3"
              sx={{
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
              }}
            >
              AI Insights
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                lineHeight: 1.6,
              }}
            >
              {goal.aiSummary}
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );

  const MilestonesTab = () => (
    <Box className="space-y-4">
      <Typography
        variant="h6"
        className="font-semibold mb-4"
        sx={{
          color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
        }}
      >
        Milestones & Steps
      </Typography>

      {goal.steps.length === 0 ? (
        <Card
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            borderRadius: '1rem',
          }}
        >
          <CardContent className="p-6 text-center">
            <Typography
              variant="body1"
              sx={{
                color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
              }}
            >
              No steps added yet. Add milestones to track your progress!
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence>
          {goal.steps.map((step) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <Card
                sx={{
                  backgroundColor:
                    theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
                  borderRadius: '1rem',
                  border: step.completed
                    ? `2px solid ${typeColor}40`
                    : `1px solid ${
                        theme?.mode === 'dark' ? '#374151' : '#e5e7eb'
                      }`,
                }}
              >
                <CardContent className="p-4">
                  <Box className="flex items-start gap-3">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={step.completed}
                          onChange={(e) =>
                            handleStepToggle(step.id, e.target.checked)
                          }
                          icon={<RadioButtonUnchecked />}
                          checkedIcon={<CheckCircle />}
                          sx={{
                            color: typeColor,
                            '&.Mui-checked': {
                              color: typeColor,
                            },
                          }}
                        />
                      }
                      label=""
                    />

                    <Box className="flex-1">
                      <Typography
                        variant="h6"
                        className={`font-semibold ${
                          step.completed ? 'line-through opacity-60' : ''
                        }`}
                        sx={{
                          color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
                        }}
                      >
                        {step.title}
                      </Typography>

                      {step.description && (
                        <Typography
                          variant="body2"
                          className="mt-1"
                          sx={{
                            color:
                              theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                          }}
                        >
                          {step.description}
                        </Typography>
                      )}

                      {(step.targetValue || step.unit) && (
                        <Box className="flex items-center gap-2 mt-2">
                          <Chip
                            label={`Target: ${step.targetValue} ${step.unit}`}
                            size="small"
                            variant="outlined"
                          />
                          {step.actualValue && (
                            <Chip
                              label={`Actual: ${step.actualValue} ${step.unit}`}
                              size="small"
                              sx={{
                                backgroundColor:
                                  step.actualValue >= (step.targetValue || 0)
                                    ? '#10B98120'
                                    : '#F59E0B20',
                                color:
                                  step.actualValue >= (step.targetValue || 0)
                                    ? '#10B981'
                                    : '#F59E0B',
                              }}
                            />
                          )}
                        </Box>
                      )}

                      {(step.startDate || step.endDate) && (
                        <Box className="flex items-center gap-2 mt-2">
                          <Schedule
                            sx={{
                              fontSize: 16,
                              color:
                                theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color:
                                theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                            }}
                          >
                            {step.startDate && (
                              <>Start: {formatStepDate(step.startDate)}</>
                            )}
                            {step.startDate && step.endDate && ' • '}
                            {step.endDate && (
                              <>End: {formatStepDate(step.endDate)}</>
                            )}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </Box>
  );

  const LinkedItemsTab = () => (
    <Box className="space-y-4">
      <Typography
        variant="h6"
        className="font-semibold mb-4"
        sx={{
          color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
        }}
      >
        Linked Items
      </Typography>

      <Card
        sx={{
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          borderRadius: '1rem',
        }}
      >
        <CardContent className="p-6 text-center">
          <Typography
            variant="body1"
            sx={{
              color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
            }}
          >
            This feature will be available soon! You&#39;ll be able to link
            tasks, schedules, and streaks to your goals.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <Box
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#f8fafc',
        minHeight: '100vh',
        p: 3,
      }}
    >
      <Box className="max-w-4xl mx-auto">
        {/* Header */}
        <Box className="flex items-center gap-4 mb-6">
          <IconButton
            onClick={() => router.back()}
            sx={{
              backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
            }}
          >
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h4"
            className="font-bold"
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
            }}
          >
            Goal Details
          </Typography>
        </Box>

        {/* Tabs */}
        <Card
          sx={{
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            borderRadius: '1rem',
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="goal tabs"
              sx={{
                '& .MuiTab-root': {
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  '&.Mui-selected': {
                    color: typeColor,
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: typeColor,
                },
              }}
            >
              <Tab label="Overview" />
              <Tab label="Milestones" />
              <Tab label="Linked Items" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <OverviewTab />
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <MilestonesTab />
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
            <LinkedItemsTab />
          </TabPanel>
        </Card>
      </Box>

      {/* Edit Modal */}
      {user && (
        <GoalsProvider userId={user.uid}>
          <GoalModal
            open={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            goal={goal}
          />
        </GoalsProvider>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            borderRadius: '1rem',
          },
        }}
      >
        <DialogTitle>
          <Typography
            variant="h6"
            className="font-semibold"
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
            }}
          >
            Delete Goal
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography
            sx={{
              color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
            }}
          >
            Are you sure you want to delete &#39;{goal.title}&#39;? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteGoal}
            disabled={loading}
            sx={{
              color: '#EF4444',
              '&:hover': {
                backgroundColor: '#EF444410',
              },
            }}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const GoalDetailPage: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <GoalsProvider userId={user.uid}>
      <GoalDetailInner />
    </GoalsProvider>
  );
};

export default GoalDetailPage;
