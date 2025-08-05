'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  CircularProgress,
  Stack,
  Paper,
  Fade,
} from '@mui/material';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';

const FullName = () => {
  const { user, loading } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(true);

  useEffect(() => {
    const fetchUserName = async () => {
      if (!user?.uid) return;

      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
      }
      setLoadingUserData(false);
    };

    if (!loading) {
      fetchUserName();
    }
  }, [user, loading]);

  const handleChange = async (
    field: 'firstName' | 'lastName',
    value: string
  ) => {
    if (!user?.uid) return;

    if (field === 'firstName') setFirstName(value);
    if (field === 'lastName') setLastName(value);

    setSaving(true);
    const ref = doc(db, 'users', user.uid);
    await updateDoc(ref, { [field]: value });
    setSaving(false);
  };

  if (loading || loadingUserData) {
    return (
      <Box textAlign="center" py={5}>
        <CircularProgress />
        <Typography mt={2} fontWeight={500}>
          Loading your info...
        </Typography>
      </Box>
    );
  }

  return (
    <Fade in timeout={500}>
      <Paper
        elevation={3}
        sx={{ p: 4, borderRadius: 3, maxWidth: 500, mx: 'auto' }}
      >
        <Typography
          variant="h5"
          fontWeight={700}
          mb={1}
          color="primary"
          textAlign="center"
        >
          Let’s personalize your profile
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          mb={4}
          textAlign="center"
        >
          Start with your full name
        </Typography>

        <Stack spacing={3}>
          <TextField
            label="First Name"
            value={firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            fullWidth
            variant="outlined"
            autoComplete="given-name"
          />

          <TextField
            label="Last Name"
            value={lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            fullWidth
            variant="outlined"
            autoComplete="family-name"
          />
        </Stack>

        {saving && (
          <Typography
            mt={3}
            fontSize={14}
            color="success.main"
            textAlign="center"
          >
            Saving...
          </Typography>
        )}
      </Paper>
    </Fade>
  );
};

export default FullName;
