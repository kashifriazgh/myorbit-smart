'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, TextField, IconButton,
  Divider, Stack, Chip, CircularProgress
} from '@mui/material';
import { Close, AutoAwesome, ArrowBack } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { Goal } from '../../lib/interface';
import { useAuth } from '@/app/lib/context/userContext';

const CATEGORY_UNITS: Record<string, string[]> = {
  finance: ['PKR', 'USD', 'EUR', '%', 'transactions', 'items'],
  health: ['kg', 'lbs', 'steps', 'minutes', 'hours', 'days', '%'],
  learning: ['minutes', 'hours', 'lessons', 'chapters', 'pages', 'courses'],
  habit: ['days', 'times', 'streak', 'weeks'],
  work: ['tasks', 'hours', 'projects', '%', 'clients'],
  lifestyle: ['days', 'sessions', 'events', 'activities', 'hours'],
  custom: ['sessions', 'tasks', 'hours'],
};

const toDateSafe = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  )
    return (value as { toDate: () => Date }).toDate();
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
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

interface GoalFurnishingDialogProps {
  open: boolean;
  onClose: () => void;
  goal: Goal;
  userName?: string;
  typeColor: string;
  isDark: boolean;
  onConfirm: (furnishedData: {
    progressMode: 'cumulative' | 'current_value';
    direction: 'up' | 'down' | null;
    startValue: number | null;
    trackingMethod: 'tracker' | 'milestones';
    overallTargetValue?: number;
    overallTargetUnit?: string;
    dueDate?: Date;
    title?: string;
    aiVerb?: string;
    aiActivityVerb?: string;
    aiSuggestedUnit?: string;
  }) => Promise<void>;
}

