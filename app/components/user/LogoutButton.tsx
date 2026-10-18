'use client';

import { useState, useEffect } from 'react';
import { Backdrop, Box, Button, CircularProgress, Portal, Typography } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { signOut } from 'firebase/auth';
import { userAuth as auth } from '@/app/lib/firebase';
import { clearGuestUser } from '@/app/lib/guestUser';
import { useAuth } from '@/app/lib/context/userContext';
import Cookies from 'js-cookie';

export default function LogoutButton() {
  const { user, isGuest } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  // Automatically reset loggingOut state whenever user session changes
  useEffect(() => {
    setLoggingOut(false);
  }, [user?.uid, isGuest]);

  // Clean up state on unmount
  useEffect(() => {
    return () => {
      setLoggingOut(false);
    };
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      if (isGuest) {
        // Clear guest user data
        clearGuestUser();
        // Reload the page to reset the app state
        window.location.reload();
      } else {
        // Disable FCM device token for this user before logging out
        try {
          const { getCurrentFcmToken, removeFidFromDatabase } = await import('@/app/lib/utils/fcm');
          const fid = await getCurrentFcmToken();
          if (fid && user) {
            await removeFidFromDatabase(user.uid, fid);
          }
        } catch (fcmErr) {
          console.warn('FCM token cleanup failed during logout:', fcmErr);
        }

        // Firebase logout for authenticated users
        await signOut(auth);
        Cookies.remove('uid', { path: '/' });
        Cookies.remove('role', { path: '/' });
        localStorage.removeItem('myorbit_cached_user');
        localStorage.removeItem('myorbit_cached_onboarding');
        localStorage.removeItem('myorbit_cached_context_paragraph');

        // Full page redirect to cleanly reset all app states and in-memory caches
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Logout failed:', err);
      setLoggingOut(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleLogout}
        color="error"
        variant="outlined"
        disabled={loggingOut}
        startIcon={loggingOut ? <CircularProgress size={18} color="inherit" /> : <LogoutIcon />}
      >
        {loggingOut
          ? isGuest ? 'Clearing…' : 'Logging you out…'
          : isGuest ? 'Clear Guest Data' : 'Logout'}
      </Button>

      <Portal>
        <Backdrop open={loggingOut} sx={{ zIndex: (t) => t.zIndex.modal + 10, color: '#fff', backdropFilter: 'blur(4px)' }}>
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <CircularProgress color="inherit" />
            <Typography variant="body1" fontWeight={600}>
              {isGuest ? 'Clearing guest data…' : 'Logging you out…'}
            </Typography>
          </Box>
        </Backdrop>
      </Portal>
    </>
  );
}
