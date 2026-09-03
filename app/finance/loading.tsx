import React from 'react';

export default function FinanceLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-3"
          >
            <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        ))}
      </div>

      {/* Transactions / Sources List */}
      <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-4">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="space-y-3 pt-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl"
            >
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded"></div>
              </div>
              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
