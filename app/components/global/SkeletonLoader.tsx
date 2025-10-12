'use client';

import React from 'react';
import { Box, Skeleton } from '@mui/material';

interface SkeletonLoaderProps {
  variant?: 'card' | 'list' | 'text' | 'rectangular';
  height?: number | string;
  width?: number | string;
  count?: number;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'card',
  height,
  width,
  count = 1,
}) => {
  const getSkeletonProps = () => {
    switch (variant) {
      case 'card':
        return {
          variant: 'rectangular' as const,
          height: height || 200,
          width: width || '100%',
          sx: { borderRadius: 2, mb: 2 },
        };
      case 'list':
        return {
          variant: 'rectangular' as const,
          height: height || 60,
          width: width || '100%',
          sx: { borderRadius: 1, mb: 1 },
        };
      case 'text':
        return {
          variant: 'text' as const,
          width: width || '100%',
          sx: { mb: 1 },
        };
      default:
        return {
          variant: 'rectangular' as const,
          height: height || 100,
          width: width || '100%',
        };
    }
  };

  const skeletonProps = getSkeletonProps();

  return (
    <Box>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} {...skeletonProps} />
      ))}
    </Box>
  );
};

export default SkeletonLoader;
