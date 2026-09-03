import React from 'react';

export default function GoalDetailLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      {/* Back button */}
      <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>

      {/* Goal Main Card */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-3 w-3/4">
            <div className="h-8 w-2/3 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700/60 rounded"></div>
          </div>
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2 pt-2">
          <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>

        {/* Milestones / Sub-goals list */}
        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="h-6 w-36 bg-gray-200 dark:bg-gray-700 rounded"></div>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl space-y-2"
            >
              <div className="h-5 w-1/2 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
