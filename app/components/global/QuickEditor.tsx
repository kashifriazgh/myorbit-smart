'use client';

import { useState } from 'react';
import { Button, Box } from '@mui/material';
import { useAuth } from '@/app/lib/context/userContext';
import NoteInput from './NoteInput';

interface ProductivityEditorProps {
  variant?: 'default' | 'compact';
}

export default function ProductivityEditor({
  variant = 'default',
}: ProductivityEditorProps) {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <Box
      sx={{
        maxWidth: 'xl',
        width: '100%',
        mx: 'auto',
      }}
    >
      {/* Greeting and expand/collapse button on one line */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            fontWeight: 600,
            fontSize: '1.15rem',
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
        <Button
          size="small"
          variant="outlined"
          sx={{
            minWidth: 0,
            px: 1.5,
            py: 0.5,
            ml: 2,
            fontWeight: 700,
            fontSize: '1.2rem',
            borderRadius: 2,
          }}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? '+' : '–'}
        </Button>
      </Box>

      {/* Collapsible content */}
      {!collapsed && <NoteInput variant={variant} />}
    </Box>
  );
}
