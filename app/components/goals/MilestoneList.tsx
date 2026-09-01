'use client';

import React, { useMemo } from 'react';
import { Box, Typography, Button, Chip, Stack } from '@mui/material';
import { InfoOutlined, TrackChanges } from '@mui/icons-material';
import { GoalStep, GoalStepStatus } from '../../lib/interface';
import { useGoals } from '../../lib/context/GoalsContext';
import { useCustomTheme } from '../../lib/context/themeContext';

const STATUS_META: Record<
  GoalStepStatus,
  { label: string; color: string; bg: string }
> = {
  [GoalStepStatus.NOT_STARTED]: {
    label: 'Not started',
    color: '#64748b',
    bg: '#f1f5f9',
  },
  [GoalStepStatus.IN_PROGRESS]: {
    label: 'In progress',
    color: '#2563eb',
    bg: '#eff6ff',
  },
  [GoalStepStatus.COMPLETED]: {
    label: 'Completed',
    color: '#10b981',
    bg: '#ecfdf5',
  },
  [GoalStepStatus.SKIPPED]: {
    label: 'Skipped',
    color: '#f97316',
    bg: '#fff7ed',
  },
  [GoalStepStatus.BLOCKED]: {
    label: 'Blocked',
    color: '#ef4444',
    bg: '#fee2e2',
  },
  [GoalStepStatus.DEFERRED]: {
    label: 'Deferred',
    color: '#8b5cf6',
    bg: '#f5f3ff',
  },
};

function formatDate(value: unknown): string {
  if (!value) return 'No due date';

  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    // Firestore Timestamp
    date = (value as { toDate: () => Date }).toDate();
  } else if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value
  ) {
    // Plain Firestore-like { seconds, nanoseconds }
    date = new Date((value as { seconds: number }).seconds * 1000);
  } else {
    date = new Date(value as string | number);
  }

  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface MilestoneListProps {
  goalId: string;
  steps: GoalStep[];
  onSelectStep: (step: GoalStep) => void;
  onStepsChange?: () => void;
  onAddStep?: () => void;
  onCreateTracker?: () => void;
  onTriggerAISuggest?: () => void;
  typeColor?: string;
  smartNudge?: string | null; // null = loading, undefined = not requested
}

