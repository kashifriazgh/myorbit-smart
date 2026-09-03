'use client';

import React, { useMemo, useState, useEffect } from 'react';
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
  Fade,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Close,
  ArrowBack,
  AutoAwesome as MagicIcon,
  CheckCircle,
} from '@mui/icons-material';
import { useGoals } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { Goal, GoalType, GoalPriority } from '../../lib/interface';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';

import {
  GOAL_CATEGORIES_CONFIG,
  getCategoryConfig,
  getSubcategories,
  getSubcategoryUnits,
  getAllUnitsForCategory,
  getMeasurementType,
  MEASUREMENT_TYPE_META,
  MeasurementType,
} from '../../lib/config/goalCategoriesConfig';

interface GoalModalProps {
  open: boolean;
  onClose: () => void;
  goal?: Goal; // Optional, only passed when editing
  defaultType?: GoalType;
}

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

const EXAMPLE_GOALS = [
  'Save PKR 100,000 for emergency fund',
  'Exercise for 300 minutes this week',
  'Read 20 books this year',
  'Lose 5 kg weight in 2 months',
  'Practice coding for 100 hours',
];

function TypewriterExamples({ isDark }: { isDark: boolean }) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fullText = EXAMPLE_GOALS[exampleIndex];
    const typingSpeed = isDeleting ? 35 : 75;

    const timer = setTimeout(() => {
      if (!isDeleting) {
        setCurrentText(fullText.substring(0, currentText.length + 1));
        if (currentText.length === fullText.length) {
          setTimeout(() => setIsDeleting(true), 2200);
        }
      } else {
        setCurrentText(fullText.substring(0, currentText.length - 1));
        if (currentText.length === 0) {
          setIsDeleting(false);
          setExampleIndex((prev) => (prev + 1) % EXAMPLE_GOALS.length);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [currentText, isDeleting, exampleIndex]);

  const textColor = isDark ? '#38bdf8' : '#0284c7';

  return (
    <Box sx={{ minHeight: '32px', display: 'flex', alignItems: 'center' }}>
      <Typography
        sx={{
          fontSize: '1.05rem',
          fontWeight: 800,
          color: textColor,
          lineHeight: 1.3,
        }}
      >
        &ldquo;{currentText}&rdquo;
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            width: '2px',
            height: '1.1em',
            bgcolor: textColor,
            ml: '3px',
            verticalAlign: 'middle',
            animation: 'blinkCaret 1s infinite',
            '@keyframes blinkCaret': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0 },
            },
          }}
        />
      </Typography>
    </Box>
  );
}

