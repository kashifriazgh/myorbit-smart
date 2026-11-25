'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Check, X } from 'lucide-react';
import { getBudgetCycle, isValidBudgetStartDay } from '@/app/lib/finance/budgetCycle';

const ALL_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

interface BudgetStartDayPickerBodyProps {
  currentDay: number;
  onSave: (day: number) => Promise<boolean>;
  saving?: boolean;
  isDark?: boolean;
  compact?: boolean;
  onClose?: () => void;
}

export function BudgetStartDayPickerBody({
  currentDay,
  onSave,
  saving = false,
  isDark = true,
  compact = false,
  onClose,
}: BudgetStartDayPickerBodyProps) {
  const [selected, setSelected] = useState<number>(currentDay);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    setSelected(currentDay);
  }, [currentDay]);

  const previewCycle = useMemo(() => getBudgetCycle(selected, new Date(), 0), [selected]);

  const handleSave = async () => {
    const ok = await onSave(selected);
    if (ok) {
      setSavedMsg(true);
      setTimeout(() => {
        setSavedMsg(false);
        onClose?.();
      }, 600);
    }
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        Choose the date your salary or monthly budget starts.{' '}
        <span className="font-medium">Days 1–14</span> start that month (e.g. 5 Dec → Dec);{' '}
        <span className="font-medium">Days 21–31</span> start the upcoming month (e.g. 25 Nov → Dec).{' '}
        <span className="opacity-75">Days 15–20 are unavailable.</span>
      </p>

      {/* Day Grid 1..31 with 15..20 disabled */}
      <div className="grid grid-cols-7 gap-1.5">
        {ALL_DAYS.map((day) => {
          const allowed = isValidBudgetStartDay(day);
          const isSelected = selected === day;

          return (
            <button
              key={day}
              type="button"
              disabled={!allowed}
              onClick={() => allowed && setSelected(day)}
              title={allowed ? `Start month on day ${day}` : 'Days 15–20 cannot be selected'}
              className={`h-8 sm:h-9 rounded-lg text-xs font-semibold transition-all ${
                !allowed
                  ? isDark
                    ? 'bg-white/[0.02] text-slate-600 line-through cursor-not-allowed'
                    : 'bg-slate-100 text-slate-300 line-through cursor-not-allowed'
                  : isSelected
                  ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/40 cursor-pointer'
                  : isDark
                  ? 'bg-white/5 text-slate-200 hover:bg-white/15 cursor-pointer'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Live Preview */}
      <div
        className={`rounded-xl border px-3 py-2.5 text-xs ${
          isDark
            ? 'border-indigo-500/25 bg-indigo-950/40 text-indigo-200'
            : 'border-indigo-200 bg-indigo-50 text-indigo-900'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="opacity-80">Current cycle:</span>
          <span className="font-bold">
            {previewCycle.label} ({previewCycle.rangeLabel})
          </span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => setSelected(1)}
          className={`text-xs font-medium underline cursor-pointer ${
            isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Reset to 1st
        </button>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                isDark
                  ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {savedMsg ? (
              <>
                <Check size={14} />
                Saved
              </>
            ) : saving ? (
              'Saving…'
            ) : (
              'Save Start Day'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BudgetStartDayModal({
  open,
  onClose,
  currentDay,
  onSave,
  saving,
  isDark = true,
}: {
  open: boolean;
  onClose: () => void;
  currentDay: number;
  onSave: (day: number) => Promise<boolean>;
  saving?: boolean;
  isDark?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border p-5 shadow-2xl ${
          isDark
            ? 'bg-[#181c24] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="mb-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`flex size-9 items-center justify-center rounded-xl ${
                isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              <CalendarRange size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold leading-tight">
                Budget Month Start Date
              </h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Align your monthly cycle with your salary date
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl p-1.5 cursor-pointer ${
              isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
            }`}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <BudgetStartDayPickerBody
          currentDay={currentDay}
          onSave={onSave}
          saving={saving}
          isDark={isDark}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
