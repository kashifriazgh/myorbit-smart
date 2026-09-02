'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Stack,
  Popover,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Checkbox,
  Tooltip,
} from '@mui/material';
import {
  InfoOutlined,
  TrackChanges,
  CalendarMonth,
  Checklist,
  Add as AddIcon,
  Close as CloseIcon,
  EventRepeat,
  AccessTime,
  Build as BuildIcon,
  CheckCircle,
  RadioButtonUnchecked,
} from '@mui/icons-material';
import { GoalStep, GoalStepStatus } from '../../lib/interface';
import { useGoals } from '../../lib/context/GoalsContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import LinkedSourceCard from './LinkedSourceCard';
import ManualMilestoneCard from './ManualMilestoneCard';

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
    date = (value as { toDate: () => Date }).toDate();
  } else if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value
  ) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  } else {
    date = new Date(value as string | number);
  }

  if (Number.isNaN(date.getTime())) return 'No due date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isToday(dateStr?: string | Date | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

interface MilestoneListProps {
  goalId: string;
  steps: GoalStep[];
  goalTargetValue?: number;
  onSelectStep: (step: GoalStep) => void;
  onStepsChange?: () => void;
  onAddStep?: () => void;
  onCreateTracker?: () => void;
  onTriggerAISuggest?: () => void;
  onOpenAddMoney?: (sourceName: string) => void;
  typeColor?: string;
  smartNudge?: string | null;
}

