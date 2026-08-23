'use client';

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Stack,
  Divider,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Close,
  TrendingUp,
  FitnessCenter,
  School,
  Psychology,
  Category,
  WorkOutline,
  SelfImprovement,
  ArrowBack,
  AutoAwesome as MagicIcon,
} from '@mui/icons-material';
import { useGoals } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { Goal, GoalType, GoalPriority } from '../../lib/interface';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';

interface GoalModalProps {
  open: boolean;
  onClose: () => void;
  goal?: Goal; // Optional, only passed when editing
}

const TYPE_COLORS: Record<GoalType, string> = {
  finance: '#10B981',
  health: '#F59E0B',
  learning: '#3B82F6',
  habit: '#8B5CF6',
  work: '#0ea5e9',
  lifestyle: '#F472B6',
  custom: '#6B7280',
};

const GOAL_TYPES: { value: GoalType; label: string; icon: React.ReactNode }[] = [
  { value: 'finance',   label: 'Finance',   icon: <TrendingUp fontSize="small" /> },
  { value: 'health',    label: 'Health',    icon: <FitnessCenter fontSize="small" /> },
  { value: 'learning',  label: 'Learning',  icon: <School fontSize="small" /> },
  { value: 'habit',     label: 'Habit',     icon: <Psychology fontSize="small" /> },
  { value: 'work',      label: 'Work',      icon: <WorkOutline fontSize="small" /> },
  { value: 'lifestyle', label: 'Lifestyle', icon: <SelfImprovement fontSize="small" /> },
  { value: 'custom',    label: 'Custom',    icon: <Category fontSize="small" /> },
];

const CATEGORY_UNITS: Record<GoalType, string[]> = {
  finance:   ['PKR', 'USD', 'EUR', '%', 'transactions', 'items'],
  health:    ['kg', 'lbs', 'steps', 'minutes', 'hours', 'days', '%'],
  learning:  ['minutes', 'hours', 'lessons', 'chapters', 'pages', 'courses'],
  habit:     ['days', 'times', 'streak', 'weeks'],
  work:      ['tasks', 'hours', 'projects', '%', 'clients'],
  lifestyle: ['days', 'sessions', 'events', 'activities', 'hours'],
  custom:    ['custom', 'sessions', 'tasks', 'hours'],
};

const DEFAULT_UNIT: Record<GoalType, string> = {
  finance: 'PKR', health: 'kg', learning: 'hours',
  habit: 'days', work: 'tasks', lifestyle: 'days', custom: 'custom',
};

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 120 : -120,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: 'easeOut' as const },
  },
  exit: (dir: number) => ({
    x: dir < 0 ? 120 : -120,
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' as const },
  }),
};

