'use client';

import React from 'react';
import { Card, Tooltip } from '@mui/material';
import { Goal, GoalStep, GoalStepStatus } from '../../lib/interface';
import { calculateGoalOverallProgress } from '../../lib/utils/goalProgress';
import { useCustomTheme } from '../../lib/context/themeContext';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  FitnessCenter,
  School,
  Psychology,
  WorkOutline,
  SelfImprovement,
  Category,
} from '@mui/icons-material';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';

// ─── Type colours ─────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  {
    label: string;
    color: string;         // accent (ring, dots, badge text)
    badgeBgLight: string;
    badgeBgDark: string;
    cardBgLight: string;
    cardBorderLight: string;
    cardBgDark: string;
    cardBorderDark: string;
  }
> = {
  finance: {
    label: 'Finance',
    color: '#10B981',
    badgeBgLight: '#ECFDF5',
    badgeBgDark: '#10b98122',
    cardBgLight: '#F0FDF4',
    cardBorderLight: '#A7F3D0',
    cardBgDark: '#0f1f1a',
    cardBorderDark: '#10b98133',
  },
  health: {
    label: 'Health',
    color: '#F59E0B',
    badgeBgLight: '#FFFBEB',
    badgeBgDark: '#f59e0b22',
    cardBgLight: '#FFFBEB',
    cardBorderLight: '#FDE68A',
    cardBgDark: '#1e1a0f',
    cardBorderDark: '#f59e0b33',
  },
  learning: {
    label: 'Learning',
    color: '#3B82F6',
    badgeBgLight: '#EFF6FF',
    badgeBgDark: '#3b82f622',
    cardBgLight: '#EFF6FF',
    cardBorderLight: '#BFDBFE',
    cardBgDark: '#0f141f',
    cardBorderDark: '#3b82f633',
  },
  habit: {
    label: 'Habit',
    color: '#A78BFA',
    badgeBgLight: '#F5F3FF',
    badgeBgDark: '#a78bfa22',
    cardBgLight: '#F5F3FF',
    cardBorderLight: '#DDD6FE',
    cardBgDark: '#16101f',
    cardBorderDark: '#a78bfa33',
  },
  work: {
    label: 'Work',
    color: '#06B6D4',
    badgeBgLight: '#ECFEFF',
    badgeBgDark: '#06b6d422',
    cardBgLight: '#ECFEFF',
    cardBorderLight: '#A5F3FC',
    cardBgDark: '#0a1a1e',
    cardBorderDark: '#06b6d433',
  },
  personal_growth: {
    label: 'Personal Growth',
    color: '#EC4899',
    badgeBgLight: '#FDF2F8',
    badgeBgDark: '#ec489922',
    cardBgLight: '#FDF2F8',
    cardBorderLight: '#FBCFE8',
    cardBgDark: '#1f0e17',
    cardBorderDark: '#ec489933',
  },
  travel: {
    label: 'Travel',
    color: '#06B6D4',
    badgeBgLight: '#ECFEFF',
    badgeBgDark: '#06b6d422',
    cardBgLight: '#ECFEFF',
    cardBorderLight: '#A5F3FC',
    cardBgDark: '#042f2e',
    cardBorderDark: '#06b6d433',
  },
  lifestyle: {
    label: 'Lifestyle',
    color: '#F472B6',
    badgeBgLight: '#FDF2F8',
    badgeBgDark: '#f472b622',
    cardBgLight: '#FDF2F8',
    cardBorderLight: '#FBCFE8',
    cardBgDark: '#1f0e17',
    cardBorderDark: '#f472b633',
  },
  custom: {
    label: 'Custom',
    color: '#6B7280',
    badgeBgLight: '#F9FAFB',
    badgeBgDark: '#6b728022',
    cardBgLight: '#F9FAFB',
    cardBorderLight: '#E5E7EB',
    cardBgDark: '#141414',
    cardBorderDark: '#6b728033',
  },
};

const DEFAULT_TYPE = TYPE_META['custom'];

