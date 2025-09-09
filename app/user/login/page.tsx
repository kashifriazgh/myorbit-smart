'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import Cookies from 'js-cookie';
import {
  Box,
  Button,
  TextField,
  Typography,
  InputAdornment,
  IconButton,
  Snackbar,
  Alert,
} from '@mui/material';

import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useCustomTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [snack, setSnack] = useState<{
    message: string;
    type: 'success' | 'error';
    open: boolean;
  }>({
    message: '',
    type: 'success',
    open: false,
  });

  const handleLogin = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();

    if (!email || !password) {
      return setSnack({
        message: 'Please enter email and password.',
        type: 'error',
        open: true,
      });
    }

    setLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        throw new Error('User data not found.');
      }

      Cookies.set('uid', user.uid, { expires: 7 });
      Cookies.set('role', userDoc.data().role, { expires: 7 });

      setSnack({ message: 'Login successful.', type: 'success', open: true });

      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err) {
      console.error(err);
      let message = 'Login failed. Please try again.';

      if (err.code === 'auth/invalid-credential')
        message = 'Invalid email or password.';
      if (err.code === 'auth/network-request-failed')
        message = 'Network error. Check your connection.';
      if (err.code === 'auth/too-many-requests')
        message = 'Too many attempts. Try again later.';

      setSnack({ message, type: 'error', open: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      maxWidth={400}
      mx="auto"
      mt={10}
      px={2}
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      <Typography variant="h5" mb={2}>
        User Login
      </Typography>

      <form onSubmit={handleLogin}>
        <TextField
          fullWidth
          label="Email"
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <TextField
          fullWidth
          label="Password"
          margin="normal"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((p) => !p)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
          type="submit"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </form>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
