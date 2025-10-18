'use client';

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Close,
  Add,
  Remove,
  Delete,
  TrendingUp,
  FitnessCenter,
  School,
  Psychology,
  Category,
} from '@mui/icons-material';
import { useGoals } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { Goal, GoalType, GoalPriority, GoalStep } from '../../lib/interface';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';
// NLP

import nlp from 'compromise';

import winkNLP from 'wink-nlp';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment

// eslint-disable-next-line @typescript-eslint/ban-ts-comment

// Define a custom type for the compromise document with the 'dates' method
type CompromiseDocumentWithDates = ReturnType<typeof nlp> & {
  dates: () => {
    out: (format: string) => string;
  };
};

interface GoalModalProps {
  open: boolean;
  onClose: () => void;
  goal?: Goal; // For editing existing goals
}

const getGoalTypeColor = (type: GoalType) => {
  switch (type) {
    case 'finance':
      return '#10B981';
    case 'health':
      return '#F59E0B';
    case 'learning':
      return '#3B82F6';
    case 'habit':
      return '#8B5CF6';
    default:
      return '#6B7280';
  }
};

const GoalModal: React.FC<GoalModalProps> = ({ open, onClose, goal }) => {
  const { addGoal, updateGoal } = useGoals();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [loading, setLoading] = useState(false);
  const [showDescription, setShowDescription] = useState(false);

  // Form state
  const isTimestampLike = (v: unknown): v is { toDate: () => Date } => {
    if (typeof v !== 'object' || v === null) return false;
    const maybe = v as { toDate?: unknown };
    return typeof maybe.toDate === 'function';
  };
  const normalizeToDate = (val: unknown): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (isTimestampLike(val)) return val.toDate();
    if (typeof val === 'string' || typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const [formData, setFormData] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    type: (goal?.type || 'custom') as GoalType,
    priority: (goal?.priority || 'Medium') as GoalPriority,
    dueDate: normalizeToDate(goal?.dueDate),
    overallTargetValue:
      (goal?.metrics as { totalTarget: number })?.totalTarget ||
      ('' as number | ''),
    overallTargetUnit: (goal?.metrics as { unit: string })?.unit || '',
    steps: goal?.steps || ([] as GoalStep[]),
    pinned: goal?.pinned || false,
  });

  const [newStep, setNewStep] = useState({
    title: '',
    description: '',
    targetValue: '',
    unit: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
  });

  const [showNewStepDescription, setShowNewStepDescription] = useState(false);
  const [stepsMode, setStepsMode] = useState<'auto' | 'manual'>('auto');
  const [milestonesCount, setMilestonesCount] = useState<number>(3);
  const [milestonesUserAdjusted, setMilestonesUserAdjusted] =
    useState<boolean>(false);
  const [touched, setTouched] = useState({
    overallTargetValue: false,
    overallTargetUnit: false,
    dueDate: false,
  });

  const handleInputChange = (field: string, value: unknown) => {
    // mark fields as user-touched to prevent auto-override on future title blur
    if (field === 'overallTargetValue')
      setTouched((p) => ({ ...p, overallTargetValue: true }));
    if (field === 'overallTargetUnit')
      setTouched((p) => ({ ...p, overallTargetUnit: true }));
    if (field === 'dueDate') setTouched((p) => ({ ...p, dueDate: true }));

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Auto-calc timeline when dueDate changes
    if (field === 'dueDate' && value) {
      const tl = computeTimelineFromDueDate(value as Date);
      setFormData((prev) => ({ ...prev, timeline: tl }));
      if (!milestonesUserAdjusted) {
        try {
          const s = suggestMilestonesBySpan(value as Date);
          setMilestonesCount(s);
        } catch {}
      }
    }
  };

  // Helpers
  const endOfMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const startOfMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), 1);
  const addMonths = (date: Date, m: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + m);
    return d;
  };

  const formatDate = (d: Date) => d; // Firestore Timestamp will be set in context; keep Date

  const monthPresetButtons = useMemo(() => {
    const now = new Date();
    // next three month ends including current month end if within 4 months
    const opts: { label: string; value: Date }[] = [];
    for (let i = 0; i < 4; i++) {
      const target = endOfMonth(addMonths(now, i));
      const label = target.toLocaleString('default', { month: 'short' });
      opts.push({ label: `End of ${label}`, value: target });
    }
    return opts;
  }, []);

  const maxDueDate = useMemo(() => {
    const now = new Date();
    return endOfMonth(addMonths(now, 4));
  }, []);

  // ---------- NLP helpers to auto-fill from title ----------
  const wink = useMemo(() => {
    try {
      // @ts-expect-error winkNLP type not available in current module
      return winkNLP ? winkNLP(model) : null;
    } catch {
      return null;
    }
  }, []);

  function parseGoalTitle(title: string): {
    dueDate?: Date;
    targetValue?: number;
    targetUnit?: string;
    priority?: GoalPriority;
    suggestedMilestones?: number;
  } {
    const result: {
      dueDate?: Date;
      targetValue?: number;
      targetUnit?: string;
      priority?: GoalPriority;
    } = {};
    if (!title || typeof title !== 'string') return result;

    // Compromise doc
    let comp: CompromiseDocumentWithDates | null;
    try {
      comp = nlp(title);
    } catch {
      comp = null;
    }

    // Wink tokens (for keyword-based priority)
    let tokensLower: string[] = [];
    try {
      const wdoc = wink ? wink.readDoc(title) : null;
      tokensLower = wdoc
        ? wdoc
            .tokens()
            .out()
            .map((t: string) => String(t).toLowerCase())
        : [];
    } catch {
      tokensLower = [];
    }

    // Target value & unit (money, weight, time)
    const money1 = /(rs|pkr|₨)\s*([0-9][\d,]*)/i.exec(title);
    const money2 = /([0-9][\d,]*)\s*(rs|pkr|₨)/i.exec(title);
    if (money1 || money2) {
      const m = money1 || money2;
      const valStr = (m?.[2] || m?.[1] || '').replace(/[^\d]/g, '');
      const val = Number(valStr);
      if (!Number.isNaN(val)) {
        result.targetValue = val;
        result.targetUnit = 'Rs';
      }
    } else {
      // generic number + unit (kg, hours) OR arbitrary noun (posts, pages, pushups, etc.)
      const numMatch =
        /([0-9][\d,]*)\s*(kg|kilograms?|lbs?|lb|hours?|hrs?|h)/i.exec(title);
      if (numMatch) {
        const val = Number(numMatch[1].replace(/,/g, ''));
        if (!Number.isNaN(val)) {
          result.targetValue = val;
          const u = numMatch[2].toLowerCase();
          if (/(kg|kilogram)/.test(u)) result.targetUnit = 'kg';
          else if (/(lb|lbs)/.test(u)) result.targetUnit = 'lb';
          else if (/(hour|hr|h)/.test(u)) result.targetUnit = 'hours';
        }
      } else {
        // 1) If NLP provides numbers, use that as targetValue
        if (
          comp &&
          typeof (comp as ReturnType<typeof nlp>).numbers === 'function'
        ) {
          const nums = (comp as ReturnType<typeof nlp>)
            .numbers()
            .out('array') as (string | number)[];
          if (nums && nums.length > 0) {
            const firstNum = Number(String(nums[0]).replace(/,/g, ''));
            if (!Number.isNaN(firstNum)) {
              result.targetValue = result.targetValue ?? firstNum;
            }
          }
        }
        // 2) Try to infer unit as the word following a number (excluding time/currency units)
        try {
          if (!result.targetUnit) {
            const excluded = new Set([
              'kg',
              'kilogram',
              'kilograms',
              'lb',
              'lbs',
              'hour',
              'hours',
              'hr',
              'h',
              'rs',
              'pkr',
              '₨',
              'month',
              'months',
              'week',
              'weeks',
              'day',
              'days',
            ]);
            const re = /([0-9][\d,]*)\s*([a-zA-Z][a-zA-Z-]*)/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(title)) !== null) {
              const val = Number(m[1].replace(/,/g, ''));
              const unitWord = m[2].toLowerCase();
              if (!Number.isNaN(val) && !excluded.has(unitWord)) {
                if (result.targetValue == null) result.targetValue = val;
                if (!result.targetUnit) result.targetUnit = unitWord;
                break;
              }
            }
          }
        } catch {}
      }
    }

    // Priority from keywords
    const hasHigh = tokensLower.some((t) =>
      /urgent|asap|critical|important|high/.test(t)
    );
    const hasMedium = tokensLower.some((t) => /medium|normal|average/.test(t));
    if (hasHigh) result.priority = 'High';
    else if (hasMedium) result.priority = 'Medium';
    else result.priority = 'Low';

    // DueDate from phrases like "in X months/weeks/days", "next month/week", etc.
    const monthsSpanNext = /in\s+next\s+(\d+)\s+months?/i.exec(title);
    const weeksSpanNext = /in\s+next\s+(\d+)\s+weeks?/i.exec(title);
    const daysSpanNext = /in\s+next\s+(\d+)\s+days?/i.exec(title);
    const monthsSpan = /in\s+(\d+)\s+months?/i.exec(title);
    const weeksSpan = /in\s+(\d+)\s+weeks?/i.exec(title);
    const daysSpan = /in\s+(\d+)\s+days?/i.exec(title);
    const nextMonthPhr = /\b(in\s+next\s+month|next\s+month)\b/i.test(title);
    const nextWeekPhr = /\b(in\s+next\s+week|next\s+week)\b/i.test(title);
    const tomorrowPhr = /\btomorrow\b/i.test(title);
    const todayPhr = /\btoday\b/i.test(title);
    const now = new Date();
    if (monthsSpanNext || monthsSpan) {
      const n = Number((monthsSpanNext?.[1] ?? monthsSpan?.[1]) || '0');
      if (!Number.isNaN(n) && n > 0)
        result.dueDate = endOfMonth(addMonths(now, Math.max(0, n - 1)));
    } else if (weeksSpanNext || weeksSpan) {
      const n = Number((weeksSpanNext?.[1] ?? weeksSpan?.[1]) || '0');
      if (!Number.isNaN(n) && n > 0) {
        const d = new Date(now);
        d.setDate(d.getDate() + n * 7);
        result.dueDate = d;
      }
    } else if (daysSpanNext || daysSpan) {
      const n = Number((daysSpanNext?.[1] ?? daysSpan?.[1]) || '0');
      if (!Number.isNaN(n) && n > 0) {
        const d = new Date(now);
        d.setDate(d.getDate() + n);
        result.dueDate = d;
      }
    } else if (nextMonthPhr) {
      result.dueDate = endOfMonth(addMonths(now, 1));
    } else if (nextWeekPhr) {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      result.dueDate = d;
    } else if (tomorrowPhr) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      result.dueDate = d;
    } else if (todayPhr) {
      result.dueDate = now;
    } else if (
      comp &&
      typeof (comp as CompromiseDocumentWithDates).dates === 'function'
    ) {
      // Try to parse basic date words like 'tomorrow', 'next week', 'next month'
      const dateText = (comp as CompromiseDocumentWithDates)
        .dates()
        .out('text');
      if (dateText) {
        const d = new Date(dateText);
        if (!Number.isNaN(d.getTime())) result.dueDate = d;
      }
    }

    // Suggest milestones count based on parsed spans or due date
    try {
      let suggested: number | undefined;
      const clamp = (n: number, min = 2, max = 6) =>
        Math.max(min, Math.min(max, n));
      if (monthsSpanNext || monthsSpan) {
        const n = Number((monthsSpanNext?.[1] ?? monthsSpan?.[1]) || '0');
        if (!Number.isNaN(n) && n > 0) suggested = clamp(n);
      } else if (weeksSpanNext || weeksSpan) {
        const n = Number((weeksSpanNext?.[1] ?? weeksSpan?.[1]) || '0');
        if (!Number.isNaN(n) && n > 0) suggested = clamp(n);
      } else if (daysSpanNext || daysSpan) {
        const n = Number((daysSpanNext?.[1] ?? daysSpan?.[1]) || '0');
        if (!Number.isNaN(n) && n > 0) {
          if (n >= 21) suggested = 4;
          else if (n >= 10) suggested = 3;
          else if (n >= 4) suggested = 2;
          else suggested = 2;
        }
      } else if (nextMonthPhr) {
        suggested = 4;
      } else if (nextWeekPhr) {
        suggested = 2;
      } else if (result.dueDate) {
        suggested = suggestMilestonesBySpan(result.dueDate);
      }
      if (suggested)
        (result as { suggestedMilestones: number }).suggestedMilestones =
          suggested;
    } catch {}
    return result;
  }

  // Trigger NLP only on title blur to avoid running on every keystroke
  const handleTitleBlur = () => {
    const t = formData.title?.trim();
    if (!t) return;
    const parsed = parseGoalTitle(t);
    setFormData((prev) => {
      const next = { ...prev } as typeof prev;
      if (!touched.overallTargetValue && typeof parsed.targetValue === 'number')
        next.overallTargetValue = parsed.targetValue;
      if (!touched.overallTargetUnit && parsed.targetUnit)
        next.overallTargetUnit = parsed.targetUnit;
      if (!touched.dueDate && parsed.dueDate) next.dueDate = parsed.dueDate;
      if (prev.priority === 'Medium' && parsed.priority)
        next.priority = parsed.priority;
      return next;
    });
    try {
      if (!milestonesUserAdjusted && parsed.suggestedMilestones) {
        setMilestonesCount(parsed.suggestedMilestones);
      }
    } catch {}
  };

  function suggestMilestonesBySpan(due: Date): number {
    const now = new Date();
    const days = Math.max(
      1,
      Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );
    if (days >= 150) return 6;
    if (days >= 90) return 4;
    if (days >= 60) return 3;
    if (days >= 14) return 3;
    if (days >= 7) return 2;
    return 2;
  }
  function computeTimelineFromDueDate(due: Date): string {
    const now = new Date();
    // rules: if day <=12 => count current month as whole month; if 13-23 => half month; if >23 => exclude
    const day = now.getDate();
    const end = endOfMonth(due);
    // months difference inclusive by month boundaries
    let months =
      (end.getFullYear() - now.getFullYear()) * 12 +
      (end.getMonth() - now.getMonth()) +
      1; // inclusive
    if (day > 23) months -= 1; // don't count current month
    else if (day >= 13) return `${Math.max(0, months - 1)}.5 months`;
    return `${Math.max(0, months)} months`;
  }

  // Quick presets for steps based on due date
  const stepMonthPresets = useMemo(() => {
    const presets: { key: string; label: string; start: Date; end: Date }[] =
      [];
    if (!formData.dueDate) return presets;
    const now = new Date();
    const end = formData.dueDate as Date;
    // compute number of months between now and due end-of-month
    const totalMonths =
      (end.getFullYear() - now.getFullYear()) * 12 +
      (end.getMonth() - now.getMonth()) +
      1;
    if (totalMonths > 2) {
      for (let i = 0; i < Math.min(totalMonths, 4); i++) {
        const start = i === 0 ? now : startOfMonth(addMonths(now, i));
        const endM = endOfMonth(addMonths(now, i));
        presets.push({
          key: `m${i + 1}`,
          label: `${i + 1}${['st', 'nd', 'rd', 'th'][Math.min(i, 3)]} month`,
          start,
          end: endM,
        });
      }
    }
    // weeks presets
    const thisWeekStart = startOfWeek(now);
    const thisWeekEnd = addDays(thisWeekStart, 6);
    const nextWeekStart = addDays(thisWeekStart, 7);
    const nextWeekEnd = addDays(nextWeekStart, 6);
    presets.push({
      key: 'w1',
      label: 'This week',
      start: thisWeekStart,
      end: thisWeekEnd,
    });
    presets.push({
      key: 'w2',
      label: 'Next week',
      start: nextWeekStart,
      end: nextWeekEnd,
    });
    return presets;
  }, [formData.dueDate]);

  function startOfWeek(date: Date) {
    const d = new Date(date);
    const diff = d.getDay(); // 0 Sun .. 6 Sat
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  const handleAddStep = () => {
    if (!newStep.title.trim()) return;

    const step: GoalStep = {
      id: Date.now().toString(),
      title: newStep.title,
      description: newStep.description || undefined,
      targetValue: newStep.targetValue
        ? parseFloat(newStep.targetValue)
        : undefined,
      unit: newStep.unit || undefined,
      startDate: newStep.startDate || undefined,
      endDate: newStep.endDate || undefined,
      completed: false,
    };

    setFormData((prev) => ({
      ...prev,
      steps: [...prev.steps, step],
    }));

    setNewStep({
      title: '',
      description: '',
      targetValue: '',
      unit: '',
      startDate: null,
      endDate: null,
    });
  };

  const handleRemoveStep = (stepId: string) => {
    setFormData((prev) => ({
      ...prev,
      steps: prev.steps.filter((step) => step.id !== stepId),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.dueDate) return;

    setLoading(true);
    try {
      const now = new Date();

      const goalData = {
        title: formData.title,
        description: formData.description || undefined,
        type: formData.type,
        priority: formData.priority,
        dueDate: formData.dueDate
          ? Timestamp.fromDate(new Date(formData.dueDate))
          : null,
        // map overall target to metrics when available
        metrics:
          typeof formData.overallTargetValue === 'number' &&
          formData.overallTargetUnit
            ? {
                totalTarget: formData.overallTargetValue,
                currency: formData.overallTargetUnit,
              }
            : undefined,
        steps: formData.steps.map((step) => ({
          ...step,
          startDate: step.startDate
            ? Timestamp.fromDate(
                step.startDate instanceof Date
                  ? step.startDate
                  : step.startDate.toDate()
              )
            : null,
          endDate: step.endDate
            ? Timestamp.fromDate(
                step.endDate instanceof Date
                  ? step.endDate
                  : step.endDate.toDate()
              )
            : null,
        })),
        pinned: formData.pinned,
        progress: goal?.progress || 0,
        status: goal?.status || 'Not Started',
        userId: user!.uid,
        authorName: user!.email || 'Anonymous',

        // 🕒 Firestore timestamps
        createdAt: goal ? goal.createdAt : Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      };

      if (goal) {
        await updateGoal(goal.id!, goalData);
      } else {
        await addGoal(goalData);
      }

      onClose();
    } catch (error) {
      console.error('Error saving goal:', error);
    } finally {
      setLoading(false);
    }
  };

  const goalTypes: { value: GoalType; label: string; icon: React.ReactNode }[] =
    [
      { value: 'finance', label: 'Finance', icon: <TrendingUp /> },
      { value: 'health', label: 'Health', icon: <FitnessCenter /> },
      { value: 'learning', label: 'Learning', icon: <School /> },
      { value: 'habit', label: 'Habit', icon: <Psychology /> },
      { value: 'custom', label: 'Custom', icon: <Category /> },
    ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
            borderRadius: '1rem',
          },
        }}
      >
        <DialogTitle className="flex justify-between items-center">
          <Typography
            component="div"
            variant="h6"
            className="font-semibold"
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
            }}
          >
            {goal ? 'Edit Goal' : 'Create New Goal'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent className="space-y-4">
          {/* Fields order: Title, Description, Target Value, Target Unit, Target Date, Steps, Type, Pin */}
          <Box>
            <Typography
              variant="subtitle1"
              className="font-semibold mb-3"
              sx={{ color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937' }}
            >
              Goal Details
            </Typography>

            <Box className="space-y-5">
              {/* i. Title */}
              <TextField
                fullWidth
                label="Goal Title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                onBlur={handleTitleBlur}
                placeholder="e.g., Save ₹5000 in 5 months"
                variant="outlined"
              />

              {/* ii. Description (collapsible with slight animation) */}
              <Box>
                <AnimatePresence initial={false}>
                  {showDescription && (
                    <motion.div
                      key="desc"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Description"
                        value={formData.description}
                        onChange={(e) =>
                          handleInputChange('description', e.target.value)
                        }
                        placeholder="Describe your goal in detail..."
                        variant="outlined"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <Typography
                  variant="body2"
                  onClick={() => setShowDescription((s) => !s)}
                  sx={{
                    mt: 2,
                    display: 'inline-block',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    color: theme?.mode === 'dark' ? '#93c5fd' : '#2563eb',
                    userSelect: 'none',
                  }}
                >
                  {showDescription ? 'Hide description' : 'Add description'}
                </Typography>
              </Box>

              {/* iii. Target Value */}
              <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  fullWidth
                  label="Target Value"
                  type="number"
                  value={formData.overallTargetValue}
                  onChange={(e) =>
                    handleInputChange(
                      'overallTargetValue',
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  placeholder="e.g., 5000"
                />
                {/* iv. Target Unit */}
                <TextField
                  fullWidth
                  label="Target Unit"
                  value={formData.overallTargetUnit}
                  onChange={(e) =>
                    handleInputChange('overallTargetUnit', e.target.value)
                  }
                  placeholder="e.g., Rs, kg, hours"
                />
              </Box>

              {/* v. Target Date */}
              <Box>
                <DatePicker
                  label="Target Date"
                  value={formData.dueDate}
                  onChange={(date) => handleInputChange('dueDate', date)}
                  maxDate={maxDueDate}
                  slotProps={{ textField: { fullWidth: true } }}
                />
                {/* Redesigned presets */}
                <Box className="flex flex-wrap gap-2 mt-3">
                  {monthPresetButtons.map((opt) => (
                    <Button
                      key={opt.label}
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        handleInputChange('dueDate', formatDate(opt.value))
                      }
                      sx={{
                        borderRadius: '9999px',
                        px: 1.5,
                        py: 0.5,
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor:
                          theme?.mode === 'dark' ? '#334155' : '#cbd5e1',
                        color: theme?.mode === 'dark' ? '#e2e8f0' : '#0f172a',
                        backgroundColor:
                          theme?.mode === 'dark' ? '#0b1220' : '#f8fafc',
                        '&:hover': {
                          backgroundColor:
                            theme?.mode === 'dark' ? '#111827' : '#eef2ff',
                        },
                      }}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>

          <Divider />

          {/* vi. Steps/Milestones */}
          <Box>
            <Typography
              variant="subtitle1"
              className="font-semibold mb-3"
              sx={{
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
              }}
            >
              Steps & Milestones
            </Typography>

            {/* Steps mode selector */}
            <Box className="flex items-center gap-2 mb-3">
              <Button
                size="small"
                variant={stepsMode === 'auto' ? 'contained' : 'outlined'}
                onClick={() => setStepsMode('auto')}
              >
                Auto
              </Button>
              <Button
                size="small"
                variant={stepsMode === 'manual' ? 'contained' : 'outlined'}
                onClick={() => setStepsMode('manual')}
              >
                Manual
              </Button>
            </Box>

            {stepsMode === 'auto' ? (
              <Box
                className="border rounded-lg p-4 mb-4"
                sx={{
                  borderColor: theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
                }}
              >
                <Typography variant="body2" className="font-medium mb-3">
                  Auto-generate milestones
                </Typography>
                <Box className="flex items-center gap-3 justify-start">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setMilestonesUserAdjusted(true);
                      setMilestonesCount(
                        Math.max(1, Math.floor(milestonesCount - 1))
                      );
                    }}
                    disabled={milestonesCount <= 1}
                  >
                    <Remove />
                  </IconButton>
                  <Typography variant="h4" fontWeight={700}>
                    {milestonesCount}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setMilestonesUserAdjusted(true);
                      setMilestonesCount(
                        Math.max(1, Math.floor(milestonesCount + 1))
                      );
                    }}
                  >
                    <Add />
                  </IconButton>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      if (!formData.dueDate) return;
                      let n = Math.max(1, Math.floor(milestonesCount));
                      if (!milestonesUserAdjusted) {
                        let suggested: number | undefined;
                        try {
                          suggested = parseGoalTitle(
                            formData.title || ''
                          ).suggestedMilestones;
                        } catch {}
                        if (!suggested) {
                          suggested = suggestMilestonesBySpan(
                            formData.dueDate as Date
                          );
                        }
                        if (suggested) n = suggested;
                      }
                      const start = new Date();
                      const end = formData.dueDate as Date;
                      const totalMs = end.getTime() - start.getTime();
                      const stepMs = Math.floor(totalMs / n);
                      const unit = formData.overallTargetUnit || '';
                      const totalTarget =
                        typeof formData.overallTargetValue === 'number'
                          ? formData.overallTargetValue
                          : 0;
                      const per =
                        n > 0 ? Math.floor((totalTarget / n) * 100) / 100 : 0;
                      const generated: GoalStep[] = Array.from({
                        length: n,
                      }).map((_, i) => {
                        const s = new Date(start.getTime() + i * stepMs);
                        const e =
                          i === n - 1
                            ? new Date(end)
                            : new Date(start.getTime() + (i + 1) * stepMs - 1);
                        return {
                          id: `${Date.now()}_${i}`,
                          title: `Milestone ${i + 1}`,
                          description: undefined,
                          targetValue: per || undefined,
                          unit: unit || undefined,
                          startDate: s,
                          endDate: e,
                          completed: false,
                        };
                      });
                      setFormData((prev) => ({ ...prev, steps: generated }));
                    }}
                  >
                    Generate
                  </Button>
                  <Button size="small" onClick={() => setStepsMode('manual')}>
                    Create manually
                  </Button>
                </Box>
              </Box>
            ) : null}

            {/* Manual: Add New Step */}
            {stepsMode === 'manual' && (
              <Box
                className="border rounded-lg p-4 mb-4"
                sx={{
                  borderColor: theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
                }}
              >
                <Typography variant="body2" className="font-medium mb-3">
                  Add New Step
                </Typography>

                <Box className="space-y-3">
                  <Box className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <TextField
                      fullWidth
                      size="small"
                      label="Step Title"
                      value={newStep.title}
                      onChange={(e) =>
                        setNewStep((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="e.g., Save ₹1000 in January"
                    />
                    <Box>
                      <AnimatePresence initial={false}>
                        {showNewStepDescription && (
                          <motion.div
                            key="stepdesc"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <TextField
                              fullWidth
                              size="small"
                              label="Description"
                              value={newStep.description}
                              onChange={(e) =>
                                setNewStep((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                              placeholder="Optional description"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <Typography
                        variant="caption"
                        onClick={() => setShowNewStepDescription((s) => !s)}
                        sx={{
                          mt: 1,
                          display: 'inline-block',
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          cursor: 'pointer',
                          color: theme?.mode === 'dark' ? '#93c5fd' : '#2563eb',
                          userSelect: 'none',
                        }}
                      >
                        {showNewStepDescription
                          ? 'Hide description'
                          : 'Add description'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Quick presets for step dates */}
                  {stepMonthPresets.length > 0 && (
                    <Box className="flex flex-wrap gap-2 mb-2">
                      {stepMonthPresets.map((p) => (
                        <Button
                          key={p.key}
                          size="small"
                          variant="outlined"
                          onClick={() =>
                            setNewStep((prev) => ({
                              ...prev,
                              startDate: p.start,
                              endDate: p.end,
                            }))
                          }
                        >
                          {p.label}
                        </Button>
                      ))}
                    </Box>
                  )}

                  <Box className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <TextField
                      fullWidth
                      size="small"
                      label="Target Value"
                      type="number"
                      value={newStep.targetValue}
                      onChange={(e) =>
                        setNewStep((prev) => ({
                          ...prev,
                          targetValue: e.target.value,
                        }))
                      }
                      placeholder="1000"
                    />

                    <TextField
                      fullWidth
                      size="small"
                      label="Unit"
                      value={newStep.unit}
                      onChange={(e) =>
                        setNewStep((prev) => ({
                          ...prev,
                          unit: e.target.value,
                        }))
                      }
                      placeholder="Rs, kg, hours"
                    />

                    <DatePicker
                      label="Start Date"
                      value={newStep.startDate}
                      onChange={(date: Date | null) =>
                        setNewStep((prev) => ({ ...prev, startDate: date }))
                      }
                      slotProps={{
                        textField: {
                          size: 'small',
                          fullWidth: true,
                        },
                      }}
                    />

                    <DatePicker
                      label="End Date"
                      value={newStep.endDate}
                      onChange={(date: Date | null) =>
                        setNewStep((prev) => ({ ...prev, endDate: date }))
                      }
                      slotProps={{
                        textField: {
                          size: 'small',
                          fullWidth: true,
                        },
                      }}
                    />
                  </Box>

                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={handleAddStep}
                    disabled={!newStep.title.trim()}
                    size="small"
                  >
                    Add Step
                  </Button>
                </Box>
              </Box>
            )}

            {/* Existing Steps */}
            <AnimatePresence>
              {formData.steps.map((step) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <Box
                    className="flex items-center justify-between p-3 border rounded-lg mb-2"
                    sx={{
                      borderColor:
                        theme?.mode === 'dark' ? '#374151' : '#e5e7eb',
                      backgroundColor:
                        theme?.mode === 'dark' ? '#37415120' : '#f9fafb',
                    }}
                  >
                    <Box className="flex-1">
                      <Typography variant="body2" className="font-medium">
                        {step.title}
                      </Typography>
                      {step.description && (
                        <Typography
                          variant="caption"
                          sx={{
                            color:
                              theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
                          }}
                        >
                          {step.description}
                        </Typography>
                      )}
                      {(step.targetValue || step.unit) && (
                        <Typography variant="caption" className="block">
                          Target: {step.targetValue} {step.unit}
                        </Typography>
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveStep(step.id)}
                      sx={{ color: '#EF4444' }}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>
          </Box>

          <Divider />

          {/* vii. Type & viii. Pin */}
          <Box>
            <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  label="Type"
                >
                  {goalTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box className="flex items-center gap-2">
                        <Box sx={{ color: getGoalTypeColor(type.value) }}>
                          {type.icon}
                        </Box>
                        {type.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) =>
                    handleInputChange('priority', e.target.value)
                  }
                  label="Priority"
                >
                  <MenuItem value="Low">
                    <Chip
                      label="Low"
                      size="small"
                      sx={{ backgroundColor: '#10B98120', color: '#10B981' }}
                    />
                  </MenuItem>
                  <MenuItem value="Medium">
                    <Chip
                      label="Medium"
                      size="small"
                      sx={{ backgroundColor: '#F59E0B20', color: '#F59E0B' }}
                    />
                  </MenuItem>
                  <MenuItem value="High">
                    <Chip
                      label="High"
                      size="small"
                      sx={{ backgroundColor: '#EF444420', color: '#EF4444' }}
                    />
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box className="mt-4">
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.pinned}
                    onChange={(e) =>
                      handleInputChange('pinned', e.target.checked)
                    }
                  />
                }
                label="Pin to top"
              />
            </Box>
          </Box>
        </DialogContent>

        <DialogActions className="p-4">
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !formData.title.trim() || !formData.dueDate}
            sx={{
              backgroundColor: '#3B82F6',
              '&:hover': {
                backgroundColor: '#2563eb',
              },
            }}
          >
            {loading ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default GoalModal;