export default function MilestoneList({
  goalId,
  steps,
  onSelectStep,
  onStepsChange,
  onAddStep,
  onCreateTracker: _onCreateTracker,
  onTriggerAISuggest: _onTriggerAISuggest,
  typeColor,
  smartNudge: _smartNudge,
}: MilestoneListProps) {
  const { updateStepStatus } = useGoals();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const orderedSteps = useMemo(
    () => [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [steps],
  );

  const hasSteps = orderedSteps.length > 0;

  const handleToggleStatus = async (step: GoalStep) => {
    if (step.closed) return;
    const nextStatus =
      step.status === GoalStepStatus.COMPLETED
        ? GoalStepStatus.IN_PROGRESS
        : GoalStepStatus.COMPLETED;
    await updateStepStatus(goalId, step.id, nextStatus);
    onStepsChange?.();
  };

  return (
    <Box>
      {!hasSteps && (
        <Box sx={{
          borderRadius: '24px',
          background: isDark 
            ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)' 
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)'}`,
          p: { xs: 3, sm: 4.5 }, 
          textAlign: 'center', 
          mb: 3,
          boxShadow: isDark ? '0 10px 30px -10px rgba(0,0,0,0.5)' : '0 10px 30px -10px rgba(99, 102, 241, 0.05)',
        }}>
          <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: 'rgba(99, 102, 241, 0.1)', mb: 2 }}>
            <TrackChanges sx={{ fontSize: 32, color: '#6366f1' }} />
          </Box>

          <Typography variant="h6" sx={{ fontWeight: 850, mb: 1, color: isDark ? '#f1f5f9' : '#0f172a', fontSize: '1.2rem' }}>
            Get Started with Milestones 🚀
          </Typography>

          <Typography sx={{ fontSize: 13, color: isDark ? '#94a3b8' : '#475569', mb: 3.5, maxLen: 480, mx: 'auto', lineHeight: 1.6 }}>
            Breaking down your goal into small checkpoints makes it significantly easier to achieve. 
            Let Orbit AI determine the milestones and frequencies automatically, or set them up manually.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} justifyContent="center" alignItems="center">
            {onAddStep && (
              <Button
                size="large"
                variant="contained"
                onClick={onAddStep}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  borderRadius: '14px',
                  py: 1.4,
                  px: 5,
                  width: { xs: '100%', sm: 'auto' },
                  background: typeColor || 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.25s',
                  '&:hover': {
                    opacity: 0.95,
                    boxShadow: '0 6px 20px rgba(99, 102, 241, 0.45)',
                  }
                }}
              >
                Add Your First Milestone
              </Button>
            )}
          </Stack>

          <Typography sx={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8', fontWeight: 600, mt: 3.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            💡 Tip: Milestones do not require mandatory start/due dates.
          </Typography>
        </Box>
      )}

      {orderedSteps.map((step, index) => {
        const status =
          step.status && STATUS_META[step.status]
            ? STATUS_META[step.status]
            : STATUS_META[GoalStepStatus.NOT_STARTED];
        const isCompleted = step.status === GoalStepStatus.COMPLETED;
        const isClosed = step.closed === true;

        return (
          <Box
            key={step.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
              gap: 1,
              p: 2,
              mb: 1.5,
              borderRadius: '16px',
              background: isDark ? '#0f172a' : '#f8fafc',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              opacity: isCompleted || isClosed ? 0.45 : 1,
              filter: isCompleted || isClosed ? 'grayscale(40%)' : 'none',
              transition: 'opacity 0.2s, filter 0.2s',
            }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box
                sx={{
                  width: 34,
                  minWidth: 34,
                  height: 34,
                  borderRadius: '12px',
                  background: isCompleted
                    ? '#10b981'
                    : isDark
                      ? '#1e293b'
                      : '#e2e8f0',
                  color: isCompleted ? '#fff' : isDark ? '#94a3b8' : '#475569',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {index + 1}
              </Box>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: isDark ? '#f1f5f9' : '#111827',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {step.role && (
                      <Chip
                        label={step.role === 'contributive' ? '⚡ Contributive' : '🤝 Supportive'}
                        size="small"
                        sx={{
                          background: step.role === 'contributive' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: step.role === 'contributive' ? '#10b981' : '#3b82f6',
                          height: 24,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      />
                    )}
                    <Chip
                      label={status.label}
                      size="small"
                      sx={{
                        background: status.bg,
                        color: status.color,
                        height: 24,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                    {isClosed && (
                      <Chip
                        label="Closed"
                        size="small"
                        sx={{
                          background: isDark ? '#334155' : '#e5e7eb',
                          color: isDark ? '#cbd5e1' : '#475569',
                          height: 24,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Box>
                </Box>
                {step.role === 'contributive' && typeof step.contributionAmount === 'number' && step.contributionAmount > 0 && (
                  <Typography
                    sx={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#10b981',
                      mt: '4px',
                    }}
                  >
                    💡 By marking this step done, progress increases by {step.contributionAmount} {step.contributionUnit || 'units'}.
                  </Typography>
                )}
                {step.role === 'supportive' && (
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: isDark ? '#64748b' : '#6b7280',
                      mt: '2px',
                      fontStyle: 'italic',
                    }}
                  >
                    🤝 Supportive item: Helps reach the goal without altering numerical progress.
                  </Typography>
                )}
                {step.description && (
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: isDark ? '#94a3b8' : '#6b7280',
                      mt: '4px',
                    }}
                  >
                    {step.description}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                  {step.endDate && (
                    <Typography
                      sx={{ fontSize: 11, color: isDark ? '#64748b' : '#6b7280' }}
                    >
                      {formatDate(step.endDate)}
                    </Typography>
                  )}
                  {typeof step.weight === 'number' && step.weight > 1 && (
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: isDark ? '#64748b' : '#6b7280',
                      }}
                    >
                      Weight: {step.weight}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'row', sm: 'row' },
                justifyContent: 'flex-end',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'nowrap',
              }}
            >
              <Button
                size="small"
                onClick={() => onSelectStep(step)}
                startIcon={<InfoOutlined />}
                sx={{
                  justifyContent: 'center',
                  textTransform: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: '10px',
                  px: 1,
                  py: 0.5,
                  background: isDark ? '#1f2937' : '#fff',
                  color: isDark ? '#f8fafc' : '#111827',
                  border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
                  minWidth: 56,
                  width: { xs: 'auto', sm: 'auto' },
                }}
              >
                Details
              </Button>
              <Button
                size="small"
                onClick={() => handleToggleStatus(step)}
                disabled={isClosed}
                sx={{
                  textTransform: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: '10px',
                  px: 1,
                  background: isCompleted || isClosed ? '#475569' : '#10b981',
                  color: '#fff',
                  '&:hover': { opacity: isClosed ? 1 : 0.92 },
                  minWidth: 56,
                  width: { xs: 'auto', sm: 'auto' },
                }}
              >
                {isClosed ? 'Closed' : isCompleted ? 'Reopen' : 'Complete'}
              </Button>
            </Box>
          </Box>
        );
      })}

      {hasSteps && onAddStep && (
        <Box sx={{ display: 'flex', mt: 3.5, justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={onAddStep}
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              borderRadius: '14px',
              py: 1.4,
              px: 5,
              fontSize: '14px',
              backgroundColor: typeColor || '#6366f1',
              color: '#fff',
              boxShadow: `0 4px 14px ${(typeColor || '#6366f1')}33`,
              transition: 'all 0.25s',
              '&:hover': {
                backgroundColor: typeColor || '#6366f1',
                opacity: 0.9,
                boxShadow: `0 6px 20px ${(typeColor || '#6366f1')}45`,
              }
            }}
          >
            Add Next Milestone
          </Button>
        </Box>
      )}
    </Box>
  );
}
