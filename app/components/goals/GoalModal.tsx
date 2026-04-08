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
  useMediaQuery,
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
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { useGoals } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { Goal, GoalType, GoalPriority } from '../../lib/interface';
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
    case 'work':
      return '#0ea5e9';
    case 'lifestyle':
      return '#F472B6';
    default:
      return '#6B7280';
  }
};

// Units configuration by goal type
const GOAL_UNITS_CONFIG: Record<
  GoalType,
  {
    label: string;
    units: Array<{ value: string; label: string }>;
    defaultUnit: string;
    allowCustomInput?: boolean;
  }
> = {
  finance: {
    label: 'Finance',
    units: [
      { value: 'PKR', label: 'Pakistani Rupees' },
      { value: 'USD', label: 'US Dollars' },
      { value: 'EUR', label: 'Euros' },
      { value: '%', label: 'Percentage' },
      { value: 'transactions', label: 'Transactions' },
      { value: 'items', label: 'Items' },
    ],
    defaultUnit: 'PKR',
  },
  health: {
    label: 'Health',
    units: [
      { value: 'kg', label: 'Kilograms' },
      { value: 'lbs', label: 'Pounds' },
      { value: 'steps', label: 'Steps' },
      { value: 'minutes', label: 'Minutes' },
      { value: 'hours', label: 'Hours' },
      { value: 'days', label: 'Days' },
      { value: '%', label: 'Percentage' },
    ],
    defaultUnit: 'kg',
  },
  learning: {
    label: 'Learning',
    units: [
      { value: 'minutes', label: 'Minutes' },
      { value: 'hours', label: 'Hours' },
      { value: 'lessons', label: 'Lessons' },
      { value: 'chapters', label: 'Chapters' },
      { value: 'pages', label: 'Pages' },
      { value: 'courses', label: 'Courses' },
    ],
    defaultUnit: 'hours',
  },
  habit: {
    label: 'Habit',
    units: [
      { value: 'days', label: 'Days' },
      { value: 'times', label: 'Times' },
      { value: 'streak', label: 'Streak' },
      { value: 'weeks', label: 'Weeks' },
    ],
    defaultUnit: 'days',
  },
  work: {
    label: 'Work',
    units: [
      { value: 'tasks', label: 'Tasks' },
      { value: 'hours', label: 'Hours' },
      { value: 'projects', label: 'Projects' },
      { value: '%', label: 'Percentage' },
      { value: 'clients', label: 'Clients' },
    ],
    defaultUnit: 'tasks',
  },
  lifestyle: {
    label: 'Lifestyle',
    units: [
      { value: 'days', label: 'Days' },
      { value: 'sessions', label: 'Sessions' },
      { value: 'events', label: 'Events' },
      { value: 'activities', label: 'Activities' },
      { value: 'hours', label: 'Hours' },
    ],
    defaultUnit: 'days',
  },
  custom: {
    label: 'Custom',
    units: [{ value: 'custom', label: 'Custom Unit' }],
    defaultUnit: 'custom',
    allowCustomInput: true,
  },
};

