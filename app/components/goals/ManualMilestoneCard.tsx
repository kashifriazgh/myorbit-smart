'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  Flag,
  CheckCircle as CheckCircle2,
  RadioButtonUnchecked as Circle,
  TrendingUp,
  Close as CloseIcon,
  Add as PlusIcon,
} from '@mui/icons-material';
import { GoalStep, GoalStepStatus, StepCheckIn } from '../../lib/interface';
import { useGoals } from '../../lib/context/GoalsContext';
import { useCustomTheme } from '../../lib/context/themeContext';

function formatDate(val: unknown): string {
  if (!val) return '';
  let date: Date;
  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    date = (val as { toDate: () => Date }).toDate();
  } else if (typeof val === 'object' && val !== null && 'seconds' in val) {
    date = new Date((val as { seconds: number }).seconds * 1000);
  } else {
    date = new Date(val as string | number);
  }
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStatus(step: GoalStep) {
  const today = new Date();
  const start = step.startDate ? new Date(step.startDate as unknown as string | number) : null;
  const end = step.endDate ? new Date(step.endDate as unknown as string | number) : null;

  const currentVal = step.actualValue ?? 0;
  const targetVal = step.targetValue ?? 0;

  const isDone =
    step.status === GoalStepStatus.COMPLETED ||
    (step.progressMode === 'progressive' &&
      (step.direction === 'down'
        ? currentVal <= targetVal && targetVal > 0
        : currentVal >= targetVal && targetVal > 0));

  if (isDone) return { label: 'Completed', tone: 'emerald' as const };
  if (start && !isNaN(start.getTime()) && today < start) return { label: 'Upcoming', tone: 'slate' as const };
  if (end && !isNaN(end.getTime()) && today > end) return { label: 'Overdue', tone: 'amber' as const };
  return { label: 'In progress', tone: 'teal' as const };
}

