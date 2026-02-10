'use client';

import React, { useState } from 'react';
import { Alert, AlertTitle, Button, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LoginIcon from '@mui/icons-material/Login';
import Link from 'next/link';
import { useAuth } from '@/app/lib/context/userContext';

export default function GuestUserBanner() {
  const { isGuest, user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Don't show banner if user is not a guest or has dismissed it
  if (!isGuest || dismissed || !user) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Alert
        severity="info"
        variant="filled"
        sx={{
          borderRadius: 2,
          '& .MuiAlert-message': {
            width: '100%',
          },
        }}
        action={
          <IconButton
            size="small"
            onClick={() => setDismissed(true)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        }
      >
        <AlertTitle>👋 Welcome, {user.firstName}!</AlertTitle>
        <strong> Sign up</strong> to save your progress
        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
          <Button
            component={Link}
            href="/user/signup"
            variant="contained"
            color="secondary"
            size="small"
            startIcon={<PersonAddIcon />}
            sx={{
              backgroundColor: 'white',
              color: '#1976d2',
              '&:hover': { backgroundColor: '#f5f5f5' },
            }}
          >
            Sign Up
          </Button>
          <Button
            component={Link}
            href="/user/login"
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={<LoginIcon sx={{ color: 'white' }} />}
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.7)',
              '&:hover': { borderColor: 'white' },
            }}
          >
            Sign In
          </Button>
        </Box>
      </Alert>
    </Box>
  );
}
