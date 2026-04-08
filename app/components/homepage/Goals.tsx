'use client';

import React, { useMemo, useState } from 'react';
import { Card, Typography, Box, Button, useMediaQuery } from '@mui/material';
import { useGoals } from '../../lib/context/GoalsContext';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import GoalSimpleCard from '../goals/GoalSimpleCard';
import { Add } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import 'keen-slider/keen-slider.min.css';
import { useKeenSlider } from 'keen-slider/react';
import GoalModal from '../goals/GoalModal';

const Goals: React.FC = () => {
  const { goals, loading } = useGoals();
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const router = useRouter();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width:639px)', { noSsr: true });

  const handleViewGoal = (goalId: string) => {
    router.push(`/goals/${goalId}`);
  };

  const handleCreateGoal = () => {
    setCreateModalOpen(true);
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
          (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0),
      );
  }, [goals, user]);

  // Show only the top 4 goals
  const displayGoals = useMemo(
    () => filteredGoals.slice(0, 4),
    [filteredGoals],
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
          border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
          boxShadow:
            '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        }}
      >
        <Typography
          variant="h6"
          className="font-bold mb-4"
          sx={{
            color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
          }}
        >
          🎯 Your Goals
        </Typography>
        <Box className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Box
              key={i}
              sx={{
                height: '200px',
                backgroundColor: theme?.mode === 'dark' ? '#334155' : '#f1f5f9',
                borderRadius: '1rem',
                border: `1px solid ${theme?.mode === 'dark' ? '#475569' : '#e2e8f0'}`,
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
        border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
        boxShadow:
          '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        transition: 'all 0.3s ease',
      }}
    >
      <Box className="flex justify-between items-center mb-6">
        <Box>
          <Typography
            variant="h6"
            className="font-bold"
            sx={{
              color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
              fontSize: '1.1rem',
              mb: 0.5,
            }}
          >
            🎯 Your Goals
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Add />}
          onClick={handleCreateGoal}
          sx={{
            borderColor: theme?.mode === 'dark' ? '#475569' : '#cbd5e1',
            color: theme?.mode === 'dark' ? '#cbd5e1' : '#475569',
            fontSize: '0.75rem',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: theme?.mode === 'dark' ? '#334155' : '#f1f5f9',
              borderColor: theme?.mode === 'dark' ? '#64748b' : '#94a3b8',
            },
          }}
        >
          Add Goal
        </Button>
      </Box>

      {displayGoals.length === 0 ? (
        <Box className="text-center py-12">
          <Typography
            variant="body1"
            sx={{
              color: theme?.mode === 'dark' ? '#94a3b8' : '#6b7280',
              mb: 3,
              fontSize: '0.95rem',
            }}
          >
            No active goals yet. Create your first goal to get started! 🚀
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
              textTransform: 'none',
            }}
          >
            Create Your First Goal
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
          {isMobile && (
            <div ref={sliderRef} className="keen-slider">
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
          )}
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

      {/* See more button at the bottom */}
      <Box className="text-center mt-2">
        <Button
          variant="outlined"
          size="small"
          onClick={() => router.push('/goals')}
          sx={{
            color: '#3B82F6',
            borderColor: '#3B82F6',
            fontSize: '0.75rem',
            textTransform: 'none',
            mt: 1,
          }}
        >
          See more
        </Button>
      </Box>

      {user && (
        <GoalModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
        />
      )}
    </Card>
  );
};

export default Goals;