const TONE_META = {
  emerald: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' },
  teal: { bg: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', border: '1px solid rgba(20, 184, 166, 0.3)' },
  amber: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' },
  slate: { bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.3)' },
};

interface ManualMilestoneCardProps {
  goalId: string;
  step: GoalStep;
  onStepsChange?: () => void;
}

export default function ManualMilestoneCard({
  goalId,
  step,
  onStepsChange,
}: ManualMilestoneCardProps) {
  const { updateStepStatus, updateGoalStep } = useGoals();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [historyOpen, setHistoryOpen] = useState(false);
  const [newValueInput, setNewValueInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  const statusMeta = getStatus(step);
  const toneStyle = TONE_META[statusMeta.tone];

  const isCompleted = step.status === GoalStepStatus.COMPLETED;
  const isProgressive = step.progressMode === 'progressive';

  const currentVal = step.actualValue ?? 0;
  const targetVal = step.targetValue ?? 0;
  const unit = step.unit || 'units';

  const pct = targetVal > 0
    ? step.direction === 'down'
      ? Math.min(100, Math.max(0, Math.round(((targetVal * 2 - currentVal) / targetVal) * 100)))
      : Math.min(100, Math.max(0, Math.round((currentVal / targetVal) * 100)))
    : 0;

  const startStr = formatDate(step.startDate);
  const endStr = formatDate(step.endDate);
  const dateLabel = startStr && endStr ? `${startStr} – ${endStr}` : startStr ? `Started ${startStr}` : endStr ? `Due ${endStr}` : 'No deadline';

  const handleToggleBinaryStatus = async () => {
    if (step.closed) return;
    const nextStatus = isCompleted ? GoalStepStatus.IN_PROGRESS : GoalStepStatus.COMPLETED;
    const nowIso = new Date().toISOString();
    await updateStepStatus(goalId, step.id, nextStatus);
    await updateGoalStep(goalId, step.id, {
      lastCompletedAt: nextStatus === GoalStepStatus.COMPLETED ? nowIso : step.lastCompletedAt,
    });
    onStepsChange?.();
  };

  const handleAddCheckIn = async () => {
    const num = Number(newValueInput);
    if (isNaN(num)) return;
    setSubmittingLog(true);

    try {
      const nowIso = new Date().toISOString();
      const newCheckIn: StepCheckIn = {
        id: 'ci_' + Date.now(),
        date: new Date(),
        value: num,
        note: noteInput.trim() || undefined,
      };

      const existingCheckIns = Array.isArray(step.checkIns) ? [...step.checkIns] : [];
      existingCheckIns.push(newCheckIn);

      const isTargetReached = step.direction === 'down' ? num <= targetVal : num >= targetVal;
      const nextStatus = isTargetReached ? GoalStepStatus.COMPLETED : GoalStepStatus.IN_PROGRESS;

      await updateGoalStep(goalId, step.id, {
        actualValue: num,
        checkIns: existingCheckIns,
        status: nextStatus,
        lastCompletedAt: isTargetReached ? nowIso : step.lastCompletedAt,
      });
      await updateStepStatus(goalId, step.id, nextStatus);

      setNewValueInput('');
      setNoteInput('');
      onStepsChange?.();
    } catch (err) {
      console.error('Error logging checkin:', err);
    } finally {
      setSubmittingLog(false);
    }
  };

  return (
    <Box
      sx={{
        borderRadius: '20px',
        border: `1.5px solid ${isDark ? 'rgba(20, 184, 166, 0.3)' : '#99f6e4'}`,
        bgcolor: isDark ? 'rgba(15, 23, 42, 0.9)' : '#ffffff',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 16px rgba(20, 184, 166, 0.05)',
      }}
    >
      {/* Header Row */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '14px',
            bgcolor: 'rgba(20, 184, 166, 0.15)',
            border: '1px solid rgba(20, 184, 166, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Flag sx={{ fontSize: 22, color: '#14b8a6' }} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a', leading: 1.3 }}>
              {step.title}
            </Typography>

            <Chip
              label={statusMeta.label}
              size="small"
              sx={{
                height: 22,
                fontSize: 11,
                fontWeight: 800,
                bgcolor: toneStyle.bg,
                color: toneStyle.color,
                border: toneStyle.border,
                px: 0.5,
              }}
            />
          </Box>

          <Typography sx={{ fontSize: 11.5, color: isDark ? '#94a3b8' : '#64748b', mt: 0.5 }}>
            {dateLabel}
          </Typography>
        </Box>
      </Box>

      {/* Binary Card Body */}
      {!isProgressive && (
        <Button
          fullWidth
          onClick={handleToggleBinaryStatus}
          disabled={step.closed}
          startIcon={
            isCompleted ? (
              <CheckCircle2 sx={{ fontSize: 18, color: '#10b981' }} />
            ) : (
              <Circle sx={{ fontSize: 18, color: isDark ? '#64748b' : '#94a3b8' }} />
            )
          }
          sx={{
            justifyContent: 'flex-start',
            textTransform: 'none',
            py: 1.2,
            px: 2,
            borderRadius: '14px',
            fontSize: 13,
            fontWeight: 800,
            bgcolor: isCompleted ? 'rgba(16, 185, 129, 0.12)' : isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
            color: isCompleted ? '#10b981' : isDark ? '#f1f5f9' : '#0f172a',
            border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.3)' : isDark ? '#334155' : '#e2e8f0'}`,
            '&:hover': {
              bgcolor: isCompleted ? 'rgba(16, 185, 129, 0.2)' : isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
            },
          }}
        >
          {isCompleted
            ? `Completed on ${formatDate(step.lastCompletedAt) || 'Today'}`
            : 'Mark as complete'}
        </Button>
      )}

      {/* Progressive Card Body */}
      {isProgressive && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 18, fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a' }}>
              {currentVal}{' '}
              <Typography component="span" sx={{ fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', fontWeight: 600 }}>
                / {targetVal} {unit}
              </Typography>
            </Typography>
          </Box>

          <Box>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 7,
                borderRadius: 4,
                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #14b8a6 0%, #10b981 100%)',
                },
              }}
            />
            <Typography sx={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', mt: 0.75, fontWeight: 700 }}>
              {pct}% there
            </Typography>
          </Box>

          <Button
            size="small"
            onClick={() => setHistoryOpen(true)}
            startIcon={<TrendingUp sx={{ fontSize: 15 }} />}
            sx={{
              alignSelf: 'flex-start',
              textTransform: 'none',
              fontSize: 12,
              fontWeight: 700,
              color: '#14b8a6',
              borderRadius: '10px',
              px: 1.5,
              bgcolor: 'rgba(20, 184, 166, 0.1)',
              '&:hover': { bgcolor: 'rgba(20, 184, 166, 0.2)' },
            }}
          >
            Log update
          </Button>
        </Box>
      )}

      {/* Log Update Dialog */}
      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1,
            maxWidth: 420,
            width: '100%',
            bgcolor: isDark ? '#0a1523' : '#ffffff',
          },
        }}
      >
        <DialogTitle sx={{ p: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
              {step.title}
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 900, color: isDark ? '#f8fafc' : '#0f172a' }}>
              {currentVal}
              <Typography component="span" sx={{ fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', fontWeight: 600 }}>
                {' '}/ {targetVal} {unit}
              </Typography>
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setHistoryOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2, pt: 1 }}>
          <Stack spacing={2}>
            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
              <Stack spacing={1.5}>
                <TextField
                  type="number"
                  placeholder={`New value (${unit})`}
                  value={newValueInput}
                  onChange={(e) => setNewValueInput(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  placeholder="Note (optional)"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  fullWidth
                  size="small"
                />
                <Button
                  onClick={handleAddCheckIn}
                  disabled={submittingLog || !newValueInput.trim()}
                  variant="contained"
                  startIcon={<PlusIcon />}
                  sx={{
                    borderRadius: '12px',
                    py: 1,
                    fontWeight: 800,
                    textTransform: 'none',
                    bgcolor: '#14b8a6',
                    '&:hover': { bgcolor: '#0d9488' },
                  }}
                >
                  Add entry
                </Button>
              </Stack>
            </Box>

            {/* History CheckIns */}
            <Typography sx={{ fontSize: 12, fontWeight: 750, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Progress Logs
            </Typography>

            <Box sx={{ maxHeight: 220, overflowY: 'auto' }}>
              {(!step.checkIns || step.checkIns.length === 0) ? (
                <Typography sx={{ fontSize: 12.5, color: isDark ? '#64748b' : '#94a3b8', textAlign: 'center', py: 2 }}>
                  No progress updates logged yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {[...step.checkIns].reverse().map((ci, idx) => (
                    <Box
                      key={ci.id || idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        borderRadius: '12px',
                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                          {ci.note || 'Progress update'}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' }}>
                          {formatDate(ci.date) || 'Logged entry'}
                        </Typography>
                      </Box>

                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#14b8a6' }}>
                        {ci.value} {unit}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setHistoryOpen(false)} variant="outlined" color="inherit" fullWidth sx={{ borderRadius: '12px', fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
