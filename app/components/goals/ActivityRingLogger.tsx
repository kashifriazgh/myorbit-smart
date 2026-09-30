'use client';

import React, { useMemo, useState, useEffect } from 'react';

export interface ActivityRingLoggerProps {
  label: string;
  unit: string;
  target: number;
  currentValue?: number;
  chips?: number[];
  step?: number;
  min?: number;
  isDone?: boolean;
  onAddEntry?: (addedValue: number) => void;
  onFinishForToday?: () => void;
}

const R = 80;
const C = 2 * Math.PI * R;
const round = (n: number) => Math.round(n * 100) / 100;

export function ActivityRingLogger({
  label,
  unit,
  target,
  currentValue = 0,
  chips,
  step = 1,
  min: _min = 1,
  isDone = false,
  onAddEntry,
  onFinishForToday,
}: ActivityRingLoggerProps) {
  const total = useMemo(
    () => round(Math.min(target, Math.max(0, currentValue))),
    [currentValue, target]
  );
  const remaining = Math.max(0, round(target - total));
  const done = isDone || remaining <= 0;

  // Auto chips generation based on target & unit
  const calculatedChips = useMemo(() => {
    if (chips && chips.length > 0) return chips;
    const norm = (unit || '').toLowerCase();
    if (norm === 'steps') return [500, 1000, 2000, 2500];
    if (norm === 'km') return [0.5, 1, 2, 3];
    if (norm === 'reps' || norm === 'rounds' || norm === 'laps' || norm === 'sets') return [1, 2, 3, 5];
    if (norm === 'minutes' || norm === 'mins') return [5, 10, 15, 20];
    const q1 = Math.max(1, Math.round(target * 0.1));
    const q2 = Math.max(1, Math.round(target * 0.25));
    const q3 = Math.max(1, Math.round(target * 0.5));
    return Array.from(new Set([q1, q2, q3])).filter((x) => x <= target);
  }, [chips, unit, target]);

  // Dial starts at 0 (no automatic assumed preview)
  const [dial, setDial] = useState<number>(0);
  const [error, setError] = useState('');

  // Reset dial to 0 whenever remaining changes
  useEffect(() => {
    setDial(0);
    setError('');
  }, [remaining]);

  const dialValue = done ? 0 : Math.min(Math.max(dial, 0), remaining);

  const handleAdd = (val: number) => {
    const v = Math.min(round(val), remaining);
    if (v <= 0) {
      setError('Please choose an amount above 0 using the slider or chips');
      return;
    }
    setError('');
    onAddEntry?.(v);
    setDial(0); // Reset dial back to 0 after adding partial progress
  };

  const handleFinishToday = () => {
    setError('');
    if (onFinishForToday) {
      onFinishForToday();
    } else {
      handleAdd(remaining > 0 ? remaining : target);
    }
    setDial(0);
  };

  const currentFrac = target > 0 ? total / target : 0;
  const dialFrac = !done && dialValue > 0 && target > 0 ? dialValue / target : 0;

  return (
    <div className="mx-auto w-full max-w-sm rounded-3xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
      <h3 className="mb-3 text-center text-lg font-bold text-slate-900 dark:text-white">
        {label}
      </h3>

      {/* Circular Ring Progress */}
      <div className="relative mx-auto h-56 w-56">
        <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label={`${label} progress`}>
          {/* Track Background */}
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            strokeWidth="14"
            strokeDasharray="2 6"
            className="stroke-slate-300 dark:stroke-slate-700"
          />
          <g transform="rotate(-90 100 100)">
            {/* Locked Progress Arc (Green) */}
            {currentFrac > 0 && (
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke="#10b981"
                strokeWidth="14"
                strokeLinecap="round"
                style={{
                  transition: 'all 0.3s ease',
                  strokeDasharray: `${Math.max(currentFrac * C - 3, 0.5)} ${C}`,
                  strokeDashoffset: 0,
                }}
              />
            )}
            {/* Manual Selection Arc (Yellow / Amber) - only fills when user manually selects an amount */}
            {!done && dialFrac > 0 && (
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="14"
                strokeLinecap="round"
                style={{
                  transition: 'all 0.3s ease',
                  strokeDasharray: `${Math.max(dialFrac * C - 3, 0.5)} ${C}`,
                  strokeDashoffset: -currentFrac * C,
                  opacity: 0.9,
                }}
              />
            )}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black leading-tight text-slate-900 dark:text-white font-mono">
            {total} / {target}
          </span>
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {done ? '🎉 Target Hit!' : `${unit} · ${target > 0 ? Math.round((total / target) * 100) : 0}%`}
          </span>
        </div>
      </div>

      {/* Dial & Controls */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-xs uppercase tracking-wider">Manual progress dial</span>
          <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${
            done
              ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60'
              : dialValue > 0
              ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60'
              : 'text-slate-500 bg-slate-200 dark:bg-slate-800'
          }`}>
            {done ? 'Done for Today' : `+${round(dialValue)} ${unit}`}
          </span>
        </div>

        <div className="px-1">
          <input
            type="range"
            value={dialValue}
            min={0}
            max={Math.max(remaining, 0)}
            step={step}
            disabled={done || remaining <= 0}
            onChange={(e) => {
              setError('');
              setDial(Number(e.target.value));
            }}
            aria-label={`${label} amount`}
            className="h-2 w-full cursor-pointer accent-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>

        {/* Quick chips */}
        <div className="my-3 flex flex-wrap gap-2 justify-center">
          {calculatedChips.map((c) => {
            const isSelected = dialValue === Math.min(c, remaining > 0 ? remaining : c);
            return (
              <button
                key={c}
                type="button"
                disabled={done || remaining <= 0}
                onClick={() => {
                  setError('');
                  setDial(Math.min(c, remaining > 0 ? remaining : c));
                }}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  isSelected
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-400'
                }`}
              >
                +{c} {unit}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={done || remaining <= 0}
            onClick={() => handleAdd(dialValue)}
            className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              dialValue > 0
                ? 'border-amber-400 bg-amber-500 text-white shadow-sm hover:bg-amber-600'
                : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
            }`}
          >
            {dialValue > 0 ? `Partial Progress (+${round(dialValue)})` : 'Partial Progress'}
          </button>
          <button
            type="button"
            disabled={done}
            onClick={handleFinishToday}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white transition shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Yeh, I done it for today
          </button>
        </div>

        {error && <p className="mt-2 text-center text-xs font-bold text-rose-500">{error}</p>}
      </div>
    </div>
  );
}

export default ActivityRingLogger;
