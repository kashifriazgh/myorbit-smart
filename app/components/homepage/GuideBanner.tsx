'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Box, Typography, Button } from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function GuideBanner() {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <Box
        className="relative overflow-hidden rounded-2xl p-5 md:p-6 mb-6 border flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm transition-all duration-300 hover:shadow-md"
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
          className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
          sx={{
            background: isDark ? '#3b82f6' : '#60a5fa',
          }}
        />
        <Box
          className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full blur-3xl opacity-10 pointer-events-none"
          sx={{
            background: isDark ? '#8b5cf6' : '#a78bfa',
          }}
        />

        {/* Content Container */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 z-10 text-center sm:text-left w-full md:w-3/4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 animate-pulse">
            <AutoStoriesIcon sx={{ fontSize: 32 }} />
          </div>
          <div>
            <Typography
              variant="h6"
              fontWeight="bold"
              className="mb-1 text-slate-800 dark:text-slate-100"
              sx={{ fontFamily: 'var(--font-inter)' }}
            >
              New to My Orbit?
            </Typography>
            <Typography
              variant="body2"
              className="text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed"
              sx={{ fontFamily: 'var(--font-roboto)' }}
            >
              Master your daily routine with our new **Interactive User Guide**. Learn how to schedule flexible tasks, track multi-step progress, and set up WhatsApp reminders for maximum productivity.
            </Typography>
          </div>
        </div>

        {/* Action Button */}
        <div className="z-10 shrink-0 w-full sm:w-auto flex justify-center">
          <Button
            component={Link}
            href="/guide"
            variant="contained"
            endIcon={<ArrowForwardIcon className="transition-transform group-hover:translate-x-1" />}
            className="group"
            sx={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              py: 1.2,
              borderRadius: '12px',
              boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                boxShadow: '0 6px 20px 0 rgba(37, 99, 235, 0.6)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            Open Interactive Guide
          </Button>
        </div>
      </Box>
    </motion.div>
  );
}
