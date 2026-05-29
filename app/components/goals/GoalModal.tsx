'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Switch,
  useMediaQuery,
  Stack,
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
  PushPin,
  AutoAwesome as MagicIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { useGoals } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { Goal, GoalType, GoalPriority } from '../../lib/interface';
import { motion, AnimatePresence } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';
import nlp from 'compromise';
import winkNLP from 'wink-nlp';

type CompromiseDocumentWithDates = ReturnType<typeof nlp> & {
  dates: () => { out: (format: string) => string };
};

interface GoalModalProps {
  open: boolean;
  onClose: () => void;
  goal?: Goal;
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

const UNITS: Record<GoalType, string[]> = {
  finance:   ['PKR', 'USD', 'EUR', '%', 'transactions', 'items'],
  health:    ['kg', 'lbs', 'steps', 'minutes', 'hours', 'days', '%'],
  learning:  ['minutes', 'hours', 'lessons', 'chapters', 'pages', 'courses'],
  habit:     ['days', 'times', 'streak', 'weeks'],
  work:      ['tasks', 'hours', 'projects', '%', 'clients'],
  lifestyle: ['days', 'sessions', 'events', 'activities', 'hours'],
  custom:    ['custom'],
};

const DEFAULT_UNIT: Record<GoalType, string> = {
  finance: 'PKR', health: 'kg', learning: 'hours',
  habit: 'days', work: 'tasks', lifestyle: 'days', custom: 'custom',
};

const PRIORITY_CONFIG = {
  Low:    { bg: 'rgba(16,185,129,0.12)', color: '#10B981', border: 'rgba(16,185,129,0.3)' },
  Medium: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  High:   { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', border: 'rgba(239,68,68,0.3)' },
};

// ─── helpers ──────────────────────────────────────────────────────────────────
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addMonths  = (d: Date, m: number) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; };

const isTimestampLike = (v: unknown): v is { toDate: () => Date } =>
  typeof v === 'object' && v !== null && typeof (v as { toDate?: unknown }).toDate === 'function';

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

export default function GoalModal({ open, onClose, goal }: GoalModalProps) {
  const { addGoal, updateGoal } = useGoals();
  const router  = useRouter();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isMobile = useMediaQuery('(max-width:600px)');
  const isDark = theme?.mode === 'dark';

  const [loading,      setLoading]      = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aiParsed,     setAiParsed]     = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // ── form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    title:              goal?.title             || '',
    description:        goal?.description       || '',
    type:              (goal?.type              || 'custom') as GoalType,
    priority:          (goal?.priority          || 'Medium') as GoalPriority,
    dueDate:            normalizeToDate(goal?.dueDate),
    overallTargetValue:(goal?.overallTargetValue || '') as number | '',
    overallTargetUnit:  goal?.overallTargetUnit  || DEFAULT_UNIT['custom'],
    pinned:             goal?.pinned             || false,
    tags:              (goal?.tags              || []) as string[],
    privacy:           (goal?.privacy           || 'private') as 'private' | 'public' | 'specific',
    notes:              goal?.notes             || '',
  });

  const [tagInput, setTagInput] = useState('');

  const activeColor = TYPE_COLORS[formData.type];

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => titleRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  const set = (field: string, value: unknown) =>
    setFormData(prev => {
      const next = { ...prev, [field]: value } as typeof prev;
      if (field === 'type') {
        next.overallTargetUnit = DEFAULT_UNIT[value as GoalType];
      }
      return next;
    });

  // ── date presets ────────────────────────────────────────────────────────────
  const now = useMemo(() => new Date(), []);
  const maxDate = useMemo(() => endOfMonth(addMonths(now, 4)), [now]);
  const datePresets = useMemo(() =>
    Array.from({ length: 4 }, (_, i) => {
      const d = endOfMonth(addMonths(now, i));
      return { label: `End of ${d.toLocaleString('default', { month: 'short' })}`, date: d };
    }), [now]);

  // ── NLP ─────────────────────────────────────────────────────────────────────
  const wink = useMemo(() => {
    try { return (winkNLP as unknown as (m: unknown) => unknown)(null); } catch { return null; }
  }, []);

  function parseTitle(title: string) {
    const result: {
      dueDate?: Date; targetValue?: number; targetUnit?: string; priority?: GoalPriority;
    } = {};
    if (!title) return result;

    let comp: CompromiseDocumentWithDates | null = null;
    try { comp = nlp(title) as CompromiseDocumentWithDates; } catch { /* noop */ }

    let tokens: string[] = [];
    try {
      const wdoc = wink ? (wink as { readDoc: (t: string) => { tokens: () => { out: () => string[] } } }).readDoc(title) : null;
      tokens = wdoc ? wdoc.tokens().out().map((t: string) => t.toLowerCase()) : [];
    } catch { /* noop */ }

    // money
    const m1 = /(rs|pkr|₨)\s*([0-9][\d,]*)/i.exec(title);
    const m2 = /([0-9][\d,]*)\s*(rs|pkr|₨)/i.exec(title);
    if (m1 || m2) {
      const m = m1 || m2;
      const v = Number((m?.[2] || m?.[1] || '').replace(/[^\d]/g, ''));
      if (!isNaN(v)) { result.targetValue = v; result.targetUnit = 'PKR'; }
    } else {
      const nm = /([0-9][\d,]*)\s*(kg|kilograms?|lbs?|hours?|hrs?)/i.exec(title);
      if (nm) {
        const v = Number(nm[1].replace(/,/g, ''));
        if (!isNaN(v)) {
          result.targetValue = v;
          const u = nm[2].toLowerCase();
          if (/kg|kilogram/.test(u)) result.targetUnit = 'kg';
          else if (/lb/.test(u))     result.targetUnit = 'lbs';
          else                        result.targetUnit = 'hours';
        }
      } else if (comp && typeof (comp as ReturnType<typeof nlp>).numbers === 'function') {
        const nums = (comp as ReturnType<typeof nlp>).numbers().out('array') as (string | number)[];
        if (nums?.length) {
          const v = Number(String(nums[0]).replace(/,/g, ''));
          if (!isNaN(v)) result.targetValue = v;
        }
      }
    }

    // priority
    if (tokens.some(t => /urgent|asap|critical|important|high/.test(t)))   result.priority = 'High';
    else if (tokens.some(t => /medium|normal|average/.test(t)))             result.priority = 'Medium';
    else result.priority = 'Low';

    // due date
    const ms  = /in\s+(?:next\s+)?(\d+)\s+months?/i.exec(title);
    const ws  = /in\s+(?:next\s+)?(\d+)\s+weeks?/i.exec(title);
    const ds  = /in\s+(?:next\s+)?(\d+)\s+days?/i.exec(title);
    const n = new Date();
    if (ms)                                     result.dueDate = endOfMonth(addMonths(n, Number(ms[1]) - 1));
    else if (ws)                                { const d = new Date(n); d.setDate(d.getDate() + Number(ws[1]) * 7); result.dueDate = d; }
    else if (ds)                                { const d = new Date(n); d.setDate(d.getDate() + Number(ds[1]));    result.dueDate = d; }
    else if (/\bnext\s+month\b/i.test(title))   result.dueDate = endOfMonth(addMonths(n, 1));
    else if (/\bnext\s+week\b/i.test(title))    { const d = new Date(n); d.setDate(d.getDate() + 7); result.dueDate = d; }
    else if (/\btomorrow\b/i.test(title))       { const d = new Date(n); d.setDate(d.getDate() + 1); result.dueDate = d; }
    else if (/\btoday\b/i.test(title))          result.dueDate = n;
    else if (comp && typeof comp.dates === 'function') {
      const txt = comp.dates().out('text');
      if (txt) { const d = new Date(txt); if (!isNaN(d.getTime())) result.dueDate = d; }
    }

    return result;
  }

  const handleTitleChange = (value: string) => {
    set('title', value);
    const parsed = parseTitle(value.trim());
    const hasAny = parsed.targetValue != null || parsed.dueDate != null;
    setAiParsed(hasAny);
    setFormData(prev => ({
      ...prev,
      title: value,
      overallTargetValue: parsed.targetValue ?? prev.overallTargetValue,
      overallTargetUnit:  parsed.targetUnit  ?? prev.overallTargetUnit,
      dueDate:            parsed.dueDate     ?? prev.dueDate,
      priority:           parsed.priority    ?? prev.priority,
    }));
  };

  // ── tags ────────────────────────────────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !formData.tags.includes(t)) set('tags', [...formData.tags, t]);
    setTagInput('');
  };

  // ── submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.dueDate) return;
    setLoading(true);
    try {
      const nowTs = new Date();
      const goalData: Goal = {
        title:              formData.title,
        description:        formData.description || undefined,
        type:               formData.type,
        priority:           formData.priority,
        dueDate:            Timestamp.fromDate(new Date(formData.dueDate)),
        overallTargetValue: typeof formData.overallTargetValue === 'number' ? formData.overallTargetValue : undefined,
        overallTargetUnit:  formData.overallTargetUnit || undefined,
        pinned:             formData.pinned,
        tags:               formData.tags.length ? formData.tags : undefined,
        privacy:            formData.privacy,
        notes:              formData.notes || undefined,
        progress:           goal?.progress || 0,
        status:             goal?.status   || 'Not Started',
        userId:             user!.uid,
        createdAt:          goal?.createdAt || Timestamp.fromDate(nowTs),
        updatedAt:          Timestamp.fromDate(nowTs),
        authorName:         user?.email || 'Anonymous',
        steps:              goal?.steps  || [],
      };
      let newGoalId = goal?.id;
      if (goal) {
        await updateGoal(goal.id!, goalData);
      } else {
        newGoalId = await addGoal(goalData);
      }
      if (newGoalId) router.push(`/goals/${newGoalId}`);
      onClose();
    } catch (err) {
      console.error('Error saving goal:', err);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = formData.title.trim() && formData.dueDate;

  // ── sx helpers ──────────────────────────────────────────────────────────────



  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          className: "rounded-[28px] overflow-hidden shadow-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800",
          sx: { borderRadius: '28px' }
        }}
      >
        {/* ── Premium Gradient Header ── */}
        <Box className="p-6 bg-gradient-to-br from-violet-500 to-indigo-700 text-white flex justify-between items-center">
          <Box>
            <Typography variant="h6" className="font-extrabold">
              {goal ? 'Edit Goal' : 'Set New Goal'}
            </Typography>
            <Typography variant="body2" className="opacity-90">
              {goal ? 'Refine your achievement details' : 'Define your path to success'}
            </Typography>
          </Box>
          <Box className="flex items-center gap-2">
            {aiParsed && (
              <Chip
                icon={<MagicIcon style={{ fontSize: 12, color: '#fff' }} />}
                label="AI Parsed"
                size="small"
                className="bg-white/20 text-white border-none font-bold px-1"
                sx={{ '& .MuiChip-icon': { color: 'inherit !important' } }}
              />
            )}
            <IconButton onClick={onClose} className="text-white hover:bg-white/20 transition-colors">
              <Close />
            </IconButton>
          </Box>
        </Box>

        <DialogContent className="p-6">
          <Box className="flex flex-col gap-10 pt-4">
            {/* ── Title ── */}
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                🏷️ Goal Title <span className="text-red-500">*</span>
              </Typography>
              <TextField
                inputRef={titleRef}
                fullWidth
                value={formData.title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="e.g. Save PKR 50k in 3 months"
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '& fieldset': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                    '&:hover fieldset': { borderColor: activeColor },
                    '&.Mui-focused fieldset': { borderColor: activeColor, borderWidth: '2px' },
                    '&.Mui-focused': { boxShadow: `0 0 0 4px ${activeColor}15` }
                  }
                }}
              />
            </Box>

            {/* ── Category strip ── */}
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                📂 Category
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {GOAL_TYPES.map(({ value, label, icon }) => {
                  const active = formData.type === value;
                  const color = TYPE_COLORS[value];
                  return (
                    <Box
                      key={value}
                      onClick={() => set('type', value)}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer select-none transition-all duration-200 border
                        ${active 
                          ? 'text-white shadow-lg' 
                          : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                        }
                      `}
                      style={{ 
                        backgroundColor: active ? color : undefined,
                        borderColor: active ? 'transparent' : undefined,
                        boxShadow: active ? `0 4px 12px ${color}40` : undefined
                      }}
                    >
                      <Box className={active ? 'text-white' : ''} sx={{ '& svg': { fontSize: 16 } }}>
                        {icon}
                      </Box>
                      <Typography className="text-sm font-bold">
                        {label}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Box>

            {/* ── Target value + unit ── */}
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                🎯 Target
              </Typography>
              <Stack direction="row" gap={2}>
                <TextField
                  type="number"
                  value={formData.overallTargetValue}
                  onChange={e => set('overallTargetValue', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="flex-[2]"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '16px',
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                      fontFamily: 'monospace',
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      '& fieldset': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                      '&:hover fieldset': { borderColor: activeColor },
                      '&.Mui-focused fieldset': { borderColor: activeColor },
                    },
                    '& input[type=number]': {
                      MozAppearance: 'textfield',
                      '&::-webkit-inner-spin-button,&::-webkit-outer-spin-button': { display: 'none' },
                    },
                  }}
                />
                <FormControl className="flex-1">
                  <Select
                    value={formData.overallTargetUnit}
                    onChange={e => set('overallTargetUnit', e.target.value)}
                    sx={{
                      borderRadius: '16px',
                      height: '100%',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                      '& fieldset': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                      '&:hover fieldset': { borderColor: activeColor },
                      '&.Mui-focused fieldset': { borderColor: activeColor },
                    }}
                  >
                    {UNITS[formData.type].map(u => (
                      <MenuItem key={u} value={u} className="font-semibold">{u}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            {/* ── Due date ── */}
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                📅 Target Date <span className="text-red-500">*</span>
              </Typography>
              <DatePicker
                value={formData.dueDate}
                onChange={date => set('dueDate', date)}
                maxDate={maxDate}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    sx: {
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '16px',
                        backgroundColor: isDark ? '#1e3a8a20' : '#f0f7ff',
                        '& fieldset': { borderColor: '#3b82f6', borderWidth: '2px' },
                      },
                      '& .MuiInputBase-input': {
                        textAlign: 'center',
                        fontWeight: 800,
                        color: '#2563eb',
                        fontSize: '1.1rem',
                        letterSpacing: '1px'
                      }
                    },
                    helperText: (
                      <Typography variant="caption" className="text-slate-400 dark:text-slate-500 font-bold ml-1 uppercase tracking-wider">
                        {formData.dueDate ? new Date(formData.dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
                      </Typography>
                    )
                  },
                }}
              />
              {/* Quick-pick pills */}
              <Stack direction="row" flexWrap="wrap" gap={1} mt={2.5} className="overflow-x-auto pb-1 no-scrollbar flex-nowrap">
                {datePresets.map(({ label, date }) => {
                  const isActive = formData.dueDate &&
                    new Date(formData.dueDate).toDateString() === date.toDateString();
                  return (
                    <Button
                      key={label}
                      variant="outlined"
                      onClick={() => set('dueDate', date)}
                      className={`
                        rounded-full normal-case text-[12px] font-bold px-5 py-1.5 whitespace-nowrap transition-all
                        ${isActive 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md hover:bg-blue-700' 
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                        }
                      `}
                    >
                      {label}
                    </Button>
                  );
                })}
              </Stack>
            </Box>

            {/* ── Priority ── */}
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                ⚡ Priority Level
              </Typography>
              <Stack direction="row" gap={1.5}>
                {(['Low', 'Medium', 'High'] as GoalPriority[]).map(p => {
                  const cfg = PRIORITY_CONFIG[p];
                  const active = formData.priority === p;
                  return (
                    <Box
                      key={p}
                      onClick={() => set('priority', p)}
                      className={`
                        flex-1 py-3 text-center cursor-pointer rounded-2xl text-sm font-extrabold select-none transition-all duration-200 border-2
                        ${active 
                          ? 'border-2' 
                          : isDark
                            ? 'bg-slate-900 border-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                            : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-105 hover:text-slate-600'
                        }
                      `}
                      style={{ 
                        backgroundColor: active ? cfg.bg : undefined,
                        color: active ? cfg.color : undefined,
                        borderColor: active ? cfg.color : undefined,
                        boxShadow: active ? `0 4px 12px ${cfg.color}20` : undefined
                      }}
                    >
                      {p}
                    </Box>
                  );
                })}
              </Stack>
            </Box>

            {/* ── Advanced Options Toggle ── */}
            <Box className="mb-2">
              <Button
                onClick={() => setShowAdvanced(!showAdvanced)}
                fullWidth
                startIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
                className="justify-start normal-case font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl py-2"
              >
                {showAdvanced ? 'Hide' : 'More Options'} (Description, Privacy, Tags)
              </Button>
            </Box>

          {/* ── Advanced panel ── */}
          <AnimatePresence initial={false}>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <Stack gap={2.5}>

                  {/* Description */}
                  <Box>
                    <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                      📝 Description
                    </Typography>
                    <TextField
                      fullWidth multiline rows={3}
                      value={formData.description}
                      onChange={e => set('description', e.target.value)}
                      placeholder="Add more context, motivation, or notes…"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '16px',
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                          '& fieldset': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                          '&:hover fieldset': { borderColor: activeColor },
                          '&.Mui-focused fieldset': { borderColor: activeColor },
                        }
                      }}
                    />
                  </Box>

                  {/* Notes */}
                  <Box>
                    <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                      📒 Private Notes
                    </Typography>
                    <TextField
                      fullWidth multiline rows={2}
                      value={formData.notes}
                      onChange={e => set('notes', e.target.value)}
                      placeholder="Private notes about this goal…"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '16px',
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                          '& fieldset': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                          '&:hover fieldset': { borderColor: activeColor },
                          '&.Mui-focused fieldset': { borderColor: activeColor },
                        }
                      }}
                    />
                  </Box>

                  {/* Tags */}
                  <Box>
                    <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                      #️⃣ Tags
                    </Typography>
                    {formData.tags.length > 0 && (
                      <Stack direction="row" flexWrap="wrap" gap={0.8} mb={1.5}>
                        {formData.tags.map(tag => (
                          <Chip
                            key={tag}
                            label={`#${tag}`}
                            size="small"
                            onDelete={() => set('tags', formData.tags.filter(t => t !== tag))}
                            sx={{
                              fontSize: '11px', fontWeight: 700, height: 26,
                              bgcolor: `${activeColor}18`, color: activeColor,
                              border: `1.5px solid ${activeColor}30`,
                              borderRadius: '8px',
                            }}
                          />
                        ))}
                      </Stack>
                    )}
                    <TextField
                      fullWidth
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                      placeholder="Type a tag and press Enter"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '16px',
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                          '& fieldset': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                          '&:hover fieldset': { borderColor: activeColor },
                          '&.Mui-focused fieldset': { borderColor: activeColor },
                        }
                      }}
                    />
                  </Box>

                  {/* Privacy */}
                  <Box>
                    <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                      🔒 Privacy Setting
                    </Typography>
                    <FormControl fullWidth>
                      <Select
                        value={formData.privacy}
                        onChange={e => set('privacy', e.target.value)}
                        sx={{
                          borderRadius: '16px', fontSize: '0.9rem', fontWeight: 700,
                          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                          '& fieldset': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                          '&:hover fieldset': { borderColor: activeColor },
                          '&.Mui-focused fieldset': { borderColor: activeColor },
                        }}
                      >
                        <MenuItem value="private" className="font-semibold">Private — only you</MenuItem>
                        <MenuItem value="public"  className="font-semibold">Public — anyone</MenuItem>
                        <MenuItem value="specific" className="font-semibold">Specific people</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Pin toggle */}
                  <Box
                    className={`
                      flex items-center justify-between px-5 py-4 rounded-2xl border transition-all
                      ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-100'}
                    `}
                  >
                    <Box className="flex items-center gap-4">
                      <PushPin sx={{ fontSize: 20, color: formData.pinned ? activeColor : isDark ? '#475569' : '#94a3b8' }} />
                      <Box>
                        <Typography className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                          Pin to top
                        </Typography>
                        <Typography className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                          Keep this goal at the top of your list
                        </Typography>
                      </Box>
                    </Box>
                    <Switch
                      checked={formData.pinned}
                      onChange={e => set('pinned', e.target.checked)}
                      size="medium"
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: activeColor },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: activeColor },
                      }}
                    />
                  </Box>
                </Stack>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Info Message Box at the bottom */}
          <Box className={`flex items-start gap-3 p-4 rounded-2xl border transition-all mt-4 ${
            isDark 
              ? 'bg-violet-950/25 border-violet-500/20 text-violet-200' 
              : 'bg-violet-50 border-violet-100 text-violet-750'
          }`}>
            <InfoIcon className={`flex-shrink-0 text-lg mt-0.5 ${isDark ? 'text-violet-400' : 'text-violet-500'}`} />
            <Typography className="text-xs font-semibold leading-relaxed">
              <strong>Tip:</strong> After creating a goal, you can create milestones on the goal details page to make it easier to achieve!
            </Typography>
          </Box>
        </Box>
      </DialogContent>

        {/* ── Footer ── */}
        <DialogActions className={`p-6 border-t gap-3 ${
          isDark 
            ? 'bg-slate-950/20 border-slate-800' 
            : 'bg-slate-50/50 border-slate-100'
        }`}>
          <Button 
            onClick={onClose} 
            disabled={loading}
            variant="outlined"
            color="error"
            className={`rounded-xl font-bold px-6 py-2 normal-case border transition-all ${
              isDark 
                ? 'border-red-500/40 text-red-400 hover:bg-red-950/20' 
                : 'border-red-500 text-red-500 hover:bg-red-50'
            }`}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            color="success"
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className={`rounded-xl font-extrabold px-8 py-2 normal-case transition-all border ${
              canSubmit
                ? isDark
                  ? 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-950/20'
                  : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'
                : isDark
                  ? 'border-slate-800 text-slate-700 cursor-not-allowed'
                  : 'border-slate-200 text-slate-300 cursor-not-allowed'
            }`}
          >
            {loading ? 'Saving…' : goal ? 'Update Goal' : 'Launch Goal'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

