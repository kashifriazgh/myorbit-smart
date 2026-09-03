import React from 'react';

export default function ToDoDetailLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      {/* Back button & Action header */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>

      {/* Main Task Detail Card */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-6">
        <div className="space-y-3">
          <div className="h-8 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-700/60 rounded"></div>
          <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700/60 rounded"></div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="h-7 w-28 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>

        {/* Progress bar skeleton */}
        <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex justify-between">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full"></div>
        </div>

        {/* Steps List skeleton */}
        <div className="space-y-3 pt-4">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl flex items-center justify-between"
            >
              <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
