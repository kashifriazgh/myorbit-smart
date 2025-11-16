'use client';

import React from 'react';
import { Card } from '@mui/material';
import { styled } from '@mui/material/styles';
import LinearProgress, {
  linearProgressClasses,
} from '@mui/material/LinearProgress';
import {
  Goal,
  GoalStep,
  FinanceMetrics,
  HealthMetrics,
} from '../../lib/interface';
import { useCustomTheme } from '../../lib/context/themeContext';
import { motion } from 'framer-motion';

// Predefined light-mode background palettes (hex) and borders to avoid Tailwind override issues inside MUI
const paletteHex = [
  { bg: '#F0F9FF', border: '#BAE6FD' }, // sky-50 / sky-200
  { bg: '#ECFDF5', border: '#A7F3D0' }, // emerald-50 / emerald-200
  { bg: '#FFFBEB', border: '#FDE68A' }, // amber-50 / amber-200
  { bg: '#FFF1F2', border: '#FECDD3' }, // rose-50 / rose-200
  { bg: '#EEF2FF', border: '#C7D2FE' }, // indigo-50 / indigo-200
  { bg: '#F0FDFA', border: '#99F6E4' }, // teal-50 / teal-200
  { bg: '#F7FEE7', border: '#D9F99D' }, // lime-50 / lime-200
];

// Matching accent colors for progress bar gradients
const accentStart: string[] = [
  '#38bdf8', // sky-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#fb7185', // rose-400
  '#818cf8', // indigo-400
  '#2dd4bf', // teal-400
  '#a3e635', // lime-400
];
const accentEnd: string[] = [
  '#0ea5e9', // sky-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#84cc16', // lime-500
];

// Dark mode palette using accent colors
const paletteDark = accentStart.map((color, index) => ({
  bg: `linear-gradient(135deg, ${color}26 0%, rgba(15,23,42,0.92) 85%)`,
  border: `${accentEnd[index]}55`,
}));

function sum(values: (number | undefined)[]) {
  return values.reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
}

function getUnit(goal: Goal): string | undefined {
  // Prefer a consistent unit across steps
  const stepUnits = Array.from(
    new Set(
      (goal.steps || [])
        .filter((step) => !step.skipped)
        .map((s) => (s.unit || '').trim())
        .filter(Boolean)
    )
  );
  if (stepUnits.length === 1) return stepUnits[0];

  // Fallback to metrics-based hints
  if (goal.type === 'finance' && goal.metrics) {
    const m = goal.metrics as FinanceMetrics;
    if (m.currency) return m.currency; // currency symbol like Rs or $
  }
  if (goal.type === 'health' && goal.metrics) {
    const m = goal.metrics as HealthMetrics;
    if (m.unit) return m.unit; // kg/lb
  }

  return undefined; // unknown / mixed units
}

function calculateTargets(goal: Goal) {
  const steps: GoalStep[] = (goal.steps || []).filter((step) => !step.skipped);

  const totalTarget = sum(steps.map((s) => s.targetValue));
  const totalActual = sum(steps.map((s) => s.actualValue));

  let progressActual = totalActual;
  // If no actual captured but we have percent and target, estimate from percent
  if (
    progressActual === 0 &&
    totalTarget > 0 &&
    typeof goal.progress === 'number'
  ) {
    progressActual = Math.round((goal.progress / 100) * totalTarget);
  }

  return {
    totalTarget,
    progressActual,
  };
}

// Stable pseudo-random index from a string (goal id/title)
function hashStringToIndex(s: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % modulo;
}

// Base styled LinearProgress with pill shape and adaptive track color
import { linearProgressClasses as lpc } from '@mui/material/LinearProgress';
const PillLinearProgress = styled(LinearProgress)(({ theme }) => ({
  height: 12,
  borderRadius: 9999,
  [`&.${lpc.colorPrimary}`]: {
    backgroundColor:
      theme.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.2)' : '#e5e7eb', // slate-500/20 vs gray-200
  },
  [`& .${lpc.bar}`]: {
    borderRadius: 9999,
  },
}));

export interface GoalSimpleCardProps {
  goal: Goal;
  index?: number; // kept for fallback but not required
  onClick?: () => void;
  variant?: 'minimal' | 'inspired';
}

