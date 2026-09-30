'use client';

import React, { useState } from 'react';
import { Add as AddIcon } from '@mui/icons-material';

export interface GoalTaskCreatorProps {
  onAdd: (text: string) => void | Promise<void>;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  badge?: React.ReactNode;
}

export default function GoalTaskCreator({
  onAdd,
  title = 'Turn this goal into action',
  subtitle = 'Small steps now, big results later',
  placeholder = "What's one thing you can do today for this goal?",
  badge,
}: GoalTaskCreatorProps) {
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const trimmed = text.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      await onAdd(trimmed);
      setText('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      {/* Heading */}
      <div className="flex items-center justify-between gap-2.5 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-500/10 text-blue-500 shadow-sm">
            <AddIcon sx={{ fontSize: 22 }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
              {title}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {/* Input + button */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          className="flex-1 min-w-0 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!text.trim() || adding}
          className="px-3.5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors shadow-sm shrink-0"
        >
          {adding ? 'Adding...' : 'Add Task'}
        </button>
      </div>
    </div>
  );
}
