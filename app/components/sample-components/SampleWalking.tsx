"use client";

import { useMemo, useState } from "react";

/**
 * WalkingMilestoneCard
 * ---------------------
 * Displays progress for a "Walk more" goal milestone.
 *
 * Goal-creation questions this card reflects:
 *  - targetSteps       -> "How many steps do you want to walk daily?"
 *  - morningWalkTime    \_ "When do you walk" (two scheduled walk windows,
 *  - eveningWalkTime    /   mirroring bedtime/wake-up on the sleep card)
 *  - consistencyCount  -> "Consistency count" (consecutive days logged)
 *  - todaySteps         -> "Step count each day"
 *
 * Progress = min(todaySteps / targetSteps, 1) * 100
 *   e.g. target 8,000, logged 8,000 -> 100%, logged 6,000 -> 75%
 *
 * Distance is derived from steps using an average stride length
 * (0.0008 km/step, i.e. ~80cm strides) unless distanceKm is passed in
 * directly from real tracker data.
 *
 * Usage:
 *   <WalkingMilestoneCard
 *     targetSteps={8000}
 *     morningWalkTime="7:00 AM"
 *     eveningWalkTime="6:30 PM"
 *     consistencyCount={9}
 *     todaySteps={6000}
 *     onLogSteps={(steps) => saveCheckIn(steps)}
 *   />
 */
export default function WalkingMilestoneCard({
  targetSteps = 8000,
  morningWalkTime = "7:00 AM",
  eveningWalkTime = "6:30 PM",
  consistencyCount = 9,
  todaySteps = 6000,
  distanceKm,
  onLogSteps,
}) {
  const [steps, setSteps] = useState(todaySteps);

  const progress = useMemo(() => {
    if (!targetSteps) return 0;
    return Math.max(0, Math.min(100, Math.round((steps / targetSteps) * 100)));
  }, [steps, targetSteps]);

  const km = useMemo(() => {
    if (typeof distanceKm === "number") return distanceKm;
    return +(steps * 0.0008).toFixed(1);
  }, [steps, distanceKm]);

  const presets = useMemo(() => {
    const round500 = (n) => Math.round(n / 500) * 500;
    return [
      round500(targetSteps * 0.75),
      targetSteps,
      round500(targetSteps * 1.25),
    ];
  }, [targetSteps]);

  const handleLog = (value) => {
    setSteps(value);
    onLogSteps?.(value);
  };

  // pathLength="100" lets us drive stroke-dasharray/offset directly in
  // percentage points regardless of the curve's real geometry.
  const trailPath = "M15,68 C60,15 90,110 130,55 C155,22 170,45 185,32";

  return (
    <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">Milestone</p>
          <h3 className="mt-0.5 text-lg font-semibold text-slate-800">
            Walk more
          </h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
          Goal: {targetSteps.toLocaleString()} steps
        </span>
      </div>

      {/* Trail progress */}
      <div className="relative mt-6 flex justify-center">
        <svg viewBox="0 0 200 110" className="w-full max-w-[260px]">
          <defs>
            <linearGradient id="trailGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#166534" />
              <stop offset="60%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#A3E635" />
            </linearGradient>
          </defs>

          {/* Track */}
          <path
            d={trailPath}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="8"
            strokeLinecap="round"
            pathLength="100"
          />
          {/* Progress */}
          <path
            d={trailPath}
            fill="none"
            stroke="url(#trailGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="100"
            strokeDashoffset={100 - progress}
            style={{ transition: "stroke-dashoffset 500ms ease" }}
          />

          {/* Start marker (footprints) */}
          <g transform="translate(15,68)">
            <circle r="9" fill="#166534" />
            <FootprintGlyph className="fill-white" transform="translate(-4,-4) scale(0.35)" />
          </g>
          {/* End marker (flag) */}
          <g transform="translate(185,32)">
            <circle r="9" fill={progress >= 100 ? "#65A30D" : "#CBD5E1"} />
            <FlagGlyph className="fill-white" transform="translate(-4,-5) scale(0.35)" />
          </g>
        </svg>

        {/* Center readout */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-3xl font-semibold tabular-nums text-slate-800">
            {steps.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-slate-400">
            steps · {km}km · {progress}% of goal
          </span>
        </div>
      </div>

      {/* Schedule pills */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-2xl bg-sky-50/70 px-4 py-3">
          <SunriseIcon className="h-5 w-5 shrink-0 text-sky-500" />
          <div>
            <p className="text-[11px] font-medium text-sky-500">Morning walk</p>
            <p className="text-sm font-semibold text-slate-700">{morningWalkTime}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-orange-50/70 px-4 py-3">
          <SunsetIcon className="h-5 w-5 shrink-0 text-orange-500" />
          <div>
            <p className="text-[11px] font-medium text-orange-500">Evening walk</p>
            <p className="text-sm font-semibold text-slate-700">{eveningWalkTime}</p>
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
          Distance: <span className="font-semibold text-slate-800">{km}km</span>
        </div>
      </div>

      {/* Quick log */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-slate-400">Log today&apos;s steps</p>
        <div className="flex gap-2">
          {presets.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleLog(s)}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                steps === s
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600"
              }`}
            >
              {s >= 1000 ? `${(s / 1000).toFixed(s % 1000 === 0 ? 0 : 1)}k` : s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FootprintGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" {...props}>
      <path d="M9 2c-2 0-3 2-3 4.5S7 12 7 14c0 1.5-1 2-1 3.5A2.5 2.5 0 008.5 20c1.5 0 2-1.2 2-2.5 0-3-1.5-4-1.5-8C9 6.5 10 5 10 3.5 10 2.7 9.6 2 9 2z" />
      <path d="M16 8c-1.7 0-2.5 1.6-2.5 3.5S15 15 15 17c0 1.2-.8 1.7-.8 3A2.3 2.3 0 0016.5 22c1.4 0 1.9-1.1 1.9-2.3 0-2.7-1.4-3.6-1.4-7.2 0-1.4.8-2.7.8-4C17.8 7.6 16.9 8 16 8z" />
    </svg>
  );
}

function FlagGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" {...props}>
      <path d="M6 2v20h2v-7h9l-2.5-4L17 7H8V2z" />
    </svg>
  );
}

function SunriseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M12 3v5M4.2 10.2l1.4 1.4M19.8 10.2l-1.4 1.4M2 18h20M6 18a6 6 0 0112 0" />
      <path d="M2 22h20" strokeOpacity="0" />
    </svg>
  );
}

function SunsetIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M12 10V5M4.2 12.2l1.4 1.4M19.8 12.2l-1.4 1.4M2 20h20M6 20a6 6 0 0112 0" />
      <path d="M9 5l3-2 3 2" />
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