'use client';

import React, { useMemo } from 'react';
import { Card, Typography, Box, Button } from '@mui/material';
import { useGoals } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import GoalSimpleCard from '../goals/GoalSimpleCard';
import { Add } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import 'keen-slider/keen-slider.min.css';
import { useKeenSlider } from 'keen-slider/react';

const Goals: React.FC = () => {
  const { goals, loading } = useGoals();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const router = useRouter();

  const handleViewGoal = (goalId: string) => {
    router.push(`/goals/${goalId}`);
  };

  const handleCreateGoal = () => {
    router.push('/goals/create');
  };

  // Filter by logged-in user, status In Progress/Not Started, sort by priority High > Medium > Low
  const priorityRank: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  const filteredGoals = useMemo(() => {
    if (!goals?.length || !user?.uid) return [];
    const userGoals = goals.filter((g) => g.userId === user.uid);
    return userGoals
      .filter((g) => g.status === 'In Progress' || g.status === 'Not Started')
      .sort(
        (a, b) =>
          (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0)
      );
  }, [goals, user]);

  // Show only the top 4 goals
  const displayGoals = useMemo(
    () => filteredGoals.slice(0, 4),
    [filteredGoals]
  );

  // Keen Slider (mobile)
  const [sliderRef] = useKeenSlider<HTMLDivElement>({
    slides: { perView: 1.1, spacing: 12 },
    breakpoints: {
      '(min-width: 640px)': { slides: { perView: 2, spacing: 16 } },
    },
    loop: false,
    drag: true,
    rubberband: true,
  });

  if (loading) {
    return (
      <Card
        sx={{
          backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          borderRadius: '1rem',
          p: 3,
        }}
      >
        <Typography variant="h6" className="font-semibold mb-4">
          Goals
        </Typography>
        <Box className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Box
              key={i}
              sx={{
                height: '140px',
                backgroundColor: theme?.mode === 'dark' ? '#374151' : '#f3f4f6',
                borderRadius: '1rem',
                animation: 'pulse 2s infinite',
              }}
            />
          ))}
        </Box>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        borderRadius: '1rem',
        p: 3,
      }}
    >
      <Box className="flex justify-between items-center mb-4">
        <Typography
          variant="h6"
          className="font-semibold"
          sx={{
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#1f2937',
          }}
        >
          Goals
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Add />}
          onClick={handleCreateGoal}
          sx={{
            borderColor: '#3B82F6',
            color: '#3B82F6',
            fontSize: '0.75rem',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: '#3B82F610',
              borderColor: '#3B82F6',
            },
          }}
        >
          Add Goal
        </Button>
      </Box>

      {displayGoals.length === 0 ? (
        <Box className="text-center py-8">
          <Typography
            variant="body1"
            sx={{
              color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
              mb: 2,
            }}
          >
            No goals yet. Create your first goal to get started!
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateGoal}
            sx={{
              backgroundColor: '#3B82F6',
              '&:hover': {
                backgroundColor: '#2563eb',
              },
            }}
          >
            Create Goal
          </Button>
        </Box>
      ) : (
        <>
          {/* Desktop view: 2 cards per row (max 4) */}
          <Box className="hidden sm:grid grid-cols-2 gap-4">
            {displayGoals.map((goal, i) => (
              <GoalSimpleCard
                key={goal.id}
                goal={goal}
                index={i}
                onClick={() => handleViewGoal(goal.id!)}
              />
            ))}
          </Box>

          {/* Mobile view: slider */}
          <div ref={sliderRef} className="sm:hidden keen-slider">
            {displayGoals.map((goal, i) => (
              <div key={goal.id} className="keen-slider__slide">
                <div className="pr-3">
                  <GoalSimpleCard
                    goal={goal}
                    index={i}
                    onClick={() => handleViewGoal(goal.id!)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Show “View All” only if filteredGoals exceed 4 */}
      {filteredGoals.length > 4 && (
        <Box className="text-center mt-4">
          <Button
            variant="text"
            size="small"
            onClick={() => router.push('/goals')}
            sx={{
              color: '#3B82F6',
              fontSize: '0.75rem',
              textTransform: 'none',
            }}
          >
            View All Goals ({filteredGoals.length})
          </Button>
        </Box>
      )}
    </Card>
  );
};

export default Goals;
