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
  IconButton,
  CircularProgress,
  Stack,
  Divider,
  Fade,
  Chip,
  Paper,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Close,
  ArrowBack,
  AutoAwesome as MagicIcon,
  ArrowForward,
  CalendarMonth,
  Category,
  Timeline,
} from '@mui/icons-material';
import { useGoals } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { Goal, GoalType, GoalPriority } from '../../lib/interface';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';
import GoalQuestionnaireStep from './GoalQuestionnaireStep';

import {
  GOAL_CATEGORIES_CONFIG,
  getCategoryConfig,
  getSubcategories,
  getMeasurementType,
  QuestionConfig,
} from '../../lib/config/goalCategoriesConfig';

interface GoalModalProps {
  open: boolean;
  onClose: () => void;
  goal?: Goal; // Optional, passed when editing
  defaultType?: GoalType;
}

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 100 : -100,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.22, ease: 'easeOut' as const },
  },
  exit: (dir: number) => ({
    x: dir < 0 ? 100 : -100,
    opacity: 0,
    transition: { duration: 0.18, ease: 'easeIn' as const },
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

export default function GoalModal({
  open,
  onClose,
  goal,
  defaultType = 'finance',
}: GoalModalProps) {
  const { addGoal, updateGoal } = useGoals();
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  // ── Step State (4-step wizard) ─────────────────────────────────────────────
  // Step 1: Category selection
  // Step 2: Subcategory selection
  // Step 3: Dynamic Questionnaire
  // Step 4: Summary & Launch Goal
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);

  // ── Selections ─────────────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<GoalType>(
    goal?.type || defaultType || 'finance'
  );
  const [selectedSubcatId, setSelectedSubcatId] = useState<string>(
    goal?.subcategory || ''
  );
  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  // ── Final Form Values ──────────────────────────────────────────────────────
  const [title, setTitle] = useState<string>(goal?.title || '');
  const [targetValue, setTargetValue] = useState<number | ''>(
    goal?.overallTargetValue || ''
  );
  const [targetUnit, setTargetUnit] = useState<string>(
    goal?.overallTargetUnit || 'units'
  );
  const [dueDate, setDueDate] = useState<Date | null>(toPlainDate(goal?.dueDate));
  const [priority] = useState<GoalPriority>(goal?.priority || 'Medium');

  const activeCategoryConfig = useMemo(
    () => getCategoryConfig(selectedCategory),
    [selectedCategory]
  );
  const activeColor = activeCategoryConfig.color;

  const availableSubcats = useMemo(
    () => getSubcategories(selectedCategory),
    [selectedCategory]
  );

  const selectedSubcat = useMemo(() => {
    return availableSubcats.find(
      (sc) => sc.id.toLowerCase() === selectedSubcatId.toLowerCase()
    );
  }, [availableSubcats, selectedSubcatId]);

  // Questions applicable to current subcategory considering dependencies
  const activeQuestions = useMemo(() => {
    if (!selectedSubcat) return [];
    return selectedSubcat.questions.filter((q) => {
      if (!q.dependsOnField) return true;
      const depVal = answers[q.dependsOnField];
      if (Array.isArray(q.dependsOnValue)) {
        return q.dependsOnValue.includes(String(depVal));
      }
      return String(depVal) === String(q.dependsOnValue);
    });
  }, [selectedSubcat, answers]);

  // Reset steps on open
  useEffect(() => {
    if (open) {
      if (goal) {
        setSelectedCategory(goal.type);
        setSelectedSubcatId(goal.subcategory || '');
        setTitle(goal.title);
        setTargetValue(goal.overallTargetValue || '');
        setTargetUnit(goal.overallTargetUnit || 'units');
        setDueDate(toPlainDate(goal.dueDate));
        if (goal.questionnaireAnswers) {
          setAnswers(goal.questionnaireAnswers);
        }
        setCurrentStep(4);
      } else {
        setCurrentStep(1);
        setSelectedSubcatId('');
        setQuestionIndex(0);
        setAnswers({});
        setTitle('');
        setTargetValue('');
        setDueDate(null);
      }
    }
  }, [open, goal]);

  // ── Step 1: Select Category (Auto Advance to Step 2) ────────────────────────
  const handleSelectCategory = (catType: GoalType) => {
    setSelectedCategory(catType);
    const subcats = getSubcategories(catType);
    if (subcats.length > 0) {
      setSelectedSubcatId(subcats[0].id);
    } else {
      setSelectedSubcatId('');
    }
    setSlideDir(1);
    setCurrentStep(2);
  };

  // ── Step 2: Select Subcategory (Auto Advance to Step 3 or 4) ────────────────
  const handleSelectSubcategory = (subcatId: string) => {
    setSelectedSubcatId(subcatId);
    setAnswers({});
    setQuestionIndex(0);

    const subcatObj = availableSubcats.find(
      (s) => s.id.toLowerCase() === subcatId.toLowerCase()
    );

    setSlideDir(1);
    if (subcatObj && subcatObj.questions.length > 0) {
      setCurrentStep(3);
    } else {
      // 0 Questions (e.g. Medical Care Plan) -> Skip Step 3 directly to Step 4!
      deriveFinalDetails({}, subcatObj?.name || subcatId, selectedCategory);
      setCurrentStep(4);
    }
  };

  // ── Update Single Question Answer & Calculate Metrics ─────────────────────
  const handleAnswerChange = (questionId: string, val: unknown) => {
    const updatedAnswers = { ...answers, [questionId]: val };
    setAnswers(updatedAnswers);
    deriveFinalDetails(updatedAnswers, selectedSubcat?.name || selectedSubcatId, selectedCategory);
  };

  // ── Intelligent Target & Title Derivation ──────────────────────────────────
  const deriveFinalDetails = (
    ansMap: Record<string, unknown>,
    subcatName: string,
    catType: GoalType
  ) => {
    // 1. Unit & Target Value extraction
    let unit = 'units';
    let targetNum: number | '' = '';
    const autoTitleParts: string[] = [];

    // Amount extraction
    for (const key of ['target_amount', 'amount', 'target_revenue', 'target_customers', 'target_weight', 'target_days', 'target_duration', 'total_quantity', 'trips_count', 'target_places', 'target_value']) {
      if (ansMap[key] !== undefined && ansMap[key] !== null) {
        const raw = ansMap[key];
        if (typeof raw === 'number') {
          targetNum = raw;
        } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
          targetNum = Number(raw);
        }
      }
    }

    // Units derivation
    if (catType === 'finance') {
      unit = 'PKR';
    } else if (subcatName?.toLowerCase().includes('fitness')) {
      const metric = String(ansMap['progress_metric'] || 'sessions');
      unit = metric === 'distance' ? 'km' : metric === 'minutes' ? 'minutes' : metric === 'steps' ? 'steps' : 'sessions';
    } else if (subcatName?.toLowerCase().includes('reading')) {
      const uType = String(ansMap['unit_type'] || 'pages').toLowerCase();
      unit = uType.includes('chapter') ? 'chapters' : uType.includes('section') ? 'sections' : 'pages';
    } else if (subcatName?.toLowerCase().includes('weight')) {
      unit = 'kg';
    } else if (subcatName?.toLowerCase().includes('sleep')) {
      unit = 'hours';
    } else if (subcatName?.toLowerCase().includes('courses')) {
      unit = String(ansMap['unit_name'] || 'lessons');
    } else if (subcatName?.toLowerCase().includes('trip')) {
      unit = 'milestones';
    } else if (subcatName?.toLowerCase().includes('explore')) {
      unit = 'places';
    } else if (subcatName?.toLowerCase().includes('travel days')) {
      unit = 'days';
    } else if (subcatName?.toLowerCase().includes('travel frequency')) {
      unit = 'trips';
    } else if (subcatName?.toLowerCase().includes('habit')) {
      unit = 'days';
    }

    setTargetUnit(unit);
    if (targetNum !== '') {
      setTargetValue(targetNum);
    }

    // Date / Deadline extraction
    for (const key of ['deadline', 'duration', 'dates', 'period']) {
      const dVal = ansMap[key];
      if (dVal instanceof Date) {
        setDueDate(dVal);
      } else if (typeof dVal === 'string') {
        const today = new Date();
        if (dVal.includes('1_month')) {
          setDueDate(new Date(today.getFullYear(), today.getMonth() + 1, today.getDate()));
        } else if (dVal.includes('2_months')) {
          setDueDate(new Date(today.getFullYear(), today.getMonth() + 2, today.getDate()));
        } else if (dVal.includes('3_months')) {
          setDueDate(new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()));
        } else if (dVal.includes('6_months')) {
          setDueDate(new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()));
        } else if (dVal.includes('1_year') || dVal.includes('this_year')) {
          setDueDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()));
        }
      }
    }

    // Auto title generation if title not manually entered
    if (!title || title.trim() === '') {
      if (ansMap['habit_name'] && typeof ansMap['habit_name'] === 'string') {
        autoTitleParts.push(ansMap['habit_name']);
      } else if (ansMap['habit_to_quit'] && typeof ansMap['habit_to_quit'] === 'string') {
        autoTitleParts.push(`Quit ${ansMap['habit_to_quit']}`);
      } else if (ansMap['routine_type'] && typeof ansMap['routine_type'] === 'string') {
        autoTitleParts.push(ansMap['routine_type']);
      } else if (ansMap['course_name'] && typeof ansMap['course_name'] === 'string') {
        autoTitleParts.push(`Complete ${ansMap['course_name']}`);
      } else if (ansMap['destination'] && typeof ansMap['destination'] === 'string') {
        autoTitleParts.push(`Trip to ${ansMap['destination']}`);
      } else if (ansMap['project_name'] && typeof ansMap['project_name'] === 'string') {
        autoTitleParts.push(ansMap['project_name']);
      } else if (ansMap['purpose'] && typeof ansMap['purpose'] === 'string' && ansMap['purpose'] !== 'other') {
        autoTitleParts.push(`Save for ${ansMap['purpose']}`);
      } else {
        autoTitleParts.push(`${subcatName} Goal`);
      }

      if (targetNum !== '') {
        autoTitleParts.push(`(${targetNum} ${unit})`);
      }
      setTitle(autoTitleParts.join(' '));
    }
  };

  // ── Step 3 Navigation (Next / Back inside Questionnaire) ──────────────────
  const handleQuestionNext = () => {
    if (questionIndex < activeQuestions.length - 1) {
      setSlideDir(1);
      setQuestionIndex((prev) => prev + 1);
    } else {
      // Finished questionnaire -> Go to Step 4
      setSlideDir(1);
      setCurrentStep(4);
    }
  };

  const handleQuestionBack = () => {
    if (questionIndex > 0) {
      setSlideDir(-1);
      setQuestionIndex((prev) => prev - 1);
    } else {
      setSlideDir(-1);
      setCurrentStep(2);
    }
  };

  // ── Step 4: Save & Launch Goal ─────────────────────────────────────────────
  const handleSaveGoal = async () => {
    if (!title.trim() || !user?.uid) return;

    setSaving(true);
    try {
      const nowTs = new Date();
      const numTarget = typeof targetValue === 'number' ? targetValue : 0;
      const mType = getMeasurementType(selectedCategory, selectedSubcatId, targetUnit);

      // Extract milestone items if checkbox_milestones was answered
      let milestoneItemsArr: string[] = [];
      for (const val of Object.values(answers)) {
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
          milestoneItemsArr = val as string[];
        }
      }

      const goalData: Goal = {
        title: title.trim(),
        type: selectedCategory,
        subcategory: selectedSubcat?.name || selectedSubcatId,
        measurementType: mType,
        priority,
        unit: targetUnit,
        dueDate: dueDate ? Timestamp.fromDate(dueDate) : undefined,
        overallTargetValue: numTarget,
        overallTargetUnit: targetUnit,
        progressMode: 'cumulative',
        goalFurnished: true,
        progress: goal?.progress || 0,
        status: goal?.status || 'Not Started',
        userId: user.uid,
        createdAt: goal?.createdAt || Timestamp.fromDate(nowTs),
        updatedAt: Timestamp.fromDate(nowTs),
        authorName: user.email || 'Anonymous',
        steps: goal?.steps || [],
        questionnaireAnswers: answers,
        milestoneItems: milestoneItemsArr,
      };

      let savedGoalId = goal?.id;
      if (goal) {
        await updateGoal(goal.id!, goalData);
      } else {
        savedGoalId = await addGoal(goalData);
      }

      onClose();
      if (savedGoalId) {
        router.push(`/goals/${savedGoalId}`);
      }
    } catch (err) {
      console.error('Failed to save goal:', err);
    } finally {
      setSaving(false);
    }
  };

  const isDarkBg = isDark ? '#1e293b' : '#ffffff';
  const borderCol = isDark ? '#334155' : '#e2e8f0';
  const textCol = isDark ? '#f1f5f9' : '#0f172a';
  const mutedCol = isDark ? '#64748b' : '#94a3b8';

  const currentQuestion: QuestionConfig | undefined = activeQuestions[questionIndex];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Fade}
        transitionDuration={350}
        PaperProps={{
          sx: {
            background: isDarkBg,
            borderRadius: '28px',
            border: `1px solid ${borderCol}`,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
          },
        }}
      >
        {/* Header */}
        <Box sx={{ p: 3, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <MagicIcon sx={{ color: activeColor, fontSize: 20 }} />
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 900,
                color: activeColor,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Goal Creation ({currentStep}/4)
            </Typography>
          </Stack>

          {/* Step Indicator Dots */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            {[1, 2, 3, 4].map((stepNum) => (
              <Box
                key={stepNum}
                sx={{
                  width: stepNum === currentStep ? 22 : 8,
                  height: 8,
                  borderRadius: '4px',
                  bgcolor: stepNum === currentStep ? activeColor : stepNum < currentStep ? `${activeColor}60` : borderCol,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            ))}
            <IconButton size="small" onClick={onClose} sx={{ color: mutedCol, ml: 1 }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <Divider sx={{ mx: 3, borderColor: borderCol }} />

        {/* Wizard Body */}
        <DialogContent
          sx={{
            px: 3.5,
            pt: 3,
            pb: 2.5,
            minHeight: 380,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <AnimatePresence mode="wait" custom={slideDir}>
            {saving ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}
              >
                <CircularProgress size={44} sx={{ color: activeColor, mb: 2 }} />
                <Typography sx={{ fontSize: 14, color: mutedCol, fontWeight: 700 }}>
                  Building custom goal template...
                </Typography>
              </motion.div>
            ) : (
              <motion.div
                key={`${currentStep}-${questionIndex}`}
                custom={slideDir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                style={{ width: '100%' }}
              >
                {/* ── STEP 1: Main Category Selection Grid ── */}
                {currentStep === 1 && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5, color: textCol, fontSize: '1.3rem' }}>
                      What area would you like to focus on? 🎯
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: mutedCol, mb: 2.5 }}>
                      Select a category to customize your goal framework:
                    </Typography>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 1.5,
                      }}
                    >
                      {Object.values(GOAL_CATEGORIES_CONFIG).map((cat) => {
                        const isSelected = selectedCategory === cat.id;
                        return (
                          <Paper
                            key={cat.id}
                            elevation={0}
                            onClick={() => handleSelectCategory(cat.id)}
                            sx={{
                              p: 2,
                              borderRadius: '20px',
                              cursor: 'pointer',
                              border: `2px solid ${isSelected ? cat.color : borderCol}`,
                              bgcolor: isDark ? '#0f172a' : '#f8fafc',
                              transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              '&:hover': {
                                transform: 'translateY(-3px)',
                                borderColor: cat.color,
                                boxShadow: `0 8px 20px ${cat.color}25`,
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: '14px',
                                bgcolor: `${cat.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 24,
                                flexShrink: 0,
                              }}
                            >
                              {cat.emoji}
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography
                                sx={{
                                  fontSize: 14,
                                  fontWeight: 800,
                                  color: textCol,
                                  lineHeight: 1.2,
                                }}
                              >
                                {cat.name}
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: 11,
                                  color: mutedCol,
                                  mt: 0.3,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {cat.subcategories.length} goal templates
                              </Typography>
                            </Box>
                            <ArrowForward sx={{ fontSize: 16, color: cat.color, opacity: 0.7 }} />
                          </Paper>
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {/* ── STEP 2: Subcategory Selection ── */}
                {currentStep === 2 && (
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                      <Typography sx={{ fontSize: 20 }}>{activeCategoryConfig.emoji}</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: textCol, fontSize: '1.3rem' }}>
                        Select {activeCategoryConfig.name} Goal Type
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 12.5, color: mutedCol, mb: 2.5 }}>
                      Choose a specific subcategory template to proceed:
                    </Typography>

                    <Stack spacing={1.5}>
                      {availableSubcats.map((sc) => {
                        const isSelected = selectedSubcatId.toLowerCase() === sc.id.toLowerCase();
                        return (
                          <Paper
                            key={sc.id}
                            elevation={0}
                            onClick={() => handleSelectSubcategory(sc.id)}
                            sx={{
                              p: 2,
                              borderRadius: '18px',
                              cursor: 'pointer',
                              border: `2px solid ${isSelected ? activeColor : borderCol}`,
                              bgcolor: isSelected
                                ? isDark ? `${activeColor}20` : `${activeColor}10`
                                : isDark ? '#0f172a' : '#f8fafc',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              '&:hover': {
                                borderColor: activeColor,
                                transform: 'translateX(4px)',
                              },
                            }}
                          >
                            <Box>
                              <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: textCol }}>
                                {sc.name}
                              </Typography>
                              {sc.description && (
                                <Typography sx={{ fontSize: 11.5, color: mutedCol, mt: 0.25 }}>
                                  {sc.description}
                                </Typography>
                              )}
                            </Box>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Chip
                                label={`${sc.questions.length} Questions`}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: 10.5,
                                  bgcolor: `${activeColor}18`,
                                  color: activeColor,
                                }}
                              />
                              <ArrowForward sx={{ fontSize: 18, color: activeColor }} />
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Box>
                )}

                {/* ── STEP 3: Dynamic Questionnaire ── */}
                {currentStep === 3 && currentQuestion && (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: activeColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Question {questionIndex + 1} of {activeQuestions.length}
                      </Typography>
                      <Chip
                        label={selectedSubcat?.name}
                        size="small"
                        sx={{ fontWeight: 700, fontSize: 11, bgcolor: `${activeColor}18`, color: activeColor }}
                      />
                    </Box>

                    <GoalQuestionnaireStep
                      question={currentQuestion}
                      value={answers[currentQuestion.id]}
                      onChange={(val) => handleAnswerChange(currentQuestion.id, val)}
                      color={activeColor}
                      isDark={isDark}
                    />
                  </Box>
                )}

                {/* ── STEP 4: Final Goal Review & Launch ── */}
                {currentStep === 4 && (
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5, color: textCol, fontSize: '1.25rem' }}>
                      Review &amp; Launch Goal 🚀
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: mutedCol, mb: 2.5 }}>
                      Confirm your goal details before saving to your space:
                    </Typography>

                    <Stack spacing={2.5}>
                      {/* Goal Title Input */}
                      <Box>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: mutedCol, mb: 0.75, textTransform: 'uppercase' }}>
                          Goal Title
                        </Typography>
                        <TextField
                          fullWidth
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g. Save PKR 100,000 for emergency fund"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '16px',
                              fontSize: '1.05rem',
                              fontWeight: 800,
                            },
                          }}
                        />
                      </Box>

                      {/* Goal Parameters Summary Card */}
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2.25,
                          borderRadius: '20px',
                          bgcolor: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(248, 250, 252, 0.8)',
                          border: `1.5px solid ${activeColor}40`,
                        }}
                      >
                        <Stack spacing={1.5}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Category sx={{ fontSize: 18, color: activeColor }} />
                              <Typography sx={{ fontSize: 12, fontWeight: 700, color: mutedCol }}>Category</Typography>
                            </Stack>
                            <Chip
                              label={`${activeCategoryConfig.emoji} ${activeCategoryConfig.name} • ${selectedSubcat?.name || selectedSubcatId}`}
                              size="small"
                              sx={{ fontWeight: 800, bgcolor: `${activeColor}20`, color: activeColor }}
                            />
                          </Stack>

                          <Divider sx={{ borderColor: borderCol }} />

                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Timeline sx={{ fontSize: 18, color: activeColor }} />
                              <Typography sx={{ fontSize: 12, fontWeight: 700, color: mutedCol }}>Target Metric</Typography>
                            </Stack>
                            <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: textCol }}>
                              {targetValue !== '' ? `${targetValue} ${targetUnit}` : `Custom (${targetUnit})`}
                            </Typography>
                          </Stack>

                          <Divider sx={{ borderColor: borderCol }} />

                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <CalendarMonth sx={{ fontSize: 18, color: activeColor }} />
                              <Typography sx={{ fontSize: 12, fontWeight: 700, color: mutedCol }}>Deadline</Typography>
                            </Stack>
                            <Typography sx={{ fontSize: 13, fontWeight: 800, color: textCol }}>
                              {dueDate ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No fixed deadline'}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Paper>

                      {/* Optional Target Value / Deadline Adjustment */}
                      <Stack direction="row" spacing={1.5}>
                        <TextField
                          label={`Target Value (${targetUnit})`}
                          type="number"
                          value={targetValue}
                          onChange={(e) => setTargetValue(e.target.value === '' ? '' : Number(e.target.value))}
                          size="small"
                          fullWidth
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                        />
                        <DatePicker
                          label="Deadline Date"
                          value={dueDate}
                          onChange={(dVal) => setDueDate(dVal as Date | null)}
                          slotProps={{
                            textField: {
                              size: 'small',
                              fullWidth: true,
                              sx: { '& .MuiOutlinedInput-root': { borderRadius: '12px' } },
                            },
                          }}
                        />
                      </Stack>
                    </Stack>
                  </Box>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>

        <Divider sx={{ mx: 3, borderColor: borderCol }} />

        {/* Footer Navigation */}
        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            pt: 1.5,
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
          }}
        >
          {currentStep > 1 && !saving && (
            <Button
              onClick={() => {
                if (currentStep === 3) {
                  handleQuestionBack();
                } else if (currentStep === 4) {
                  if (activeQuestions.length > 0) {
                    setSlideDir(-1);
                    setCurrentStep(3);
                  } else {
                    setSlideDir(-1);
                    setCurrentStep(2);
                  }
                } else {
                  setSlideDir(-1);
                  setCurrentStep((prev) => (prev - 1) as 1 | 2);
                }
              }}
              startIcon={<ArrowBack />}
              sx={{
                textTransform: 'none',
                color: mutedCol,
                fontWeight: 700,
                fontSize: 12.5,
                '&:hover': { color: textCol },
              }}
            >
              Back
            </Button>
          )}

          <Box flex={1} />

          {!saving && currentStep === 3 && (
            <Button
              variant="contained"
              onClick={handleQuestionNext}
              sx={{
                textTransform: 'none',
                fontWeight: 800,
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${activeColor} 0%, ${activeColor}cc 100%)`,
                color: '#fff',
                px: 3.5,
                py: 0.9,
                boxShadow: `0 4px 14px ${activeColor}40`,
                '&:hover': { opacity: 0.92 },
              }}
            >
              {questionIndex < activeQuestions.length - 1 ? 'Next Question' : 'Review Goal'}
            </Button>
          )}

          {!saving && currentStep === 4 && (
            <Button
              variant="contained"
              onClick={handleSaveGoal}
              disabled={!title.trim()}
              sx={{
                textTransform: 'none',
                fontWeight: 800,
                borderRadius: '14px',
                background: `linear-gradient(135deg, ${activeColor} 0%, ${activeColor}cc 100%)`,
                color: '#fff',
                px: 4,
                py: 1,
                fontSize: '0.95rem',
                boxShadow: `0 6px 18px ${activeColor}40`,
                '&:hover': { opacity: 0.92 },
              }}
            >
              {goal ? 'Update Goal' : 'Launch Goal 🚀'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}
