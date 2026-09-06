"use client";

import { useState } from "react";

/**
 * MedicalCarePlan
 * -----------------
 * Template for a "Medical Care Plan" goal — e.g. "Get reason of frequent
 * numbness". A plan is a mix of independent tracked things, so each kind
 * is rendered as its own small card/section rather than one flat card:
 *
 *   - appointments        doctor/clinic, next date, short visit history
 *   - tests                test name, next/last date, result
 *   - medicines            prescribed drug list (name, dosage, frequency)
 *   - medicationSchedule   daily dosage timing checklist
 *   - followUps            next follow-up date + notes
 *
 * Every section is optional — a plan only renders the sections it has
 * data for, so a "medicines only" plan looks fine, as does an
 * "appointments + tests" plan.
 *
 * Usage:
 *   <MedicalCarePlan plan={{
 *     title: "Get reason of frequent numbness",
 *     description: "Investigating recurring numbness in hands and feet",
 *     status: "active",
 *     appointments: [...],
 *     tests: [...],
 *     medicines: [...],
 *     medicationSchedule: [...],
 *     followUps: [...],
 *   }} />
 */

const STATUS_STYLES = {
  active: "bg-sky-50 text-sky-600",
  resolved: "bg-emerald-50 text-emerald-600",
  paused: "bg-slate-100 text-slate-500",
};

const RESULT_STYLES = {
  normal: "bg-emerald-50 text-emerald-600",
  pending: "bg-amber-50 text-amber-600",
  abnormal: "bg-rose-50 text-rose-600",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const DEMO_PLAN = {
  title: "Get reason of frequent numbness",
  description: "Investigating recurring numbness in hands and feet",
  status: "active",
  appointments: [
    {
      doctor: "Dr. Ahsan Raza",
      clinic: "City Neuro Clinic",
      nextDate: "2026-09-12",
      history: [
        { date: "2026-08-20", note: "Initial consult" },
        { date: "2026-07-15", note: "Referral" },
      ],
    },
  ],
  tests: [
    { name: "MRI Brain", nextDate: "2026-09-15", lastDate: "2026-08-22", result: "Normal" },
  ],
  medicines: [
    { name: "Gabapentin", dosage: "100mg", frequency: "2x/day", prescribedBy: "Dr. Ahsan Raza" },
  ],
  medicationSchedule: [
    { time: "Morning", label: "8:00 AM", taken: true },
    { time: "Afternoon", label: "2:00 PM", taken: false },
    { time: "Night", label: "9:00 PM", taken: false },
  ],
  followUps: [
    { type: "Neurologist review", nextDate: "2026-10-01", notes: "Bring test results" },
  ],
};

export default function MedicalCarePlan({ plan = DEMO_PLAN }) {
  const {
    title,
    description,
    status = "active",
    appointments = [],
    tests = [],
    medicines = [],
    medicationSchedule = [],
    followUps = [],
  } = plan;

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Plan header */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-400">Care plan</p>
            <h2 className="mt-0.5 text-lg font-semibold text-slate-800">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize ${
              STATUS_STYLES[status] ?? STATUS_STYLES.active
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {appointments.length > 0 && (
        <Section label="Appointments" color="sky" icon={StethoscopeIcon}>
          {appointments.map((a, i) => (
            <AppointmentCard key={i} {...a} />
          ))}
        </Section>
      )}

      {tests.length > 0 && (
        <Section label="Tests" color="violet" icon={FlaskIcon}>
          {tests.map((t, i) => (
            <TestCard key={i} {...t} />
          ))}
        </Section>
      )}

      {medicines.length > 0 && (
        <Section label="Medicines" color="amber" icon={PillIcon}>
          <MedicineListCard medicines={medicines} />
        </Section>
      )}

      {medicationSchedule.length > 0 && (
        <Section label="Medication schedule" color="teal" icon={ClockIcon}>
          <MedicationScheduleCard schedule={medicationSchedule} />
        </Section>
      )}

      {followUps.length > 0 && (
        <Section label="Follow-ups" color="indigo" icon={CalendarIcon}>
          {followUps.map((f, i) => (
            <FollowUpCard key={i} {...f} />
          ))}
        </Section>
      )}
    </div>
  );
}

/* ---------- Layout ---------- */

const DOT_COLORS = {
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
};

const ICON_COLORS = {
  sky: "text-sky-500",
  violet: "text-violet-500",
  amber: "text-amber-500",
  teal: "text-teal-500",
  indigo: "text-indigo-500",
};

function Section({ label, color, icon: Icon, children }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[color]}`} />
        <Icon className={`h-4 w-4 ${ICON_COLORS[color]}`} />
        <h3 className="text-sm font-semibold text-slate-600">{label}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/* ---------- Section cards ---------- */

function AppointmentCard({ doctor, clinic, nextDate, history = [] }) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{doctor}</p>
          {clinic && <p className="text-xs text-slate-400">{clinic}</p>}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium text-sky-500">Next appointment</p>
          <p className="text-sm font-semibold text-slate-700">{formatDate(nextDate)}</p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            {showHistory ? "Hide history" : `View history (${history.length})`}
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5">
              {history.map((h, i) => (
                <li key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{h.note}</span>
                  <span className="font-medium text-slate-400">{formatDate(h.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TestCard({ name, nextDate, lastDate, result }) {
  const resultKey = (result || "").toLowerCase();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{name}</p>
          {lastDate && (
            <p className="text-xs text-slate-400">Last done {formatDate(lastDate)}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium text-violet-500">Next test</p>
          <p className="text-sm font-semibold text-slate-700">{formatDate(nextDate)}</p>
        </div>
      </div>
      {result && (
        <span
          className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
            RESULT_STYLES[resultKey] ?? "bg-slate-100 text-slate-500"
          }`}
        >
          {result}
        </span>
      )}
    </div>
  );
}

