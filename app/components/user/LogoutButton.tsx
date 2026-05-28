'use client';

import { Button } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/app/lib/firebase';
import { clearGuestUser } from '@/app/lib/guestUser';
import { useAuth } from '@/app/lib/context/userContext';
import Cookies from 'js-cookie';

export default function LogoutButton() {
  const router = useRouter();
  const { isGuest } = useAuth();

  const handleLogout = async () => {
    try {
      if (isGuest) {
        // Clear guest user data
        clearGuestUser();
        // Reload the page to reset the app state
        window.location.reload();
      } else {
        // Firebase logout for authenticated users
        await signOut(auth);
        Cookies.remove('uid', { path: '/' });
        Cookies.remove('role', { path: '/' });
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
