'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Badge,
  styled,
  Skeleton,
  Stack,
  Chip,
} from '@mui/material';
import { useTodoContext } from '@/app/lib/context/todoContext';
import moment from 'moment';

// Custom Styled Badge
const StyledBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    right: -3,
    top: 3,
    border: `2px solid ${theme.palette.background.paper}`,
    padding: '0 4px',
  },
}));

const OngoingPlanCard = () => {
  const { todos, loading } = useTodoContext();
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Generate 5 dates starting from today
  const dates = useMemo(() => {
    const d = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      d.push({
        date: date.getDate().toString(),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: date.toISOString().split('T')[0],
      });
    }
    return d;
  }, []);

  // Set initial selected date to today
  useEffect(() => {
    if (dates.length > 0) setSelectedDate(dates[0].fullDate);
  }, [dates]);

  // Calculate task counts for each day
  const taskCounts = useMemo(() => {
    const counts: { [date: string]: number } = {};
    todos.forEach((t) => {
      if (t.status !== 'completed' && t.dueDate) {
        const dueDate = moment(t.dueDate).format('YYYY-MM-DD');
        counts[dueDate] = (counts[dueDate] || 0) + 1;
      }
    });
    return counts;
  }, [todos]);

  // Filter tasks for selected day
  const dailyTasks = useMemo(() => {
    const start = moment(selectedDate).startOf('day');
    const end = moment(selectedDate).endOf('day');
    return todos.filter(t => 
      t.status !== 'completed' && 
      moment(t.dueDate).isBetween(start, end, 'day', '[]')
    );
  }, [todos, selectedDate]);

  return (
    <Box className="p-4">
      {/* Header */}
      <Box className="flex justify-between items-center mb-3">
        <Typography variant="subtitle1" fontWeight="bold">
          On Going Plan
        </Typography>
        <Typography variant="body2" color="primary" className="cursor-pointer">
          See all
        </Typography>
      </Box>

      {/* Date Picker */}
      <Box display="flex" justifyContent="center" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          {dates.map((dateInfo) => {
            const isSelected = selectedDate === dateInfo.fullDate;
            const count = taskCounts[dateInfo.fullDate] || 0;
            return (
              <StyledBadge
                key={dateInfo.fullDate}
                badgeContent={count}
                color="secondary"
                invisible={count === 0}
              >
                <Box
                  onClick={() => setSelectedDate(dateInfo.fullDate)}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 64,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease-in-out',
                    backgroundColor: isSelected ? '#fbbf24' : '#f3f4f6',
                    '&:hover': {
                      backgroundColor: isSelected ? '#f59e0b' : '#e5e7eb',
                    },
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: isSelected ? '#000000' : '#6b7280' }}
                  >
                    {dateInfo.date}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontSize: '0.7rem', color: isSelected ? '#000000' : '#9ca3af' }}
                  >
                    {dateInfo.day}
                  </Typography>
                </Box>
              </StyledBadge>
            );
          })}
        </Box>
      </Box>

      {/* Tasks List */}
      <Box>
        {loading ? (
          <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
        ) : dailyTasks.length === 0 ? (
          <Box py={4} textAlign="center" bgcolor="#f8fafc" borderRadius={2} border="1px dashed #e2e8f0">
            <Typography variant="body2" color="textSecondary">No tasks for this day</Typography>
          </Box>
        ) : (
          dailyTasks.slice(0, 3).map((task) => (
            <Card key={task.id} className="rounded-xl shadow-sm hover:shadow-md transition mb-2">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box className="flex items-start gap-2 mb-2">
                  <Typography variant="subtitle2" fontWeight="medium">
                    {task.title}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip size="small" label={task.priority} color={task.priority === 'critical' ? 'error' : 'default'} />
                  {task.steps && (
                    <Typography variant="caption" color="textSecondary" sx={{ alignSelf: 'center' }}>
                      {task.steps.filter(s => s.status === 'completed').length}/{task.steps.length} Steps
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Box>
    </Box>
  );
};

export default OngoingPlanCard;
