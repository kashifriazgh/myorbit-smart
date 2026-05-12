'use client';
import { Box, Typography } from '@mui/material';

interface TodoProgressBarProps {
  progressPercent: number; // Actual percentage
  status: 'completed' | 'in_progress' | 'hold' | 'left-over'; // For fallback or styling if needed
  hasSteps: boolean; // To know if it should show 0% or 100% by default
}

export default function TodoProgressBar({
  progressPercent,
  status,
  hasSteps,
}: TodoProgressBarProps) {
  const actualProgress = hasSteps
    ? progressPercent
    : status === 'completed'
    ? 100
    : 0;

  return (
    <Box mt={3}>
      <div className="flex justify-between items-center mb-2">
        <Typography variant="subtitle2" fontWeight="700" className={status === 'completed' ? 'text-teal-600' : 'text-slate-600 dark:text-slate-300'}>
          Overall Progress
        </Typography>
        <Typography variant="subtitle2" fontWeight="800" className="text-indigo-600">
          {actualProgress || 0}%
        </Typography>
      </div>
      
      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-200/50 dark:border-slate-700">
        <div
          className={`h-full transition-all duration-1000 ease-out rounded-full ${
            status === 'completed' 
              ? 'bg-gradient-to-r from-teal-400 to-teal-600 shadow-[0_0_10px_rgba(20,184,166,0.3)]' 
              : 'bg-gradient-to-r from-indigo-400 to-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.3)]'
          }`}
          style={{ width: `${actualProgress}%` }}
        />
      </div>
    </Box>
  );
}
