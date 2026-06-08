'use client';

import React, { useMemo } from 'react';
import { Box, Typography, Button, Chip, Divider } from '@mui/material';
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
  smartNudge?: string | null; // null = loading, undefined = not requested
}

export default function MilestoneList({
  goalId,
  steps,
  onSelectStep,
  onStepsChange,
  onAddStep,
  onCreateTracker,
  smartNudge,
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
          borderRadius: '18px',
          background: isDark ? '#0f172a' : '#f8fafc',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          p: 3, textAlign: 'center', mb: 2,
        }}>
          {/* Contextual AI nudge or generic fallback */}
          {smartNudge === null ? (
            // Loading shimmer
            <Box sx={{
              height: 16, borderRadius: '6px', mb: 1.5,
              background: isDark
                ? 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)'
                : 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s infinite',
              '@keyframes shimmer': { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
              width: '80%', mx: 'auto',
            }} />
          ) : smartNudge ? (
            <Typography sx={{ fontSize: 13, color: isDark ? '#94a3b8' : '#475569', mb: 1.5, lineHeight: 1.6, fontStyle: 'italic' }}>
              ✨ {smartNudge}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#64748b', mb: 1.5 }}>
              No milestones yet. Add your first step to get started.
            </Typography>
          )}
          {onAddStep && (
            <Button
              size="medium"
              onClick={onAddStep}
              variant="contained"
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '12px',
                py: 1.2,
                px: 3,
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              Add Milestone
            </Button>
          )}
          {onCreateTracker && (
            <>
              <Divider sx={{ my: 2.5 }}>
                <Typography sx={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8', fontWeight: 600 }}>OR</Typography>
              </Divider>
              <Typography sx={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', mb: 2, lineHeight: 1.55 }}>
                For repeating goals (e.g. <em>Run 5 km daily</em> or <em>Read 400 pages by Aug</em>), use a tracker instead.
              </Typography>
              <Button
                size="medium"
                variant="outlined"
                startIcon={<TrackChanges sx={{ fontSize: 15 }} />}
                onClick={onCreateTracker}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '12px',
                  py: 1.2,
                  px: 3,
                  width: { xs: '100%', sm: 'auto' },
                  borderColor: isDark ? '#475569' : '#cbd5e1',
                  color: isDark ? '#cbd5e1' : '#475569',
                  '&:hover': {
                    borderColor: '#6366f1',
                    color: '#6366f1',
                    background: '#6366f108',
                  },
                }}
              >
                Set up a Tracker
              </Button>
            </>
          )}
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
                  <Typography
                    sx={{ fontSize: 11, color: isDark ? '#64748b' : '#6b7280' }}
                  >
                    {formatDate(step.endDate)}
                  </Typography>
                  {typeof step.weight === 'number' && (
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
    </Box>
  );
}
