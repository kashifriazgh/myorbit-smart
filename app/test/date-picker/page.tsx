'use client';

import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

interface Goal {
  title: string;
  progress: string;
  goal: string;
  color: string; // main gradient color
  progressPercent?: number; // optional for wave height
}

const GoalsReport = () => {
  const goals: Goal[] = [
    {
      title: 'Water',
      progress: '2500ml',
      goal: '3.1L',
      color: '#3B82F6',
      progressPercent: 80,
    },
    {
      title: 'Weight',
      progress: '62kg',
      goal: '56kg',
      color: '#F59E0B',
      progressPercent: 60,
    },
    {
      title: 'BPM',
      progress: '95bpm',
      goal: '90',
      color: '#10B981',
      progressPercent: 50,
    },
    {
      title: 'Calories',
      progress: '320kcal',
      goal: '1950',
      color: '#F87171',
      progressPercent: 20,
    },
  ];

  return (
    <Box className="p-4">
      <Typography variant="h6" className="font-semibold mb-3 text-gray-700">
        Report{' '}
        <span className="text-gray-400 text-sm font-normal">
          Goals this week
        </span>
      </Typography>

      <div className="grid grid-cols-2 gap-4">
        {goals.map((goal, index) => (
          <Card
            key={index}
            className="relative overflow-hidden rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 bg-white"
            sx={{
              width: '160px',
              height: '160px',
              borderRadius: '1.5rem',
            }}
          >
            <CardContent className="p-4 h-full flex flex-col justify-between relative z-10">
              {/* Title */}
              <Typography
                variant="subtitle1"
                className="text-gray-800 font-semibold tracking-tight"
              >
                {goal.title}
              </Typography>

              {/* Bottom section */}
              <div className="flex justify-between items-end text-white font-semibold text-sm">
                <Typography
                  variant="h6"
                  className="text-lg font-bold text-white"
                >
                  {goal.progress}
                </Typography>
                <Typography className="opacity-90 text-sm">
                  Goal {goal.goal}
                </Typography>
              </div>
            </CardContent>

            {/* Wave background */}
            <div
              className="absolute bottom-0 left-0 w-full transition-all duration-700"
              style={{
                height: `${goal.progressPercent ?? 50}%`,
                background: `linear-gradient(180deg, ${goal.color}80 0%, ${goal.color}FF 100%)`,
                clipPath:
                  'path("M0,100 Q40,80 80,100 T160,100 L160,160 L0,160 Z")',
              }}
            />
          </Card>
        ))}
      </div>
    </Box>
  );
};

export default GoalsReport;
