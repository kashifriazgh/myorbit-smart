'use client';

import { Box, Typography, Button } from '@mui/material';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import CompletedTodosList from '../../components/to-do/completedTodosList';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function CompletedTodosPage() {
  const { theme } = useCustomTheme();

  if (!theme) return null;

  return (
    <Box
      maxWidth="600px"
      mx="auto"
      p={1.5}
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      {/* Header with back button */}
      <Box
        display="flex"
        alignItems="center"
        gap={2}
        mb={3}
        sx={{
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: { xs: 1, sm: 2 },
        }}
      >
        <Link href="/to-do" style={{ textDecoration: 'none' }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              borderColor: theme.mode === 'dark' ? '#6b7280' : '#9ca3af',
              color: theme.mode === 'dark' ? '#9ca3af' : '#6b7280',
              '&:hover': {
                borderColor: theme.mode === 'dark' ? '#9ca3af' : '#6b7280',
                backgroundColor:
                  theme.mode === 'dark'
                    ? 'rgba(107, 114, 128, 0.1)'
                    : 'rgba(156, 163, 175, 0.05)',
              },
            }}
          >
            Back to Tasks
          </Button>
        </Link>
        <Typography
          variant="h4"
          sx={{
            flexGrow: 1,
            fontSize: { xs: '1.75rem', sm: '2.125rem' },
            textAlign: { xs: 'left', sm: 'left' },
          }}
        >
          ✅ Completed Tasks
        </Typography>
      </Box>

      {/* Completed tasks list */}
      <CompletedTodosList />
    </Box>
  );
}
