'use client';

import { Button } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/app/lib/firebase';
import Cookies from 'js-cookie';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth); // Firebase logout
      Cookies.remove('uid'); // Remove cookie
      router.push('/login'); // Redirect
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
      Logout
    </Button>
  );
}