function getTypeMeta(type: string | undefined) {
  return (type && TYPE_META[type]) || DEFAULT_TYPE;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function getGoalTypeIcon(type: string | undefined) {
  const size = { fontSize: 16 };
  switch (type) {
    case 'finance':         return <TrendingUp sx={size} />;
    case 'health':          return <FitnessCenter sx={size} />;
    case 'learning':        return <School sx={size} />;
    case 'habit':           return <Psychology sx={size} />;
    case 'work':            return <WorkOutline sx={size} />;
    case 'personal_growth': return <SelfImprovement sx={size} />;
    case 'travel':          return <Category sx={size} />;
    case 'lifestyle':       return <SelfImprovement sx={size} />;
    default:                return <Category sx={size} />;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sum(values: (number | undefined)[]) {
  return values.reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
}

function getUnit(goal: Goal): string | undefined {
  return goal.overallTargetUnit;
}

function calculateTargets(goal: Goal) {
  const steps: GoalStep[] = goal.steps || [];
  const totalTarget  = sum(steps.map((s) => s.targetValue));
  const totalActual  = sum(steps.map((s) => s.actualValue));

  let progressActual = totalActual;
  if (progressActual === 0 && totalTarget > 0 && typeof goal.progress === 'number') {
    progressActual = Math.round((goal.progress / 100) * totalTarget);
  }
  return { totalTarget, progressActual };
}

function formatVal(v: number | undefined, unit: string | undefined): string {
  if (typeof v !== 'number') return '—';
  const display = Number.isInteger(v) ? v.toString() : v.toFixed(1);
  return unit ? `${display} ${unit}` : display;
}

function formatDeadline(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── Circular Ring SVG ────────────────────────────────────────────────────────

const RING_SIZE   = 56;
const RING_RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 138.2

interface RingProps {
  percent: number;   // 0-100
  color: string;
  trackColor: string;
}

function CircularRing({ percent, color, trackColor }: RingProps) {
  const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;

  return (
    <div style={{ position: 'relative', width: RING_SIZE, height: RING_SIZE, flexShrink: 0 }}>
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={trackColor}
          strokeWidth={5}
        />
        {/* Progress arc */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {/* Centre label */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'monospace',
          color: color,
          lineHeight: 1,
        }}
      >
        {Math.round(percent)}%
      </div>
    </div>
  );
}

// ─── Milestone Dots ───────────────────────────────────────────────────────────

interface MilestoneDotsProps {
  steps: GoalStep[];
  color: string;
  borderColor: string;
}

function MilestoneDots({ steps, color, borderColor }: MilestoneDotsProps) {
  const active = steps.slice(0, 8); // max 8 dots
  if (active.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {active.map((step, i) => {
        const done =
          typeof step.actualValue === 'number' &&
          typeof step.targetValue === 'number' &&
          step.actualValue >= step.targetValue;

        return (
          <Tooltip
            key={step.id || i}
            title={step.title || `Step ${i + 1}`}
            arrow
            placement="top"
          >
            <span
              style={{
                flex: 1,
                height: 3,
                borderRadius: 999,
                backgroundColor: done ? color : borderColor,
                transition: 'background-color 0.3s',
                cursor: 'default',
              }}
            />
          </Tooltip>
        );
      })}
    </div>
  );
}

// ─── Priority chip colours (reuse existing type colour) ───────────────────────

const PRIORITY_STYLES: Record<string, { bg: string; bgDark: string; text: string }> = {
  high:   { bg: '#FEF2F2', bgDark: '#7f1d1d33', text: '#DC2626' },
  medium: { bg: '#FFFBEB', bgDark: '#78350f33', text: '#D97706' },
  low:    { bg: '#F0FDF4', bgDark: '#14532d33', text: '#16A34A' },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export interface GoalSimpleCardProps {
  goal: Goal;
  index?: number;
  onClick?: () => void;
  variant?: 'minimal' | 'inspired';
}

const GoalSimpleCard: React.FC<GoalSimpleCardProps> = ({
  goal,
  onClick,
}) => {
  const { theme }  = useCustomTheme();
  const isDark     = theme?.mode === 'dark';

  const unit                         = getUnit(goal);
  const { totalTarget, progressActual } = calculateTargets(goal);
  const meta                         = getTypeMeta(goal.type);

  const percent = calculateGoalOverallProgress(goal);

  const title    = goal.title || 'Untitled Goal';
  const deadline = formatDeadline(goal.deadline || goal.targetDate);

  const milestoneSteps = goal.steps || [];
  const doneCount      = milestoneSteps.filter(
    (s) => s.status === GoalStepStatus.COMPLETED,
  ).length;

  // Colours
  const accent      = meta.color;
  const trackColor  = isDark ? `${accent}22` : `${accent}20`;
  const cardBg      = isDark ? meta.cardBgDark      : meta.cardBgLight;
  const cardBorder  = isDark ? meta.cardBorderDark  : meta.cardBorderLight;
  const badgeBg     = isDark ? meta.badgeBgDark     : meta.badgeBgLight;

  const priorityRaw = (goal.priority || '').toLowerCase();
  const priStyle    = PRIORITY_STYLES[priorityRaw] || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.22 }}
      onClick={onClick}
      style={{ cursor: 'pointer', height: '100%' }}
    >
      <Card
        sx={{
          borderRadius: '16px',
          backgroundColor: cardBg,
          border: `1px solid ${cardBorder}`,
          boxShadow: isDark
            ? '0 2px 12px rgba(0,0,0,0.28)'
            : '0 2px 10px rgba(0,0,0,0.05)',
          transition: 'box-shadow 0.25s ease, transform 0.25s ease',
          height: '100%',
          overflow: 'hidden',
          '&:hover': {
            boxShadow: isDark
              ? '0 8px 28px rgba(0,0,0,0.4)'
              : '0 8px 24px rgba(0,0,0,0.09)',
          },
        }}
      >
        <div
          style={{
            padding: '18px 18px 16px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            gap: 12,
          }}
        >

          {/* ── Row 1: category badge + priority chip ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Category badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: badgeBg,
                color: accent,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                fontFamily: 'monospace',
                padding: '3px 10px',
                borderRadius: 999,
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: accent,
                  display: 'inline-block',
                  animation: 'goalPulse 2s ease-in-out infinite',
                }}
              />
              {meta.label}
            </span>

            {/* Priority chip */}
            {priStyle && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                  padding: '3px 9px',
                  borderRadius: 6,
                  backgroundColor: isDark ? priStyle.bgDark : priStyle.bg,
                  color: priStyle.text,
                }}
              >
                {priorityRaw.charAt(0).toUpperCase() + priorityRaw.slice(1)}
              </span>
            )}

            {/* Icon fallback when no priority */}
            {!priStyle && (
              <span style={{ color: accent, display: 'flex', alignItems: 'center' }}>
                {getGoalTypeIcon(goal.type)}
              </span>
            )}
          </div>

          {/* ── Row 2: Title ── */}
          <div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1.3,
                color: isDark ? '#f8fafc' : '#0f172a',
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </h3>
          </div>

          {/* ── Row 3: Ring + meta text ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CircularRing
              percent={percent}
              color={accent}
              trackColor={trackColor}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: isDark ? '#f1f5f9' : '#1e293b',
                  margin: '0 0 1px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {milestoneSteps.length > 0
                  ? `${doneCount} / ${milestoneSteps.length} Steps`
                  : totalTarget > 0
                  ? `${formatVal(Math.min(progressActual, totalTarget), unit)} / ${formatVal(totalTarget, unit)}`
                  : `${Math.round(percent)}% Complete`}
              </p>
              <p
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: isDark ? '#94a3b8' : '#64748b',
                  margin: 0,
                  letterSpacing: '0.02em'
                }}
              >
                {percent >= 100
                  ? 'Goal Achieved'
                  : `${Math.round(percent)}% • ${
                      percent >= 75 ? 'Almost there' : 
                      percent >= 40 ? 'In progress' : 
                      'Just started'
                    }`}
              </p>
            </div>
          </div>

          {/* ── Row 4: Milestone dots (only when steps exist) ── */}
          {milestoneSteps.length > 0 && (
            <MilestoneDots
              steps={milestoneSteps}
              color={accent}
              borderColor={isDark ? '#ffffff18' : `${accent}28`}
            />
          )}

          {/* ── Row 5: Footer — deadline + target ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 10,
              borderTop: `1px solid ${isDark ? '#ffffff0d' : `${accent}20`}`,
              marginTop: 'auto',
            }}
          >
            {deadline ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontWeight: 500
                }}
              >
                <CalendarTodayOutlinedIcon sx={{ fontSize: 13, opacity: 0.7 }} />
                {deadline}
              </span>
            ) : (
              <span />
            )}

            {totalTarget > 0 && (
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: isDark ? '#64748b' : '#94a3b8',
                    fontFamily: 'monospace',
                    lineHeight: 1,
                    marginBottom: 2,
                  }}
                >
                  Target
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    lineHeight: 1,
                    fontFamily: 'monospace',
                  }}
                >
                  {formatVal(totalTarget, unit)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Pulse keyframe — injected once via a style tag */}
        <style>{`
          @keyframes goalPulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.35; }
          }
        `}</style>
      </Card>
    </motion.div>
  );
};

export default GoalSimpleCard;