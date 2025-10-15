'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import HomeIcon from '@mui/icons-material/Home';
import ChecklistIcon from '@mui/icons-material/Checklist';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import TimelineIcon from '@mui/icons-material/Timeline';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import FlagIcon from '@mui/icons-material/Flag';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { Skeleton, Box } from '@mui/material';

import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';

export default function BottomNav() {
  const pathname = usePathname();
  const { theme } = useCustomTheme();
  const { user, loading } = useAuth();

  const [value, setValue] = React.useState(pathname);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

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
        {[...Array(5)].map((_, idx) => (
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
    { label: 'To-Do', icon: <ChecklistIcon />, path: '/to-do' },
    { label: 'Journal', icon: <MenuBookIcon />, path: '/journals' },
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
    { label: 'Finance', icon: <PriceCheckIcon />, path: '/finance' },
  ];
  const handleChange = (_: React.SyntheticEvent, newValue: string) => {
    if (newValue === 'more') return;
    setValue(newValue);
  };

  const handleMoreClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMoreClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <>
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
        <BottomNavigationAction
          label="More"
          value="more"
          icon={<MoreHorizIcon />}
          onClick={handleMoreClick}
          disabled={!user}
        />
      </BottomNavigation>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleMoreClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <List sx={{ minWidth: 200 }}>
          <ListItemButton disabled={!user} component={Link} href="/goals">
            <FlagIcon sx={{ mr: 1 }} />
            <ListItemText primary="Goals" />
          </ListItemButton>
          <ListItemButton disabled={!user} component={Link} href="/ideas">
            <LightbulbIcon sx={{ mr: 1 }} />
            <ListItemText primary="Ideas" />
          </ListItemButton>
          <ListItemButton disabled={!user} component={Link} href="/time-table">
            <EventAvailableIcon sx={{ mr: 1 }} />
            <ListItemText primary="Time Table" />
          </ListItemButton>
          <ListItemButton disabled={!user} component={Link} href="/streaks">
            <TimelineIcon sx={{ mr: 1 }} />
            <ListItemText primary="Streaks" />
          </ListItemButton>
        </List>
      </Popover>
    </>
  );
}
