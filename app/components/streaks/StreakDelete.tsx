'use client';
import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useStreaks } from '@/app/lib/context/StreaksContext';

interface DeleteStreakProps {
  streakId: string;
}

export default function DeleteStreak({ streakId }: DeleteStreakProps) {
  const { deleteStreakItem } = useStreaks();

  const handleDelete = async () => {
    if (!streakId) return;

    const confirmDelete = window.confirm(
      'Are you sure you want to delete this streak? This action cannot be undone.'
    );
    if (!confirmDelete) return;

    try {
      await deleteStreakItem(streakId);
    } catch (error) {
      console.error('Error deleting streak:', error);
    }
  };

  return (
    <Tooltip title="Delete Streak">
      <IconButton
        size="small"
        onClick={handleDelete}
        sx={{
          color: 'error.main',
          backgroundColor: 'rgba(255,255,255,0.9)',
          '&:hover': {
            backgroundColor: 'rgba(255,0,0,0.15)',
          },
        }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