function MedicineListCard({ medicines }) {
  return (
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
      {medicines.map((m, i) => (
        <div key={i} className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {m.name} <span className="font-normal text-slate-400">{m.dosage}</span>
            </p>
            {m.prescribedBy && (
              <p className="text-xs text-slate-400">Prescribed by {m.prescribedBy}</p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">
            {m.frequency}
          </span>
        </div>
      ))}
    </div>
  );
}

function MedicationScheduleCard({ schedule }) {
  const [taken, setTaken] = useState(() => schedule.map((s) => !!s.taken));

  const toggle = (i) => {
    setTaken((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {schedule.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors ${
              taken[i]
                ? "border-teal-500 bg-teal-500 text-white"
                : "border-slate-200 text-slate-500 hover:border-teal-300"
            }`}
          >
            <span className="text-xs font-medium">{s.time}</span>
            <span className={`text-[11px] ${taken[i] ? "text-teal-50" : "text-slate-400"}`}>
              {s.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FollowUpCard({ type, nextDate, notes }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{type}</p>
          {notes && <p className="mt-0.5 text-xs text-slate-400">{notes}</p>}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium text-indigo-500">Next follow-up</p>
          <p className="text-sm font-semibold text-slate-700">{formatDate(nextDate)}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Icons ---------- */

function StethoscopeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4.5 3v6a4.5 4.5 0 009 0V3M9 15.5a4.5 4.5 0 109 0V13" />
      <circle cx="19.5" cy="9" r="1.5" />
    </svg>
  );
}

function FlaskIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 2v6.5L4 18a2 2 0 001.8 3h12.4A2 2 0 0020 18l-5-9.5V2M8 2h8" />
    </svg>
  );
}

function PillIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="10.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 14)" />
      <path d="M9 9l6 6" />
    </svg>
  );
}

function ClockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function CalendarIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
    </svg>
  );
}