const toPlainDate = (val: unknown): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && val !== null) {
    if ('toDate' in val && typeof (val as { toDate: unknown }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate();
    }
    if ('seconds' in val) {
      return new Date((val as { seconds: number }).seconds * 1000);
    }
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

export default function GoalModal({ open, onClose, goal }: GoalModalProps) {
  const { addGoal, updateGoal } = useGoals();
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  // ── Step State ─────────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Form States ────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(goal?.title || '');
  const [description] = useState(goal?.description || '');
  const [type, setType] = useState<(GoalType)>(goal?.type || 'custom');
  const [priority] = useState<GoalPriority>(goal?.priority || 'Medium');
  const [dueDate, setDueDate] = useState<Date | null>(toPlainDate(goal?.dueDate));
  const [overallTargetValue, setOverallTargetValue] = useState<number | ''>(
    goal?.overallTargetValue || ''
  );
  const [overallTargetUnit, setOverallTargetUnit] = useState(
    goal?.overallTargetUnit || DEFAULT_UNIT['custom']
  );
  const [startValue, setStartValue] = useState<number | ''>(goal?.startValue || '');
  const [progressMode, setProgressMode] = useState<'cumulative' | 'current_value'>(
    goal?.progressMode || 'cumulative'
  );
  const [direction, setDirection] = useState<'up' | 'down' | null>(goal?.direction || null);

  // AI-suggested helper properties
  const [aiVerb, setAiVerb] = useState(goal?.aiVerb || '');
  const [aiActivityVerb, setAiActivityVerb] = useState(goal?.aiActivityVerb || '');
  const [aiSuggestedUnit, setAiSuggestedUnit] = useState(goal?.aiSuggestedUnit || '');
  const [trackingMethod, setTrackingMethod] = useState<'tracker' | 'milestones'>(
    goal?.trackingMethod || 'milestones'
  );
  const [aiStartValueLabel, setAiStartValueLabel] = useState('');

  const activeColor = TYPE_COLORS[type];

  // Set initial default unit when category changes manually
  const handleCategoryChange = (newType: GoalType) => {
    setType(newType);
    setOverallTargetUnit(DEFAULT_UNIT[newType]);
  };

  // ── Date Presets ────────────────────────────────────────────────────────────
  const datePresets = useMemo(() => {
    const today = new Date();
    return [
      {
        label: '1 Month',
        date: new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()),
      },
      {
        label: '3 Months',
        date: new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()),
      },
      {
        label: '6 Months',
        date: new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()),
      },
    ];
  }, []);

  // Sync date preset
  const selectDatePreset = (presetDate: Date) => {
    setDueDate(presetDate);
  };

  // ── Step 1 Next: Call AI refiner ──────────────────────────────────────────
  const handleStep1Next = async () => {
    if (!title.trim()) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/goals/smart-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refine-title',
          title: title.trim(),
          currentDate: new Date().toISOString().split('T')[0],
        }),
      });

      if (!res.ok) {
        throw new Error('Refinement request failed');
      }

      const data = await res.json();
      console.log('AI Title Evaluation Payload:', data);

      if (data.error) {
        throw new Error(data.error);
      }

      // Pre-populate AI suggestions
      if (data.suggestedTitle) {
        setTitle(data.suggestedTitle);
      }
      if (data.direction) {
        setDirection(data.direction);
      }
      if (data.progressMode) {
        setProgressMode(data.progressMode);
      }
      if (data.suggestedCategory && TYPE_COLORS[data.suggestedCategory as GoalType]) {
        setType(data.suggestedCategory as GoalType);
      }
      if (data.suggestedUnit) {
        setOverallTargetUnit(data.suggestedUnit);
        setAiSuggestedUnit(data.suggestedUnit);
      }
      if (data.targetValueSuggestion) {
        setOverallTargetValue(Number(data.targetValueSuggestion));
      }
      if (data.dueDateSuggestion) {
        setDueDate(new Date(data.dueDateSuggestion + 'T00:00:00'));
      }
      if (data.startValueLabel) {
        setAiStartValueLabel(data.startValueLabel);
      }
      if (data.trackingMethodSuggestion) {
        setTrackingMethod(data.trackingMethodSuggestion);
      }
      if (data.verb) {
        setAiVerb(data.verb);
      }
      if (data.activityVerb) {
        setAiActivityVerb(data.activityVerb);
      }

      // Transition to Step 2
      setSlideDir(1);
      setCurrentStep(2);
    } catch (err) {
      console.error('AI refinement error:', err);
      setAiError('Could not connect to AI. Please define category and target manually.');
      // Still proceed to Step 2 so user can continue manually
      setSlideDir(1);
      setCurrentStep(2);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Step Navigation ────────────────────────────────────────────────────────
  const handleNext = () => {
    if (currentStep === 1) {
      handleStep1Next();
    } else if (currentStep === 4) {
      handleSaveGoal();
    } else {
      setSlideDir(1);
      setCurrentStep((prev) => (prev + 1) as 2 | 3 | 4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setSlideDir(-1);
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3);
    }
  };

  // ── Save Goal logic ────────────────────────────────────────────────────────
  const handleSaveGoal = async () => {
    if (!title.trim() || !user?.uid) return;

    setAiLoading(true);
    try {
      const nowTs = new Date();
      let calculatedDirection = direction;

      // Ensure proper direction evaluation for current value snapshots
      if (progressMode === 'current_value') {
        const start = typeof startValue === 'number' ? startValue : 0;
        const target = typeof overallTargetValue === 'number' ? overallTargetValue : 0;
        calculatedDirection = target < start ? 'down' : 'up';
      }

      const goalData: Goal = {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        dueDate: dueDate ? Timestamp.fromDate(dueDate) : undefined,
        overallTargetValue: typeof overallTargetValue === 'number' ? overallTargetValue : undefined,
        overallTargetUnit: overallTargetUnit || undefined,
        progressMode,
        direction: calculatedDirection,
        startValue: progressMode === 'current_value' ? (typeof startValue === 'number' ? startValue : null) : null,
        trackingMethod,
        aiVerb: aiVerb || undefined,
        aiActivityVerb: aiActivityVerb || undefined,
        aiSuggestedUnit: aiSuggestedUnit || undefined,
        goalFurnished: true, // Flag as furnished so page context knows it is setup
        progress: goal?.progress || 0,
        status: goal?.status || 'Not Started',
        userId: user.uid,
        createdAt: goal?.createdAt || Timestamp.fromDate(nowTs),
        updatedAt: Timestamp.fromDate(nowTs),
        authorName: user.email || 'Anonymous',
        steps: goal?.steps || [],
      };

      let newGoalId = goal?.id;
      if (goal) {
        await updateGoal(goal.id!, goalData);
      } else {
        newGoalId = await addGoal(goalData);
      }

      onClose();
      // Redirect to goal detail page
      if (newGoalId) {
        router.push(`/goals/${newGoalId}`);
      }
    } catch (err) {
      console.error('Failed to save goal:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const isDarkBg = isDark ? '#1e293b' : '#ffffff';
  const borderCol = isDark ? '#334155' : '#e2e8f0';
  const textCol = isDark ? '#f1f5f9' : '#0f172a';
  const mutedCol = isDark ? '#64748b' : '#94a3b8';

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            background: isDarkBg,
            borderRadius: '24px',
            border: `1px solid ${borderCol}`,
            boxShadow: 24,
            overflow: 'hidden',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ p: 3, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <MagicIcon sx={{ color: activeColor, fontSize: 18 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 900, color: activeColor, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Orbit Goal Builder
            </Typography>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: mutedCol }}>
            <Close fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ mx: 3, borderColor: borderCol }} />

        {/* Wizard Body with Slide Animation */}
        <DialogContent sx={{ px: 3, pt: 3, pb: 2, minHeight: 280, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <AnimatePresence mode="wait" custom={slideDir}>
            {aiLoading ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}
              >
                <CircularProgress size={36} sx={{ color: activeColor, mb: 2 }} />
                <Typography sx={{ fontSize: 13, color: mutedCol, fontWeight: 700 }}>
                  Orbit AI is evaluating goal parameters…
                </Typography>
              </motion.div>
            ) : (
              <motion.div
                key={currentStep}
                custom={slideDir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ width: '100%' }}
              >
                {/* AI Error Warning */}
                {aiError && (
                  <Box sx={{ mb: 2.5, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <Typography sx={{ fontSize: 11.5, color: '#f59e0b', fontWeight: 600 }}>
                      ⚠️ {aiError}
                    </Typography>
                  </Box>
                )}

                {/* ── STEP 1: Title Input ── */}
                {currentStep === 1 && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: textCol, fontSize: '1.25rem' }}>
                      Name your goal ✍️
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: mutedCol, mb: 2.5 }}>
                      Orbit AI will analyze your title to automatically pre-populate metrics, direction, and milestones.
                    </Typography>

                    <TextField
                      autoFocus
                      fullWidth
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Lose 10kg or Save PKR 50k"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '14px',
                          fontSize: '1.2rem',
                          fontWeight: 700,
                          '& fieldset': { borderColor: borderCol },
                          '&:hover fieldset': { borderColor: activeColor },
                          '&.Mui-focused fieldset': { borderColor: activeColor, borderWidth: '2px' },
                        },
                      }}
                    />
                  </Box>
                )}

                {/* ── STEP 2: Category & Units ── */}
                {currentStep === 2 && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5, color: textCol, fontSize: '1.2rem' }}>
                      Category &amp; Units 📏
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: mutedCol, mb: 2.5 }}>
                      Which describes better for this goal?
                    </Typography>

                    {/* Category Selection Grid */}
                    <Typography sx={{ fontSize: 10, fontWeight: 800, color: mutedCol, mb: 1, textTransform: 'uppercase' }}>
                      Choose Category
                    </Typography>
                    <Stack direction="row" gap={0.75} flexWrap="wrap" mb={2.5}>
                      {GOAL_TYPES.map(({ value, label }) => (
                        <Chip
                          key={value}
                          label={label}
                          onClick={() => handleCategoryChange(value)}
                          variant={type === value ? 'filled' : 'outlined'}
                          sx={{
                            borderRadius: '8px',
                            fontWeight: 700,
                            borderColor: type === value ? activeColor : borderCol,
                            bgcolor: type === value ? `${activeColor}20` : 'transparent',
                            color: type === value ? textCol : mutedCol,
                            '&:hover': { bgcolor: `${activeColor}10` },
                          }}
                        />
                      ))}
                    </Stack>

                    {/* Unit Selector */}
                    <Typography sx={{ fontSize: 10, fontWeight: 800, color: mutedCol, mb: 1, textTransform: 'uppercase' }}>
                      Choose Unit
                    </Typography>
                    <Stack direction="row" gap={0.75} flexWrap="wrap" mb={2}>
                      {(CATEGORY_UNITS[type] || []).map((u) => (
                        <Chip
                          key={u}
                          label={u}
                          onClick={() => setOverallTargetUnit(u)}
                          variant={overallTargetUnit === u ? 'filled' : 'outlined'}
                          sx={{
                            borderRadius: '8px',
                            fontWeight: 600,
                            borderColor: overallTargetUnit === u ? activeColor : borderCol,
                            bgcolor: overallTargetUnit === u ? `${activeColor}15` : 'transparent',
                            color: overallTargetUnit === u ? textCol : mutedCol,
                          }}
                        />
                      ))}
                    </Stack>
                    <TextField
                      label="Custom Unit"
                      value={overallTargetUnit}
                      onChange={(e) => setOverallTargetUnit(e.target.value)}
                      size="small"
                      fullWidth
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                    />
                  </Box>
                )}

                {/* ── STEP 3: Target Value & Starting Baseline ── */}
                {currentStep === 3 && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: textCol, fontSize: '1.2rem' }}>
                      Define target values 🎯
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: mutedCol, mb: 2.5 }}>
                      Specify what target value you want to hit to complete the goal.
                    </Typography>

                    <Stack spacing={2.5}>
                      <TextField
                        label={`Target Value (${overallTargetUnit})`}
                        type="number"
                        value={overallTargetValue}
                        onChange={(e) => setOverallTargetValue(e.target.value === '' ? '' : Number(e.target.value))}
                        fullWidth
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                      />

                      {/* Render Starting Baseline conditionally if progressMode is snapshot/current_value */}
                      {progressMode === 'current_value' && (
                        <Box>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: textCol, mb: 1 }}>
                            {aiStartValueLabel || 'What level are you starting from?'}
                          </Typography>
                          <TextField
                            label={`Current Starting level (${overallTargetUnit})`}
                            type="number"
                            value={startValue}
                            onChange={(e) => setStartValue(e.target.value === '' ? '' : Number(e.target.value))}
                            fullWidth
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                          />
                        </Box>
                      )}
                    </Stack>
                  </Box>
                )}

                {/* ── STEP 4: Target Date & Presets ── */}
                {currentStep === 4 && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: textCol, fontSize: '1.2rem' }}>
                      Target deadline 📅
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: mutedCol, mb: 2.5 }}>
                      When do you plan to achieve this goal?
                    </Typography>

                    {/* Presets */}
                    <Stack direction="row" gap={1} mb={2.5}>
                      {datePresets.map((preset) => {
                        const isPresetActive = dueDate?.toDateString() === preset.date.toDateString();
                        return (
                          <Chip
                            key={preset.label}
                            label={preset.label}
                            onClick={() => selectDatePreset(preset.date)}
                            sx={{
                              borderRadius: '8px',
                              fontWeight: 700,
                              borderColor: isPresetActive ? activeColor : borderCol,
                              bgcolor: isPresetActive ? `${activeColor}15` : 'transparent',
                              color: isPresetActive ? textCol : mutedCol,
                            }}
                          />
                        );
                      })}
                    </Stack>

                    <DatePicker
                      value={dueDate}
                      onChange={(val) => setDueDate(val as Date | null)}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          sx: {
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '14px',
                            },
                          },
                        },
                      }}
                    />
                  </Box>
                )}

                 {/* ── STEP 5: Milestones Setup (REMOVED) ── */}
               </motion.div>
             )}
           </AnimatePresence>
         </DialogContent>
 
         <Divider sx={{ mx: 3, borderColor: borderCol }} />
 
         {/* Footer Navigation */}
         <DialogActions sx={{ px: 3, pb: 3, pt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
           {currentStep > 1 && !aiLoading && (
             <Button
               onClick={handleBack}
               startIcon={<ArrowBack />}
               sx={{
                 textTransform: 'none',
                 color: mutedCol,
                 fontWeight: 700,
                 fontSize: 12.5,
                 '&:hover': {
                   background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                   color: textCol,
                 },
               }}
             >
               Back
             </Button>
           )}
           <Box flex={1} />
           {!aiLoading && (
             <Button
               variant="contained"
               onClick={handleNext}
               disabled={
                 (currentStep === 1 && !title.trim()) ||
                 (currentStep === 2 && (!type || !overallTargetUnit)) ||
                 (currentStep === 3 && overallTargetValue === '') ||
                 (currentStep === 3 && progressMode === 'current_value' && startValue === '') ||
                 (currentStep === 4 && !dueDate)
               }
               sx={{
                 textTransform: 'none',
                 fontWeight: 800,
                 borderRadius: '12px',
                 background: `linear-gradient(135deg, ${activeColor} 0%, ${activeColor}cc 100%)`,
                 color: '#fff',
                 px: 3.5,
                 py: 0.9,
                 boxShadow: `0 4px 14px ${activeColor}40`,
                 transition: 'all 0.2s',
                 '&:hover': {
                   opacity: 0.92,
                   boxShadow: `0 6px 18px ${activeColor}50`,
                 },
               }}
             >
               {currentStep === 4 ? (goal ? 'Update Goal' : 'Launch Goal 🚀') : 'Next'}
             </Button>
           )}
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}
