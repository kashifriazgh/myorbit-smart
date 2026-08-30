'use client';

import { Button } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { userAuth as auth } from '@/app/lib/firebase';
import { clearGuestUser } from '@/app/lib/guestUser';
import { useAuth } from '@/app/lib/context/userContext';
import Cookies from 'js-cookie';

export default function LogoutButton() {
  const router = useRouter();
  const { user, isGuest } = useAuth();

  const handleLogout = async () => {
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
        router.push('/');
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      color="error"
      variant="outlined"
      startIcon={<LogoutIcon />}
    >
      {isGuest ? 'Clear Guest Data' : 'Logout'}
    </Button>
  );
}
