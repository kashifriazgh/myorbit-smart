// components/QuickLinks.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, Box } from '@mui/material';
import { useCustomTheme } from '../../lib/context/themeContext';
import {
  FlagOutlined,
  RequestQuoteOutlined,
} from '@mui/icons-material';

const links = [
  { name: 'Goals',      icon: <FlagOutlined />,                   href: '/goals',                    lightBg: '#eff6ff', darkBg: '#1e3a5f', iconColor: '#2563eb' },
  { name: 'Loan',       icon: <RequestQuoteOutlined />,           href: '/finance/loans',            lightBg: '#f0fdfa', darkBg: '#134e4a', iconColor: '#0d9488' },
];

const QuickLinks = () => {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  return (
    <Card
      style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff' }}
      sx={{
        height: '100%',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        position: 'relative',
      }}
    >
      <CardContent sx={{ p: 2 }}>
        {/* Section Header */}
        <div className="flex items-center gap-2 mb-4 ml-1">
          <div className="w-2 h-5 bg-gradient-to-b from-violet-500 to-indigo-600 rounded-full" />
          <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-[0.2em]">
            Quick Launchpad
          </h2>
        </div>

        {/* Links Grid - Responsive CSS Grid (3 columns on mobile, 5 on desktop) */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(3, 1fr)',
              sm: 'repeat(5, 1fr)',
            },
            gap: { xs: 1.5, sm: 2 },
            justifyItems: 'center',
            width: '100%',
          }}
        >
          {links.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              style={{
                textDecoration: 'none',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: { xs: '84px', sm: '96px' },
                  aspectRatio: '1 / 1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '16px',
                  backgroundColor: isDark ? link.darkBg : link.lightBg,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                  p: { xs: 0.5, sm: 1 },
                  '&:hover': {
                    transform: 'scale(1.06) translateY(-3px)',
                    boxShadow: isDark
                      ? `0 8px 20px rgba(0,0,0,0.4)`
                      : `0 8px 20px rgba(0,0,0,0.12)`,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)'}`,
                  },
                }}
              >
                {/* Icon */}
                <Box
                  sx={{
                    mb: 0.75,
                    transition: 'transform 0.25s ease',
                    '&:hover': { transform: 'rotate(12deg) scale(1.1)' },
                    color: link.iconColor,
                    '& svg': { fontSize: '1.5rem' },
                  }}
                >
                  {link.icon}
                </Box>

                {/* Label */}
                <Box
                  component="span"
                  sx={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: isDark ? '#cbd5e1' : '#475569',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    px: 0.5,
                    letterSpacing: '0.01em',
                  }}
                >
                  {link.name}
                </Box>

                {/* Hover dot */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 6,
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    backgroundColor: link.iconColor,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    '.MuiBox-root:hover &': { opacity: 1 },
                  }}
                />
              </Box>
            </Link>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default QuickLinks;
