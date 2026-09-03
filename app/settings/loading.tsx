import React from 'react';

export default function SettingsLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      {/* Title */}
      <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>

      {/* Settings Sections */}
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex justify-between items-center"
          >
            <div className="space-y-2">
              <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-3 w-64 bg-gray-200 dark:bg-gray-800 rounded"></div>
            </div>
            <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
