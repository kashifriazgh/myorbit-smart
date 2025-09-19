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
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useAuth } from '@/app/lib/context/userContext';
import { migrateGuestDataToUser } from '@/app/lib/guestDataMigration';

export default function SignupPage() {
  const router = useRouter();
  const { theme } = useCustomTheme();
  const { user: currentUser, isGuest } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const [isMasterBlocked, setIsMasterBlocked] = useState(false);
  const [isInvitedUser, setIsInvitedUser] = useState(false);
  const [invitedRole, setInvitedRole] = useState<'viewer' | 'editor' | null>(
    null
  );
  const [invitedBy, setInvitedBy] = useState<string | null>(null);

  // 🔍 Check if master already exists + if this email is invited
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const masterQuery = query(
          collection(db, 'users'),
          where('role', '==', 'master')
        );
        const masterSnapshot = await getDocs(masterQuery);
        const masterExists = !masterSnapshot.empty;

        if (!email) {
          setIsMasterBlocked(masterExists);
          setChecking(false);
          return;
        }

        const invitedRef = doc(db, 'invites', email);
        const invitedDoc = await getDoc(invitedRef);

        let isInvited = false;
        let role: 'viewer' | 'editor' | null = null;
        let inviter: string | null = null;

        if (invitedDoc.exists()) {
          const data = invitedDoc.data();
          if (data.status === 'invited') {
            isInvited = true;
            role = data.role;
            inviter = data.invitedBy || null;
          }
        }

        setIsInvitedUser(isInvited);
        setInvitedRole(role);
        setInvitedBy(inviter);

        // ❌ Block if master exists AND user is not invited
        setIsMasterBlocked(masterExists && !isInvited);
      } catch (err) {
        console.error(err);
        setError('Failed to check user status.');
        setIsMasterBlocked(true); // safest fallback
      } finally {
        setChecking(false);
      }
    };

    checkStatus();
  }, [email]);

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
      if (isInvitedUser && invitedRole) {
        role = invitedRole;
      }

      const userData = {
        uid: user.uid,
        email: user.email,
        firstName,
        lastName,
        role,
        createdAt: Timestamp.now(),
        ...(isInvitedUser && { invitedBy, status: 'active' }),
      };

      await setDoc(doc(db, 'users', user.uid), userData);

      if (isInvitedUser) {
        await setDoc(doc(db, 'invites', email), {
          ...userData,
          status: 'accepted',
        });
      }

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
          // Don't block signup if migration fails
        }
      }

      router.push('/');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Signup failed.');
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
      maxWidth={400}
      mx="auto"
      my={10}
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      <Typography variant="h5" mb={2}>
        Sign Up
      </Typography>

      {isGuest && currentUser && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>🔄 Migrate Your Data</AlertTitle>
          You&#39;re currently using MyOrbit as a guest. Sign up now to save
          your data permanently and access it from any device!
        </Alert>
      )}

      {isMasterBlocked && !isInvitedUser && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          A master user already exists. Signup is restricted to invited users
          only.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        fullWidth
        label="First Name"
        margin="normal"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        disabled={loading}
      />

      <TextField
        fullWidth
        label="Last Name"
        margin="normal"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        disabled={loading}
      />

      <TextField
        fullWidth
        label="Email"
        margin="normal"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
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
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                disabled={loading}
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
        onClick={handleSignup}
        disabled={
          loading ||
          !firstName ||
          !lastName ||
          !email ||
          !password ||
          (isMasterBlocked && !isInvitedUser)
        }
        sx={{ mt: 2 }}
      >
        {loading ? 'Signing up...' : 'Sign Up'}
      </Button>
    </Box>
  );
}