const GoalModal: React.FC<GoalModalProps> = ({ open, onClose, goal }) => {
  const { addGoal, updateGoal } = useGoals();

  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isMobile = useMediaQuery('(max-width:600px)');
  const [loading, setLoading] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const defaultUnit = GOAL_UNITS_CONFIG[goal?.type || 'custom'].defaultUnit;

  const [formData, setFormData] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    type: (goal?.type || 'custom') as GoalType,
    priority: (goal?.priority || 'Medium') as GoalPriority,
    dueDate: normalizeToDate(goal?.dueDate),
    overallTargetValue: (goal?.overallTargetValue || '') as number | '',
    overallTargetUnit: goal?.overallTargetUnit || defaultUnit,
    pinned: goal?.pinned || false,
  });

  const [touched] = useState({
    overallTargetValue: false,
    overallTargetUnit: false,
    dueDate: false,
  });

  const [milestonesUserAdjusted, setMilestonesCount] = useState<
    number | boolean
  >(false);

  // ...existing code...

  const handleInputChange = (field: string, value: unknown) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // When type changes, update unit to the default for that type
      if (field === 'type') {
        next.overallTargetUnit =
          GOAL_UNITS_CONFIG[value as GoalType].defaultUnit;
      }
      return next;
    });
  };

  // Helpers
  const endOfMonth = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0);

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
      /urgent|asap|critical|important|high/.test(t),
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

  const handleTitleChange = (value: string) => {
    handleInputChange('title', value);
    const t = value.trim();
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
      Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );
    if (days >= 150) return 6;
    if (days >= 90) return 4;
    if (days >= 60) return 3;
    if (days >= 14) return 3;
    if (days >= 7) return 2;
    return 2;
  }
  // Steps/Milestones logic removed

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.dueDate) return;
    setLoading(true);
    try {
      const now = new Date();
      const goalData: Goal = {
        title: formData.title,
        description: formData.description || undefined,
        type: formData.type,
        priority: formData.priority,
        dueDate: formData.dueDate
          ? Timestamp.fromDate(new Date(formData.dueDate))
          : Timestamp.fromDate(now),
        overallTargetValue:
          typeof formData.overallTargetValue === 'number'
            ? formData.overallTargetValue
            : undefined,
        overallTargetUnit: formData.overallTargetUnit || undefined,
        pinned: formData.pinned,
        progress: goal?.progress || 0,
        status: goal?.status || 'Not Started',
        userId: user!.uid,
        createdAt: goal?.createdAt || Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
        authorName: user?.email || 'Anonymous',
        steps: goal?.steps || [],
      };
      let newGoalId = goal?.id;
      if (goal) {
        await updateGoal(goal.id!, goalData);
      } else {
        newGoalId = await addGoal(goalData);
      }
      if (newGoalId) {
        router.push(`/goals/${newGoalId}`);
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
      { value: 'work', label: 'Work', icon: <WorkOutline /> },
      { value: 'lifestyle', label: 'Lifestyle', icon: <SelfImprovement /> },
      { value: 'custom', label: 'Custom', icon: <Category /> },
    ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            background:
              theme?.mode === 'dark'
                ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: '1rem',
            boxShadow:
              theme?.mode === 'dark'
                ? '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                : '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <DialogTitle
          sx={{
            background:
              theme?.mode === 'dark'
                ? 'linear-gradient(135deg, #334155 0%, #1e293b 100%)'
                : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            borderBottom: `1px solid ${theme?.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography
            component="div"
            variant="h6"
            className="font-semibold"
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
            }}
          >
            {goal ? 'Edit Goal' : 'Create New Goal'}
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ color: theme?.mode === 'dark' ? '#94a3b8' : '#475569' }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3, pb: 3, px: 3 }}>
          {/* TOP SECTION: Title, Type, Due Date */}
          <Box
            sx={{
              backgroundColor:
                theme?.mode === 'dark'
                  ? 'rgba(51, 65, 85, 0.3)'
                  : 'rgba(226, 232, 240, 0.5)',
              borderRadius: '1rem',
              p: 4,
              border: `1px solid ${
                theme?.mode === 'dark'
                  ? 'rgba(71, 85, 105, 0.5)'
                  : 'rgba(203, 213, 225, 0.5)'
              }`,
              mb: 4,
            }}
          >
            <Typography
              variant="subtitle2"
              className="font-semibold mb-4 uppercase"
              sx={{
                color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
                fontSize: '0.75rem',
                letterSpacing: '0.5px',
              }}
            >
              Core Goal Settings
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* i. Title */}
              <TextField
                fullWidth
                label={
                  <span>
                    <b>Goal Title</b>{' '}
                    <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                }
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g., Save ₹5000 in 5 months"
                variant="outlined"
                InputProps={{
                  style: {
                    fontWeight: 500,
                    fontSize: '1.1rem',
                    letterSpacing: '0.01em',
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '0.75rem',
                    backgroundColor:
                      theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
                  },
                  '& .MuiInputLabel-root': {
                    fontWeight: 600,
                  },
                  mb: 1,
                }}
                autoFocus
                required
              />

              {/* ii. Type & Due Date side by side */}
              <Box className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormControl fullWidth>
                  <InputLabel>
                    <b>Goal Type</b>
                  </InputLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    label="Goal Type"
                    sx={{
                      borderRadius: '0.75rem',
                      backgroundColor:
                        theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
                    }}
                  >
                    {goalTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        <Box className="flex items-center gap-2">
                          <Box sx={{ color: getGoalTypeColor(type.value) }}>
                            {type.icon}
                          </Box>
                          <span style={{ fontWeight: 600 }}>{type.label}</span>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box>
                  <DatePicker
                    label={
                      <span>
                        <b>Target Date</b>{' '}
                        <span style={{ color: '#ef4444' }}>*</span>
                      </span>
                    }
                    value={formData.dueDate}
                    onChange={(date) => handleInputChange('dueDate', date)}
                    maxDate={maxDueDate}
                    slotProps={{
                      textField: { fullWidth: true, required: true },
                    }}
                  />
                </Box>
              </Box>

              {/* Quick presets */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                {monthPresetButtons.map((opt) => (
                  <Button
                    key={opt.label}
                    size="small"
                    variant={
                      formData.dueDate &&
                      new Date(formData.dueDate).toDateString() ===
                        opt.value.toDateString()
                        ? 'contained'
                        : 'outlined'
                    }
                    onClick={() =>
                      handleInputChange('dueDate', formatDate(opt.value))
                    }
                    sx={{
                      borderRadius: '9999px',
                      px: 1.5,
                      py: 0.5,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      backgroundColor:
                        formData.dueDate &&
                        new Date(formData.dueDate).toDateString() ===
                          opt.value.toDateString()
                          ? getGoalTypeColor(formData.type)
                          : 'transparent',
                      borderColor:
                        theme?.mode === 'dark' ? '#475569' : '#cbd5e1',
                      color:
                        formData.dueDate &&
                        new Date(formData.dueDate).toDateString() ===
                          opt.value.toDateString()
                          ? '#ffffff'
                          : theme?.mode === 'dark'
                            ? '#e2e8f0'
                            : '#0f172a',
                      '&:hover': {
                        backgroundColor: getGoalTypeColor(formData.type) + '20',
                      },
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </Box>
            </Box>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* ADVANCED SECTION (Collapsible) */}
          <Button
            fullWidth
            onClick={() => setShowAdvanced(!showAdvanced)}
            sx={{
              justifyContent: 'space-between',
              pt: 3,
              pb: 3,
              textTransform: 'none',
              fontSize: '1.1rem',
              fontWeight: 600,
              color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
              '&:hover': {
                backgroundColor:
                  theme?.mode === 'dark'
                    ? 'rgba(71, 85, 105, 0.2)'
                    : 'rgba(226, 232, 240, 0.3)',
              },
            }}
          >
            Advanced Settings
            {showAdvanced ? <ExpandLess /> : <ExpandMore />}
          </Button>

          <AnimatePresence initial={false}>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3.5,
                    pt: 3,
                    pb: 2,
                  }}
                >
                  {/* i. Target Value */}
                  <TextField
                    fullWidth
                    label={
                      <span>
                        <b>Target Value</b>{' '}
                        <span style={{ color: '#ef4444' }}>*</span>
                      </span>
                    }
                    type="number"
                    value={formData.overallTargetValue}
                    onChange={(e) =>
                      handleInputChange(
                        'overallTargetValue',
                        e.target.value === '' ? '' : Number(e.target.value),
                      )
                    }
                    placeholder="e.g., 5000"
                    InputProps={{
                      style: {
                        fontWeight: 500,
                        fontSize: '1.05rem',
                      },
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.75rem',
                      },
                      mb: 1,
                    }}
                    required
                  />

                  {/* ii. Target Unit - Dynamic based on Goal Type */}
                  <FormControl fullWidth>
                    <InputLabel>
                      <b>How you will measure</b>
                    </InputLabel>
                    <Select
                      value={formData.overallTargetUnit}
                      onChange={(e) =>
                        handleInputChange('overallTargetUnit', e.target.value)
                      }
                      label="How you will measure"
                      sx={{
                        borderRadius: '0.75rem',
                      }}
                    >
                      {GOAL_UNITS_CONFIG[formData.type].units.map((unit) => (
                        <MenuItem key={unit.value} value={unit.value}>
                          <span style={{ fontWeight: 500 }}>{unit.label}</span>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Description */}
                  <Box sx={{ pt: 1 }}>
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
                            label={
                              <span>
                                <b>Description</b>
                              </span>
                            }
                            value={formData.description}
                            onChange={(e) =>
                              handleInputChange('description', e.target.value)
                            }
                            placeholder="Describe your goal in detail... (optional)"
                            variant="outlined"
                            InputProps={{
                              style: {
                                fontWeight: 400,
                                fontSize: '1rem',
                              },
                            }}
                            sx={{
                              mb: 2,
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '0.75rem',
                              },
                            }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <Button
                      size="small"
                      onClick={() => setShowDescription((s) => !s)}
                      sx={{
                        textTransform: 'none',
                        color: theme?.mode === 'dark' ? '#93c5fd' : '#2563eb',
                        fontSize: '0.875rem',
                      }}
                    >
                      {showDescription ? 'Hide description' : 'Add description'}
                    </Button>
                  </Box>

                  {/* iii. Priority */}
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={formData.priority}
                      onChange={(e) =>
                        handleInputChange('priority', e.target.value)
                      }
                      label="Priority"
                      sx={{
                        borderRadius: '0.75rem',
                      }}
                    >
                      <MenuItem value="Low">
                        <Chip
                          label="Low"
                          size="small"
                          sx={{
                            backgroundColor: '#10B98120',
                            color: '#10B981',
                          }}
                        />
                      </MenuItem>
                      <MenuItem value="Medium">
                        <Chip
                          label="Medium"
                          size="small"
                          sx={{
                            backgroundColor: '#F59E0B20',
                            color: '#F59E0B',
                          }}
                        />
                      </MenuItem>
                      <MenuItem value="High">
                        <Chip
                          label="High"
                          size="small"
                          sx={{
                            backgroundColor: '#EF444420',
                            color: '#EF4444',
                          }}
                        />
                      </MenuItem>
                    </Select>
                  </FormControl>

                  <Box>
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
                      sx={{ mt: 0.5 }}
                    />
                  </Box>

                  {/* Steps & Milestones section removed for cleaner UI */}
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>

        <DialogActions
          sx={{
            p: 3,
            gap: 2,
            borderTop: `1px solid ${theme?.mode === 'dark' ? '#475569' : '#cbd5e1'}`,
          }}
        >
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !formData.title.trim()}
            sx={{
              backgroundColor: getGoalTypeColor(formData.type),
              '&:hover': {
                backgroundColor: getGoalTypeColor(formData.type) + 'dd',
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
