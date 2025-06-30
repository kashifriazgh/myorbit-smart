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
} from '@mui/material';
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

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isMasterBlocked, setIsMasterBlocked] = useState(false);
  const [isInvitedUser, setIsInvitedUser] = useState(false);
  const [invitedRole, setInvitedRole] = useState<'viewer' | 'editor' | null>(
    null
  );
  const [invitedBy, setInvitedBy] = useState<string | null>(null);

  // 🔍 Check if master already exists and if email is invited
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

        const invitedRef = doc(db, 'invites', email); // ⬅️ use "invites" collection or users/email
        const invitedDoc = await getDoc(invitedRef);

        if (invitedDoc.exists()) {
          const data = invitedDoc.data();
          if (data.status === 'invited') {
            setIsInvitedUser(true);
            setInvitedRole(data.role);
            setInvitedBy(data.invitedBy);
          }
        }

        setIsMasterBlocked(masterExists && !invitedDoc.exists());
      } catch (err) {
        console.error(err);
        setError('Failed to check user status.');
      } finally {
        setChecking(false);
      }
    };

    checkStatus();
  }, [email]);

  const handleSignup = async () => {
    if (!email || !password) {
      return setError('Email and password are required.');
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

      // ⬅️ Check if it's master or sub-user
      const userData =
        isInvitedUser && invitedRole
          ? {
              uid: user.uid,
              email: user.email,
              role: invitedRole,
              invitedBy,
              status: 'active',
              createdAt: Timestamp.now(),
            }
          : {
              uid: user.uid,
              email: user.email,
              role: 'master',
              createdAt: Timestamp.now(),
            };

      await setDoc(doc(db, 'users', user.uid), userData);

      // Optional: update invite status
      if (isInvitedUser) {
        await setDoc(doc(db, 'invites', email), {
          ...userData,
          status: 'accepted',
        });
      }

      router.push('/');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Signup failed.');
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
    <Box maxWidth={400} mx="auto" mt={10}>
      <Typography variant="h5" mb={2}>
        Sign Up
      </Typography>

      {isMasterBlocked && !isInvitedUser && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          A master user already exists and you&#39;re not invited. Signup is
          disabled.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

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
        type="password"
        margin="normal"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
      />

      <Button
        variant="contained"
        fullWidth
        onClick={handleSignup}
        disabled={loading || (isMasterBlocked && !isInvitedUser)}
        sx={{ mt: 2 }}
      >
        {loading ? 'Signing up...' : 'Sign Up'}
      </Button>
    </Box>
  );
}
