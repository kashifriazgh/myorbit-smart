'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, IconButton,
  Switch, Divider,
} from '@mui/material';
import { Close, WhatsApp } from '@mui/icons-material';
import { GoalTracker, TrackerFrequency, TrackerCheckIn } from '../../lib/interface';

// ─── Constants ────────────────────────────────────────────────────────────────

const FREQ_OPTIONS: { value: TrackerFrequency; label: string; days: number }[] = [
  { value: 'daily', label: 'Daily', days: 1 },
  { value: 'every2days', label: 'Every 2 days', days: 2 },
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'biweekly', label: 'Biweekly', days: 14 },
  { value: 'monthly', label: 'Monthly', days: 30 },
];

const PERIOD_PREFIX: Record<TrackerFrequency, string> = {
  daily: 'D', every2days: 'D', weekly: 'W', biweekly: 'BW', monthly: 'M',
};

function suggestFrequency(durationDays: number): TrackerFrequency {
  if (durationDays <= 14) return 'daily';
  if (durationDays <= 60) return 'weekly';
  if (durationDays <= 120) return 'biweekly';
  return 'monthly';
}

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function generateCheckIns(
  startDate: string,
  freq: TrackerFrequency,
  totalCheckIns: number,
  intervalDays: number,
): TrackerCheckIn[] {
  const prefix = PERIOD_PREFIX[freq];
  return Array.from({ length: totalCheckIns }, (_, i) => {
    const d = new Date(startDate + 'T00:00:00');
    d.setDate(d.getDate() + i * intervalDays);
    return {
      id: genId(),
      period: `${prefix}${i + 1}`,
      scheduledDate: d.toISOString().split('T')[0],
      completed: false,
    };
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  goal: {
    title: string;
    dueDate?: string;       // YYYY-MM-DD
    overallTargetValue?: number;
    overallTargetUnit?: string;
  };
  activityVerb?: string;
  verb?: string;
  suggestedUnit?: string;
  typeColor: string;
  isDark: boolean;
  onConfirm: (tracker: GoalTracker) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateTrackerModal({
  open,
  onClose,
  goal,
  activityVerb,
  verb,
  suggestedUnit,
  typeColor,
  isDark,
  onConfirm,
}: Props) {
  const today = new Date().toISOString().split('T')[0];
  const dueDate = goal.dueDate ?? today;
  const hasTarget = !!goal.overallTargetValue && goal.overallTargetValue > 0;
  const totalTarget = goal.overallTargetValue ?? 0;
  const unit = goal.overallTargetUnit || suggestedUnit || '';

  const durationDays = useMemo(() => {
    const diff = new Date(dueDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime();
    return Math.max(1, Math.ceil(diff / 86_400_000));
  }, [dueDate, today]);

  const defaultFreq = useMemo(() => suggestFrequency(durationDays), [durationDays]);

  const [step, setStep] = useState(1);
  const [freq, setFreq] = useState<TrackerFrequency>(defaultFreq);
  const [customPerCheckIn, setCustomPerCheckIn] = useState('');
  const [whatsapp, setWhatsapp] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedFreqObj = FREQ_OPTIONS.find(f => f.value === freq)!;
  const totalCheckIns = Math.max(1, Math.floor(durationDays / selectedFreqObj.days));
  const autoPerCheckIn = hasTarget ? Math.ceil(totalTarget / totalCheckIns) : 1;
  const perCheckIn = customPerCheckIn !== '' ? Number(customPerCheckIn) : autoPerCheckIn;
  const estimatedTotal = perCheckIn * totalCheckIns;

  const bg = isDark ? '#1e293b' : '#ffffff';
  const surfaceBg = isDark ? '#0f172a' : '#f8fafc';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1a1a1a';
  const textMuted = isDark ? '#64748b' : '#94a3b8';

  const handleClose = () => {
    setStep(1);
    setFreq(defaultFreq);
    setCustomPerCheckIn('');
    setWhatsapp(false);
    setSaving(false);
    onClose();
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const checkIns = generateCheckIns(today, freq, totalCheckIns, selectedFreqObj.days);
      const tracker: GoalTracker = {
        frequency: freq,
        targetPerCheckIn: perCheckIn,
        unit,
        totalTarget,
        totalCheckIns,
        startDate: today,
        dueDate,
        checkIns,
        whatsappReminder: whatsapp,
      };
      await onConfirm(tracker);
      handleClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Step dot indicator
  const StepDots = () => (
    <Box display="flex" gap={0.75}>
      {[1, 2, 3].map(s => (
        <Box key={s} sx={{
          width: 8, height: 8, borderRadius: '50%',
          background: s === step ? typeColor : s < step ? `${typeColor}66` : borderColor,
          transition: 'background 0.2s',
        }} />
      ))}
    </Box>
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth PaperProps={{
      sx: { background: bg, borderRadius: '20px', border: `1px solid ${borderColor}` },
    }}>
      {/* Header */}
      <DialogTitle sx={{ pb: 0 }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: textPrimary }}>Create tracker</Typography>
            <Typography sx={{ fontSize: 12, color: textMuted, mt: '2px' }}>
              {goal.title}{hasTarget ? ` · ${totalTarget} ${unit}` : ''}{goal.dueDate ? ` · due ${new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <StepDots />
            <IconButton size="small" onClick={handleClose} sx={{ color: textMuted }}><Close fontSize="small" /></IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <Divider sx={{ mt: 1.5, borderColor: borderColor }} />

      <DialogContent sx={{ pt: 2 }}>
        {/* ── STEP 1: Frequency ── */}
        {step === 1 && (
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: textMuted, letterSpacing: '.08em', textTransform: 'uppercase', mb: 0.5 }}>
              Step 1 of 3 · Check-in Frequency
            </Typography>
            <Typography sx={{ fontSize: 14, color: textPrimary, mb: 2 }}>
              {activityVerb && !activityVerb.toLowerCase().includes('for') && !activityVerb.toLowerCase().includes('to')
                ? `How often will you check in to ${activityVerb.toLowerCase()}?`
                : 'How often will you check in to track your progress?'}
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {FREQ_OPTIONS.map(opt => {
                const selected = freq === opt.value;
                return (
                  <Box
                    key={opt.value}
                    onClick={() => setFreq(opt.value)}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      px: 2, py: 1.5, borderRadius: '12px', cursor: 'pointer',
                      border: `1.5px solid ${selected ? typeColor : borderColor}`,
                      background: selected ? `${typeColor}0d` : 'transparent',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: typeColor, background: `${typeColor}08` },
                    }}
                  >
                    <Typography sx={{ fontSize: 14, color: textPrimary, fontWeight: selected ? 600 : 400 }}>{opt.label}</Typography>
                    <Box sx={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: `2px solid ${selected ? typeColor : borderColor}`,
                      background: selected ? typeColor : 'transparent',
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* ── STEP 2: Per-check-in target ── */}
        {step === 2 && (
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: textMuted, letterSpacing: '.08em', textTransform: 'uppercase', mb: 0.5 }}>
              Step 2 of 3 · {hasTarget ? 'Target per check-in' : 'Check-in setup'}
            </Typography>
            <Typography sx={{ fontSize: 14, color: textPrimary, mb: 2 }}>
              {hasTarget
                ? (verb
                  ? `How many ${unit} will you ${verb.toLowerCase()} ${selectedFreqObj.label.toLowerCase()}?`
                  : `How much ${unit} per ${selectedFreqObj.label.toLowerCase()} check-in?`)
                : (verb
                  ? `Confirm your ${selectedFreqObj.label.toLowerCase()} ${verb.toLowerCase()} schedule.`
                  : 'Confirm your check-in schedule.')}
            </Typography>

            {/* Stats preview */}
            <Box sx={{ background: surfaceBg, borderRadius: '12px', p: 2, mb: 2 }}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography sx={{ fontSize: 12, color: textMuted }}>Total check-ins</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: textPrimary, fontFamily: 'monospace' }}>{totalCheckIns}</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography sx={{ fontSize: 12, color: textMuted }}>Frequency</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: textPrimary }}>{selectedFreqObj.label}</Typography>
              </Box>
              {hasTarget && (
                <>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography sx={{ fontSize: 12, color: textMuted }}>Auto calculated / check-in</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: typeColor, fontFamily: 'monospace' }}>
                      {autoPerCheckIn} {unit}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 1, borderColor: borderColor }} />
                  <Box display="flex" justifyContent="space-between">
                    <Typography sx={{ fontSize: 12, color: textMuted }}>Estimated total</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: estimatedTotal >= totalTarget ? '#10b981' : '#f59e0b', fontFamily: 'monospace' }}>
                      {estimatedTotal} {unit}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>

            {hasTarget && (
              <TextField
                label={`Override per check-in (${unit})`}
                type="number"
                value={customPerCheckIn}
                onChange={e => setCustomPerCheckIn(e.target.value)}
                placeholder={String(autoPerCheckIn)}
                size="small"
                fullWidth
                helperText="Leave blank to use auto-calculated value"
                InputProps={{ inputProps: { min: 0 } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
            )}
          </Box>
        )}

        {/* ── STEP 3: Summary + WhatsApp ── */}
        {step === 3 && (
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: textMuted, letterSpacing: '.08em', textTransform: 'uppercase', mb: 0.5 }}>
              Step 3 of 3 · Summary
            </Typography>
            <Typography sx={{ fontSize: 14, color: textPrimary, mb: 2 }}>Review your tracker setup.</Typography>

            <Box sx={{ background: surfaceBg, borderRadius: '14px', p: 2, mb: 2, border: `1.5px solid ${typeColor}30` }}>
              {[
                ['Goal', goal.title],
                ['Frequency', selectedFreqObj.label],
                ...(hasTarget ? [['Per check-in', `${perCheckIn} ${unit}`]] : []),
                ['Total check-ins', String(totalCheckIns)],
                ...(hasTarget ? [['Estimated total', `${estimatedTotal} ${unit}`]] : []),
                ['Start date', today],
                ['End date', dueDate],
              ].map(([label, value]) => (
                <Box key={label} display="flex" justifyContent="space-between" mb={1}>
                  <Typography sx={{ fontSize: 12, color: textMuted }}>{label}</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>{value}</Typography>
                </Box>
              ))}
            </Box>

            {/* WhatsApp reminder */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              background: whatsapp ? '#dcfce7' : surfaceBg,
              borderRadius: '12px', px: 2, py: 1.5,
              border: `1.5px solid ${whatsapp ? '#22c55e' : borderColor}`,
              transition: 'all 0.2s',
            }}>
              <WhatsApp sx={{ color: '#25D366', fontSize: 22, flexShrink: 0 }} />
              <Box flex={1}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>WhatsApp Reminder</Typography>
                <Typography sx={{ fontSize: 11, color: textMuted }}>Get check-in reminders on WhatsApp</Typography>
              </Box>
              <Switch
                size="small"
                checked={whatsapp}
                onChange={e => setWhatsapp(e.target.checked)}
                sx={{ '& .MuiSwitch-thumb': { background: whatsapp ? '#22c55e' : '#94a3b8' } }}
              />
            </Box>
            {whatsapp && (
              <Typography sx={{ fontSize: 11, color: '#16a34a', mt: 1, textAlign: 'center' }}>
                ✓ Reminder integration coming soon — we&apos;ll notify you when it&apos;s live!
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 0, gap: 1 }}>
        {step > 1 && (
          <Button onClick={() => setStep(s => s - 1)} sx={{ textTransform: 'none', color: textMuted, borderRadius: '10px' }}>
            Back
          </Button>
        )}
        <Box flex={1} />
        {step < 3 ? (
          <Button
            variant="contained"
            onClick={() => setStep(s => s + 1)}
            disabled={step === 1 && !freq}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: '10px',
              background: typeColor, color: '#fff', px: 3,
              '&:hover': { background: typeColor, opacity: 0.88 },
            }}
          >
            Next →
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={saving}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: '10px',
              background: typeColor, color: '#fff', px: 3,
              '&:hover': { background: typeColor, opacity: 0.88 },
            }}
          >
            {saving ? 'Creating…' : 'Create Tracker'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
