'use client';

import React from 'react';

const DailyGoalsCard: React.FC = () => {
  return (
    <div className="w-full max-w-sm mx-auto bg-slate-50 dark:bg-slate-800 rounded-3xl overflow-hidden shadow-lg">
      {/* TOP GRADIENT SECTION */}
      <div className="relative bg-gradient-to-b from-blue-900 to-blue-800 dark:from-slate-800 dark:to-slate-900 px-6 pt-6 pb-14 text-white">
        <h2 className="text-sm font-medium opacity-90">Good Morning</h2>

        {/* CIRCULAR PROGRESS */}
        <div className="relative flex justify-center items-center mt-6">
          <svg className="w-44 h-44">
            {/* background ring */}
            <circle
              cx="88"
              cy="88"
              r="72"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="12"
              fill="none"
            />
            {/* progress ring */}
            <circle
              cx="88"
              cy="88"
              r="72"
              stroke="url(#gradient)"
              strokeWidth="12"
              strokeDasharray="452"
              strokeDashoffset="120"
              strokeLinecap="round"
              fill="none"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center text */}
          <div className="absolute text-center">
            <div className="text-3xl font-bold">
              7,500 {/*goal.metrics.totalTarget*/}{' '}
            </div>
            <div className="text-sm opacity-80">
              Steps {/*goal.metrics. ...*/}{' '}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="relative -mt-10 px-5 pb-6 space-y-5">
        {/* CHALLENGE CARD */}
        <div className="bg-white dark:bg-slate-700 rounded-2xl p-4 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                goals.type
              </span>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                Goal.title
              </h3>
            </div>

            <div className="w-11 h-11 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white text-lg">
              👣
            </div>
          </div>

          {/* progress */}
          <div className="mt-3">
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <div className="h-full w-[15%] bg-blue-600 dark:bg-blue-500 rounded-full" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              You have walked{' '}
              <span className="font-medium">15% {/*goal.progress*/} </span> of
              your goal
            </p>
          </div>
        </div>

        {/* TODAY GOALS HEADER */}
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Your Milestones
          </h4>
          <button className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            View all
          </button>
        </div>

        {/* GOAL ITEM 1 */}
        <div className="bg-white dark:bg-slate-700 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              💧
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                goal.step[0].title
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                3000 mls {/*goal.step.targetValue goal.unit*/}
              </p>
            </div>
          </div>
        </div>

        {/* GOAL ITEM 2 */}
        <div className="bg-white dark:bg-slate-700 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
              🎯
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                goal.step[1].title
              </p>
            </div>
          </div>

          <button className="text-xs font-semibold px-4 py-1.5 rounded-full bg-blue-900 dark:bg-blue-700 text-white">
            Complete {/*goal.step.completed ? 'completed' : '' */}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyGoalsCard;
