'use client';

import React, { useState } from 'react';
import { Alert, AlertTitle, Button, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                '&:hover': {
                  backgroundColor: '#f5f5f5',
                },
              }}
            >
              Sign Up
            </Button>
            <IconButton
              size="small"
              onClick={() => setDismissed(true)}
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        }
      >
        <AlertTitle>👋 Welcome, {user.firstName}!</AlertTitle>
        You&#39;re using MyOrbit as a guest. Your data is saved locally but
        won&#39;t sync across devices.
        <strong> Sign up now</strong> to save your progress permanently and
        access all features!
      </Alert>
    </Box>
  );
}
