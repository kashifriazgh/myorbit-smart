'use client';

import { Box, TextField, Typography, Button } from '@mui/material';
import { useState } from 'react';
import ToDoModal from '../components/to-do/todoModal';
import TodosList from '../components/to-do/todoList';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import Link from 'next/link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function TodosPage() {
  const [open, setOpen] = useState(false);
  const { theme } = useCustomTheme();

  if (!theme) return null;

  return (
    <Box maxWidth="600px" mx="auto" p={1.5}>
      <Typography variant="h4" gutterBottom>
        ✅ My Tasks
      </Typography>
      {/* TextField styled trigger to open modal */}
      <TextField
        variant="outlined"
        placeholder="📝 What do you want to get done?"
        fullWidth
        onClick={() => setOpen(true)}
        InputProps={{
          readOnly: true,
          sx: {
            backgroundColor: theme.mode === 'dark' ? '#334155' : '#ffffff',
            color: theme.mode === 'dark' ? '#f1f5f9' : '#000000',
            borderRadius: 1.2,
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0, 102, 255, 0.1)',
            transition: 'all 0.25s ease',

            '&:hover': {
              boxShadow: '0 2px 8px rgba(0, 102, 255, 0.2)',
            },

            '&:focus-within': {
              borderColor: '#3366ff',
              boxShadow: '0 0 0 2px rgba(51, 102, 255, 0.25)',
            },

            '& fieldset': {
              borderColor: theme.mode === 'dark' ? '#f8fafc' : '#d0d7ff',
            },

            '&:hover fieldset': {
              borderColor: theme.mode === 'dark' ? '#e2e8f0' : '#a0bfff',
            },
          },
        }}
        sx={{ mb: 3 }}
      />

      <TodosList />

      {/* View Completed Tasks Button */}
      <Box mt={3} textAlign="center">
        <Link href="/to-do/completed" style={{ textDecoration: 'none' }}>
          <Button
            variant="outlined"
            startIcon={<CheckCircleIcon />}
            sx={{
              px: 3,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 500,
              borderColor: theme.mode === 'dark' ? '#4ade80' : '#22c55e',
              color: theme.mode === 'dark' ? '#4ade80' : '#22c55e',
              '&:hover': {
                borderColor: theme.mode === 'dark' ? '#22c55e' : '#16a34a',
                backgroundColor:
                  theme.mode === 'dark'
                    ? 'rgba(34, 197, 94, 0.1)'
                    : 'rgba(34, 197, 94, 0.05)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            View Completed Tasks
          </Button>
        </Link>
      </Box>

      <ToDoModal open={open} onClose={() => setOpen(false)} />
    </Box>
  );
}
