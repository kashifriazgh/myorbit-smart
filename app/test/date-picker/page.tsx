'use client';

import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';

const DateSelector = () => {
  const [selectedDate, setSelectedDate] = useState('22');

  const dates = [
    { day: 'Sun', date: '21' },
    { day: 'Mon', date: '22' },
    { day: 'Tue', date: '23' },
    { day: 'Wed', date: '27' },
    { day: 'Thu', date: '28' },
  ];

  return (
    <Box className="flex items-center justify-center space-x-3">
      {dates.map((d) => {
        const isSelected = selectedDate === d.date;
        return (
          <Box
            key={d.date}
            onClick={() => setSelectedDate(d.date)}
            className={`
              flex flex-col items-center justify-center cursor-pointer
              w-12 h-16 rounded-full
              transition-all duration-300 ease-in-out
              ${
                isSelected
                  ? 'bg-yellow-400 text-black'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            <Typography
              variant="body1"
              className={`font-semibold ${
                isSelected ? 'text-black' : 'text-gray-500'
              }`}
            >
              {d.date}
            </Typography>
            <Typography
              variant="caption"
              className={`${
                isSelected ? 'text-black font-medium' : 'text-gray-400'
              }`}
            >
              {d.day}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default DateSelector;
