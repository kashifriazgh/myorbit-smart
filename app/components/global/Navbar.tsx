'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import HomeIcon from '@mui/icons-material/Home';
import ChecklistIcon from '@mui/icons-material/Checklist';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import FlagIcon from '@mui/icons-material/Flag';
import { Skeleton, Box } from '@mui/material';

import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { theme } = useCustomTheme();
  const { user, loading } = useAuth();

  const [value, setValue] = React.useState(pathname);

  React.useEffect(() => {
    setValue(pathname);
  }, [pathname]);

  if (!theme || loading) {
    return (
      <Box
        sx={{
          width: '100%',
          position: 'fixed',
          bottom: 0,
          zIndex: 10,
          borderTop: '1px solid #ccc',
          bgcolor: '#f1f5f9',
          display: 'flex',
          justifyContent: 'space-around',
          p: 1,
        }}
      >
        {[...Array(4)].map((_, idx) => (
          <Box
            key={idx}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Skeleton variant="circular" width={28} height={28} />
            <Skeleton variant="text" width={40} height={10} />
          </Box>
        ))}
      </Box>
    );
  }

  const navItems = [
    {
      label: 'Home',
      icon: (
        <HomeIcon
          sx={{
            fontSize: 30,
            color: theme.mode === 'dark' ? '#facc15' : '#eab308', // yellow-400/500
          }}
        />
      ),
      path: '/',
    },
    { label: 'To-Do', icon: <ChecklistIcon />, path: '/to-do' },
    { label: 'Goals', icon: <FlagIcon />, path: '/goals' },
    { label: 'Finance', icon: <PriceCheckIcon />, path: '/finance' },
  ];

  const handleChange = (_: React.SyntheticEvent, newValue: string) => {
    setValue(newValue);
  };

  return (
    <BottomNavigation
      value={value}
      onChange={handleChange}
      sx={{
        width: '100%',
        position: 'fixed',
        bottom: 0,
        zIndex: 10,
        borderTop: '1px solid #ccc',
        bgcolor: theme.mode === 'dark' ? '#334155' : undefined,
        color: theme.mode === 'dark' ? '#f8fafc' : undefined,
      }}
    >
      {navItems.map((item) => (
        <BottomNavigationAction
          key={item.label}
          label={item.label}
          value={item.path}
          icon={item.icon}
          component={Link}
          href={user ? item.path : '#'}
          disabled={!user}
          sx={
            item.label === 'Home'
              ? {
                fontWeight: 600,
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.75rem',
                },
              }
              : {}
          }
        />
      ))}
    </BottomNavigation>
  );
}

