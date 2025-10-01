'use client';

import * as React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  InputBase,
  MenuItem,
  Menu,
  Box,
  Divider,
} from '@mui/material';
import { Skeleton } from '@mui/material';

import { styled, alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import AccountCircle from '@mui/icons-material/AccountCircle';
import MoreIcon from '@mui/icons-material/MoreVert';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import Link from 'next/link';
import LogoutButton from '../user/LogoutButton';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

// Styled Components
const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
  },
}));

export default function AppBarTop() {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [mobileMoreAnchorEl, setMobileMoreAnchorEl] =
    React.useState<null | HTMLElement>(null);

  const isMenuOpen = Boolean(anchorEl);
  const isMobileMenuOpen = Boolean(mobileMoreAnchorEl);
  const { user, loading, isGuest } = useAuth();
  const { theme, setThemeMode, refreshTheme } = useCustomTheme();

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMoreAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    handleMobileMenuClose();
  };

  const handleMobileMenuClose = () => {
    setMobileMoreAnchorEl(null);
  };

  const menuId = 'primary-account-menu';
  const renderMenu = (
    <Menu
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      id={menuId}
      keepMounted
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      open={isMenuOpen}
      onClose={handleMenuClose}
      PaperProps={{
        sx: {
          minWidth: 320,
          px: 2,
          py: 1,
        },
      }}
    >
      {user?.role === 'master' && !isGuest && (
        <MenuItem onClick={handleMenuClose}>
          <Link href="/user/dashboard">Dashboard</Link>
        </MenuItem>
      )}
      {user?.role === 'master' && !isGuest && <Divider />}

      {!loading && user
        ? [
            ...(isGuest
              ? [
                  <MenuItem key="guest-signup" onClick={handleMenuClose}>
                    <Link
                      href="/user/signup"
                      style={{ color: '#1976d2', fontWeight: 'bold' }}
                    >
                      🚀 Sign Up to Save Data
                    </Link>
                  </MenuItem>,
                  <MenuItem key="guest-login" onClick={handleMenuClose}>
                    <Link href="/user/login">Login</Link>
                  </MenuItem>,
                  <Divider key="guest-divider" />,
                ]
              : []),
            <MenuItem key="logout" onClick={handleMenuClose}>
              <LogoutButton />
            </MenuItem>,
          ]
        : [
            <MenuItem key="login" onClick={handleMenuClose}>
              <Link href="/user/login">Login</Link>
            </MenuItem>,
            <Divider key="divider" />,
            <MenuItem key="signup" onClick={handleMenuClose}>
              <Link href="/user/signup">SignUp</Link>
            </MenuItem>,
          ]}
    </Menu>
  );

  const mobileMenuId = 'primary-account-menu-mobile';
  const renderMobileMenu = (
    <Menu
      anchorEl={mobileMoreAnchorEl}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      id={mobileMenuId}
      keepMounted
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      open={isMobileMenuOpen}
      onClose={handleMobileMenuClose}
    >
      <MenuItem>
        <Link
          href="/2/change-log"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <IconButton size="large" color="inherit">
            <HistoryIcon />
          </IconButton>
        </Link>
        <p>Change Log</p>
      </MenuItem>

      {/* ✅ Dark Mode Toggle on Mobile */}
      <MenuItem
        onClick={() => {
          const newMode = theme?.mode === 'dark' ? 'light' : 'dark';
          setThemeMode(newMode);
          refreshTheme(); // 🔄 Refresh here too
        }}
      >
        <IconButton size="large" color="inherit">
          {theme?.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
        <p>{theme?.mode === 'dark' ? 'Light Mode' : 'Dark Mode'}</p>
      </MenuItem>

      <MenuItem onClick={handleProfileMenuOpen}>
        <IconButton
          size="large"
          aria-label="account of current user"
          aria-controls="primary-account-menu"
          aria-haspopup="true"
          color="inherit"
        >
          <AccountCircle />
        </IconButton>
        <p>Profile</p>
      </MenuItem>
    </Menu>
  );

  if (!theme) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" sx={{ bgcolor: '#f8fafc', color: '#0f172a' }}>
          <Toolbar sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Skeleton variant="text" width={80} height={32} />
            <Box sx={{ flexGrow: 1 }}>
              <Skeleton
                variant="rectangular"
                height={36}
                width="60%"
                sx={{ borderRadius: 1 }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton variant="circular" width={32} height={32} />
            </Box>
          </Toolbar>
        </AppBar>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            MyOrbit
          </Typography>

          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="Search…"
              inputProps={{ 'aria-label': 'search' }}
            />
          </Search>

          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
            <Link href="/2/change-log">
              <IconButton size="large" color="inherit" aria-label="change log">
                <HistoryIcon />
              </IconButton>
            </Link>
            <IconButton
              size="large"
              color="inherit"
              aria-label="toggle dark mode"
              onClick={() => {
                const newMode = theme?.mode === 'dark' ? 'light' : 'dark';
                setThemeMode(newMode);
                refreshTheme(); // 🔄 Refresh after mode change
              }}
              sx={{ ml: 1 }}
            >
              {theme.mode === 'dark' ? (
                <Brightness7Icon />
              ) : (
                <Brightness4Icon />
              )}
            </IconButton>
            <IconButton
              size="large"
              edge="end"
              aria-label="account"
              aria-controls={menuId}
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <AccountCircle />
            </IconButton>
          </Box>

          <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="more options"
              aria-controls={mobileMenuId}
              aria-haspopup="true"
              onClick={handleMobileMenuOpen}
              color="inherit"
            >
              <MoreIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      {renderMobileMenu}
      {renderMenu}
    </Box>
  );
}
