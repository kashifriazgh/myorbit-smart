import React from 'react';

export default function Loading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
        </div>
        <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
      </div>

      {/* Main Grid Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
              <div className="h-6 w-16 bg-blue-100 dark:bg-blue-950/60 rounded-full"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-700/60 rounded-md"></div>
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700/60 rounded-md"></div>
            </div>
            <div className="pt-2 flex justify-between items-center">
              <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
              <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
