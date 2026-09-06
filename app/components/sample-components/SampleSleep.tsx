"use client";

import { useMemo, useState } from "react";

/**
 * SleepMilestoneCard
 * ------------------
 * Displays progress for a "Sleep Better" goal milestone.
 *
 * Goal-creation questions this card is built to reflect:
 *  - targetHours      -> "How much time do you want to sleep?"
 *  - bedTime          -> "When you go to bed"
 *  - wakeTime         -> "When you wake up"
 *  - consistencyCount -> "Consistency count" (consecutive days the check-in was logged)
 *  - lastNightHours   -> "Sleep hours count each day" (most recent check-in)
 *
 * Progress = min(lastNightHours / targetHours, 1) * 100
 *   e.g. target 8h, logged 8h -> 100%, logged 7h -> 87%, logged 6h -> 75%
 *
 * Usage:
 *   <SleepMilestoneCard
 *     targetHours={8}
 *     bedTime="10:30 PM"
 *     wakeTime="6:30 AM"
 *     consistencyCount={12}
 *     lastNightHours={7}
 *     onLogHours={(hours) => saveCheckIn(hours)}
 *   />
 */
export default function SleepMilestoneCard({
  targetHours = 8,
  bedTime = "10:30 PM",
  wakeTime = "6:30 AM",
  consistencyCount = 12,
  lastNightHours = 7,
  onLogHours,
}) {
  const [hours, setHours] = useState(lastNightHours);

  const progress = useMemo(() => {
    if (!targetHours) return 0;
    return Math.max(0, Math.min(100, Math.round((hours / targetHours) * 100)));
  }, [hours, targetHours]);

  // Semicircle arc geometry (dusk -> dawn path)
  const radius = 80;
  const circumference = Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  const handleLog = (value) => {
    setHours(value);
    onLogHours?.(value);
  };

  return (
    <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">Milestone</p>
          <h3 className="mt-0.5 text-lg font-semibold text-slate-800">
            Sleep better
          </h3>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
          Goal: {targetHours}h / night
        </span>
      </div>

      {/* Dusk-to-dawn arc */}
      <div className="relative mt-6 flex justify-center">
        <svg viewBox="0 0 200 110" className="w-full max-w-[260px]">
          <defs>
            <linearGradient id="sleepArcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4338CA" />
              <stop offset="55%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>

          {/* Track */}
          <path
            d="M20,100 A80,80 0 0 1 180,100"
            fill="none"
            stroke="#EEF2FF"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Progress */}
          <path
            d="M20,100 A80,80 0 0 1 180,100"
            fill="none"
            stroke="url(#sleepArcGradient)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 500ms ease" }}
          />

          {/* Moon end-cap */}
          <g transform="translate(20,100)">
            <circle r="10" fill="#4338CA" />
            <path d="M-3,-4 A5,5 0 1 0 3,4 A6.5,6.5 0 0 1 -3,-4 Z" fill="#EEF2FF" />
          </g>
          {/* Sun end-cap */}
          <g transform="translate(180,100)">
            <circle r="10" fill="#F59E0B" />
            <circle r="4.5" fill="#FFFBEB" />
          </g>
        </svg>

        {/* Center readout */}
        <div className="absolute inset-x-0 top-[52px] flex flex-col items-center">
          <span className="text-3xl font-semibold tabular-nums text-slate-800">
            {hours}<span className="text-lg text-slate-400">h</span>
          </span>
          <span className="text-xs font-medium text-slate-400">{progress}% of goal</span>
        </div>
      </div>

      {/* Schedule pills */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-2xl bg-indigo-50/60 px-4 py-3">
          <MoonIcon className="h-5 w-5 shrink-0 text-indigo-500" />
          <div>
            <p className="text-[11px] font-medium text-indigo-400">Bedtime</p>
            <p className="text-sm font-semibold text-slate-700">{bedTime}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-amber-50/70 px-4 py-3">
          <SunIcon className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-[11px] font-medium text-amber-500">Wake up</p>
            <p className="text-sm font-semibold text-slate-700">{wakeTime}</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <FlameIcon className="h-4 w-4 text-orange-500" />
          <span className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{consistencyCount}</span> day streak
          </span>
        </div>
        <div className="text-sm text-slate-600">
          Last night: <span className="font-semibold text-slate-800">{hours}h</span>
        </div>
      </div>

      {/* Quick log */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-slate-400">Log last night&apos;s sleep</p>
        <div className="flex gap-2">
          {[6, 7, 8].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => handleLog(h)}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                hours === h
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoonIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.354 15.354A9 9 0 018.646 3.646a9.003 9.003 0 1011.708 11.708z" />
    </svg>
  );
}

function SunIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function FlameIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2c1 3-2 4-2 7a3 3 0 006 0c1.5 1.5 2 3.5 2 5a6 6 0 11-12 0c0-4 3-5 3-8 1 1 1.5 2 1.5 3 .5-2 1.5-4 1.5-7z" />
    </svg>
  );
}