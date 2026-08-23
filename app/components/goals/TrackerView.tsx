'use client';

import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Button, IconButton, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Tooltip,
} from '@mui/material';
import {
  Close, CheckCircle, RadioButtonUnchecked,
  DeleteOutline,
} from '@mui/icons-material';
import { GoalTracker, TrackerCheckIn } from '../../lib/interface';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const today = new Date().toISOString().split('T')[0];

function calcStreak(checkIns: TrackerCheckIn[]): number {
  const sorted = [...checkIns].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  let streak = 0;
  for (const c of sorted) {
    if (c.scheduledDate > today) continue;
    if (c.completed) streak++;
    else break;
  }
  return streak;
}

// ─── Check-in Dialog ──────────────────────────────────────────────────────────

interface CheckInDialogProps {
  open: boolean;
  onClose: () => void;
  checkIn: TrackerCheckIn;
  tracker: GoalTracker;
  verb?: string;
  activityVerb?: string;
  typeColor: string;
  isDark: boolean;
  onSave: (updated: TrackerCheckIn) => Promise<void>;
}

function CheckInDialog({
  open,
  onClose,
  checkIn,
  tracker,
  verb,

  typeColor,
  isDark,
  onSave,
}: CheckInDialogProps) {
  const [value, setValue] = useState(String(checkIn.value ?? ''));
  const [note, setNote] = useState(checkIn.note ?? '');
  const [saving, setSaving] = useState(false);
  const hasUnit = !!tracker.unit;

  // Quick preset values from previous check-ins
  const recentValues = useMemo(() => {
    const vals = tracker.checkIns
      .filter(c => c.completed && typeof c.value === 'number')
      .slice(-3)
      .map(c => c.value as number);
    const presets = new Set([tracker.targetPerCheckIn, ...vals]);
    return [...presets].filter(Boolean).slice(0, 4);
  }, [tracker]);

  const bg = isDark ? '#1e293b' : '#ffffff';
  const textPrimary = isDark ? '#f1f5f9' : '#1a1a1a';
  const textMuted = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...checkIn,
        value: hasUnit ? (value !== '' ? Number(value) : undefined) : undefined,
        note: note.trim() || undefined,
        completed: true,
        completedAt: today,
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{
      sx: { background: bg, borderRadius: '20px', border: `1px solid ${borderColor}` },
    }}>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>Check in</Typography>
            <Typography sx={{ fontSize: 12, color: textMuted }}>
              {checkIn.period}{hasUnit ? ` · target ${tracker.targetPerCheckIn} ${tracker.unit}` : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ color: textMuted }}><Close fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {hasUnit && (
          <Box mb={2}>
            <Typography sx={{ fontSize: 13, color: textPrimary, mb: 1 }}>
              {verb
                ? `How many ${tracker.unit} did you ${verb.toLowerCase()}?`
                : 'How much did you do?'}
            </Typography>
            <Box display="flex" alignItems="center" gap={1.5}>
              <TextField
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                size="small"
                sx={{ width: 100, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 22, fontWeight: 700 } }}
                inputProps={{ min: 0 }}
              />
              <Typography sx={{ fontSize: 14, color: textMuted }}>{tracker.unit}</Typography>
              <Box display="flex" gap={0.75} flexWrap="wrap">
                {recentValues.map(v => (
                  <Box
                    key={v}
                    onClick={() => setValue(String(v))}
                    sx={{
                      px: 1.5, py: 0.5, borderRadius: '8px', cursor: 'pointer',
                      border: `1.5px solid ${value === String(v) ? typeColor : borderColor}`,
                      background: value === String(v) ? `${typeColor}18` : 'transparent',
                      fontSize: 13, fontWeight: 600, color: value === String(v) ? typeColor : textPrimary,
                      transition: 'all 0.15s',
                    }}
                  >
                    {v}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
        <TextField
          label="Quick note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={verb ? `How did the ${verb.toLowerCase()} session go?` : 'How did it go?'}
          multiline rows={3} fullWidth size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 0, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: textMuted, borderRadius: '10px' }}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSave} disabled={saving || (hasUnit && value === '')}
          sx={{
            flex: 1, textTransform: 'none', fontWeight: 700, borderRadius: '10px',
            background: typeColor, color: '#fff',
            '&:hover': { background: typeColor, opacity: 0.88 },
          }}
        >
          {saving ? 'Saving…' : 'Save check-in'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main TrackerView ──────────────────────────────────────────────────────────

interface Props {
  goalId: string;
  goalTitle: string;
  tracker: GoalTracker;
  activityVerb?: string;
  verb?: string;
  progressMode?: 'cumulative' | 'current_value';
  direction?: 'up' | 'down' | null;
  startValue?: number | null;
  typeColor: string;
  isDark: boolean;
  onCheckIn: (updated: TrackerCheckIn) => Promise<void>;
  onRemove: () => void;
}

export default function TrackerView({
  goalTitle: _goalTitle,
  tracker,
  activityVerb,
  verb,
  progressMode,
  direction,
  startValue,
  typeColor,
  isDark,
  onCheckIn,
  onRemove,
}: Props) {
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const bg = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1a1a1a';
  const textMuted = isDark ? '#64748b' : '#94a3b8';

  const { checkIns, unit, totalTarget, totalCheckIns, frequency } = tracker;
  const hasUnit = !!unit;
  const freqLabel = { daily: 'Daily', every2days: 'Every 2 days', weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly' }[frequency];

  // Stats
  const doneCheckIns = useMemo(() => checkIns.filter(c => c.completed), [checkIns]);
  const pastCheckIns = useMemo(() => checkIns.filter(c => c.scheduledDate <= today), [checkIns]);
  const missedCount = pastCheckIns.length - doneCheckIns.length;
  const consistency = pastCheckIns.length > 0 ? Math.round((doneCheckIns.length / pastCheckIns.length) * 100) : 100;
  const remaining = totalCheckIns - doneCheckIns.length;
  const _streak = useMemo(() => calcStreak(checkIns), [checkIns]);

  const actualTotal = hasUnit
    ? doneCheckIns.reduce((s, c) => s + (c.value ?? 0), 0)
    : doneCheckIns.length;

  const sortedDone = useMemo(() => {
    return [...doneCheckIns].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  }, [doneCheckIns]);

  const latestValue = useMemo(() => {
    if (doneCheckIns.length === 0) return startValue ?? 0;
    return sortedDone[0].value ?? startValue ?? 0;
  }, [doneCheckIns, sortedDone, startValue]);

  const progressPct = useMemo(() => {
    if (progressMode === 'current_value') {
      const start = startValue ?? 0;
      const target = totalTarget;
      if (start === target) return 0;
      let pct = 0;
      if (direction === 'down') {
        pct = Math.round(((start - latestValue) / (start - target)) * 100);
      } else {
        pct = Math.round(((latestValue - start) / (target - start)) * 100);
      }
      return Math.max(0, Math.min(100, pct));
    } else {
      const denominator = hasUnit ? totalTarget : totalCheckIns;
      return denominator > 0 ? Math.min(100, Math.round((actualTotal / denominator) * 100)) : 0;
    }
  }, [progressMode, startValue, totalTarget, latestValue, direction, hasUnit, totalCheckIns, actualTotal]);

  const remainingValue = useMemo(() => {
    if (progressMode === 'current_value') {
      if (direction === 'down') {
        return Math.max(0, latestValue - totalTarget);
      } else {
        return Math.max(0, totalTarget - latestValue);
      }
    } else {
      return Math.max(0, totalTarget - actualTotal);
    }
  }, [progressMode, direction, latestValue, totalTarget, actualTotal]);

  // Target check-in (past/today incomplete first, then upcoming future incomplete)
  const targetCheckIn = useMemo(() => {
    const pastOrToday = checkIns.find(c => !c.completed && c.scheduledDate <= today);
    if (pastOrToday) return pastOrToday;
    const future = checkIns.find(c => !c.completed);
    return future ?? null;
  }, [checkIns]);

  const nextIncomplete = useMemo(() => {
    return checkIns.find(c => !c.completed) ?? null;
  }, [checkIns]);

  const isEarlyState = useMemo(() => {
    return !!(targetCheckIn && targetCheckIn.scheduledDate > today);
  }, [targetCheckIn]);

  const recentDone = useMemo(() =>
    [...doneCheckIns].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 5),
    [doneCheckIns]
  );

  const stats = [
    { label: 'Done', value: doneCheckIns.length, sub: 'check-ins', color: '#10b981' },
    { label: 'Missed', value: missedCount, sub: 'check-ins', color: missedCount > 0 ? '#ef4444' : textMuted },
    { label: 'Consistency', value: `${consistency}%`, sub: 'on time', color: typeColor },
    { label: 'Remaining', value: remaining, sub: 'check-ins', color: textPrimary },
  ];

  return (
    <Box>
      {/* ── Header card ── */}
      <Box sx={{
        background: cardBg, borderRadius: '16px',
        border: `1px solid ${borderColor}`, p: 2, mb: 1.5,
      }}>
        <Box display="flex" flexWrap="wrap" justifyContent="space-between" alignItems="center" gap={1.5} mb={0.5}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
              {activityVerb
                ? `${activityVerb.charAt(0).toUpperCase() + activityVerb.slice(1)} (${freqLabel.toLowerCase()})`
                : `${freqLabel} check-in`} · due {fmtDate(tracker.dueDate)}
            </Typography>
          </Box>
          <Box display="flex" flexWrap="wrap" alignItems="center" gap={1}>
            {nextIncomplete && (
              <Typography sx={{ fontSize: 12, fontWeight: 750, color: textMuted, mr: 1 }}>
                Next check-in date is {fmtDate(nextIncomplete.scheduledDate)}
              </Typography>
            )}
            <Button
              variant="contained"
              size="small"
              onClick={() => setCheckInOpen(true)}
              disabled={isEarlyState || !targetCheckIn}
              sx={{
                textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: '10px',
                background: typeColor, color: '#fff', whiteSpace: 'nowrap',
                '&:hover': { background: typeColor, opacity: 0.88 },
              }}
            >
              {!targetCheckIn ? 'Completed' : 'Track progress'}
            </Button>
            {isEarlyState && targetCheckIn && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setCheckInOpen(true)}
                sx={{
                  textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: '10px',
                  borderColor: typeColor, color: typeColor, whiteSpace: 'nowrap',
                  '&:hover': { background: `${typeColor}08`, borderColor: typeColor },
                }}
              >
                Make an early check-in
              </Button>
            )}
            <Tooltip title="Remove tracker">
              <IconButton size="small" onClick={() => setConfirmRemove(true)} sx={{ color: textMuted }}>
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Progress bar */}
        <Box mt={1.5}>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography sx={{ fontSize: 12, color: textMuted }}>Overall progress</Typography>
            {hasUnit && (
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: textPrimary, fontFamily: 'monospace' }}>
                {progressMode === 'current_value'
                  ? `Current: ${latestValue} / Target: ${totalTarget} ${unit}`
                  : `${actualTotal} / ${totalTarget} ${unit}`}
              </Typography>
            )}
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPct}
            sx={{
              height: 8, borderRadius: '99px',
              backgroundColor: isDark ? '#334155' : '#e2e8f0',
              '& .MuiLinearProgress-bar': { background: typeColor, borderRadius: '99px' },
            }}
          />
          <Box display="flex" justifyContent="space-between" mt={0.5}>
            <Typography sx={{ fontSize: 11, color: textMuted }}>{progressPct}% complete</Typography>
            {hasUnit && <Typography sx={{ fontSize: 11, color: textMuted }}>{remainingValue} {unit} remaining</Typography>}
          </Box>
        </Box>
      </Box>

      {/* ── Stats grid ── */}
      <Box display="grid" gridTemplateColumns="1fr 1fr 1fr 1fr" gap={1} mb={1.5}>
        {stats.map(stat => (
          <Box key={stat.label} sx={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '12px', p: '10px 12px' }}>
            <Typography sx={{ fontSize: 10, color: textMuted, textTransform: 'uppercase', letterSpacing: '.05em', mb: '4px' }}>{stat.label}</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: stat.color, fontFamily: 'monospace', lineHeight: 1 }}>{stat.value}</Typography>
            <Typography sx={{ fontSize: 10, color: textMuted, mt: '2px' }}>{stat.sub}</Typography>
          </Box>
        ))}
      </Box>

      {/* ── Check-in timeline ── */}
      <Box sx={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '14px', p: 2, mb: 1.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em', mb: 1.5 }}>
          Check-in history
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
          {checkIns.map(c => {
            const isToday = c.scheduledDate === today;
            const isPast = c.scheduledDate < today;
            const missed = isPast && !c.completed;
            return (
              <Box key={c.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${c.completed ? typeColor : isToday ? typeColor : missed ? '#ef4444' : borderColor}`,
                  background: c.completed ? `${typeColor}20` : isToday ? `${typeColor}10` : missed ? '#fef2f2' : bg,
                  position: 'relative',
                }}>
                  {c.completed ? (
                    <CheckCircle sx={{ fontSize: 18, color: typeColor }} />
                  ) : missed ? (
                    <Close sx={{ fontSize: 14, color: '#ef4444' }} />
                  ) : isToday ? (
                    <RadioButtonUnchecked sx={{ fontSize: 18, color: typeColor }} />
                  ) : (
                    <RadioButtonUnchecked sx={{ fontSize: 18, color: borderColor }} />
                  )}
                </Box>
                <Typography sx={{ fontSize: 9, color: isToday ? typeColor : textMuted, fontWeight: isToday ? 700 : 400 }}>
                  {isToday ? 'Today' : c.period}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ── Recent log ── */}
      {recentDone.length > 0 && (
        <Box sx={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: '14px', p: 2 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '.06em', mb: 1.5 }}>
            Recent log
          </Typography>
          <Box display="flex" flexDirection="column">
            {recentDone.map((c, i) => (
              <Box key={c.id} sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                py: 1, borderBottom: i < recentDone.length - 1 ? `1px solid ${borderColor}` : 'none',
              }}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Box sx={{
                    width: 26, height: 26, borderRadius: '6px', flexShrink: 0,
                    border: `1.5px solid ${typeColor}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckCircle sx={{ fontSize: 14, color: typeColor }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
                      {hasUnit && typeof c.value === 'number' ? `${c.value} ${unit}` : '✓ Completed'} · {c.period}
                    </Typography>
                    {c.note && <Typography sx={{ fontSize: 11, color: textMuted }}>{c.note}</Typography>}
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 11, color: textMuted }}>{c.completedAt ? fmtDate(c.completedAt) : ''}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* ── Check-in dialog ── */}
      {targetCheckIn && (
        <CheckInDialog
          open={checkInOpen}
          onClose={() => setCheckInOpen(false)}
          checkIn={targetCheckIn}
          tracker={tracker}
          verb={verb}
          activityVerb={activityVerb}
          typeColor={typeColor}
          isDark={isDark}
          onSave={onCheckIn}
        />
      )}

      {/* ── Remove confirmation ── */}
      <Dialog open={confirmRemove} onClose={() => setConfirmRemove(false)} maxWidth="xs" fullWidth PaperProps={{
        sx: { background: cardBg, borderRadius: '16px', border: `1px solid ${borderColor}` },
      }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>Remove tracker?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: textMuted }}>
            This will remove the tracker and all check-in history. You can create a new one or switch to milestones.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setConfirmRemove(false)} sx={{ textTransform: 'none', color: textMuted }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => { setConfirmRemove(false); onRemove(); }} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
