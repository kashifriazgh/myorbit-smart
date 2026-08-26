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
  Badge,
  Button,
} from '@mui/material';
import { Skeleton } from '@mui/material';

import { styled, alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';
import AccountCircle from '@mui/icons-material/AccountCircle';
import MoreIcon from '@mui/icons-material/MoreVert';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Link from 'next/link';
import LogoutButton from '../user/LogoutButton';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
} from 'firebase/firestore';
import { userDb } from '@/app/lib/firebase';

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

  // Notifications interface
  interface NavNotification {
    id: string;
    type: 'incoming' | 'accepted';
    title: string;
    message: string;
    rawInvite: {
      id: string;
      senderUid: string;
      senderName: string;
      senderShareId: string;
      senderUsername?: string;
      receiverUid: string;
      receiverName: string;
      receiverShareId: string;
      receiverUsername?: string;
      status: 'pending' | 'accepted' | 'rejected';
      acknowledgedBySender?: boolean;
    };
  }

  // Notifications states
  const [notifications, setNotifications] = React.useState<NavNotification[]>([]);
  const [notiAnchorEl, setNotiAnchorEl] = React.useState<null | HTMLElement>(null);
  const isNotiMenuOpen = Boolean(notiAnchorEl);

  const handleNotiMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotiAnchorEl(event.currentTarget);
  };

  const handleNotiMenuClose = () => {
    setNotiAnchorEl(null);
  };

  // Real-time listener for incoming pending invitations and accepted confirmations
  React.useEffect(() => {
    if (!user || isGuest) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(userDb, 'invitations'),
      where('status', 'in', ['pending', 'accepted'])
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: NavNotification[] = [];
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.receiverUid === user.uid && data.status === 'pending') {
          list.push({
            id: docSnap.id,
            type: 'incoming',
            title: 'Sharing Invitation Received 📬',
            message: `${data.senderName} (@${data.senderUsername || 'user'}) sent you a device sharing request.`,
            rawInvite: { id: docSnap.id, ...data } as NavNotification['rawInvite']
          });
        } else if (data.senderUid === user.uid && data.status === 'accepted' && data.acknowledgedBySender === false) {
          list.push({
            id: docSnap.id,
            type: 'accepted',
            title: 'Invitation Accepted 🎉',
            message: `${data.receiverName} accepted your sharing invitation.`,
            rawInvite: { id: docSnap.id, ...data } as NavNotification['rawInvite']
          });
        }
      });
      setNotifications(list);
    }, (err) => {
      console.error('Error listening to notifications:', err);
    });

    return () => unsub();
  }, [user, isGuest]);

  const handleAcceptRequest = async (invite: NavNotification['rawInvite']) => {
    try {
      await updateDoc(doc(userDb, 'invitations', invite.id), {
        status: 'accepted',
        acknowledgedBySender: false,
      });
      await updateDoc(doc(userDb, 'users', invite.senderUid), {
        sharedWith: arrayUnion({
          uid: invite.receiverUid,
          displayName: invite.receiverName,
          shareId: invite.receiverShareId,
        }),
      });
      await updateDoc(doc(userDb, 'users', invite.receiverUid), {
        sharedWith: arrayUnion({
          uid: invite.senderUid,
          displayName: invite.senderName,
          shareId: invite.senderShareId,
        }),
      });
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const handleRejectRequest = async (invite: NavNotification['rawInvite']) => {
    try {
      await deleteDoc(doc(userDb, 'invitations', invite.id));
    } catch (err) {
      console.error('Failed to reject request:', err);
    }
  };

  const handleDismissNotification = async (invite: NavNotification['rawInvite']) => {
    try {
      await updateDoc(doc(userDb, 'invitations', invite.id), {
        acknowledgedBySender: true,
      });
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

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
      {user && !isGuest && (
        <MenuItem onClick={handleMenuClose}>
          <Link href="/user/dashboard" prefetch={false}>Dashboard</Link>
        </MenuItem>
      )}
      {user && !isGuest && (
        <MenuItem onClick={handleMenuClose}>
          <Link href="/settings" prefetch={false}>Settings</Link>
        </MenuItem>
      )}
      {user && !isGuest && <Divider />}

      {!loading && user
        ? [
          ...(isGuest
            ? [
              <MenuItem key="guest-signup" onClick={handleMenuClose}>
                <Link
                  href="/user/signup"
                  prefetch={false}
                  style={{ color: '#1976d2', fontWeight: 'bold' }}
                >
                  🚀 Sign Up to Save Data
                </Link>
              </MenuItem>,
              <MenuItem key="guest-login" onClick={handleMenuClose}>
                <Link href="/user/login" prefetch={false}>Login</Link>
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
            <Link href="/user/login" prefetch={false}>Login</Link>
          </MenuItem>,
          <Divider key="divider" />,
          <MenuItem key="signup" onClick={handleMenuClose}>
            <Link href="/user/signup" prefetch={false}>SignUp</Link>
          </MenuItem>,
        ]}
    </Menu>
  );

  const notificationsMenuId = 'primary-notifications-menu';
  const renderNotificationsMenu = (
    <Menu
      anchorEl={notiAnchorEl}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      id={notificationsMenuId}
      keepMounted
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      open={isNotiMenuOpen}
      onClose={handleNotiMenuClose}
      PaperProps={{
        sx: {
          width: 360,
          maxHeight: 480,
          borderRadius: '12px',
          mt: 1.5,
          boxShadow: theme?.mode === 'dark' 
            ? '0 10px 25px -5px rgba(0,0,0,0.5)' 
            : '0 10px 25px -5px rgba(0,0,0,0.1)',
          border: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
          bgcolor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
          color: theme?.mode === 'dark' ? '#f1f5f9' : '#0f172a',
        }
      }}
    >
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}` }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Notifications</Typography>
        {notifications.length > 0 && (
          <Typography variant="caption" color="primary" sx={{ fontWeight: 650 }}>
            {notifications.length} Pending
          </Typography>
        )}
      </Box>
      
      {notifications.length === 0 ? (
        <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            🔔 No new notifications
          </Typography>
        </Box>
      ) : (
        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          {notifications.map((noti) => (
            <Box 
              key={noti.id} 
              sx={{ 
                p: 2, 
                borderBottom: `1px solid ${theme?.mode === 'dark' ? '#334155' : '#e2e8f0'}`,
                '&:hover': { bgcolor: theme?.mode === 'dark' ? '#334155' : '#f8fafc' }
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: noti.type === 'accepted' ? '#10b981' : '#f59e0b', display: 'block', mb: 0.5 }}>
                {noti.title}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 550, mb: 1.5, lineHeight: 1.4 }}>
                {noti.message}
              </Typography>
              
              {noti.type === 'incoming' ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    variant="contained" 
                    size="small" 
                    color="success"
                    onClick={() => handleAcceptRequest(noti.rawInvite)}
                    sx={{ textTransform: 'none', fontSize: '0.7rem', fontWeight: 700 }}
                  >
                    Accept
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    color="error"
                    onClick={() => handleRejectRequest(noti.rawInvite)}
                    sx={{ textTransform: 'none', fontSize: '0.7rem', fontWeight: 700 }}
                  >
                    Decline
                  </Button>
                </Box>
              ) : (
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => handleDismissNotification(noti.rawInvite)}
                  sx={{ textTransform: 'none', fontSize: '0.7rem', fontWeight: 700, borderColor: theme?.mode === 'dark' ? '#475569' : '#cbd5e1', color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b' }}
                >
                  Dismiss
                </Button>
              )}
            </Box>
          ))}
        </Box>
      )}
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
          prefetch={false}
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
            <Link href="/2/change-log" prefetch={false}>
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
            {user && !isGuest && (
              <IconButton
                size="large"
                aria-label="show invitations notifications"
                aria-controls={notificationsMenuId}
                aria-haspopup="true"
                onClick={handleNotiMenuOpen}
                color="inherit"
                sx={{ ml: 1 }}
              >
                <Badge badgeContent={notifications.length} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            )}
            <IconButton
              size="large"
              edge="end"
              aria-label="account"
              aria-controls={menuId}
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
              sx={{ ml: 1 }}
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
      {renderNotificationsMenu}
    </Box>
  );
}

