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
  Paper,
  Fade,
  Avatar,
  Divider,
} from '@mui/material';

import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Login as LoginIcon,
} from '@mui/icons-material';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

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

      // Clear any guest user data
      Cookies.remove('guest_uid');

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
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark
          ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        p: 2,
      }}
    >
      <Fade in timeout={800}>
        <Paper
          elevation={0}
          sx={{
            maxWidth: 440,
            width: '100%',
            p: { xs: 3, md: 5 },
            borderRadius: 6,
            bgcolor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)'}`,
            boxShadow: isDark 
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' 
              : '0 25px 50px -12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
            <Avatar 
              sx={{ 
                width: 64, 
                height: 64, 
                mb: 2, 
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)'
              }}
            >
              <LoginIcon fontSize="large" />
            </Avatar>
            <Typography variant="h4" fontWeight="900" sx={{ 
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}>
              Welcome Back
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight="500">
              Enter your credentials to access your account
            </Typography>
          </Box>

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Email Address"
              variant="outlined"
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                sx: { borderRadius: 3 }
              }}
            />

            <TextField
              fullWidth
              label="Password"
              variant="outlined"
              margin="normal"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((p) => !p)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
                sx: { borderRadius: 3 }
              }}
            />

            <Button
              variant="contained"
              fullWidth
              type="submit"
              disabled={loading}
              sx={{ 
                mt: 4, 
                mb: 3, 
                py: 1.5, 
                borderRadius: 3,
                fontWeight: 800,
                fontSize: '1rem',
                textTransform: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  boxShadow: '0 12px 20px rgba(99, 102, 241, 0.4)',
                }
              }}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary" fontWeight="500">
              OR
            </Typography>
          </Divider>

          <Box textAlign="center">
            <Typography variant="body2" color="text.secondary" fontWeight="500">
              Don&apos;t have an account?{' '}
              <Link href="/user/signup" style={{ textDecoration: 'none' }}>
                <Typography component="span" color="primary" fontWeight="700" sx={{ '&:hover': { textDecoration: 'underline' } }}>
                  Create one now
                </Typography>
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Fade>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.type} variant="filled" sx={{ borderRadius: 3, fontWeight: 600 }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
