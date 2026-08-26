'use client';

import { Box } from '@mui/material';
import { useAuth } from '@/app/lib/context/userContext';

export default function ProductivityEditor() {
  const { user } = useAuth();

  return (
    <Box
      sx={{
        maxWidth: 'xl',
        width: '100%',
        mx: 'auto',
        display: 'flex',
        alignItems: 'center',
        fontWeight: 700,
        fontSize: '1.25rem',
      }}
    >
      {/* Dynamic greeting */}
      {(() => {
        const hour = new Date().getHours();
        let greeting = 'Good morning';
        if (hour >= 18) greeting = 'Good evening';
        else if (hour >= 12) greeting = 'Good afternoon';
        return `${greeting}, ${user?.firstName ? user.firstName : 'Guest'}`;
      })()}
    </Box>
  );
}