const GoalSimpleCard: React.FC<GoalSimpleCardProps> = ({
  goal,
  index = 0,
  onClick,
  variant = 'inspired',
}) => {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const unit = getUnit(goal);
  const { totalTarget, progressActual } = calculateTargets(goal);

  // Compute percent for the progress bar
  const percent = (() => {
    if (totalTarget > 0) {
      const p = progressActual / totalTarget;
      return Math.max(0, Math.min(1, isFinite(p) ? p : 0));
    }
    const p = (goal.progress ?? 0) / 100;
    return Math.max(0, Math.min(1, isFinite(p) ? p : 0));
  })();

  // Choose palette: stable pseudo-random by goal id/title in light mode; neutral in dark mode
  const key = goal.id || goal.title || String(index);
  const paletteIndex = hashStringToIndex(key, paletteHex.length);
  const paletteLight = paletteHex[paletteIndex];
  const paletteNight = paletteDark[paletteIndex];

  // Formatters
  const formatVal = (v: number | undefined) => {
    if (typeof v !== 'number') return '—';
    const display = Number.isInteger(v) ? v.toString() : v.toFixed(1);
    return unit ? `${display} ${unit}` : display;
  };

  const title = goal.title || 'Untitled Goal';

  const InspiredLayout = (
    <div className="p-4 flex flex-col h-full select-none">
      {/* Title */}
      <div className="mb-2">
        <h3
          className={`text-left font-semibold leading-snug line-clamp-1 ${
            isDark ? 'text-slate-100' : 'text-slate-800'
          }`}
        >
          {title}
        </h3>
      </div>

      {/* Progress bar area */}
      <div className="relative rounded-lg overflow-hidden h-16 sm:h-20 mb-3 flex items-center">
        {/* Subtle gradient gloss */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/60 via-white/10 to-transparent opacity-60 pointer-events-none" />
        {isDark && (
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent opacity-70 pointer-events-none" />
        )}
        <div className="w-full px-2">
          <PillLinearProgress
            variant="determinate"
            value={Math.round(percent * 100)}
            sx={{
              [`& .${linearProgressClasses.bar}`]: {
                backgroundImage: `linear-gradient(90deg, ${accentStart[paletteIndex]}, ${accentEnd[paletteIndex]})`,
              },
              boxShadow: isDark ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.06)',
            }}
          />
        </div>
      </div>

      {/* Bottom row: Target (left) and Progress (right) */}
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span
            className={`text-[10px] uppercase tracking-wider ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Target
          </span>
          <span
            className={`font-bold ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            } text-2xl leading-none truncate`}
          >
            {formatVal(totalTarget || 0)}
          </span>
        </div>

        <div className="text-right min-w-0">
          <span
            className={`text-[10px] uppercase tracking-wider ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Progress
          </span>
          <div
            className={`${
              isDark ? 'text-slate-200' : 'text-slate-700'
            } text-lg font-semibold leading-none truncate`}
          >
            {totalTarget > 0
              ? formatVal(Math.min(progressActual, totalTarget))
              : `${Math.round(percent * 100)}%`}
          </div>
        </div>
      </div>
    </div>
  );

  const MinimalLayout = (
    <div className="p-4 flex flex-col h-full select-none">
      {/* Title */}
      <div className="mb-6">
        <h3
          className={`text-left font-semibold leading-snug line-clamp-2 ${
            isDark ? 'text-slate-100' : 'text-slate-800'
          }`}
        >
          {title}
        </h3>
      </div>

      {/* Bottom row */}
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span
            className={`text-xs uppercase tracking-wider ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Target
          </span>
          <span
            className={`font-bold ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            } text-2xl sm:text-[1.6rem] leading-none truncate`}
          >
            {formatVal(totalTarget || 0)}
          </span>
        </div>

        <div className="text-right min-w-0">
          <span
            className={`text-xs uppercase tracking-wider ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Progress
          </span>
          <div
            className={`${
              isDark ? 'text-slate-200' : 'text-slate-700'
            } text-lg font-semibold leading-none truncate`}
          >
            {totalTarget > 0
              ? formatVal(Math.min(progressActual, totalTarget))
              : `${Math.round(goal.progress ?? 0)}%`}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      className="cursor-pointer h-full"
    >
      <Card
        className={`rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 h-full overflow-hidden`}
        sx={
          isDark
            ? {
                borderRadius: '1rem',
                background: paletteNight.bg,
                border: `1px solid ${paletteNight.border}`,
                boxShadow: '0 18px 40px rgba(15,23,42,0.35)',
              }
            : {
                borderRadius: '1rem',
                backgroundColor: paletteLight.bg,
                border: `1px solid ${paletteLight.border}`,
              }
        }
      >
        {/* Optional subtle inner gradient to emulate the reference style */}
        <div className="relative h-full">
          {isDark ? (
            <div className="pointer-events-none absolute inset-0 opacity-[0.45]">
              <div className="absolute -top-12 -left-16 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-16 -right-12 w-52 h-52 rounded-full bg-white/5 blur-3xl" />
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-0 opacity-[0.35]">
              <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/40 blur-2xl" />
              <div className="absolute -bottom-10 -right-10 w-44 h-44 rounded-full bg-white/30 blur-2xl" />
            </div>
          )}

          {variant === 'inspired' ? InspiredLayout : MinimalLayout}
        </div>
      </Card>
    </motion.div>
  );
};

export default GoalSimpleCard;
