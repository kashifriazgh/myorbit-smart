'use client';
import { Box, Typography, LinearProgress } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

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
  const [buffer, setBuffer] = useState(progressPercent + 10);
  const progressRef = useRef(() => {});

  const actualProgress = hasSteps
    ? progressPercent
    : status === 'completed'
    ? 100
    : 0;

  // Animate buffer to make it feel alive
  useEffect(() => {
    progressRef.current = () => {
      setBuffer((prev) => (prev < 100 ? prev + 2 + Math.random() * 6 : 100));
    };
  });

  useEffect(() => {
    const timer = setInterval(() => {
      progressRef.current();
    }, 200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Reset buffer if progress changes drastically
    setBuffer(progressPercent + 10);
  }, [progressPercent]);

  return (
    <Box mt={3}>
      <Typography variant="subtitle2" fontWeight="500">
        {actualProgress || 0}%
      </Typography>
      <LinearProgress
        variant="buffer"
        value={actualProgress}
        valueBuffer={buffer}
        sx={{ mt: 1, height: 8, borderRadius: 4 }}
      />
    </Box>
  );
}
