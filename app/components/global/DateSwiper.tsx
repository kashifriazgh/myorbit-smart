'use client';

import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { CalendarMonth as CalendarIcon } from '@mui/icons-material';
import 'react-datepicker/dist/react-datepicker.css';

interface DateSwiperProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  isFlexible: boolean;
}

interface DateOption {
  id: string;
  label: string;
  date: Date;
}

const isSameDay = (d1: Date | null, d2: Date | null) => {
  if (!d1 || !d2) return false;
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
};

const getEndOfWeekDate = () => {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 7 : 7 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

export default function DateSwiper({ value, onChange, isFlexible }: DateSwiperProps) {
  const [datesList, setDatesList] = useState<DateOption[]>([]);

  useEffect(() => {
    const today = new Date();
    
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const afterTomorrow = new Date();
    afterTomorrow.setDate(today.getDate() + 2);

    const nextWeek = getEndOfWeekDate();

    setDatesList([
      { id: 'today', label: 'Today', date: today },
      { id: 'tomorrow', label: 'Tomorrow', date: tomorrow },
      { id: 'afterTomorrow', label: 'After Tomorrow', date: afterTomorrow },
      { id: 'nextWeek', label: 'Next Week', date: nextWeek },
    ]);
  }, []);

  // Check if current value matches one of our predefined options
  const activeOption = datesList.find(opt => isSameDay(opt.date, value));
  const isCustomSelected = value !== null && !activeOption && !isFlexible;

  return (
    <div className="w-full flex items-center gap-1.5">
      {/* 4 Predefined Dates in one row */}
      <div className="grid grid-cols-4 gap-1.5 flex-grow min-w-0">
        {datesList.map((item) => {
          const isSelected = value !== null && isSameDay(value, item.date) && !isFlexible;
          return (
            <button
              key={item.id}
              type="button"
              disabled={isFlexible}
              onClick={() => onChange(item.date)}
              className={`
                w-full text-center py-2 px-1 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-center items-center h-[52px] select-none
                ${isSelected
                  ? 'bg-gradient-to-br from-teal-500 to-cyan-600 border-teal-400 text-white shadow-md shadow-teal-500/15 scale-[1.01] font-black'
                  : isFlexible
                    ? 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 text-slate-300 dark:text-slate-700 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-800/40 border-indigo-200/70 dark:border-indigo-900/50 text-slate-700 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-600'
                }
              `}
            >
              <span className="text-[10px] font-black tracking-tight truncate w-full">
                {item.label}
              </span>
              <span className={`text-[8.5px] font-bold block mt-0.5 ${isSelected ? 'text-teal-100' : 'text-slate-400 dark:text-slate-500'}`}>
                {item.date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Manual DatePicker Selector */}
      <div className="flex-shrink-0">
        <DatePicker
          selected={value}
          onChange={(date: Date | null) => onChange(date)}
          minDate={new Date()}
          disabled={isFlexible}
          customInput={
            <button
              type="button"
              className={`
                h-[52px] min-w-[56px] px-2.5 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all duration-200 cursor-pointer select-none
                ${isCustomSelected
                  ? 'bg-gradient-to-br from-orange-500 to-amber-500 border-orange-400 text-white shadow-lg shadow-orange-500/20 scale-[1.01] font-black'
                  : isFlexible
                    ? 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 text-slate-300 dark:text-slate-700 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-800/60 border-indigo-200/70 dark:border-indigo-900/50 text-slate-500 dark:text-slate-400 hover:text-teal-500 hover:border-teal-500'
                }
              `}
            >
              <CalendarIcon style={{ fontSize: 16 }} className={isCustomSelected ? 'text-white' : 'text-slate-400 dark:text-slate-500'} />
              <span className="text-[8.5px] font-black uppercase tracking-wider text-center">
                {isCustomSelected
                  ? value.toLocaleDateString([], { month: 'short', day: 'numeric' })
                  : 'Pick'}
              </span>
            </button>
          }
        />
      </div>
    </div>
  );
}