export default function GoalFurnishingDialog({
  open,
  onClose,
  goal,
  userName,
  typeColor,
  isDark,
  onConfirm,
}: GoalFurnishingDialogProps) {
  // ── Setup Clean name ────────────────────────────────────────────────────────
  const capitalizedName = useMemo(() => {
    if (!userName) return 'Friend';
    const clean = userName.split(/[^a-zA-Z]/)[0];
    if (!clean) return 'Friend';
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }, [userName]);

  // ── States ──────────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User Selections & Inputs
  const [selectedTitle, setSelectedTitle] = useState(goal.title);
  const [selectedCategory, setSelectedCategory] = useState(goal.type || '');
  const [selectedUnit, setSelectedUnit] = useState(goal.overallTargetUnit || '');
  const [selectedDueDate, setSelectedDueDate] = useState<string>(
    goal.dueDate ? toDateSafe(goal.dueDate)?.toISOString().split('T')[0] || '' : ''
  );
  const [selectedTargetValue, setSelectedTargetValue] = useState<number | ''>(
    goal.overallTargetValue || ''
  );
  const [selectedProgressMode, setSelectedProgressMode] = useState<'cumulative' | 'current_value'>('cumulative');
  const [selectedStartValue, setSelectedStartValue] = useState<number | ''>('');

  // AI Suggestion Values
  const [aiTitleSuggestion, setAiTitleSuggestion] = useState('');
  const [aiCategorySuggestion, setAiCategorySuggestion] = useState('');
  const [aiUnitSuggestion, setAiUnitSuggestion] = useState('');
  const [aiDueDateSuggestion, setAiDueDateSuggestion] = useState('');
  const [aiTargetValueSuggestion, setAiTargetValueSuggestion] = useState<number | ''>('');
  const [aiTargetLabelSuggestion, setAiTargetLabelSuggestion] = useState('');

  // AI Progress mode details from target refinement step
  const [aiProgressMode, setAiProgressMode] = useState<'cumulative' | 'current_value'>('cumulative');
  const [aiStartValueLabel, setAiStartValueLabel] = useState('');

  // Step 7 Outcomes
  const [aiFrequency, setAiFrequency] = useState('weekly');
  const [aiTrackingMethod, setAiTrackingMethod] = useState<'tracker' | 'milestones'>('milestones');
  const [aiReason, setAiReason] = useState('');
  const [aiVerb, setAiVerb] = useState('');
  const [aiActivityVerb, setAiActivityVerb] = useState('');

  const { onboardingData } = useAuth();

  const userProfileContext = useMemo(() => {
    if (!onboardingData) return null;
    return {
      country: onboardingData.country?.value || '',
      city: onboardingData.city?.value || '',
      profession: onboardingData.profession?.value || '',
      workStyle: onboardingData.workStyle?.value || '',
      peakHours: onboardingData.peakHours?.value || [],
      aiTone: onboardingData.aiTone?.value || 'Friendly',
    };
  }, [onboardingData]);

  const [saving, setSaving] = useState(false);

  // Colors
  const bg = isDark ? '#1e293b' : '#ffffff';
  const surfaceBg = isDark ? '#0f172a' : '#f8fafc';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#1a1a1a';
  const textMuted = isDark ? '#64748b' : '#94a3b8';

  // Fetch Step specific recommendations
  useEffect(() => {
    if (!open) return;

    const fetchSmartNudge = async (action: string, payload: Record<string, unknown>) => {
      const res = await fetch('/api/goals/smart-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userContext: userProfileContext,
          ...payload
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errMsg = errorData.error || `Server error (status ${res.status})`;
        throw new Error(errMsg);
      }
      return res.json();
    };

    const fetchStepDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const clientCurrentDate = new Date().toISOString().split('T')[0];

        if (currentStep === 1) {
          const data = await fetchSmartNudge('refine-title', { title: goal.title });
          setAiTitleSuggestion(data.suggestedTitle || goal.title);
          // Set to AI suggestion automatically
          if (data.suggestedTitle) {
            setSelectedTitle(data.suggestedTitle);
          }
        } else if (currentStep === 2) {
          const data = await fetchSmartNudge('refine-category', { title: selectedTitle, category: goal.type });
          setAiCategorySuggestion(data.suggestedCategory || '');
          setAiUnitSuggestion(data.suggestedUnit || '');

          // Preselect recommended category/unit
          if (data.suggestedCategory) setSelectedCategory(data.suggestedCategory);
          if (data.suggestedUnit) setSelectedUnit(data.suggestedUnit);

          // Auto skip if user selected category is suitable
          if (goal.type && goal.type !== 'custom' && data.suitable) {
            setSelectedCategory(goal.type);
            const units = CATEGORY_UNITS[goal.type] || [];
            setSelectedUnit(goal.overallTargetUnit || data.suggestedUnit || units[0] || '');
            setCurrentStep(3);
          }
        } else if (currentStep === 3) {
          const data = await fetchSmartNudge('refine-due-date', {
            title: selectedTitle,
            category: selectedCategory,
            dueDate: selectedDueDate || null,
            currentDate: clientCurrentDate
          });
          setAiDueDateSuggestion(data.dueDateSuggestion || '');
          // Pre-select suggested target date
          if (data.suggestedDate) {
            setSelectedDueDate(data.suggestedDate);
          }
        } else if (currentStep === 4) {
          const data = await fetchSmartNudge('refine-target-value', {
            title: selectedTitle,
            category: selectedCategory,
            unit: selectedUnit,
            dueDate: selectedDueDate
          });
          setAiTargetValueSuggestion(data.targetValueSuggestion || '');
          setAiTargetLabelSuggestion(data.label || 'Target Value');

          // Progress mode config
          setAiProgressMode(data.progressMode || 'cumulative');
          setAiStartValueLabel(data.startValueLabel || '');

          if (data.targetValueSuggestion) {
            setSelectedTargetValue(Number(data.targetValueSuggestion));
          }
          if (data.progressMode) {
            setSelectedProgressMode(data.progressMode);
          }
        } else if (currentStep === 5) {
          // Concept selection - no API load needed
          setLoading(false);
          return;
        } else if (currentStep === 6) {
          // Starting Value - auto-skip if cumulative
          if (selectedProgressMode === 'cumulative') {
            setCurrentStep(7);
          }
          setLoading(false);
          return;
        } else if (currentStep === 7) {
          const data = await fetchSmartNudge('refine-tracking', {
            title: selectedTitle,
            category: selectedCategory,
            unit: selectedUnit,
            dueDate: selectedDueDate,
            targetValue: selectedTargetValue,
            progressMode: selectedProgressMode,
            startValue: selectedStartValue || null
          });
          setAiFrequency(data.frequency || 'weekly');
          setAiTrackingMethod(data.trackingMethod || 'milestones');
          setAiReason(data.reason || '');
          setAiVerb(data.verb || '');
          setAiActivityVerb(data.activityVerb || '');
        }
      } catch (err) {
        console.error('AI refinement error:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg || 'Suggestions offline. Please proceed manually.');
      } finally {
        setLoading(false);
      }
    };

    fetchStepDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, open]);

  const handleNext = () => {
    if (currentStep === 5) {
      if (selectedProgressMode === 'cumulative') {
        setCurrentStep(7); // Skip step 6
      } else {
        setCurrentStep(6);
      }
    } else if (currentStep < 7) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7);
    } else {
      handleSave();
    }
  };

  const handleBack = () => {
    if (currentStep === 7) {
      if (selectedProgressMode === 'cumulative') {
        setCurrentStep(5); // Skip step 6
      } else {
        setCurrentStep(6);
      }
    } else if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let direction: 'up' | 'down' | null = null;
      if (selectedProgressMode === 'current_value') {
        const start = typeof selectedStartValue === 'number' ? selectedStartValue : 0;
        const target = typeof selectedTargetValue === 'number' ? selectedTargetValue : 0;
        direction = target < start ? 'down' : 'up';
      }

      await onConfirm({
        progressMode: selectedProgressMode,
        direction: direction,
        startValue: selectedProgressMode === 'current_value' ? (typeof selectedStartValue === 'number' ? selectedStartValue : null) : null,
        trackingMethod: aiTrackingMethod,
        overallTargetValue: typeof selectedTargetValue === 'number' ? selectedTargetValue : undefined,
        overallTargetUnit: selectedUnit || undefined,
        dueDate: selectedDueDate ? new Date(selectedDueDate) : undefined,
        title: selectedTitle,
        aiVerb,
        aiActivityVerb,
        aiSuggestedUnit: selectedUnit || undefined,
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const selectDatePreset = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setSelectedDueDate(d.toISOString().split('T')[0]);
  };

  // Step Indicators
  const StepIndicator = () => (
    <Box display="flex" gap={0.75}>
      {[1, 2, 3, 4, 5, 6, 7].map((s) => {
        // Skip step 6 dot if cumulative progress mode is active
        if (s === 6 && selectedProgressMode === 'cumulative') return null;
        return (
          <Box
            key={s}
            sx={{
              width: 7, height: 7, borderRadius: '50%',
              background: s === currentStep ? typeColor : s < currentStep ? `${typeColor}66` : borderColor,
              transition: 'background 0.2s',
            }}
          />
        );
      })}
    </Box>
  );

  return (
    <Dialog open={open} maxWidth="xs" fullWidth PaperProps={{
      sx: { background: bg, borderRadius: '24px', border: `1px solid ${borderColor}`, boxShadow: 24, overflow: 'hidden' },
    }}>
      {/* Header */}
      <DialogTitle sx={{ pb: 1.5, pt: 3.5, px: 3 }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={0.75}>
              <AutoAwesome sx={{ color: typeColor, fontSize: 16 }} />
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: typeColor, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Orbit AI Guide
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 16.5, fontWeight: 800, color: textPrimary, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
              {capitalizedName}, We Have some suggestions for you
            </Typography>
          </Box>
          <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1.5}>
            <IconButton size="small" onClick={onClose} sx={{ color: textMuted, mt: -1, mr: -1 }}><Close fontSize="small" /></IconButton>
            <StepIndicator />
          </Box>
        </Box>
      </DialogTitle>

      <Divider sx={{ mx: 3, borderColor: borderColor }} />

      <DialogContent sx={{ pt: 3, pb: 3, px: 3, minHeight: 225, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}
            >
              <CircularProgress size={36} sx={{ color: typeColor, mb: 2 }} />
              <Typography sx={{ fontSize: 14, color: textMuted, fontWeight: 600 }}>
                Asking Orbit AI...
              </Typography>
            </motion.div>
          ) : (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {error && (
                <Box sx={{ mb: 2, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <Typography sx={{ fontSize: 12, color: '#ef4444', fontWeight: 600, lineHeight: 1.4 }}>
                    ⚠️ Suggestions offline: {error}
                  </Typography>
                </Box>
              )}
              {/* STEP 1: Title Correction */}
              {currentStep === 1 && (
                <Box>
                  <Typography sx={{ fontSize: 17, color: textPrimary, mb: 1, fontWeight: 800 }}>
                    Goal Title ✍️
                  </Typography>
                  <TextField
                    label="Edit Title"
                    value={selectedTitle}
                    onChange={(e) => setSelectedTitle(e.target.value)}
                    fullWidth
                    sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                  <Stack gap={1.5}>
                    <Box
                      onClick={() => setSelectedTitle(goal.title)}
                      sx={{
                        cursor: 'pointer', p: 1.75, borderRadius: '14px', border: `1.5px solid ${selectedTitle === goal.title ? typeColor : borderColor}`,
                        background: selectedTitle === goal.title ? `${typeColor}0a` : 'transparent',
                        transition: 'all 0.2s', '&:hover': { borderColor: typeColor }
                      }}
                    >
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: textMuted, mb: 0.25, textTransform: 'uppercase' }}>
                        Use original
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: textPrimary }}>
                        {goal.title}
                      </Typography>
                    </Box>

                    {aiTitleSuggestion && aiTitleSuggestion !== goal.title && (
                      <Box
                        onClick={() => setSelectedTitle(aiTitleSuggestion)}
                        sx={{
                          cursor: 'pointer', p: 1.75, borderRadius: '14px', border: `1.5px solid ${selectedTitle === aiTitleSuggestion ? typeColor : borderColor}`,
                          background: selectedTitle === aiTitleSuggestion ? `${typeColor}0a` : 'transparent',
                          transition: 'all 0.2s', '&:hover': { borderColor: typeColor }
                        }}
                      >
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: typeColor, mb: 0.25, textTransform: 'uppercase' }}>
                          Use AI Suggestion
                        </Typography>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: textPrimary }}>
                          {aiTitleSuggestion}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}

              {/* STEP 2: Category and Unit */}
              {currentStep === 2 && (
                <Box>
                  <Typography sx={{ fontSize: 17, color: textPrimary, mb: 2, fontWeight: 800 }}>
                    Category &amp; Unit 📏
                  </Typography>

                  {/* Propose AI recommendation */}
                  {aiCategorySuggestion && (
                    <Box sx={{ mb: 2.5 }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: textMuted, mb: 0.75, textTransform: 'uppercase' }}>
                        AI Suggestion
                      </Typography>
                      <Box
                        onClick={() => {
                          setSelectedCategory(aiCategorySuggestion);
                          setSelectedUnit(aiUnitSuggestion);
                        }}
                        sx={{
                          cursor: 'pointer', p: 1.75, borderRadius: '14px', border: `1.5px solid ${selectedCategory === aiCategorySuggestion && selectedUnit === aiUnitSuggestion ? typeColor : borderColor}`,
                          background: selectedCategory === aiCategorySuggestion && selectedUnit === aiUnitSuggestion ? `${typeColor}0a` : 'transparent',
                          transition: 'all 0.2s', '&:hover': { borderColor: typeColor }
                        }}
                      >
                        <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: textPrimary }}>
                          Category: {aiCategorySuggestion.charAt(0).toUpperCase() + aiCategorySuggestion.slice(1)}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: textMuted, mt: 0.5 }}>
                          Suggested Unit: {aiUnitSuggestion}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Manual Category Selection */}
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: textMuted, mb: 1, textTransform: 'uppercase' }}>
                    Choose Category
                  </Typography>
                  <Stack direction="row" gap={0.75} flexWrap="wrap" mb={2.5}>
                    {Object.keys(CATEGORY_UNITS).map((cat) => (
                      <Chip
                        key={cat}
                        label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                        onClick={() => {
                          setSelectedCategory(cat);
                          const units = CATEGORY_UNITS[cat] || [];
                          setSelectedUnit(units[0] || '');
                        }}
                        variant={selectedCategory === cat ? 'filled' : 'outlined'}
                        sx={{
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: 12,
                          borderColor: selectedCategory === cat ? typeColor : borderColor,
                          bgcolor: selectedCategory === cat ? `${typeColor}20` : 'transparent',
                          color: selectedCategory === cat ? textPrimary : textMuted,
                          '&:hover': { bgcolor: `${typeColor}10` }
                        }}
                      />
                    ))}
                  </Stack>

                  {/* Unit Selection */}
                  {selectedCategory && (
                    <Box>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: textMuted, mb: 1, textTransform: 'uppercase' }}>
                        Choose Unit
                      </Typography>
                      <Stack direction="row" gap={0.75} flexWrap="wrap" mb={2}>
                        {(CATEGORY_UNITS[selectedCategory] || []).map((u) => (
                          <Chip
                            key={u}
                            label={u}
                            onClick={() => setSelectedUnit(u)}
                            variant={selectedUnit === u ? 'filled' : 'outlined'}
                            sx={{
                              borderRadius: '8px',
                              fontWeight: 600,
                              fontSize: 11.5,
                              borderColor: selectedUnit === u ? typeColor : borderColor,
                              bgcolor: selectedUnit === u ? `${typeColor}15` : 'transparent',
                              color: selectedUnit === u ? textPrimary : textMuted
                            }}
                          />
                        ))}
                      </Stack>
                      <TextField
                        label="Custom Unit"
                        value={selectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value)}
                        size="small"
                        fullWidth
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                      />
                    </Box>
                  )}
                </Box>
              )}

              {/* STEP 3: Due Date */}
              {currentStep === 3 && (
                <Box>
                  <Typography sx={{ fontSize: 17, color: textPrimary, mb: 2, fontWeight: 800 }}>
                    Target Date 📅
                  </Typography>

                  {aiDueDateSuggestion && (
                    <Box sx={{ mb: 2.5 }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: textMuted, mb: 0.75, textTransform: 'uppercase' }}>
                        AI Recommendation
                      </Typography>
                      <Box
                        sx={{
                          p: 1.75, borderRadius: '14px', border: `1.5px solid ${typeColor}`,
                          background: `${typeColor}0a`,
                        }}
                      >
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: textPrimary, lineHeight: 1.45 }}>
                          {aiDueDateSuggestion}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* Timeframe Presets */}
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: textMuted, mb: 1, textTransform: 'uppercase' }}>
                    Quick timeframe presets
                  </Typography>
                  <Stack direction="row" gap={0.75} flexWrap="wrap" mb={2.5}>
                    {[
                      { label: '1 Month', val: 1 },
                      { label: '3 Months', val: 3 },
                      { label: '6 Months', val: 6 },
                    ].map((preset) => (
                      <Chip
                        key={preset.label}
                        label={preset.label}
                        onClick={() => selectDatePreset(preset.val)}
                        sx={{ borderRadius: '8px', fontWeight: 700, fontSize: 11.5 }}
                      />
                    ))}
                  </Stack>

                  <TextField
                    type="date"
                    value={selectedDueDate}
                    onChange={(e) => setSelectedDueDate(e.target.value)}
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    label="Target Date"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                </Box>
              )}

              {/* STEP 4: Target Value */}
              {currentStep === 4 && (
                <Box>
                  <Typography sx={{ fontSize: 17, color: textPrimary, mb: 2, fontWeight: 800 }}>
                    Target Value 🎯
                  </Typography>

                  {aiTargetValueSuggestion && (
                    <Box sx={{ mb: 2.5 }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: textMuted, mb: 0.75, textTransform: 'uppercase' }}>
                        AI Proposal
                      </Typography>
                      <Box
                        onClick={() => {
                          setSelectedTargetValue(Number(aiTargetValueSuggestion));
                        }}
                        sx={{
                          cursor: 'pointer', p: 1.75, borderRadius: '14px', border: `1.5px solid ${selectedTargetValue === Number(aiTargetValueSuggestion) ? typeColor : borderColor}`,
                          background: selectedTargetValue === Number(aiTargetValueSuggestion) ? `${typeColor}0a` : 'transparent',
                          transition: 'all 0.2s', '&:hover': { borderColor: typeColor }
                        }}
                      >
                        <Typography sx={{ fontSize: 12, color: textMuted, mb: 0.25 }}>
                          {aiTargetLabelSuggestion || 'Suggested target'}
                        </Typography>
                        <Typography sx={{ fontSize: 20, fontWeight: 900, color: textPrimary }}>
                          {aiTargetValueSuggestion} <span style={{ fontSize: 13, fontWeight: 500 }}>{selectedUnit}</span>
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  <TextField
                    label={`Target Value (${selectedUnit})`}
                    type="number"
                    value={selectedTargetValue}
                    onChange={(e) => setSelectedTargetValue(e.target.value === '' ? '' : Number(e.target.value))}
                    size="small"
                    fullWidth
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />
                </Box>
              )}

              {/* STEP 5: Progress Mode (Concept) */}
              {currentStep === 5 && (
                <Box>
                  <Typography sx={{ fontSize: 17, color: textPrimary, mb: 2, fontWeight: 800 }}>
                    Tracking Method Concept 📈
                  </Typography>
                  <Stack gap={1.5}>
                    <Box
                      onClick={() => {
                        setSelectedProgressMode('cumulative');
                      }}
                      sx={{
                        cursor: 'pointer', p: 1.75, borderRadius: '14px', border: `1.5px solid ${selectedProgressMode === 'cumulative' ? typeColor : borderColor}`,
                        background: selectedProgressMode === 'cumulative' ? `${typeColor}0a` : 'transparent',
                        transition: 'all 0.2s', '&:hover': { borderColor: typeColor }
                      }}
                    >
                      <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: textPrimary, mb: '2px' }}>
                        Adding up logs over time 📈
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: textMuted, lineHeight: 1.4 }}>
                        For repeating activities that accumulate, like pages read, kilometers run, or money deposited.
                      </Typography>
                      {aiProgressMode === 'cumulative' && (
                        <Typography sx={{ fontSize: 10, color: typeColor, fontWeight: 800, mt: 1, textTransform: 'uppercase' }}>
                          ★ AI Recommended
                        </Typography>
                      )}
                    </Box>

                    <Box
                      onClick={() => {
                        setSelectedProgressMode('current_value');
                      }}
                      sx={{
                        cursor: 'pointer', p: 1.75, borderRadius: '14px', border: `1.5px solid ${selectedProgressMode === 'current_value' ? typeColor : borderColor}`,
                        background: selectedProgressMode === 'current_value' ? `${typeColor}0a` : 'transparent',
                        transition: 'all 0.2s', '&:hover': { borderColor: typeColor }
                      }}
                    >
                      <Typography sx={{ fontSize: 13.5, fontWeight: 750, color: textPrimary, mb: '2px' }}>
                        Tracking a single current level 🎯
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: textMuted, lineHeight: 1.4 }}>
                        For snapshot levels, like current weight, account balance, or completion rate.
                      </Typography>
                      {aiProgressMode === 'current_value' && (
                        <Typography sx={{ fontSize: 10, color: typeColor, fontWeight: 800, mt: 1, textTransform: 'uppercase' }}>
                          ★ AI Recommended
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>
              )}

              {/* STEP 6: Starting Value */}
              {currentStep === 6 && (
                <Box>
                  <Typography sx={{ fontSize: 17, color: textPrimary, mb: 2, fontWeight: 800 }}>
                    Starting Baseline 🚀
                  </Typography>
                  <Typography sx={{ fontSize: 13.5, color: textPrimary, mb: 2, fontWeight: 700 }}>
                    {aiStartValueLabel || 'What level are you starting from?'}
                  </Typography>

                  <TextField
                    label={`Starting level (${selectedUnit})`}
                    type="number"
                    value={selectedStartValue}
                    onChange={(e) => setSelectedStartValue(e.target.value === '' ? '' : Number(e.target.value))}
                    size="small"
                    fullWidth
                    sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                  />

                  <Stack direction="row" gap={1}>
                    <Chip
                      label="Start at 0"
                      onClick={() => setSelectedStartValue(0)}
                      sx={{ borderRadius: '8px', fontWeight: 600, fontSize: 12 }}
                    />
                    {selectedUnit.toLowerCase() === 'kg' && (
                      <>
                        <Chip label="70 kg" onClick={() => setSelectedStartValue(70)} sx={{ borderRadius: '8px', fontWeight: 600 }} />
                        <Chip label="80 kg" onClick={() => setSelectedStartValue(80)} sx={{ borderRadius: '8px', fontWeight: 600 }} />
                      </>
                    )}
                  </Stack>
                </Box>
              )}

              {/* STEP 7: Recommendations & Confirmation */}
              {currentStep === 7 && (
                <Box>
                  <Typography sx={{ fontSize: 17, color: textPrimary, mb: 2.5, fontWeight: 800 }}>
                    Final Recommendations 🚀
                  </Typography>

                  <Stack gap={2} sx={{ mb: 1.5 }}>
                    <Box sx={{ p: 2, borderRadius: '16px', background: `${typeColor}08`, border: `1.5px dashed ${typeColor}` }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 800, color: textPrimary, mb: 0.5 }}>
                        Create a <span style={{ color: typeColor, fontWeight: 900 }}>{aiTrackingMethod === 'tracker' ? 'Snapshots Tracker' : 'Milestones Setup'}</span>
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: textMuted, lineHeight: 1.45 }}>
                        {aiReason || 'Based on your goal details and timeline.'}
                      </Typography>
                    </Box>

                    <Box display="flex" gap={1.5}>
                      <Box flex={1} sx={{ p: 1.5, borderRadius: '12px', background: surfaceBg, border: `1px solid ${borderColor}`, textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 9, color: textMuted, textTransform: 'uppercase', fontWeight: 800, mb: 0.5 }}>
                          Frequency
                        </Typography>
                        <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>
                          {aiFrequency.toUpperCase()}
                        </Typography>
                      </Box>

                      <Box flex={1} sx={{ p: 1.5, borderRadius: '12px', background: surfaceBg, border: `1px solid ${borderColor}`, textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 9, color: textMuted, textTransform: 'uppercase', fontWeight: 800, mb: 0.5 }}>
                          Target
                        </Typography>
                        <Typography sx={{ fontSize: 15, fontWeight: 800, color: textPrimary }}>
                          {selectedTargetValue} {selectedUnit}
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                </Box>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>

      <Divider sx={{ mx: 3, borderColor: borderColor }} />

      <DialogActions sx={{ px: 3, pb: 3.5, pt: 2, gap: 1.5 }}>
        {currentStep > 1 && !loading && (
          <Button
            onClick={handleBack}
            disabled={saving}
            startIcon={<ArrowBack />}
            sx={{
              textTransform: 'none',
              color: textMuted,
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 13,
              px: 2.5,
              py: 0.75,
              transition: 'all 0.2s',
              '&:hover': {
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                color: textPrimary
              }
            }}
          >
            Back
          </Button>
        )}
        <Box flex={1} />
        {!loading && (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={
              saving ||
              (currentStep === 1 && !selectedTitle.trim()) ||
              (currentStep === 2 && (!selectedCategory || !selectedUnit)) ||
              (currentStep === 3 && !selectedDueDate) ||
              (currentStep === 4 && selectedTargetValue === '') ||
              (currentStep === 6 && selectedProgressMode === 'current_value' && selectedStartValue === '')
            }
            sx={{
              textTransform: 'none',
              fontWeight: 800,
              borderRadius: '14px',
              background: `linear-gradient(135deg, ${typeColor} 0%, ${typeColor}cc 100%)`,
              color: '#fff',
              px: 4,
              py: 1.15,
              boxShadow: `0 4px 14px ${typeColor}40`,
              transition: 'all 0.25s ease',
              '&:hover': {
                opacity: 0.92,
                boxShadow: `0 6px 20px ${typeColor}60`,
                transform: 'translateY(-1px)'
              },
              '&:active': {
                transform: 'translateY(1px)'
              },
              '&.Mui-disabled': {
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                color: textMuted
              }
            }}
          >
            {saving ? 'Saving…' : currentStep < 7 ? 'Next →' : 'Confirm & Finish ❤️'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
