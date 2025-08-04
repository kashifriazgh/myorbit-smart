'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ChecklistIcon from '@mui/icons-material/Checklist';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
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
  const { user, loading } = useAuth(); // <-- get auth state

  const navItems = [
    { label: 'Ideas', icon: <LightbulbIcon />, path: '/ideas' },
    { label: 'To-Do', icon: <ChecklistIcon />, path: '/to-do' },
    { label: 'Journal', icon: <MenuBookIcon />, path: '/journals' },
    { label: 'Finance', icon: <PriceCheckIcon />, path: '/finance' },
  ];

  const [value, setValue] = React.useState(pathname);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

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

  // Show loading skeleton while waiting for auth or theme
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
            href={user ? item.path : '#'} // prevent navigation if user not ready
            disabled={!user}
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
          <ListItemButton disabled={!user} component={Link} href="/settings">
            <ListItemText primary="Settings" />
          </ListItemButton>
          <ListItemButton disabled={!user} component={Link} href="/profile">
            <ListItemText primary="Profile" />
          </ListItemButton>
          <ListItemButton disabled={!user} component={Link} href="/logout">
            <ListItemText primary="Logout" />
          </ListItemButton>
        </List>
      </Popover>
    </>
  );
}
