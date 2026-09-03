import React from 'react';

export default function GoalsLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-4 w-56 bg-gray-200 dark:bg-gray-800 rounded"></div>
        </div>
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
      </div>

      {/* Goal Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>
            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700/60 rounded"></div>
            <div className="space-y-2 pt-2">
              <div className="flex justify-between">
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded"></div>
                <div className="h-3 w-8 bg-gray-200 dark:bg-gray-800 rounded"></div>
              </div>
              <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
