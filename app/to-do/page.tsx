'use client';

import { useState } from 'react';
import ToDoModal from '../components/to-do/todoModal';
import TodosList from '../components/to-do/todoList';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import Link from 'next/link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function TodosPage() {
  const [open, setOpen] = useState(false);
  const { theme } = useCustomTheme();

  if (!theme) return null;

  return (
    <div className={`w-full min-h-screen transition-colors duration-500 ${
      theme.mode === 'dark' 
        ? 'bg-slate-950 text-slate-50 selection:bg-blue-500/30' 
        : 'bg-slate-50 text-slate-900 selection:bg-blue-200'
    }`}>
      <div className="max-w-[600px] mx-auto p-4 md:p-6">
        <h1 className={`text-3xl md:text-4xl font-extrabold mb-8 flex items-center gap-3 ${
          theme.mode === 'dark' ? 'text-white' : 'text-slate-900'
        }`}>
          <span className="drop-shadow-sm">✅</span> My Tasks
        </h1>
        
        {/* Input-style trigger to open modal */}
        <div
          onClick={() => setOpen(true)}
          className={`w-full p-4 mb-10 rounded-2xl border-2 cursor-pointer shadow-sm hover:shadow-md transition-all flex items-center gap-4 group backdrop-blur-sm ${
            theme.mode === 'dark' 
              ? 'border-slate-800 bg-slate-900/50 text-slate-500 hover:border-blue-500/50' 
              : 'border-slate-200/60 bg-white text-slate-400 hover:border-blue-400'
          }`}
        >
          <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform ${
            theme.mode === 'dark' ? 'bg-slate-800' : 'bg-slate-50'
          }`}>
            <span className="text-xl">📝</span>
          </div>
          <span className="text-lg font-medium">What do you want to get done?</span>
        </div>

        <div className="space-y-6">
          <TodosList />
        </div>

        {/* View Completed Tasks Button */}
        <div className="mt-12 text-center">
          <Link href="/to-do/completed" className="no-underline inline-block w-full sm:w-auto">
            <button className={`w-full sm:w-auto px-8 py-4 rounded-2xl border-2 font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm cursor-pointer group ${
              theme.mode === 'dark'
                ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                : 'border-emerald-500/80 text-emerald-600 hover:bg-emerald-50'
            }`}>
              <CheckCircleIcon className="group-hover:rotate-12 transition-transform" />
              <span>View Completed Tasks</span>
            </button>
          </Link>
        </div>

        <ToDoModal open={open} onClose={() => setOpen(false)} />
      </div>
    </div>
  );
}
