'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  AlertTitle,
  IconButton,
  InputAdornment,
  Paper,
  Fade,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { userAuth as auth, userDb as db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import Cookies from 'js-cookie';
import { migrateGuestDataToUser } from '@/app/lib/guestDataMigration';

export default function SignupPage() {
  const router = useRouter();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const { user: currentUser, isGuest } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const [masterExists, setMasterExists] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // 🔍 Check if master already exists
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const masterQuery = query(
          collection(db, 'users'),
          where('role', '==', 'master')
        );
        const masterSnapshot = await getDocs(masterQuery);
        setMasterExists(!masterSnapshot.empty);
      } catch (err) {
        console.error(err);
        setError('Failed to check user status.');
      } finally {
        setChecking(false);
      }
    };

    checkStatus();
  }, []);

  const handleSignup = async () => {
    if (!firstName || !lastName || !email || !password) {
      return setError('All fields are required.');
    }

    setLoading(true);
    setError('');

    try {
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCred.user;

      let role: 'master' | 'editor' | 'viewer' = 'master';
      let status: 'active' | 'pending' = 'active';

      if (masterExists) {
        role = 'editor';
        status = 'pending';
      }

      const userData = {
        uid: user.uid,
        email: user.email,
        firstName,
        lastName,
        role,
        status,
        createdAt: Timestamp.now(),
      };

      await setDoc(doc(db, 'users', user.uid), userData);

      // Migrate guest data if user was a guest
      if (isGuest && currentUser) {
        try {
          const migrationResult = await migrateGuestDataToUser(
            currentUser.uid,
            user.uid
          );
          if (
            migrationResult.success &&
            migrationResult.migratedCollections.length > 0
          ) {
            console.log(
              '✅ Guest data migrated successfully:',
              migrationResult.migratedCollections
            );
          }
        } catch (migrationError) {
          console.error('❌ Failed to migrate guest data:', migrationError);
        }
      }

      if (status === 'pending') {
        // Sign out immediately so session is not created
        await signOut(auth);
        Cookies.remove('uid', { path: '/' });
        Cookies.remove('role', { path: '/' });
        setSignupSuccess(true);
        setTimeout(() => {
          router.push('/user/login');
        }, 4000);
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Box display="flex" justifyContent="center" mt={10}>
        <CircularProgress />
      </Box>
    );
  }

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
            maxWidth: 480,
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
                background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                boxShadow: '0 8px 16px rgba(236, 72, 153, 0.3)'
              }}
            >
              <PersonAddIcon fontSize="large" />
            </Avatar>
            <Typography variant="h4" fontWeight="900" sx={{ 
              background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}>
              Create Account
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight="500">
              Join us to start managing your data
            </Typography>
          </Box>

          {signupSuccess ? (
            <Alert severity="success" sx={{ mb: 3, borderRadius: 3, fontWeight: 600 }}>
              <AlertTitle sx={{ fontWeight: 800 }}>🎉 Signup Successful!</AlertTitle>
              Your account has been created. It is currently **pending approval** by the master user.
              You will be able to sign in once approved. Redirecting to login...
            </Alert>
          ) : (
            <>
              {isGuest && currentUser && (
                <Alert severity="info" sx={{ mb: 3, borderRadius: 3, fontWeight: 600 }}>
                  <AlertTitle sx={{ fontWeight: 800 }}>🔄 Migrate Your Data</AlertTitle>
                  You&apos;re currently using MyOrbit as a guest. Sign up now to save
                  your data permanently and access it from any device!
                </Alert>
              )}

              {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 3, fontWeight: 600 }}>
                  {error}
                </Alert>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>
                <Box display="flex" gap={2}>
                  <TextField
                    fullWidth
                    label="First Name"
                    margin="normal"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={loading}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: 'text.secondary' }} /></InputAdornment>,
                      sx: { borderRadius: 3 }
                    }}
                  />
                  <TextField
                    fullWidth
                    label="Last Name"
                    margin="normal"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={loading}
                    InputProps={{
                      sx: { borderRadius: 3 }
                    }}
                  />
                </Box>

                <TextField
                  fullWidth
                  label="Email Address"
                  margin="normal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: 'text.secondary' }} /></InputAdornment>,
                    sx: { borderRadius: 3 }
                  }}
                />

                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  margin="normal"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: 'text.secondary' }} /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" disabled={loading}>
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
                  disabled={loading || !firstName || !lastName || !email || !password}
                  sx={{ 
                    mt: 4, 
                    mb: 3, 
                    py: 1.5, 
                    borderRadius: 3,
                    fontWeight: 800,
                    fontSize: '1rem',
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                    boxShadow: '0 8px 16px rgba(236, 72, 153, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #db2777 0%, #e11d48 100%)',
                      boxShadow: '0 12px 20px rgba(236, 72, 153, 0.4)',
                    },
                    '&.Mui-disabled': {
                      background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    }
                  }}
                >
                  {loading ? 'Creating Account...' : 'Sign Up'}
                </Button>
              </form>

              <Divider sx={{ my: 3 }}>
                <Typography variant="body2" color="text.secondary" fontWeight="500">
                  OR
                </Typography>
              </Divider>

              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary" fontWeight="500">
                  Already have an account?{' '}
                  <Link href="/user/login" style={{ textDecoration: 'none' }}>
                    <Typography component="span" sx={{ color: '#ec4899', fontWeight: 700, '&:hover': { textDecoration: 'underline' } }}>
                      Sign in
                    </Typography>
                  </Link>
                </Typography>
              </Box>
            </>
          )}
        </Paper>
      </Fade>
    </Box>
  );
}
