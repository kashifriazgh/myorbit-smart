import React from 'react';

export default function ToDoLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      {/* Title & Filter Bar Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>

      {/* Task List Items Skeleton */}
      <div className="space-y-3 pt-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="h-6 w-6 rounded-md bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
              <div className="space-y-2 w-full max-w-md">
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-800 rounded"></div>
              </div>
            </div>
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
