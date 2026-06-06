'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import {
  DeleteOutline,
  Lock,
  CheckCircle,
  Close as CloseIcon,
} from '@mui/icons-material';
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
  if (!value) return 'Not set';
  const date =
    value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface MilestoneDetailSheetProps {
  open: boolean;
  step: GoalStep | null;
  goalId: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function MilestoneDetailSheet({
  open,
  step,
  goalId,
  onClose,
  onUpdate,
}: MilestoneDetailSheetProps) {
  const { updateStepStatus, updateGoalStep, deleteGoalStep } = useGoals();
  const { theme } = useCustomTheme();
  const [statusValue, setStatusValue] = useState<GoalStepStatus>(
    GoalStepStatus.NOT_STARTED,
  );
  const [weight, setWeight] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isDark = theme?.mode === 'dark';

  const getFieldSx = () => ({
    '& .MuiOutlinedInput-root': {
      borderRadius: '16px',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff',
      color: isDark ? '#f1f5f9' : '#0f172a',
      '& fieldset': {
        borderColor: isDark ? '#334155' : '#e2e8f0',
      },
      '&:hover fieldset': {
        borderColor: '#6366f1',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#6366f1',
      },
    },
    '& .MuiInputLabel-root': {
      color: isDark ? '#94a3b8' : '#6b7280',
      '&.Mui-focused': {
        color: '#6366f1',
      },
    },
    '& .MuiInputBase-input': {
      color: isDark ? '#f1f5f9' : '#0f172a',
    },
  });
  const statusMeta =
    step && step.status && STATUS_META[step.status]
      ? STATUS_META[step.status]
      : STATUS_META[GoalStepStatus.NOT_STARTED];
  const completed = step?.status === GoalStepStatus.COMPLETED;
  const closed = step?.closed === true;

  React.useEffect(() => {
    if (!step) return;
    setStatusValue(step.status);
    setWeight(step.weight ?? 1);
    setNotes(step.description || '');
  }, [step]);

  const detailRows = useMemo(
    () => [
      { label: 'Due date', value: formatDate(step?.endDate) },
      {
        label: 'Weight',
        value: typeof step?.weight === 'number' ? `${step?.weight}` : '—',
      },
      {
        label: 'Target',
        value:
          step?.targetValue != null
            ? `${step.targetValue} ${step.unit ?? ''}`
            : '—',
      },
      { label: 'Start', value: formatDate(step?.startDate) },
    ],
    [step],
  );

  const handleToggleComplete = async () => {
    if (!step || closed) return;
    setSaving(true);
    try {
      const nextStatus = completed
        ? GoalStepStatus.IN_PROGRESS
        : GoalStepStatus.COMPLETED;
      await updateStepStatus(goalId, step.id, nextStatus);
      onUpdate?.();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const handleSaveDetails = async () => {
    if (!step || closed || completed) return;
    setSaving(true);
    try {
      // Persist descriptive updates and weight first (include status to avoid overwrites)
      const updates: Partial<GoalStep> = {
        description: notes.trim() || undefined,
        weight,
      };
      if (statusValue !== step.status) updates.status = statusValue;

      await updateGoalStep(goalId, step.id, updates);

      // If the status was changed to completed, ensure completionRecord is set
      if (
        statusValue !== step.status &&
        statusValue === GoalStepStatus.COMPLETED
      ) {
        await updateStepStatus(goalId, step.id, GoalStepStatus.COMPLETED);
      }
      onUpdate?.();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseStep = async () => {
    if (!step || closed) return;
    setSaving(true);
    try {
      // Mark step closed and completed together to avoid race conditions
      await updateGoalStep(goalId, step.id, {
        closed: true,
        status: GoalStepStatus.COMPLETED,
        description: notes.trim() || undefined,
        weight,
      });
      // Ensure completionRecord is populated
      await updateStepStatus(goalId, step.id, GoalStepStatus.COMPLETED);
      onUpdate?.();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  const handleDeleteStep = async () => {
    if (!step || closed || completed) return;
    setSaving(true);
    try {
      await deleteGoalStep(goalId, step.id);
      onUpdate?.();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  if (!step) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: '24px',
          overflow: 'hidden',
          bgcolor: isDark ? '#0f172a' : '#ffffff',
          color: isDark ? '#f1f5f9' : '#0f172a',
          backgroundImage: 'none',
          border: `1px solid ${isDark ? '#334155' : 'transparent'}`,
          boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.5)' : undefined,
        },
      }}
    >
      <DialogTitle
        sx={{ px: 3, pt: 3, pb: 1.5, fontWeight: 700, position: 'relative' }}
      >
        {step.title}
        <Box sx={{ position: 'absolute', right: 12, top: 12 }}>
          <Button
            onClick={onClose}
            aria-label="Close modal"
            size="small"
            sx={{ minWidth: 32, p: 0.5 }}
          >
            <CloseIcon fontSize="small" />
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            mb: 2,
          }}
        >
          <Chip
            label={statusMeta.label}
            sx={{
              background: statusMeta.bg,
              color: statusMeta.color,
              fontWeight: 700,
            }}
          />
          {step.description && (
            <Typography
              sx={{ fontSize: 13, color: isDark ? '#cbd5e1' : '#475569' }}
            >
              {step.description}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 2,
            mb: 2,
          }}
        >
          {detailRows.map((row) => (
            <Box key={row.label}>
              <Typography
                sx={{
                  fontSize: 10,
                  color: isDark ? '#64748b' : '#8b94a6',
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                }}
              >
                {row.label}
              </Typography>
              <Typography
                sx={{
                  mt: 0.5,
                  fontSize: 13,
                  color: isDark ? '#f8fafc' : '#111827',
                  fontWeight: 600,
                }}
              >
                {row.value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ borderColor: isDark ? '#334155' : '#e2e8f0', mb: 2 }} />

        <FormControl fullWidth sx={{ mb: 2, ...getFieldSx() }}>
          <InputLabel id="step-status-label">Status</InputLabel>
          <Select
            labelId="step-status-label"
            value={statusValue}
            label="Status"
            onChange={(event) =>
              setStatusValue(event.target.value as GoalStepStatus)
            }
            disabled={closed}
            MenuProps={{
              PaperProps: {
                sx: {
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                },
              },
            }}
          >
            {Object.entries(STATUS_META).map(([statusKey, statusData]) => (
              <MenuItem key={statusKey} value={statusKey as GoalStepStatus}>
                {statusData.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          value={weight}
          onChange={(event) => {
            const value = Number(event.target.value);
            setWeight(
              Number.isNaN(value) ? 1 : Math.max(1, Math.min(10, value)),
            );
          }}
          label="Weight (1-10, default 1)"
          type="number"
          inputProps={{ min: 1, max: 10 }}
          fullWidth
          sx={{ mb: 2, ...getFieldSx() }}
        />

        <TextField
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          multiline
          minRows={3}
          placeholder="Update milestone notes"
          fullWidth
          variant="outlined"
          sx={{ mb: 2, ...getFieldSx() }}
        />

        {/* completion note and summary removed — editing locked for completed/closed items */}
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          pt: 0,
          display: 'flex',
          gap: 1,
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
        }}
      >
        <Button
          onClick={handleSaveDetails}
          disabled={saving || closed || completed}
          variant="contained"
          fullWidth
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          Save changes
        </Button>
        {!closed && (
          <Button
            onClick={handleCloseStep}
            disabled={saving}
            startIcon={<Lock />}
            variant="contained"
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              background: isDark ? '#f59e0b' : '#f59e0b',
              color: isDark ? '#0f172a' : '#111827',
              '&:hover': { opacity: 0.92 },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Close milestone
          </Button>
        )}
        {!closed && !completed && (
          <Button
            onClick={handleDeleteStep}
            disabled={saving}
            startIcon={<DeleteOutline />}
            variant="outlined"
            color="error"
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderColor: isDark ? 'rgba(239,68,68,0.32)' : undefined,
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Delete
          </Button>
        )}

        {completed && !closed && (
          <Button
            onClick={handleToggleComplete}
            disabled={saving}
            variant="outlined"
            startIcon={<CheckCircle />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Reopen step
          </Button>
        )}

        {closed && (
          <Button
            disabled
            startIcon={<Lock />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              background: isDark ? '#334155' : '#e5e7eb',
              color: isDark ? '#cbd5e1' : '#475569',
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Closed (locked)
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
