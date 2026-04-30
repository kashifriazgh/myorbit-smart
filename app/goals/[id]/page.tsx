'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { ArrowBack, Edit, Delete } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoals, GoalsProvider } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { GoalType } from '../../lib/interface';
import GoalModal from '../../components/goals/GoalModal';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toPlainDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    'nanoseconds' in value
  ) {
    const { seconds, nanoseconds } = value as {
      seconds: number;
      nanoseconds: number;
    };
    return new Date(seconds * 1000 + nanoseconds / 1_000_000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  try {
    const parsed = new Date(value as unknown as string | number | Date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
};

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_IN_MS);

const getGoalTypeIcon = (type: GoalType): string => {
  switch (type) {
    case 'finance':
      return '💰';
    case 'health':
      return '🏃';
    case 'learning':
      return '📚';
    case 'habit':
      return '🎯';
    case 'work':
      return '💼';
    case 'lifestyle':
      return '🌟';
    default:
      return '✨';
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
    case 'work':
      return '#0ea5e9';
    case 'lifestyle':
      return '#F472B6';
    default:
      return '#6B7280';
  }
};

const GoalDetailInner: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { goals, updateStepStatus, deleteGoal, updateGoal } = useGoals();
  const { theme } = useCustomTheme();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneEndDate, setNewMilestoneEndDate] = useState('');
  const [newMilestoneTargetValue, setNewMilestoneTargetValue] = useState('');

  const goal = goals.find((g) => g.id === params.id);

  // Detect if this is the first time viewing this goal (per user, per browser)
  const [firstView, setFirstView] = useState(false);
  useEffect(() => {
    if (goal && goal.id) {
      const viewedKey = `goal_viewed_${goal.id}`;
      if (!localStorage.getItem(viewedKey)) {
        setFirstView(true);
        localStorage.setItem(viewedKey, '1');
      }
    }
  }, [goal]);
  const typeColor = useMemo(
    () => (goal ? getGoalTypeColor(goal.type) : '#6B7280'),
    [goal],
  );

  const dueDateDate = useMemo(
    () => (goal ? toPlainDate(goal.dueDate) : null),
    [goal],
  );

  const createdDate = useMemo(() => (goal ? new Date() : null), [goal]);

  const daysLeft = useMemo(() => {
    if (!dueDateDate) return 0;
    const now = new Date();
    return Math.ceil(
      (dueDateDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
  }, [dueDateDate]);

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

  const handleCreateMilestone = async () => {
    try {
      const title =
        newMilestoneTitle.trim() ||
        `Milestone ${(goal.steps || []).length + 1}`;

      // determine start date: after last step end or createdDate or today
      let start: Date;
      if (goal.steps && goal.steps.length > 0) {
        const last = goal.steps[goal.steps.length - 1];
        const lastEnd =
          toPlainDate(last.endDate) || toPlainDate(last.startDate) || null;
        start = lastEnd ? addDays(lastEnd, 1) : new Date();
      } else {
        start = createdDate || new Date();
      }

      // Use provided endDate or fallback to default
      let end: Date;
      if (newMilestoneEndDate) {
        end = new Date(newMilestoneEndDate);
      } else {
        end = dueDateDate || addDays(start, 7);
      }

      if (start.getTime() >= end.getTime()) {
        start = addDays(end, -1);
      }

      const uniqueId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const newStep = {
        id: uniqueId,
        title,
        startDate: start,
        endDate: end,
        completed: false,
        skipped: false,
        targetValue: newMilestoneTargetValue
          ? parseFloat(newMilestoneTargetValue)
          : undefined,
      };

      await updateGoal(goal.id!, { steps: [...(goal.steps || []), newStep] });
      setMilestoneDialogOpen(false);
      setNewMilestoneTitle('');
      setNewMilestoneEndDate('');
      setNewMilestoneTargetValue('');
    } catch (err) {
      console.error('Error creating milestone:', err);
    }
  };

  const completedStepsCount =
    goal.steps?.filter((s) => s.completed).length || 0;
  const totalStepsCount = goal.steps?.length || 0;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme?.mode === 'dark' ? '#0f172a' : '#f8fafc',
        py: { xs: 2, sm: 4 },
        px: { xs: 2, sm: 4 },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 4,
        }}
      >
        <IconButton
          onClick={() => router.push('/goals')}
          sx={{
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
          }}
        >
          <ArrowBack />
        </IconButton>
        <Box sx={{ display: 'flex', gap: 1 }}>
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

      {/* Offer AI suggestion if first time viewing */}
      {firstView && (
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: '1rem',
            background: theme?.mode === 'dark' ? '#334155' : '#e0f2fe',
            border: `1px solid ${theme?.mode === 'dark' ? '#475569' : '#38bdf8'}`,
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#0ea5e9',
              mb: 1,
            }}
          >
            Welcome! Want to improve this goal?
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: theme?.mode === 'dark' ? '#cbd5e1' : '#0369a1',
              mb: 2,
            }}
          >
            We can analyze your goal and suggest improvements or milestones
            using AI.
          </Typography>
          <Button
            variant="contained"
            sx={{
              background: theme?.mode === 'dark' ? '#38bdf8' : '#0ea5e9',
              color: '#fff',
              fontWeight: 600,
            }}
            onClick={() => {
              // TODO: Open AI suggestion modal or trigger API
              alert('AI suggestion feature coming soon!');
            }}
          >
            Analyze & Suggest with AI
          </Button>
        </Box>
      )}
      <Box
        sx={{
          maxWidth: 'md',
          mx: 'auto',
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          borderRadius: '2rem',
          overflow: 'hidden',
        }}
      >
        {/* Top Gradient Section with Circular Progress */}
        <Box
          sx={{
            background: `linear-gradient(135deg, ${typeColor} 0%, ${typeColor}dd 100%)`,
            px: 3,
            pt: 3,
            pb: 8,
            color: 'white',
            position: 'relative',
          }}
        >
          <Typography
            variant="body2"
            sx={{ opacity: 0.9, mb: 3, fontWeight: 500 }}
          >
            {goal.status}
          </Typography>

          {/* Circular Progress */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              position: 'relative',
              mb: 4,
            }}
          >
            <svg width="160" height="160">
              {/* Background ring */}
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="10"
                fill="none"
              />
              {/* Progress ring */}
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="10"
                strokeDasharray={`${(goal.progress / 100) * 440} 440`}
                strokeLinecap="round"
                fill="none"
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: '50% 50%',
                  transition: 'stroke-dasharray 0.3s ease',
                }}
              />
            </svg>

            {/* Center content */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 'bold',
                  fontSize: '1.25rem',
                }}
              >
                {goal.progress}
              </Typography>
              <Typography
                variant="body2"
                sx={{ opacity: 0.87, fontSize: '0.75rem' }}
              >
                %
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Content Area */}
        <Box
          sx={{
            px: { xs: 2, sm: 4 },
            pb: 4,
            mt: -6,
            pt: 4,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Goal Title Card */}
          <Box
            sx={{
              backgroundColor: theme?.mode === 'dark' ? '#334155' : '#white',
              borderRadius: '1.5rem',
              p: 3,
              mb: 4,
              boxShadow:
                theme?.mode === 'dark' ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
              border:
                theme?.mode === 'dark'
                  ? `1px solid #475569`
                  : '1px solid #e5e7eb',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 2,
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: typeColor,
                    mb: 0.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {goal.type}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
                    mb: 1,
                  }}
                >
                  {goal.title}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '0.75rem',
                  backgroundColor: `${typeColor}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                }}
              >
                {getGoalTypeIcon(goal.type)}
              </Box>
            </Box>

            {/* Progress Bar */}
            <Box sx={{ mt: 3 }}>
              <Box
                sx={{
                  height: 6,
                  width: '100%',
                  backgroundColor:
                    theme?.mode === 'dark' ? '#1e293b' : '#e5e7eb',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${goal.progress}%`,
                    backgroundColor: typeColor,
                    borderRadius: '9999px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.75rem',
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  mt: 1,
                }}
              >
                You have achieved{' '}
                <span style={{ fontWeight: 600, color: typeColor }}>
                  {goal.progress}%
                </span>{' '}
                of your goal
              </Typography>
            </Box>
          </Box>

          {/* Description */}
          {goal.description && (
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#cbd5e1' : '#6b7280',
                  lineHeight: 1.6,
                }}
              >
                {goal.description}
              </Typography>
            </Box>
          )}

          {/* Milestones Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Typography
              variant="body1"
              sx={{
                fontWeight: 600,
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
              }}
            >
              Steps & Milestones ({completedStepsCount}/{totalStepsCount})
            </Typography>
            <Box>
              <Button
                size="small"
                onClick={() => setMilestoneDialogOpen(true)}
                sx={{ textTransform: 'none' }}
              >
                Add Milestone
              </Button>
            </Box>
          </Box>

          {/* Steps List */}
          <AnimatePresence>
            {goal.steps && goal.steps.length > 0 ? (
              <Box sx={{ space: 2 }}>
                {goal.steps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                  >
                    <Box
                      sx={{
                        backgroundColor:
                          theme?.mode === 'dark' ? '#334155' : '#f9fafb',
                        borderRadius: '1.25rem',
                        p: 3,
                        mb: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border:
                          theme?.mode === 'dark'
                            ? `1px solid #475569`
                            : '1px solid #e5e7eb',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          boxShadow:
                            theme?.mode === 'dark'
                              ? 'none'
                              : '0 4px 12px rgba(0,0,0,0.08)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 2,
                          alignItems: 'flex-start',
                          flex: 1,
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '0.75rem',
                            backgroundColor: step.completed
                              ? `${typeColor}20`
                              : theme?.mode === 'dark'
                                ? '#475569'
                                : '#e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {step.completed ? (
                            <Typography
                              sx={{
                                fontSize: '1.25rem',
                              }}
                            >
                              ✓
                            </Typography>
                          ) : (
                            <Typography
                              sx={{
                                fontSize: '1rem',
                                color:
                                  theme?.mode === 'dark'
                                    ? '#94a3b8'
                                    : '#9ca3af',
                              }}
                            >
                              {index + 1}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              color: step.completed
                                ? theme?.mode === 'dark'
                                  ? '#94a3b8'
                                  : '#9ca3af'
                                : theme?.mode === 'dark'
                                  ? '#f1f5f9'
                                  : '#1f2937',
                              textDecoration: step.completed
                                ? 'line-through'
                                : 'none',
                            }}
                          >
                            {step.title}
                          </Typography>
                          {step.description && (
                            <Typography
                              variant="caption"
                              sx={{
                                color:
                                  theme?.mode === 'dark'
                                    ? '#94a3b8'
                                    : '#6b7280',
                                display: 'block',
                                mt: 0.5,
                              }}
                            >
                              {step.description}
                            </Typography>
                          )}
                          {step.targetValue && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: typeColor,
                                display: 'block',
                                mt: 0.5,
                                fontWeight: 500,
                              }}
                            >
                              Target: {step.targetValue}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      {/* Action Button */}
                      <Button
                        onClick={() =>
                          handleStepToggle(step.id, !step.completed)
                        }
                        size="small"
                        sx={{
                          backgroundColor: step.completed
                            ? `${typeColor}20`
                            : theme?.mode === 'dark'
                              ? '#1e293b'
                              : '#3B82F6',
                          color: step.completed ? typeColor : '#ffffff',
                          fontWeight: 600,
                          textTransform: 'none',
                          borderRadius: '0.5rem',
                          px: 2,
                          py: 1,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          fontSize: '0.75rem',
                          '&:hover': {
                            backgroundColor: step.completed
                              ? `${typeColor}30`
                              : '#2563eb',
                          },
                        }}
                      >
                        {step.completed ? 'Completed' : 'Complete'}
                      </Button>
                    </Box>
                  </motion.div>
                ))}
              </Box>
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  textAlign: 'center',
                  py: 3,
                }}
              >
                No milestones yet
              </Typography>
            )}
          </AnimatePresence>

          {/* Additional Info */}
          {goal.notes && (
            <Box sx={{ mt: 4 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
                  mb: 1,
                }}
              >
                Notes
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#cbd5e1' : '#6b7280',
                  lineHeight: 1.6,
                }}
              >
                {goal.notes}
              </Typography>
            </Box>
          )}

          {/* Tags */}
          {goal.tags && goal.tags.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
                  mb: 1,
                }}
              >
                Tags
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {goal.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{
                      backgroundColor: `${typeColor}20`,
                      color: typeColor,
                      fontWeight: 500,
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Due Date and Priority Info */}
          <Box
            sx={{
              mt: 4,
              pt: 3,
              borderTop:
                theme?.mode === 'dark'
                  ? '1px solid #475569'
                  : '1px solid #e5e7eb',
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                }}
              >
                Due Date
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
                  fontWeight: 500,
                  mt: 0.5,
                }}
              >
                {dueDateDate ? dueDateDate.toLocaleDateString() : 'Not set'}
              </Typography>
              {dueDateDate && (
                <Typography
                  variant="caption"
                  sx={{
                    color:
                      daysLeft < 0
                        ? '#EF4444'
                        : daysLeft <= 3
                          ? '#F59E0B'
                          : typeColor,
                    display: 'block',
                    mt: 0.25,
                  }}
                >
                  {daysLeft < 0
                    ? `${Math.abs(daysLeft)} days overdue`
                    : `${daysLeft} days left`}
                </Typography>
              )}
            </Box>

            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                }}
              >
                Priority
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={goal.priority}
                  size="small"
                  sx={{
                    backgroundColor: `${typeColor}20`,
                    color: typeColor,
                    fontWeight: 600,
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Create Milestone Dialog */}
      <Dialog
        open={milestoneDialogOpen}
        onClose={() => setMilestoneDialogOpen(false)}
      >
        <DialogTitle>Create Milestone</DialogTitle>
        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}
        >
          <TextField
            label="Milestone title"
            fullWidth
            size="small"
            value={newMilestoneTitle}
            onChange={(e) => setNewMilestoneTitle(e.target.value)}
          />
          <TextField
            label="End Date"
            type="date"
            fullWidth
            size="small"
            value={newMilestoneEndDate}
            onChange={(e) => setNewMilestoneEndDate(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
          />
          <TextField
            label="What you actually want"
            fullWidth
            size="small"
            type="number"
            value={newMilestoneTargetValue}
            onChange={(e) => setNewMilestoneTargetValue(e.target.value)}
            placeholder="e.g., 100 (target value)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMilestoneDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateMilestone} sx={{ color: typeColor }}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Modal */}
      <GoalModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        goal={goal}
      />

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Goal</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this goal? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteGoal}
            disabled={loading}
            sx={{ color: '#EF4444' }}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default function GoalDetailPage() {
  const { user } = useAuth();
  return (
    <GoalsProvider userId={user?.uid}>
      <GoalDetailInner />
    </GoalsProvider>
  );
}
