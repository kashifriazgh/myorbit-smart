'use client';

import React, { memo, useEffect, useState, useCallback } from 'react';
import { Box, Skeleton } from '@mui/material';
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
  console.info(headerData);
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

  return (
    <Box className="w-full mb-6">
      <div
        className="rounded-2xl shadow-lg p-5"
        style={{
          background:
            theme?.mode === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #ffffff 100%)',
          border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
        }}
      >
        {loading ? (
          <Skeleton variant="text" width={200} height={32} />
        ) : (
          <ProductivityEditor />
        )}
      </div>
    </Box>
  );
});

HomepageHeader.displayName = 'HomepageHeader';

export default HomepageHeader;
