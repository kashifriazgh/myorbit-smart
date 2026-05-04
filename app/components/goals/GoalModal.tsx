'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
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
  const surface = isDark ? 'rgba(15,23,42,0.6)' : '#fff';
  const inputSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
      backgroundColor: surface,
      fontSize: '14px',
      '& fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)' },
      '&:hover fieldset': { borderColor: activeColor },
      '&.Mui-focused fieldset': { borderColor: activeColor, borderWidth: '1.5px' },
    },
  };

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
          sx: {
            borderRadius: isMobile ? 0 : '16px',
            background: isDark
              ? 'linear-gradient(160deg,#0f172a 0%,#1e293b 100%)'
              : '#f8fafc',
            boxShadow: isDark
              ? '0 24px 48px rgba(0,0,0,0.6)'
              : '0 24px 48px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          },
        }}
      >
        {/* ── Header ── */}
        <DialogTitle
          sx={{
            px: 3, py: 2.5,
            borderBottom: `0.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isDark ? 'rgba(15,23,42,0.8)' : '#fff',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '15px', fontWeight: 600, color: isDark ? '#f1f5f9' : '#0f172a' }}>
              {goal ? 'Edit goal' : 'New goal'}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: isDark ? '#64748b' : '#94a3b8', mt: 0.3 }}>
              {goal ? 'Update your goal details' : 'What do you want to achieve?'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {aiParsed && (
              <Chip
                icon={<MagicIcon style={{ fontSize: 12, color: '#3B82F6' }} />}
                label="AI parsed"
                size="small"
                sx={{
                  height: 22, fontSize: '10px', fontWeight: 600,
                  bgcolor: 'rgba(59,130,246,0.1)', color: '#3B82F6',
                  border: '0.5px solid rgba(59,130,246,0.25)',
                  '& .MuiChip-icon': { ml: 0.8 },
                }}
              />
            )}
            <IconButton onClick={onClose} size="small"
              sx={{
                width: 28, height: 28, border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                color: isDark ? '#64748b' : '#94a3b8',
                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
              }}
            >
              <Close sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* ── Category strip ── */}
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 600, color: isDark ? '#475569' : '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.2 }}>
              Category
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.8}>
              {GOAL_TYPES.map(({ value, label, icon }) => {
                const active = formData.type === value;
                const color  = TYPE_COLORS[value];
                return (
                  <Box
                    key={value}
                    onClick={() => set('type', value)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.7,
                      px: 1.4, py: 0.6, borderRadius: '20px', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 500, userSelect: 'none',
                      transition: 'all 0.15s ease',
                      border: `0.5px solid ${active ? 'transparent' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      bgcolor: active ? color : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      color:   active ? '#fff'  : isDark ? '#94a3b8' : '#64748b',
                      '&:hover': { borderColor: active ? 'transparent' : color, color: active ? '#fff' : color },
                      '& svg': { fontSize: 14 },
                    }}
                  >
                    {icon}
                    {label}
                  </Box>
                );
              })}
            </Stack>
          </Box>

          {/* ── Title ── */}
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 600, color: isDark ? '#475569' : '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.2 }}>
              Goal title <span style={{ color: '#ef4444' }}>*</span>
            </Typography>
            <TextField
              inputRef={titleRef}
              fullWidth
              value={formData.title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="e.g. Save PKR 50k in 3 months"
              sx={{
                ...inputSx,
                '& .MuiOutlinedInput-root': {
                  ...inputSx['& .MuiOutlinedInput-root'],
                  fontSize: '15px',
                  fontWeight: 500,
                },
              }}
            />
          </Box>

          {/* ── Target value + unit ── */}
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 600, color: isDark ? '#475569' : '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.2 }}>
              Target
            </Typography>
            <Stack direction="row" gap={1.5}>
              <TextField
                type="number"
                value={formData.overallTargetValue}
                onChange={e => set('overallTargetValue', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                sx={{
                  flex: 1,
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    ...inputSx['& .MuiOutlinedInput-root'],
                    fontFamily: 'monospace',
                    fontSize: '20px',
                    fontWeight: 600,
                  },
                  '& input[type=number]': {
                    MozAppearance: 'textfield',
                    '&::-webkit-inner-spin-button,&::-webkit-outer-spin-button': { display: 'none' },
                  },
                }}
              />
              <FormControl sx={{ minWidth: 120 }}>
                <Select
                  value={formData.overallTargetUnit}
                  onChange={e => set('overallTargetUnit', e.target.value)}
                  sx={{
                    borderRadius: '10px',
                    height: '100%',
                    fontSize: '13px',
                    fontWeight: 500,
                    backgroundColor: surface,
                    '& fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)' },
                    '&:hover fieldset': { borderColor: activeColor },
                    '&.Mui-focused fieldset': { borderColor: activeColor },
                  }}
                >
                  {UNITS[formData.type].map(u => (
                    <MenuItem key={u} value={u} sx={{ fontSize: '13px' }}>{u}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Box>

          {/* ── Due date ── */}
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 600, color: isDark ? '#475569' : '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.2 }}>
              Target date <span style={{ color: '#ef4444' }}>*</span>
            </Typography>
            <DatePicker
              value={formData.dueDate}
              onChange={date => set('dueDate', date)}
              maxDate={maxDate}
              slotProps={{
                textField: {
                  fullWidth: true,
                  sx: inputSx,
                },
              }}
            />
            {/* Quick-pick pills */}
            <Stack direction="row" flexWrap="wrap" gap={0.8} mt={1.2}>
              {datePresets.map(({ label, date }) => {
                const isActive = formData.dueDate &&
                  new Date(formData.dueDate).toDateString() === date.toDateString();
                return (
                  <Box
                    key={label}
                    onClick={() => set('dueDate', date)}
                    sx={{
                      px: 1.2, py: 0.5, borderRadius: '20px', cursor: 'pointer',
                      fontSize: '11px', fontWeight: 500, userSelect: 'none',
                      transition: 'all 0.15s',
                      border: `0.5px solid ${isActive ? 'transparent' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      bgcolor: isActive ? activeColor : 'transparent',
                      color:   isActive ? '#fff' : isDark ? '#64748b' : '#94a3b8',
                      '&:hover': { borderColor: activeColor, color: isActive ? '#fff' : activeColor },
                    }}
                  >
                    {label}
                  </Box>
                );
              })}
            </Stack>
          </Box>

          {/* ── Priority ── */}
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 600, color: isDark ? '#475569' : '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.2 }}>
              Priority
            </Typography>
            <Stack direction="row" gap={1}>
              {(['Low', 'Medium', 'High'] as GoalPriority[]).map(p => {
                const cfg    = PRIORITY_CONFIG[p];
                const active = formData.priority === p;
                return (
                  <Box
                    key={p}
                    onClick={() => set('priority', p)}
                    sx={{
                      flex: 1, py: 1, textAlign: 'center', cursor: 'pointer',
                      borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                      userSelect: 'none', transition: 'all 0.15s',
                      border: `0.5px solid ${active ? cfg.border : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      bgcolor: active ? cfg.bg : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      color:   active ? cfg.color : isDark ? '#475569' : '#94a3b8',
                      '&:hover': { bgcolor: cfg.bg, color: cfg.color, borderColor: cfg.border },
                    }}
                  >
                    {p}
                  </Box>
                );
              })}
            </Stack>
          </Box>

          {/* ── Advanced toggle ── */}
          <Box
            onClick={() => setShowAdvanced(s => !s)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
              '&:hover .adv-label': { color: isDark ? '#94a3b8' : '#64748b' },
            }}
          >
            <Box sx={{ flex: 1, height: '0.5px', bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
            <Typography className="adv-label" sx={{ fontSize: '11px', fontWeight: 500, color: isDark ? '#475569' : '#94a3b8', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
              More options
            </Typography>
            {showAdvanced ? <ExpandLess sx={{ fontSize: 14, color: isDark ? '#475569' : '#94a3b8' }} /> : <ExpandMore sx={{ fontSize: 14, color: isDark ? '#475569' : '#94a3b8' }} />}
            <Box sx={{ flex: 1, height: '0.5px', bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
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
                    <Typography sx={{ fontSize: '10px', fontWeight: 600, color: isDark ? '#475569' : '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.2 }}>
                      Description
                    </Typography>
                    <TextField
                      fullWidth multiline rows={3}
                      value={formData.description}
                      onChange={e => set('description', e.target.value)}
                      placeholder="Add more context, motivation, or notes…"
                      sx={inputSx}
                    />
                  </Box>

                  {/* Notes */}
                  <Box>
                    <Typography sx={{ fontSize: '10px', fontWeight: 600, color: isDark ? '#475569' : '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.2 }}>
                      Notes
                    </Typography>
                    <TextField
                      fullWidth multiline rows={2}
                      value={formData.notes}
                      onChange={e => set('notes', e.target.value)}
                      placeholder="Private notes about this goal…"
                      sx={inputSx}
                    />
                  </Box>

                  {/* Tags */}
                  <Box>
                    <Typography sx={{ fontSize: '10px', fontWeight: 600, color: isDark ? '#475569' : '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.2 }}>
                      Tags
                    </Typography>
                    {formData.tags.length > 0 && (
                      <Stack direction="row" flexWrap="wrap" gap={0.8} mb={1}>
                        {formData.tags.map(tag => (
                          <Chip
                            key={tag}
                            label={`#${tag}`}
                            size="small"
                            onDelete={() => set('tags', formData.tags.filter(t => t !== tag))}
                            sx={{
                              fontSize: '11px', fontWeight: 500, height: 24,
                              bgcolor: `${activeColor}18`, color: activeColor,
                              border: `0.5px solid ${activeColor}40`,
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
                      sx={inputSx}
                    />
                  </Box>

                  {/* Privacy */}
                  <Box>
                    <Typography sx={{ fontSize: '10px', fontWeight: 600, color: isDark ? '#475569' : '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.2 }}>
                      Privacy
                    </Typography>
                    <FormControl fullWidth>
                      <Select
                        value={formData.privacy}
                        onChange={e => set('privacy', e.target.value)}
                        sx={{
                          borderRadius: '10px', fontSize: '13px', fontWeight: 500,
                          backgroundColor: surface,
                          '& fieldset': { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)' },
                          '&:hover fieldset': { borderColor: activeColor },
                          '&.Mui-focused fieldset': { borderColor: activeColor },
                        }}
                      >
                        <MenuItem value="private" sx={{ fontSize: 13 }}>Private — only you</MenuItem>
                        <MenuItem value="public"  sx={{ fontSize: 13 }}>Public — anyone</MenuItem>
                        <MenuItem value="specific" sx={{ fontSize: 13 }}>Specific people</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Pin toggle */}
                  <Box
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      px: 1.8, py: 1.4, borderRadius: '10px',
                      border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                      <PushPin sx={{ fontSize: 16, color: formData.pinned ? activeColor : isDark ? '#475569' : '#94a3b8' }} />
                      <Box>
                        <Typography sx={{ fontSize: '13px', fontWeight: 500, color: isDark ? '#cbd5e1' : '#374151' }}>
                          Pin to top
                        </Typography>
                        <Typography sx={{ fontSize: '11px', color: isDark ? '#475569' : '#94a3b8' }}>
                          Keep this goal at the top of your list
                        </Typography>
                      </Box>
                    </Box>
                    <Switch
                      checked={formData.pinned}
                      onChange={e => set('pinned', e.target.checked)}
                      size="small"
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

        </DialogContent>

        {/* ── Footer ── */}
        <DialogActions
          sx={{
            px: 3, py: 2.5, gap: 1.5,
            borderTop: `0.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.8)',
          }}
        >
          <Button
            onClick={onClose}
            disabled={loading}
            sx={{
              textTransform: 'none', fontSize: '13px', fontWeight: 500,
              color: isDark ? '#64748b' : '#94a3b8', borderRadius: '10px',
              px: 2, border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            sx={{
              textTransform: 'none', fontSize: '13px', fontWeight: 600,
              borderRadius: '10px', px: 3, boxShadow: 'none',
              bgcolor: activeColor,
              '&:hover': { bgcolor: activeColor, opacity: 0.88, boxShadow: 'none' },
              '&:disabled': { bgcolor: isDark ? '#1e293b' : '#e2e8f0', color: isDark ? '#334155' : '#94a3b8' },
            }}
          >
            {loading ? 'Saving…' : goal ? 'Update goal' : 'Create goal'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

