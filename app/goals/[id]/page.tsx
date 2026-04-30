'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  AutoAwesome,
  CheckCircle,
  RadioButtonUnchecked,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useGoals, GoalsProvider } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { GoalType } from '../../lib/interface';
import GoalModal from '../../components/goals/GoalModal';

// ─── Utilities ────────────────────────────────────────────────────────────────

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toPlainDate = (value: unknown): Date | null => {
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
    const { seconds, nanoseconds } = value as { seconds: number; nanoseconds: number };
    return new Date(seconds * 1000 + nanoseconds / 1_000_000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  try {
    const d = new Date(value as string | number | Date);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_IN_MS);

const fmtDate = (d: Date | null) =>
  d
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not set';

// ─── Type helpers ─────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { label: string; emoji: string; color: string; light: string; dark: string; darkBg: string }
> = {
  finance:   { label: 'Finance',   emoji: '💰', color: '#10B981', light: '#ecfdf5', dark: '#a7f3d0', darkBg: '#022c22' },
  health:    { label: 'Health',    emoji: '🏃', color: '#F59E0B', light: '#fffbeb', dark: '#fde68a', darkBg: '#1c1400' },
  learning:  { label: 'Learning',  emoji: '📚', color: '#3B82F6', light: '#eff6ff', dark: '#bfdbfe', darkBg: '#0a1930' },
  habit:     { label: 'Habit',     emoji: '🎯', color: '#8B5CF6', light: '#f5f3ff', dark: '#ddd6fe', darkBg: '#120d26' },
  work:      { label: 'Work',      emoji: '💼', color: '#0ea5e9', light: '#f0f9ff', dark: '#bae6fd', darkBg: '#071b2e' },
  lifestyle: { label: 'Lifestyle', emoji: '🌟', color: '#F472B6', light: '#fdf2f8', dark: '#fbcfe8', darkBg: '#1f0815' },
  custom:    { label: 'Custom',    emoji: '✨', color: '#6B7280', light: '#f9fafb', dark: '#e5e7eb', darkBg: '#111827' },
};

const getTypeMeta = (type: GoalType | string | undefined) =>
  TYPE_META[type as string] ?? TYPE_META['custom'];

const PRIORITY_META: Record<string, { label: string; color: string; bg: string; bgDark: string }> = {
  high:   { label: '🔴 High',   color: '#DC2626', bg: '#fef2f2', bgDark: '#450a0a' },
  medium: { label: '🟡 Medium', color: '#D97706', bg: '#fffbeb', bgDark: '#1c1400' },
  low:    { label: '🟢 Low',    color: '#16A34A', bg: '#f0fdf4', bgDark: '#052e16' },
};

const getPriorityMeta = (p: string | undefined) =>
  PRIORITY_META[(p ?? '').toLowerCase()] ?? { label: p ?? '—', color: '#6B7280', bg: '#f9fafb', bgDark: '#111827' };

// ─── Circular Ring ────────────────────────────────────────────────────────────

function HeroRing({ pct }: { pct: number }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const offset = C - (pct / 100) * C;
  const size = 100;

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle cx={50} cy={50} r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={7} />
        <circle
          cx={50}
          cy={50}
          r={R}
          fill="none"
          stroke="#ffffff"
          strokeWidth={7}
          strokeDasharray={C}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1, fontFamily: 'monospace' }}>
          {Math.round(pct)}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', letterSpacing: '.04em' }}>
          %
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Stat Strip ───────────────────────────────────────────────────────────────

function StatStrip({
  steps,
  daysLeft,
  priority,
  isDark,
}: {
  steps: { completed: boolean }[];
  daysLeft: number;
  priority: string | undefined;
  isDark: boolean;
}) {
  const done  = steps.filter((s) => s.completed).length;
  const total = steps.length;
  const pri   = getPriorityMeta(priority);

  const bg    = isDark ? '#1e293b' : '#f8f7f4';
  const text  = isDark ? '#f1f5f9' : '#1a1a1a';
  const muted = isDark ? '#64748b' : '#94a3b8';

  const stats = [
    { val: total > 0 ? `${done}/${total}` : '—', lbl: 'Steps done', color: '#10B981' },
    {
      val: daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Today' : `${daysLeft}d`,
      lbl: 'Days left',
      color: daysLeft < 0 ? '#EF4444' : daysLeft <= 7 ? '#F59E0B' : text,
    },
    { val: pri.label, lbl: 'Priority', color: pri.color },
  ];

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', mb: 2.5 }}>
      {stats.map((s) => (
        <Box
          key={s.lbl}
          sx={{ background: bg, borderRadius: '12px', p: '12px', textAlign: 'center' }}
        >
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: s.color, fontFamily: 'monospace', lineHeight: 1 }}>
            {s.val}
          </Typography>
          <Typography sx={{ fontSize: 10, color: muted, mt: '3px', letterSpacing: '.04em', textTransform: 'uppercase' }}>
            {s.lbl}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── AI Banner ────────────────────────────────────────────────────────────────

function AIBanner({
  typeColor,
  isDark,
  onAnalyze,
}: {
  typeColor: string;
  isDark: boolean;
  onAnalyze: () => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: '12px 14px',
        borderRadius: '14px',
        background: isDark ? `${typeColor}18` : `${typeColor}12`,
        border: `1px solid ${typeColor}35`,
        mb: 2.5,
      }}
    >
      <Box
        sx={{
          width: 36, height: 36, borderRadius: '10px',
          background: typeColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AutoAwesome sx={{ fontSize: 16, color: '#fff' }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: isDark ? '#f1f5f9' : '#111', lineHeight: 1.2 }}>
          Improve this goal with AI
        </Typography>
        <Typography sx={{ fontSize: 11, color: isDark ? '#94a3b8' : '#6b7280', mt: '2px' }}>
          Get milestone suggestions & analysis
        </Typography>
      </Box>
      <Button
        onClick={onAnalyze}
        size="small"
        sx={{
          flexShrink: 0,
          background: typeColor,
          color: '#fff',
          fontWeight: 600,
          fontSize: 11,
          textTransform: 'none',
          borderRadius: '8px',
          px: 1.5,
          py: 0.75,
          whiteSpace: 'nowrap',
          '&:hover': { background: typeColor, opacity: 0.88 },
        }}
      >
        Analyze →
      </Button>
    </Box>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionTitle({
  children,
  action,
  isDark,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: isDark ? '#475569' : '#94a3b8',
        }}
      >
        {children}
      </Typography>
      {action}
    </Box>
  );
}

// ─── Timeline Milestone Row ───────────────────────────────────────────────────

function MilestoneRow({
  step,
  index,
  typeColor,
  isDark,
  onToggle,
}: {
  step: { id: string; title?: string; description?: string; targetValue?: number; completed?: boolean; endDate?: unknown };
  index: number;
  typeColor: string;
  isDark: boolean;
  onToggle: (id: string, completed: boolean) => void;
}) {
  const done   = !!step.completed;
  const endDate = toPlainDate(step.endDate);

  const cardBg     = done
    ? isDark ? `${typeColor}15` : `${typeColor}0e`
    : isDark ? '#1e293b'        : '#f8f7f4';
  const cardBorder = done
    ? `${typeColor}35`
    : isDark ? '#334155' : '#f0ede8';

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 1.5 }}>
      {/* Dot */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: '11px' }}>
        {done
          ? <CheckCircle sx={{ fontSize: 16, color: typeColor }} />
          : <RadioButtonUnchecked sx={{ fontSize: 16, color: isDark ? '#334155' : '#d1d5db' }} />}
      </Box>

      {/* Card */}
      <Box
        sx={{
          flex: 1,
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: '12px',
          p: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          transition: 'all 0.2s',
        }}
      >
        {/* Index badge */}
        <Box
          sx={{
            width: 26, height: 26, borderRadius: '7px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: done ? typeColor : isDark ? '#334155' : '#e5e7eb',
            color: done ? '#fff' : isDark ? '#94a3b8' : '#6b7280',
            fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
          }}
        >
          {done ? '✓' : index + 1}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 500,
              color: done ? (isDark ? '#475569' : '#9ca3af') : (isDark ? '#f1f5f9' : '#1a1a1a'),
              textDecoration: done ? 'line-through' : 'none',
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {step.title || `Step ${index + 1}`}
          </Typography>
          <Typography sx={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8', mt: '2px' }}>
            {[
              step.targetValue ? `Target: ${step.targetValue}` : null,
              endDate ? fmtDate(endDate) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Box>

        <Button
          size="small"
          onClick={() => onToggle(step.id, !done)}
          sx={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: '8px',
            px: 1.5,
            py: 0.6,
            background: done ? `${typeColor}18` : typeColor,
            color:  done ? typeColor : '#fff',
            '&:hover': { background: done ? `${typeColor}28` : typeColor, opacity: done ? 1 : 0.88 },
          }}
        >
          {done ? 'Done' : 'Complete'}
        </Button>
      </Box>
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const GoalDetailInner: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const { goals, updateStepStatus, deleteGoal, updateGoal } = useGoals();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [editModalOpen,      setEditModalOpen]      = useState(false);
  const [deleteDialogOpen,   setDeleteDialogOpen]   = useState(false);
  const [loading,            setLoading]            = useState(false);
  const [milestoneOpen,      setMilestoneOpen]      = useState(false);
  const [newTitle,           setNewTitle]           = useState('');
  const [newEndDate,         setNewEndDate]         = useState('');
  const [newTargetValue,     setNewTargetValue]     = useState('');
  const [firstView,          setFirstView]          = useState(false);

  const goal = goals.find((g) => g.id === params.id);

  useEffect(() => {
    if (goal?.id) {
      const key = `goal_viewed_${goal.id}`;
      if (!localStorage.getItem(key)) {
        setFirstView(true);
        localStorage.setItem(key, '1');
      }
    }
  }, [goal]);

  const meta      = useMemo(() => getTypeMeta(goal?.type), [goal]);
  const typeColor = meta.color;

  const dueDateDate = useMemo(() => (goal ? toPlainDate(goal.dueDate) : null), [goal]);
  const createdDate = useMemo(() => (goal ? new Date() : null), [goal]);

  const daysLeft = useMemo(() => {
    if (!dueDateDate) return 0;
    return Math.ceil((dueDateDate.getTime() - Date.now()) / DAY_IN_MS);
  }, [dueDateDate]);

  useEffect(() => {
    if (!goal && goals.length > 0) router.push('/goals');
  }, [goal, goals, router]);

  if (!goal) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh"
        sx={{ background: isDark ? '#0f172a' : '#f8fafc' }}>
        <Typography>Goal not found</Typography>
      </Box>
    );
  }

  const handleStepToggle = async (stepId: string, completed: boolean) => {
    try { await updateStepStatus(goal.id!, stepId, completed); }
    catch (e) { console.error(e); }
  };

  const handleDeleteGoal = async () => {
    setLoading(true);
    try { await deleteGoal(goal.id!); router.push('/goals'); }
    catch (e) { console.error(e); }
    finally { setLoading(false); setDeleteDialogOpen(false); }
  };

  const handleCreateMilestone = async () => {
    try {
      const title = newTitle.trim() || `Milestone ${(goal.steps || []).length + 1}`;
      let start: Date;
      if (goal.steps?.length) {
        const last    = goal.steps[goal.steps.length - 1];
        const lastEnd = toPlainDate(last.endDate) || toPlainDate(last.startDate) || null;
        start = lastEnd ? addDays(lastEnd, 1) : new Date();
      } else {
        start = createdDate ?? new Date();
      }
      const end = newEndDate ? new Date(newEndDate) : (dueDateDate ?? addDays(start, 7));
      if (start.getTime() >= end.getTime()) start = addDays(end, -1);

      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      await updateGoal(goal.id!, {
        steps: [
          ...(goal.steps || []),
          {
            id, title, startDate: start, endDate: end, completed: false, skipped: false,
            targetValue: newTargetValue ? parseFloat(newTargetValue) : undefined,
          },
        ],
      });
      setMilestoneOpen(false);
      setNewTitle(''); setNewEndDate(''); setNewTargetValue('');
    } catch (e) { console.error(e); }
  };

  const steps    = goal.steps || [];
  const doneCnt  = steps.filter((s) => s.completed).length;
  const totalCnt = steps.length;

  // colours
  const pageBg    = isDark ? '#0f172a' : '#f5f4f0';
  const contentBg = isDark ? '#1e293b' : '#ffffff';
  const mutedText = isDark ? '#64748b' : '#94a3b8';
  const bodyText  = isDark ? '#f1f5f9' : '#1a1a1a';
  const surfaceBg = isDark ? '#1e293b' : '#f8f7f4';

  return (
    <Box sx={{ minHeight: '100vh', background: pageBg, pb: 6 }}>

      {/* ── Hero ── */}
      <Box
        sx={{
          position: 'relative',
          background: `linear-gradient(150deg, ${typeColor} 0%, ${typeColor}cc 100%)`,
          px: { xs: 2.5, sm: 3 },
          pt: 2.5,
          pb: 9,
          overflow: 'hidden',
        }}
      >
        {/* Decorative rings */}
        {[220, 150].map((sz, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: sz, height: sz,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.1)',
              top: -sz * 0.4,
              right: -sz * 0.3,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Top bar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <IconButton
            onClick={() => router.push('/goals')}
            size="small"
            sx={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: '10px',
              '&:hover': { background: 'rgba(255,255,255,0.25)' },
            }}
          >
            <ArrowBack sx={{ fontSize: 18 }} />
          </IconButton>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Edit goal">
              <IconButton
                size="small"
                onClick={() => setEditModalOpen(true)}
                sx={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff', borderRadius: '9px',
                  '&:hover': { background: 'rgba(255,255,255,0.25)' },
                }}
              >
                <Edit sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete goal">
              <IconButton
                size="small"
                onClick={() => setDeleteDialogOpen(true)}
                sx={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fca5a5', borderRadius: '9px',
                  '&:hover': { background: 'rgba(255,255,255,0.25)' },
                }}
              >
                <Delete sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Hero body */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            {/* Badge */}
            <Box
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff',
                fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
                textTransform: 'uppercase', fontFamily: 'monospace',
                px: 1.25, py: '4px', borderRadius: '999px',
                mb: 1.25,
              }}
            >
              <span>{meta.emoji}</span>
              {meta.label}
            </Box>

            <Typography
              variant="h5"
              sx={{
                fontWeight: 700, color: '#fff', lineHeight: 1.25,
                letterSpacing: '-.02em', mb: 0.75,
                fontSize: { xs: 20, sm: 23 },
              }}
            >
              {goal.title}
            </Typography>

            {goal.description && (
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
                {goal.description.length > 90
                  ? `${goal.description.slice(0, 90)}…`
                  : goal.description}
              </Typography>
            )}
          </Box>

          <HeroRing pct={goal.progress ?? 0} />
        </Box>
      </Box>

      {/* ── White content card ── */}
      <Box
        sx={{
          background: contentBg,
          borderRadius: { xs: '22px 22px 0 0', sm: '24px 24px 0 0' },
          mt: '-24px',
          position: 'relative',
          zIndex: 2,
          px: { xs: 2, sm: 3 },
          pt: 3,
          pb: 4,
          maxWidth: 680,
          mx: 'auto',
        }}
      >
        {/* Stat strip */}
        <StatStrip
          steps={steps}
          daysLeft={daysLeft}
          priority={goal.priority}
          isDark={isDark}
        />

        {/* AI banner — first view or always show */}
        {firstView && (
          <AIBanner
            typeColor={typeColor}
            isDark={isDark}
            onAnalyze={() => alert('AI suggestion feature coming soon!')}
          />
        )}

        {/* Description (full) */}
        {goal.description && (
          <>
            <SectionTitle isDark={isDark}>About</SectionTitle>
            <Box
              sx={{
                background: surfaceBg,
                borderRadius: '12px',
                p: '13px 14px',
                mb: 2.5,
                fontSize: 13,
                color: isDark ? '#94a3b8' : '#555',
                lineHeight: 1.65,
              }}
            >
              {goal.description}
            </Box>
          </>
        )}

        {/* Milestones / Steps — timeline style */}
        <SectionTitle
          isDark={isDark}
          action={
            <Button
              size="small"
              onClick={() => setMilestoneOpen(true)}
              sx={{
                fontSize: 11, fontWeight: 600, textTransform: 'none',
                color: typeColor, background: `${typeColor}15`,
                borderRadius: '7px', px: 1.25, py: 0.5,
                '&:hover': { background: `${typeColor}25` },
              }}
            >
              + Add
            </Button>
          }
        >
          Steps &amp; milestones ({doneCnt}/{totalCnt})
        </SectionTitle>

        {/* Vertical connector line */}
        <Box sx={{ position: 'relative' }}>
          {steps.length > 1 && (
            <Box
              sx={{
                position: 'absolute',
                left: 7,
                top: 20,
                bottom: 20,
                width: 1,
                background: isDark
                  ? `linear-gradient(to bottom, ${typeColor}55, #334155)`
                  : `linear-gradient(to bottom, ${typeColor}44, #e5e7eb)`,
                zIndex: 0,
              }}
            />
          )}

          <AnimatePresence>
            {steps.length > 0 ? (
              steps.map((step, i) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, delay: i * 0.04 }}
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  <MilestoneRow
                    step={step}
                    index={i}
                    typeColor={typeColor}
                    isDark={isDark}
                    onToggle={handleStepToggle}
                  />
                </motion.div>
              ))
            ) : (
              <Typography sx={{ fontSize: 13, color: mutedText, textAlign: 'center', py: 3 }}>
                No milestones yet — add one to get started.
              </Typography>
            )}
          </AnimatePresence>
        </Box>

        {/* Details grid */}
        <Box sx={{ mt: 1.5, mb: 2.5 }}>
          <SectionTitle isDark={isDark}>Details</SectionTitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              {
                label: 'Due date',
                value: fmtDate(dueDateDate),
                sub: dueDateDate
                  ? daysLeft < 0
                    ? `${Math.abs(daysLeft)} days overdue`
                    : `${daysLeft} days left`
                  : null,
                subColor: daysLeft < 0 ? '#EF4444' : daysLeft <= 7 ? '#F59E0B' : typeColor,
              },
              {
                label: 'Priority',
                value: getPriorityMeta(goal.priority).label,
                sub: null,
                subColor: typeColor,
              },
              {
                label: 'Status',
                value: goal.status ?? 'In Progress',
                sub: null,
                subColor: typeColor,
              },
              {
                label: 'Progress',
                value: `${goal.progress ?? 0}%`,
                sub: null,
                subColor: typeColor,
              },
            ].map((cell) => (
              <Box
                key={cell.label}
                sx={{ background: surfaceBg, borderRadius: '12px', p: '12px 14px' }}
              >
                <Typography sx={{ fontSize: 10, fontWeight: 600, color: mutedText, letterSpacing: '.06em', textTransform: 'uppercase', mb: '4px' }}>
                  {cell.label}
                </Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: bodyText, fontFamily: 'monospace' }}>
                  {cell.value}
                </Typography>
                {cell.sub && (
                  <Typography sx={{ fontSize: 11, color: cell.subColor, mt: '2px' }}>
                    {cell.sub}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Tags */}
        {goal.tags && goal.tags.length > 0 && (
          <>
            <SectionTitle isDark={isDark}>Tags</SectionTitle>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px', mb: 2.5 }}>
              {goal.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    background: `${typeColor}14`,
                    color: typeColor,
                    fontWeight: 500,
                    fontSize: 11,
                    border: `1px solid ${typeColor}30`,
                  }}
                />
              ))}
            </Box>
          </>
        )}

        {/* Notes */}
        {goal.notes && (
          <>
            <SectionTitle isDark={isDark}>Notes</SectionTitle>
            <Box
              sx={{
                borderLeft: `3px solid ${typeColor}`,
                background: isDark ? `${typeColor}12` : `${typeColor}0a`,
                borderRadius: '0 10px 10px 0',
                p: '12px 14px',
                fontSize: 13,
                color: isDark ? '#94a3b8' : '#555',
                lineHeight: 1.65,
              }}
            >
              {goal.notes}
            </Box>
          </>
        )}
      </Box>

      {/* ── Add Milestone Dialog ── */}
      <Dialog
        open={milestoneOpen}
        onClose={() => setMilestoneOpen(false)}
        PaperProps={{ sx: { borderRadius: '18px', p: 1, minWidth: 320 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 0 }}>Add milestone</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Title" fullWidth size="small" value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)} />
          <TextField label="End date" type="date" fullWidth size="small" value={newEndDate}
            onChange={(e) => setNewEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Target value" fullWidth size="small" type="number" value={newTargetValue}
            onChange={(e) => setNewTargetValue(e.target.value)} placeholder="e.g. 5000" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMilestoneOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            onClick={handleCreateMilestone}
            variant="contained"
            sx={{
              background: typeColor, color: '#fff', textTransform: 'none', borderRadius: '8px',
              '&:hover': { background: typeColor, opacity: 0.88 },
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Modal ── */}
      <GoalModal open={editModalOpen} onClose={() => setEditModalOpen(false)} goal={goal} />

      {/* ── Delete Dialog ── */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '18px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 0 }}>Delete goal?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: isDark ? '#94a3b8' : '#6b7280', mt: 1 }}>
            This action cannot be undone. All milestones and progress will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            onClick={handleDeleteGoal}
            disabled={loading}
            sx={{
              background: '#EF4444', color: '#fff', textTransform: 'none', borderRadius: '8px',
              '&:hover': { background: '#DC2626' },
            }}
            variant="contained"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ─── Page export ──────────────────────────────────────────────────────────────

export default function GoalDetailPage() {
  const { user } = useAuth();
  return (
    <GoalsProvider userId={user?.uid}>
      <GoalDetailInner />
    </GoalsProvider>
  );
}