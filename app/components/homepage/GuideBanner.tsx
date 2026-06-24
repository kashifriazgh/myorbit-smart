'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Typography, Button } from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';

export default function GuideBanner() {
  const { theme } = useCustomTheme();
  const { user, markGuideAsVisited } = useAuth();
  const [showBanner, setShowBanner] = useState(false);
  const isDark = theme?.mode === 'dark';

  useEffect(() => {
    // 1. Check local storage first
    try {
      const localVisited = localStorage.getItem('myorbit_guide_visited') === 'true';
      if (localVisited) {
        setShowBanner(false);
        return;
      }
    } catch (e) {
      console.error('Error reading localStorage:', e);
    }

    // 2. Check DB / Context user record
    if (user) {
      if (user.guideVisited) {
        // Sync local storage so we don't check DB next time
        try {
          localStorage.setItem('myorbit_guide_visited', 'true');
        } catch (e) {
          console.error('Error writing to localStorage:', e);
        }
        setShowBanner(false);
      } else {
        setShowBanner(true);
      }
    } else {
      // If no user object is loaded yet, or it's a guest, let's show it (unless localVisited was true, which we handled)
      setShowBanner(true);
    }
  }, [user]);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          key="guide-banner"
          initial={{ opacity: 0, height: 0, y: -10 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -10 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
        >
          <Box
            className="relative overflow-hidden rounded-xl p-3 px-4 mb-5 border flex flex-row items-center justify-between gap-4 shadow-sm transition-all duration-300 hover:shadow-md"
            sx={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)'
                : 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)',
              borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(191, 219, 254, 0.6)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* Glow Effects */}
            <Box
              className="absolute -right-10 -top-10 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none"
              sx={{
                background: isDark ? '#3b82f6' : '#60a5fa',
              }}
            />
            <Box
              className="absolute -left-10 -bottom-10 w-24 h-24 rounded-full blur-2xl opacity-10 pointer-events-none"
              sx={{
                background: isDark ? '#8b5cf6' : '#a78bfa',
              }}
            />

            {/* Left Content: Icon + Title */}
            <div className="flex items-center gap-3 z-10">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <AutoStoriesIcon sx={{ fontSize: 20 }} />
              </div>
              <Typography
                variant="subtitle1"
                fontWeight="bold"
                className="text-slate-800 dark:text-slate-100"
                sx={{ fontFamily: 'var(--font-inter)', fontSize: '0.95rem' }}
              >
                New to MyOrbit?
              </Typography>
            </div>

            {/* Right Action Button */}
            <div className="z-10 shrink-0">
              <Button
                component={Link}
                href="/guide"
                variant="contained"
                onClick={markGuideAsVisited}
                endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} className="transition-transform group-hover:translate-x-1" />}
                className="group"
                sx={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 2.5,
                  py: 0.8,
                  borderRadius: '8px',
                  boxShadow: '0 4px 10px 0 rgba(37, 99, 235, 0.3)',
                  fontSize: '0.875rem',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                    boxShadow: '0 6px 15px 0 rgba(37, 99, 235, 0.4)',
                    transform: 'translateY(-1px)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                User guide
              </Button>
            </div>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
