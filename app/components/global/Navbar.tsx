'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
import { useCustomTheme } from '@/app/lib/context/themeContext';
import CircularProgress from '@mui/material/CircularProgress';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useCustomTheme();

  const navItems = [
    { label: 'Ideas', icon: <LightbulbIcon />, path: '/ideas' },
    { label: 'To-Do', icon: <ChecklistIcon />, path: '/to-do' },
    { label: 'Journal', icon: <MenuBookIcon />, path: '/journals' },
    { label: 'Finance', icon: <PriceCheckIcon />, path: '/finance' },
  ];

  const [value, setValue] = React.useState(pathname);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleChange = (_: React.SyntheticEvent, newValue: string) => {
    if (newValue === 'more') {
      return;
    }
    setValue(newValue);
    router.push(newValue);
  };

  const handleMoreClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMoreClose = () => {
    setAnchorEl(null);
  };

  const handleMoreOption = (href: string) => {
    router.push(href);
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  if (!theme) {
    return (
      <CircularProgress
        sx={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
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
          />
        ))}
        <BottomNavigationAction
          label="More"
          value="more"
          icon={<MoreHorizIcon />}
          onClick={handleMoreClick}
        />
      </BottomNavigation>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleMoreClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        <List sx={{ minWidth: 200 }}>
          <ListItemButton onClick={() => handleMoreOption('/settings')}>
            <ListItemText primary="Settings" />
          </ListItemButton>
          <ListItemButton onClick={() => handleMoreOption('/profile')}>
            <ListItemText primary="Profile" />
          </ListItemButton>
          <ListItemButton onClick={() => handleMoreOption('/logout')}>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </List>
      </Popover>
    </>
  );
}