export default function MilestoneList({
  goalId,
  steps,
  goalTargetValue,
  onSelectStep,
  onStepsChange,
  onAddStep,
  onCreateTracker: _onCreateTracker,
  onTriggerAISuggest: _onTriggerAISuggest,
  onOpenAddMoney: _onOpenAddMoney,
  typeColor,
  smartNudge: _smartNudge,
}: MilestoneListProps) {
  const { updateStepStatus, updateGoalStep } = useGoals();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  // Popover state for Contributive / Supportive role explanation
  const [roleAnchorEl, setRoleAnchorEl] = useState<HTMLElement | null>(null);
  const [rolePopoverText, setRolePopoverText] = useState('');

  // Dialog state for Schedule / Todo detail modal on title click
  const [activeDetailStep, setActiveDetailStep] = useState<GoalStep | null>(null);

  const orderedSteps = useMemo(
    () => [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [steps],
  );

  const hasSteps = orderedSteps.length > 0;

  const handleRoleClick = (event: React.MouseEvent<HTMLElement>, role: 'contributive' | 'supportive', title: string) => {
    setRoleAnchorEl(event.currentTarget);
    if (role === 'contributive') {
      setRolePopoverText(`➕ "${title}" is a Contributive Milestone. Marking it done directly increases your goal's numerical progress towards target.`);
    } else {
      setRolePopoverText(`🔧 "${title}" is a Supportive Milestone. It helps you stay on track towards achieving your goal without altering numerical progress calculation.`);
    }
  };

  const handleRoleClose = () => {
    setRoleAnchorEl(null);
  };

  const handleToggleStatus = async (step: GoalStep) => {
    if (step.closed) return;

    const isDaily =
      (step.linkedType === 'schedule' || step.linkedType === 'todo') &&
      (step.recurrence?.type === 'daily' ||
        step.description?.toLowerCase().includes('daily') ||
        step.title.toLowerCase().includes('daily'));

    if (isDaily && isToday(step.lastCompletedAt)) {
      alert('This daily milestone has already been completed today. It will unlock tomorrow.');
      return;
    }

    const isNowCompleted = step.status !== GoalStepStatus.COMPLETED;
    const nextStatus = isNowCompleted
      ? GoalStepStatus.COMPLETED
      : GoalStepStatus.IN_PROGRESS;

    const nowIso = new Date().toISOString();
    const history = Array.isArray(step.completionHistory) ? [...step.completionHistory] : [];
    if (isNowCompleted) {
      history.push(nowIso);
    }

    await updateStepStatus(goalId, step.id, nextStatus);
    await updateGoalStep(goalId, step.id, {
      lastCompletedAt: isNowCompleted ? nowIso : step.lastCompletedAt,
      completionHistory: history,
    });

    // Update active detail step if open
    if (activeDetailStep && activeDetailStep.id === step.id) {
      setActiveDetailStep((prev) => prev ? { ...prev, status: nextStatus, lastCompletedAt: isNowCompleted ? nowIso : prev.lastCompletedAt } : null);
    }

    onStepsChange?.();
  };

  return (
    <Box>
      {/* Empty State */}
      {!hasSteps && (
        <Box
          sx={{
            borderRadius: '24px',
            background: isDark
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)'}`,
            p: { xs: 3, sm: 4.5 },
            textAlign: 'center',
            mb: 3,
            boxShadow: isDark ? '0 10px 30px -10px rgba(0,0,0,0.5)' : '0 10px 30px -10px rgba(99, 102, 241, 0.05)',
          }}
        >
          <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: 'rgba(99, 102, 241, 0.1)', mb: 2 }}>
            <TrackChanges sx={{ fontSize: 32, color: '#6366f1' }} />
          </Box>

          <Typography variant="h6" sx={{ fontWeight: 850, mb: 1, color: isDark ? '#f1f5f9' : '#0f172a', fontSize: '1.2rem' }}>
            Get Started with Milestones 🚀
          </Typography>

          <Typography sx={{ fontSize: 13, color: isDark ? '#94a3b8' : '#475569', mb: 3.5, maxLen: 480, mx: 'auto', lineHeight: 1.6 }}>
            Breaking down your goal into small checkpoints makes it significantly easier to achieve. 
            Add your schedules, tasks, or funding sources to track progress.
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
                  },
                }}
              >
                Add Your First Milestone
              </Button>
            )}
          </Stack>
        </Box>
      )}

      {/* Milestone Card Items */}
      {orderedSteps.map((step, index) => {
        if (step.linkedType === 'finance_source') {
          return (
            <Box key={step.id} sx={{ mb: 2 }}>
              <LinkedSourceCard
                goalId={goalId}
                step={step}
                goalTargetValue={goalTargetValue}
                onStepsChange={onStepsChange}
              />
            </Box>
          );
        }

        if (step.linkedType === 'manual' || !step.linkedType) {
          return (
            <Box key={step.id} sx={{ mb: 2 }}>
              <ManualMilestoneCard
                goalId={goalId}
                step={step}
                onStepsChange={onStepsChange}
              />
            </Box>
          );
        }

        const status =
          step.status && STATUS_META[step.status]
            ? STATUS_META[step.status]
            : STATUS_META[GoalStepStatus.NOT_STARTED];
        const isCompleted = step.status === GoalStepStatus.COMPLETED;
        const isClosed = step.closed === true;

        const isDaily =
          (step.linkedType === 'schedule' || step.linkedType === 'todo') &&
          (step.recurrence?.type === 'daily' ||
            step.description?.toLowerCase().includes('daily') ||
            step.title.toLowerCase().includes('daily'));

        const isDailyCompletedToday = isDaily && isToday(step.lastCompletedAt);
        const isScheduleOrTodo = step.linkedType === 'schedule' || step.linkedType === 'todo';

        return (
          <Box
            key={step.id}
            sx={{
              p: 2.5,
              mb: 2,
              borderRadius: '20px',
              background: isDark ? '#0f172a' : '#ffffff',
              border: `1.5px solid ${
                step.linkedType === 'schedule'
                  ? isDark ? 'rgba(139, 92, 246, 0.3)' : '#ddd6fe'
                  : step.linkedType === 'todo'
                  ? isDark ? 'rgba(37, 99, 235, 0.3)' : '#bfdbfe'
                  : isDark ? '#334155' : '#e2e8f0'
              }`,
              opacity: isClosed ? 0.5 : 1,
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.03)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.06)',
              },
            }}
          >
            {/* Top Header Type Badge */}
            <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              {step.linkedType === 'schedule' && (
                <Chip
                  icon={<CalendarMonth sx={{ fontSize: 15, color: '#8b5cf6 !important' }} />}
                  label="Schedules"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(139, 92, 246, 0.15)',
                    color: '#8b5cf6',
                    fontWeight: 900,
                    fontSize: 11,
                    px: 1,
                    py: 0.4,
                    borderRadius: '10px',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    letterSpacing: '0.03em',
                  }}
                />
              )}
              {step.linkedType === 'todo' && (
                <Chip
                  icon={<Checklist sx={{ fontSize: 15, color: '#2563eb !important' }} />}
                  label="Todo Task"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(37, 99, 235, 0.15)',
                    color: '#2563eb',
                    fontWeight: 900,
                    fontSize: 11,
                    px: 1,
                    py: 0.4,
                    borderRadius: '10px',
                    border: '1px solid rgba(37, 99, 235, 0.3)',
                    letterSpacing: '0.03em',
                  }}
                />
              )}
              {!step.linkedType && (
                <Chip
                  icon={<TrackChanges sx={{ fontSize: 15, color: '#0ea5e9 !important' }} />}
                  label="Milestone Checkpoint"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(14, 165, 233, 0.15)',
                    color: '#0ea5e9',
                    fontWeight: 900,
                    fontSize: 11,
                    px: 1,
                    py: 0.4,
                    borderRadius: '10px',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    letterSpacing: '0.03em',
                  }}
                />
              )}

              {/* Status Badge */}
              <Chip
                label={status.label}
                size="small"
                sx={{
                  background: status.bg,
                  color: status.color,
                  height: 22,
                  fontSize: 11,
                  fontWeight: 800,
                }}
              />
            </Box>

            {/* Main Card Content Layout */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              {/* Left Details Box */}
              <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1, flexWrap: 'wrap' }}>
                  {/* Inline Checkbox for Schedule & Todo */}
                  {isScheduleOrTodo ? (
                    <Tooltip title={isDailyCompletedToday ? 'Completed for today' : isCompleted ? 'Mark as In Progress' : 'Mark as Complete'}>
                      <Checkbox
                        checked={isCompleted || isDailyCompletedToday}
                        onChange={() => handleToggleStatus(step)}
                        disabled={isClosed || isDailyCompletedToday}
                        checkedIcon={<CheckCircle sx={{ color: '#10b981', fontSize: 22 }} />}
                        icon={<RadioButtonUnchecked sx={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: 22 }} />}
                        sx={{ p: 0.2 }}
                      />
                    </Tooltip>
                  ) : (
                    /* Step Index Circle for Manual & Source */
                    <Box
                      sx={{
                        width: 28,
                        minWidth: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: isCompleted ? '#10b981' : isDark ? '#1e293b' : '#e2e8f0',
                        color: isCompleted ? '#fff' : isDark ? '#94a3b8' : '#475569',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 800,
                        fontSize: 12,
                      }}
                    >
                      {index + 1}
                    </Box>
                  )}

                  {/* Title (Clicking opens Detail Dialog for Schedule & Todo) */}
                  {isScheduleOrTodo ? (
                    <Typography
                      onClick={() => setActiveDetailStep(step)}
                      sx={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: step.linkedType === 'schedule'
                          ? isDark ? '#a78bfa' : '#6d28d9'
                          : isDark ? '#60a5fa' : '#1d4ed8',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        textUnderlineOffset: '3px',
                        '&:hover': { opacity: 0.8 },
                      }}
                    >
                      {step.title}
                    </Typography>
                  ) : (
                    <Typography
                      sx={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: isDark ? '#f1f5f9' : '#0f172a',
                      }}
                    >
                      {step.title}
                    </Typography>
                  )}

                  {/* Icon-only Badges for Contributive (➕) & Supportive (🔧) */}
                  {step.role === 'contributive' && (
                    <Tooltip title="➕ Contributive Milestone (Click for info)">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRoleClick(e, 'contributive', step.title);
                        }}
                        sx={{
                          p: 0.4,
                          borderRadius: '8px',
                          bgcolor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.3)' },
                        }}
                      >
                        <AddIcon sx={{ fontSize: 16, fontWeight: 900 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {step.role === 'supportive' && (
                    <Tooltip title="🔧 Supportive Milestone (Click for info)">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRoleClick(e, 'supportive', step.title);
                        }}
                        sx={{
                          p: 0.4,
                          borderRadius: '8px',
                          bgcolor: 'rgba(59, 130, 246, 0.15)',
                          color: '#3b82f6',
                          '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.3)' },
                        }}
                      >
                        <BuildIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                {/* Subtitle / Description */}
                {step.description && (
                  <Typography sx={{ fontSize: 12, color: isDark ? '#cbd5e1' : '#475569', mb: 0.75 }}>
                    {step.description}
                  </Typography>
                )}

                {/* Contributive value note */}
                {step.role === 'contributive' && typeof step.contributionAmount === 'number' && step.contributionAmount > 0 && (
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#10b981', mb: 0.75 }}>
                    💡 Marking this done contributes {step.contributionAmount} {step.contributionUnit || 'units'} towards target!
                  </Typography>
                )}

                {/* Dates & Recurrence Details (No due date displayed for Daily items) */}
                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ gap: 1 }}>
                  {!isDaily && step.endDate && (
                    <Typography sx={{ fontSize: 11, color: isDark ? '#94a3b8' : '#6b7280', fontWeight: 600 }}>
                      📅 Due: {formatDate(step.endDate)}
                    </Typography>
                  )}
                  {isDaily && (
                    <Typography sx={{ fontSize: 11, color: '#8b5cf6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EventRepeat sx={{ fontSize: 13 }} /> Daily
                    </Typography>
                  )}
                </Stack>
              </Box>

              {/* Right Action Buttons */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'row', sm: 'row' },
                  gap: 1,
                  alignItems: 'center',
                  width: { xs: '100%', sm: 'auto' },
                  justifyContent: { xs: 'flex-end', sm: 'flex-end' },
                }}
              >
                {/* For Schedule & Todo: Buttons are hidden as per request (replaced by Title Dialog & Checkbox) */}
                {!isScheduleOrTodo && (
                  <>
                    <Button
                      size="small"
                      onClick={() => onSelectStep(step)}
                      startIcon={<InfoOutlined sx={{ fontSize: 14 }} />}
                      sx={{
                        textTransform: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: '10px',
                        px: 1.5,
                        py: 0.75,
                        background: isDark ? '#1f2937' : '#f1f5f9',
                        color: isDark ? '#f8fafc' : '#1e293b',
                        border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
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
                        fontWeight: 800,
                        borderRadius: '10px',
                        px: 2,
                        py: 0.75,
                        background: isCompleted || isClosed ? '#475569' : '#10b981',
                        color: '#fff',
                        minWidth: 90,
                        width: { xs: 'auto', sm: 'auto' },
                      }}
                    >
                      {isClosed ? 'Closed' : isCompleted ? 'Reopen' : 'Complete'}
                    </Button>
                  </>
                )}
              </Box>
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
              },
            }}
          >
            Add Next Milestone
          </Button>
        </Box>
      )}

      {/* Role Explanation Popover */}
      <Popover
        open={Boolean(roleAnchorEl)}
        anchorEl={roleAnchorEl}
        onClose={handleRoleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            p: 2,
            maxWidth: 320,
            borderRadius: '16px',
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            boxShadow: 8,
          },
        }}
      >
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: isDark ? '#cbd5e1' : '#475569', lineHeight: 1.5 }}>
          {rolePopoverText}
        </Typography>
      </Popover>

      {/* Interactive Detail Dialog for Both Schedule & Todo */}
      <Dialog
        open={Boolean(activeDetailStep)}
        onClose={() => setActiveDetailStep(null)}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1,
            maxWidth: 440,
            width: '100%',
            bgcolor: isDark ? '#0f172a' : '#ffffff',
          },
        }}
      >
        <DialogTitle sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {activeDetailStep?.linkedType === 'schedule' ? (
              <CalendarMonth sx={{ color: '#8b5cf6' }} />
            ) : (
              <Checklist sx={{ color: '#2563eb' }} />
            )}
            <Typography variant="h6" fontWeight={800}>
              {activeDetailStep?.linkedType === 'schedule' ? 'Schedule Milestone Details' : 'Todo Task Details'}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={() => setActiveDetailStep(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2, pt: 1 }}>
          {activeDetailStep && (
            <Stack spacing={2}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: activeDetailStep.linkedType === 'schedule'
                    ? isDark ? 'rgba(139, 92, 246, 0.1)' : '#f5f3ff'
                    : isDark ? 'rgba(37, 99, 235, 0.1)' : '#eff6ff',
                  border: `1px solid ${
                    activeDetailStep.linkedType === 'schedule' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(37, 99, 235, 0.2)'
                  }`,
                }}
              >
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a', mb: 0.5 }}>
                  {activeDetailStep.title}
                </Typography>
                {activeDetailStep.description && (
                  <Typography sx={{ fontSize: 12.5, color: isDark ? '#cbd5e1' : '#475569' }}>
                    {activeDetailStep.description}
                  </Typography>
                )}
              </Box>

              <Box sx={{ p: 2, borderRadius: '16px', bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <Stack spacing={1.5}>
                  {/* Due date if non-daily */}
                  {!(
                    activeDetailStep.recurrence?.type === 'daily' ||
                    activeDetailStep.description?.toLowerCase().includes('daily') ||
                    activeDetailStep.title.toLowerCase().includes('daily')
                  ) && activeDetailStep.endDate && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                        Due Date: {formatDate(activeDetailStep.endDate)}
                      </Typography>
                    </Box>
                  )}

                  {/* Recurrence */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EventRepeat sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
                      Recurrence:{' '}
                      {activeDetailStep.recurrence?.type
                        ? activeDetailStep.recurrence.type.charAt(0).toUpperCase() + activeDetailStep.recurrence.type.slice(1)
                        : activeDetailStep.description?.toLowerCase().includes('daily')
                        ? 'Daily'
                        : 'Single Event'}
                    </Typography>
                  </Box>

                  {/* Completion History Count */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>
                      Completion History:
                    </Typography>
                    <Chip
                      label={`${(activeDetailStep.completionHistory || []).length} time(s) completed`}
                      size="small"
                      sx={{ fontWeight: 800, bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: 11 }}
                    />
                  </Box>
                </Stack>
              </Box>

              {/* Status Toggle Button in Dialog */}
              <Button
                variant="contained"
                fullWidth
                onClick={() => handleToggleStatus(activeDetailStep)}
                disabled={
                  activeDetailStep.closed ||
                  ((activeDetailStep.recurrence?.type === 'daily' ||
                    activeDetailStep.description?.toLowerCase().includes('daily') ||
                    activeDetailStep.title.toLowerCase().includes('daily')) &&
                    isToday(activeDetailStep.lastCompletedAt))
                }
                sx={{
                  py: 1.2,
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: 13,
                  textTransform: 'none',
                  bgcolor: activeDetailStep.status === GoalStepStatus.COMPLETED ? '#475569' : '#10b981',
                  '&:hover': { bgcolor: activeDetailStep.status === GoalStepStatus.COMPLETED ? '#334155' : '#059669' },
                }}
              >
                {(activeDetailStep.recurrence?.type === 'daily' ||
                  activeDetailStep.description?.toLowerCase().includes('daily') ||
                  activeDetailStep.title.toLowerCase().includes('daily')) &&
                isToday(activeDetailStep.lastCompletedAt)
                  ? '✓ Done Today (Unlocks Tomorrow)'
                  : activeDetailStep.status === GoalStepStatus.COMPLETED
                  ? 'Reopen Milestone'
                  : 'Mark as Completed'}
              </Button>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setActiveDetailStep(null)} variant="outlined" color="inherit" fullWidth sx={{ borderRadius: '12px', fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