export default function GoalModal({ open, onClose, goal, defaultType: _defaultType = 'finance' }: GoalModalProps) {
  const { addGoal, updateGoal } = useGoals();
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  // ── Step State (5-step wizard) ─────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCategoryDetected, setAiCategoryDetected] = useState(false);

  // ── Form States ────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(goal?.title || '');
  const [description] = useState(goal?.description || '');
  const [type, setType] = useState<GoalType>(goal?.type || 'finance');
  const [subcategory, setSubcategory] = useState<string>(goal?.subcategory || '');
  const [showAllCategoryUnits, setShowAllCategoryUnits] = useState(false);
  const [priority] = useState<GoalPriority>(goal?.priority || 'Medium');
  const [dueDate, setDueDate] = useState<Date | null>(toPlainDate(goal?.dueDate));
  const [overallTargetValue, setOverallTargetValue] = useState<number | ''>(
    goal?.overallTargetValue || ''
  );
  const [overallTargetUnit, setOverallTargetUnit] = useState(
    goal?.overallTargetUnit || 'PKR'
  );
  const [startValue, setStartValue] = useState<number | ''>(
    typeof goal?.startValue === 'number' ? goal.startValue : (goal?.startingValue || '')
  );
  const [progressMode, setProgressMode] = useState<'cumulative' | 'current_value'>(
    goal?.progressMode || 'cumulative'
  );
  const [direction, setDirection] = useState<'up' | 'down' | null>(goal?.direction || null);

  // ── Architecture & AI Properties ──
  const [intent, setIntent] = useState<string>(goal?.intent || '');
  const [progressTrackingType, setProgressTrackingType] = useState<'accumulative' | 'opposes'>(
    goal?.progressTrackingType || 'accumulative'
  );
  const [opposesDirection, setOpposesDirection] = useState<'UP' | 'DOWN' | null>(
    goal?.direction === 'up' ? 'UP' : goal?.direction === 'down' ? 'DOWN' : (goal?.direction as 'UP' | 'DOWN' | null) || null
  );

  const [aiVerb, setAiVerb] = useState(goal?.aiVerb || '');
  const [aiActivityVerb, setAiActivityVerb] = useState(goal?.aiActivityVerb || '');
  const [_aiSuggestedUnit, setAiSuggestedUnit] = useState(goal?.aiSuggestedUnit || '');
  const [trackingMethod, setTrackingMethod] = useState<'tracker' | 'milestones'>(
    goal?.trackingMethod || 'milestones'
  );
  const [aiStartValueLabel, setAiStartValueLabel] = useState('');

  const catConfig = useMemo(() => getCategoryConfig(type), [type]);
  const activeColor = catConfig.color;

  // Set category and default subcategory
  const handleCategorySelect = (selectedCatType: GoalType) => {
    setType(selectedCatType);
    const subcats = getSubcategories(selectedCatType);
    if (subcats.length > 0) {
      setSubcategory(subcats[0].id);
      if (subcats[0].units.length > 0) {
        setOverallTargetUnit(subcats[0].units[0]);
      }
    } else {
      setSubcategory('');
      setOverallTargetUnit(getCategoryConfig(selectedCatType).allUnits[0] || 'units');
    }
  };

  // Select subcategory & update available units
  const handleSubcategorySelect = (subcatId: string) => {
    setSubcategory(subcatId);
    setShowAllCategoryUnits(false);
    const subcatUnits = getSubcategoryUnits(type, subcatId).units;
    if (subcatUnits.length > 0 && !subcatUnits.includes(overallTargetUnit)) {
      setOverallTargetUnit(subcatUnits[0]);
    }
  };

  // Calculate current measurement type dynamically
  const currentMeasurementType: MeasurementType = useMemo(() => {
    return getMeasurementType(type, subcategory, overallTargetUnit);
  }, [type, subcategory, overallTargetUnit]);

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

      const data = await res.json().catch(() => ({}));
      console.log('AI Title Evaluation Payload:', data);

      if (!res.ok || data.error) {
        console.warn('AI evaluation warning:', data?.error || res.statusText);
        setAiError(data?.error || 'AI setup unavailable. Please specify target & category manually.');
        setAiCategoryDetected(false);
      } else {
        if (data.suggestedTitle) {
          setTitle(data.suggestedTitle);
        }
        if (data.intent) {
          setIntent(data.intent);
        }
        if (data.progressTrackingType) {
          setProgressTrackingType(data.progressTrackingType);
          if (data.progressTrackingType === 'opposes') {
            setProgressMode('current_value');
          }
        }
        if (data.direction) {
          const dir = String(data.direction).toUpperCase();
          if (dir === 'UP' || dir === 'DOWN') {
            setOpposesDirection(dir as 'UP' | 'DOWN');
            setDirection(dir === 'UP' ? 'up' : 'down');
          } else {
            setDirection(data.direction);
          }
        }
        if (data.startingValueSuggestion !== undefined && data.startingValueSuggestion !== null) {
          setStartValue(Number(data.startingValueSuggestion));
        }
        if (data.progressMode) {
          setProgressMode(data.progressMode);
        }
        if (data.suggestedCategory && GOAL_CATEGORIES_CONFIG[data.suggestedCategory]) {
          setType(data.suggestedCategory as GoalType);
          setAiCategoryDetected(true);
          const subcats = getSubcategories(data.suggestedCategory);
          if (data.suggestedSubcategory) {
            setSubcategory(data.suggestedSubcategory);
          } else if (subcats.length > 0) {
            setSubcategory(subcats[0].id);
          }
        } else {
          setAiCategoryDetected(false);
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
      }

      setSlideDir(1);
      setCurrentStep(2);
    } catch (err) {
      console.error('AI refinement error:', err);
      setAiError('Could not connect to AI. Please define category and target manually.');
      setAiCategoryDetected(false);
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
    } else if (currentStep === 5) {
      handleSaveGoal();
    } else {
      setSlideDir(1);
      setCurrentStep((prev) => (prev + 1) as 2 | 3 | 4 | 5);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setSlideDir(-1);
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  // ── Save Goal logic ────────────────────────────────────────────────────────
  const handleSaveGoal = async () => {
    if (!title.trim() || !user?.uid) return;

    setAiLoading(true);
    try {
      const nowTs = new Date();
      const numStart = typeof startValue === 'number' ? startValue : 0;
      const numTarget = typeof overallTargetValue === 'number' ? overallTargetValue : 0;

      let calculatedDirection: 'up' | 'down' | null = direction;
      const finalTrackingType = progressTrackingType;

      if (finalTrackingType === 'opposes') {
        if (opposesDirection === 'DOWN' || numTarget < numStart) {
          calculatedDirection = 'down';
        } else {
          calculatedDirection = 'up';
        }
      } else {
        calculatedDirection = null;
      }

      let timeFrameStr = '30 days';
      if (dueDate) {
        const diffDays = Math.max(1, Math.ceil((dueDate.getTime() - nowTs.getTime()) / (1000 * 60 * 60 * 24)));
        timeFrameStr = diffDays >= 60 ? `${Math.round(diffDays / 30)} months` : `${diffDays} days`;
      }

      const evaluatedIntent = intent || aiVerb || 'achieve';
      const evaluatedUnit = overallTargetUnit || 'units';

      const goalData: Goal = {
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        subcategory: subcategory || undefined,
        measurementType: currentMeasurementType,
        priority,
        unit: evaluatedUnit,
        dueDate: dueDate ? Timestamp.fromDate(dueDate) : undefined,
        overallTargetValue: numTarget,
        overallTargetUnit: evaluatedUnit,
        progressMode: finalTrackingType === 'opposes' ? 'current_value' : progressMode,
        direction: calculatedDirection,
        startValue: numStart,
        startingValue: numStart,
        intent: evaluatedIntent,
        progressTrackingType: finalTrackingType,
        timeFrame: timeFrameStr,
        trackingMethod,
        aiVerb: aiVerb || evaluatedIntent,
        aiActivityVerb: aiActivityVerb || undefined,
        aiSuggestedUnit: evaluatedUnit,
        goalFurnished: true,
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

  const subcats = getSubcategories(type);
  const activeSubcatUnitsObj = getSubcategoryUnits(type, subcategory);
  const displayedUnits = showAllCategoryUnits
    ? getAllUnitsForCategory(type)
    : activeSubcatUnitsObj.units;

  const mTypeMeta = MEASUREMENT_TYPE_META[currentMeasurementType];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        TransitionComponent={Fade}
        transitionDuration={400}
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
              Orbit Goal Builder ({currentStep}/5)
            </Typography>
          </Stack>
          <IconButton size="small" onClick={onClose} sx={{ color: mutedCol }}>
            <Close fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ mx: 3, borderColor: borderCol }} />

        {/* Wizard Body */}
        <DialogContent sx={{ px: 3, pt: 2.5, pb: 2, minHeight: 320, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
                  <Box sx={{ mb: 2, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
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
                      Orbit AI will analyze your title to automatically pre-select category, metrics, and duration.
                    </Typography>

                    <TextField
                      fullWidth
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter your goal title..."
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '14px',
                          fontSize: '1.15rem',
                          fontWeight: 700,
                          '& fieldset': { borderColor: borderCol },
                          '&:hover fieldset': { borderColor: activeColor },
                          '&.Mui-focused fieldset': { borderColor: activeColor, borderWidth: '2px' },
                        },
                      }}
                    />

                    <Box
                      sx={{
                        mt: 2,
                        p: 2,
                        borderRadius: '14px',
                        bgcolor: isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(2, 132, 199, 0.06)',
                        border: `1px dashed ${isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(2, 132, 199, 0.3)'}`,
                      }}
                    >
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: isDark ? '#38bdf8' : '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                        💡 Inspiration Examples
                      </Typography>
                      <TypewriterExamples isDark={isDark} />
                    </Box>
                  </Box>
                )}

                {/* ── STEP 2: Category Selection (Creative UI & AI Heading Logic) ── */}
                {currentStep === 2 && (
                  <Box>
                    {/* Headings based on AI detection */}
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5, color: textCol, fontSize: '1.2rem' }}>
                      {aiCategoryDetected
                        ? 'We chose this category that matches your goal'
                        : 'Choose the category that suits you best'}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: mutedCol, mb: 2 }}>
                      {aiCategoryDetected
                        ? 'Tap any category to change'
                        : 'Select a category to organize your target'}
                    </Typography>

                    {/* Creative Category Cards Grid */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 1.25,
                        mb: 1,
                      }}
                    >
                      {Object.values(GOAL_CATEGORIES_CONFIG).map((cat) => {
                        const isSelected = type === cat.id;
                        return (
                          <Box
                            key={cat.id}
                            onClick={() => handleCategorySelect(cat.id)}
                            sx={{
                              p: 1.5,
                              borderRadius: '16px',
                              cursor: 'pointer',
                              border: `2px solid ${isSelected ? cat.color : borderCol}`,
                              bgcolor: isSelected
                                ? isDark ? `${cat.color}25` : `${cat.color}15`
                                : isDark ? '#0f172a' : '#f8fafc',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.25,
                              position: 'relative',
                              overflow: 'hidden',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                borderColor: cat.color,
                                boxShadow: `0 4px 12px ${cat.color}25`,
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                borderRadius: '12px',
                                bgcolor: `${cat.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 20,
                                flexShrink: 0,
                              }}
                            >
                              {cat.emoji}
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography
                                sx={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: isSelected ? textCol : isDark ? '#e2e8f0' : '#334155',
                                  lineHeight: 1.2,
                                }}
                              >
                                {cat.name}
                              </Typography>
                              {isSelected && aiCategoryDetected && cat.id === type && (
                                <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: cat.color, mt: 0.2 }}>
                                  AI Match ✨
                                </Typography>
                              )}
                            </Box>
                            {isSelected && (
                              <CheckCircle sx={{ fontSize: 16, color: cat.color, flexShrink: 0 }} />
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {/* ── STEP 3: Subcategory & Measurement Unit ── */}
                {currentStep === 3 && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5, color: textCol, fontSize: '1.2rem' }}>
                      Subcategory &amp; Unit 📏
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: mutedCol, mb: 2 }}>
                      Pick a subcategory under <strong style={{ color: activeColor }}>{catConfig.name}</strong> and choose how to measure progress.
                    </Typography>

                    {/* Subcategories Selector */}
                    {subcats.length > 0 && (
                      <Box sx={{ mb: 2.5 }}>
                        <Typography sx={{ fontSize: 10, fontWeight: 800, color: mutedCol, mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Select Subcategory
                        </Typography>
                        <Stack direction="row" gap={0.75} flexWrap="wrap">
                          {subcats.map((sc) => {
                            const isSelected = subcategory.toLowerCase() === sc.id.toLowerCase();
                            return (
                              <Chip
                                key={sc.id}
                                label={sc.name}
                                onClick={() => handleSubcategorySelect(sc.id)}
                                variant={isSelected ? 'filled' : 'outlined'}
                                sx={{
                                  borderRadius: '10px',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  borderColor: isSelected ? activeColor : borderCol,
                                  bgcolor: isSelected ? `${activeColor}25` : 'transparent',
                                  color: isSelected ? textCol : mutedCol,
                                  '&:hover': { bgcolor: `${activeColor}15` },
                                }}
                              />
                            );
                          })}
                        </Stack>
                      </Box>
                    )}

                    {/* Valid Units List */}
                    <Box sx={{ mb: 1.5 }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 800, color: mutedCol, mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Measurement Unit
                      </Typography>
                      <Stack direction="row" gap={0.75} flexWrap="wrap" mb={1}>
                        {displayedUnits.map((u) => {
                          const isSelected = overallTargetUnit === u;
                          const mType = getMeasurementType(type, subcategory, u);
                          const mMeta = MEASUREMENT_TYPE_META[mType];
                          return (
                            <Chip
                              key={u}
                              label={`${u} ${mMeta?.icon || ''}`}
                              onClick={() => setOverallTargetUnit(u)}
                              variant={isSelected ? 'filled' : 'outlined'}
                              sx={{
                                borderRadius: '10px',
                                fontWeight: 700,
                                fontSize: 12,
                                borderColor: isSelected ? activeColor : borderCol,
                                bgcolor: isSelected ? `${activeColor}20` : 'transparent',
                                color: isSelected ? textCol : mutedCol,
                              }}
                            />
                          );
                        })}
                      </Stack>

                      {/* Option to show other category units */}
                      <Button
                        size="small"
                        onClick={() => setShowAllCategoryUnits(!showAllCategoryUnits)}
                        sx={{
                          textTransform: 'none',
                          fontSize: 11.5,
                          color: activeColor,
                          fontWeight: 700,
                          p: 0,
                          minWidth: 0,
                          '&:hover': { background: 'transparent', textDecoration: 'underline' },
                        }}
                      >
                        {showAllCategoryUnits
                          ? '← Show recommended units for this subcategory'
                          : `Show other units in ${catConfig.name}`}
                      </Button>
                    </Box>

                    {/* Custom Unit Field */}
                    <TextField
                      label="Custom Unit Name"
                      value={overallTargetUnit}
                      onChange={(e) => setOverallTargetUnit(e.target.value)}
                      size="small"
                      fullWidth
                      sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                    />
                  </Box>
                )}

                {/* ── STEP 4: Target Value & Measurement Type Explanation ── */}
                {currentStep === 4 && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: textCol, fontSize: '1.2rem' }}>
                      Define target value 🎯
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: mutedCol, mb: 2 }}>
                      Specify the numerical target you aim to reach in <strong>{overallTargetUnit}</strong>.
                    </Typography>

                    <Stack spacing={2.5}>
                      <TextField
                        label={`Target Value (${overallTargetUnit})`}
                        type="number"
                        value={overallTargetValue}
                        onChange={(e) => setOverallTargetValue(e.target.value === '' ? '' : Number(e.target.value))}
                        fullWidth
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', fontSize: '1.1rem', fontWeight: 700 } }}
                      />

                      {/* Measurement Type Explanation Badge */}
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: '16px',
                          bgcolor: isDark ? `${activeColor}15` : `${activeColor}10`,
                          border: `1px solid ${activeColor}30`,
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                          <Typography sx={{ fontSize: 16 }}>{mTypeMeta?.icon}</Typography>
                          <Typography sx={{ fontSize: 12, fontWeight: 800, color: activeColor, textTransform: 'uppercase' }}>
                            Measurement Type: {mTypeMeta?.label}
                          </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: 11.5, color: textCol, fontWeight: 500 }}>
                          Progress Formula: <strong style={{ color: activeColor }}>{mTypeMeta?.formula}</strong>
                        </Typography>
                      </Box>

                      {/* Starting level for snapshot / current_value mode */}
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

                {/* ── STEP 5: Target Date & Presets ── */}
                {currentStep === 5 && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: textCol, fontSize: '1.2rem' }}>
                      Target deadline 📅
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: mutedCol, mb: 2.5 }}>
                      When do you plan to achieve this goal?
                    </Typography>

                    <Stack direction="row" gap={1} mb={2.5}>
                      {datePresets.map((preset) => {
                        const isPresetActive = dueDate?.toDateString() === preset.date.toDateString();
                        return (
                          <Chip
                            key={preset.label}
                            label={preset.label}
                            onClick={() => selectDatePreset(preset.date)}
                            sx={{
                              borderRadius: '10px',
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
                (currentStep === 2 && !type) ||
                (currentStep === 3 && (!subcategory || !overallTargetUnit)) ||
                (currentStep === 4 && overallTargetValue === '') ||
                (currentStep === 4 && progressMode === 'current_value' && startValue === '') ||
                (currentStep === 5 && !dueDate)
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
              {currentStep === 5 ? (goal ? 'Update Goal' : 'Launch Goal 🚀') : 'Next'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}
