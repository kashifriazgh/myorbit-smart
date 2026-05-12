'use client';
// Trigger HMR

import React, { useState } from 'react';
import { Button, Box, IconButton, Paper, Typography, Fade } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import Link from 'next/link';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function GuestUserBanner() {
  const { isGuest, user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  if (!isGuest || dismissed || !user) {
    return null;
  }

  return (
    <Fade in timeout={500}>
      <Box sx={{ mb: { xs: 2, sm: 3 }, px: { xs: 0, sm: 0 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2 },
            borderRadius: 3,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            background: isDark 
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
            border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
            backdropFilter: 'blur(12px)',
            boxShadow: isDark 
              ? '0 10px 30px -10px rgba(0,0,0,0.5)'
              : '0 10px 30px -10px rgba(99,102,241,0.15)',
            position: 'relative',
          }}
        >
          {/* Close button on absolute top-right for mobile */}
          <IconButton
            size="small"
            onClick={() => setDismissed(true)}
            sx={{ 
              position: 'absolute', 
              top: 8, 
              right: 8,
              color: 'text.secondary',
              display: { xs: 'flex', sm: 'none' } 
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box 
              sx={{ 
                width: 38, 
                height: 38, 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
              }}
            >
              <PersonAddIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box pr={{ xs: 3, sm: 0 }}>
              <Typography variant="body2" fontWeight="800" sx={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                Guest Mode Active
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 500 }}>
                Sign up to save your progress permanently.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
            <Button
              component={Link}
              href="/user/signup"
              variant="contained"
              size="small"
              fullWidth
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                boxShadow: 'none',
                px: 3,
                py: 0.75,
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #db2777 100%)',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }
              }}
            >
              Sign Up
            </Button>
            <Button
              component={Link}
              href="/user/login"
              variant="outlined"
              size="small"
              fullWidth
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                px: 3,
                py: 0.75,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.3)',
                color: isDark ? '#e2e8f0' : '#4f46e5',
                '&:hover': {
                  borderColor: '#6366f1',
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(99, 102, 241, 0.05)',
                }
              }}
            >
              Log In
            </Button>
            <IconButton
              size="small"
              onClick={() => setDismissed(true)}
              sx={{ 
                color: 'text.secondary',
                display: { xs: 'none', sm: 'flex' },
                ml: 1
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      </Box>
    </Fade>
  );
}
