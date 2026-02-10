'use client';

import React, { memo, useEffect, useState, useCallback } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import ProductivityEditor from '../global/QuickEditor';

interface HeaderData {
  firstName: string;
  totalTasks: number;
}

const HomepageHeader = memo(() => {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [headerData, setHeaderData] = useState<HeaderData>({
    firstName: '',
    totalTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  // Populate header data from `user` directly to avoid extra Firestore requests
  const fetchHeaderData = useCallback(() => {
    const getFirstName = () => {
      if (!user) return '';
      if (user.firstName) return user.firstName;
      if (user.email) return user.email.split('@')[0];
      return '';
    };

    const firstName = getFirstName();
    const totalTasks = 0; // intentionally kept 0 while count logic is disabled

    setHeaderData({ firstName, totalTasks });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchHeaderData();
  }, [fetchHeaderData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <Box className="w-full mb-6">
      <div
        className="rounded-2xl shadow-lg lg:p-6 p-4 sm:p-5"
        style={{
          background:
            theme?.mode === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #ffffff 100%)',
          border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
          {/* Greeting Section */}
          <div className="flex-1 lg:w-[40%]">
            {loading ? (
              <div className="space-y-2">
                <Skeleton variant="text" width={200} height={32} />
                <Skeleton variant="text" width={160} height={20} />
              </div>
            ) : (
              <div>
                <Typography
                  variant="h4"
                  sx={{
                    color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
                    fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
                    lineHeight: 1.2,
                    mb: 0.5,
                  }}
                >
                  {getGreeting()},{' '}
                  <span style={{ fontWeight: 'bold' }}>
                    {headerData.firstName}
                  </span>
                </Typography>
              </div>
            )}
          </div>

          {/* Search Section */}
          <div className="flex-1 lg:w-[60%]">
            {loading ? (
              <Skeleton variant="rounded" height={56} />
            ) : (
              <ProductivityEditor variant="compact" />
            )}
          </div>
        </div>
      </div>
    </Box>
  );
});

HomepageHeader.displayName = 'HomepageHeader';

export default HomepageHeader;
