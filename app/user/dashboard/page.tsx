'use client';

import { useAuth } from '@/app/lib/context/userContext';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  IconButton,
  Button,
  Tooltip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Link from 'next/link';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useEffect, useState } from 'react';

export default function ManageDashboard() {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.uid) return;

      try {
        const userDoc = await doc(db, 'users', user.uid);
        const snapshot = await getDoc(userDoc);

        if (snapshot.exists()) {
          const data = snapshot.data();
          setFirstName(data.firstName || '');
          setLastName(data.lastName || '');
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };

    fetchUserData();
  }, [user]);

  const handleCopy = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveName = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        firstName,
        lastName,
      });
    } catch (err) {
      console.error('Error updating name:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <Box mt={10} textAlign="center">
        <Typography variant="h6">
          Please log in to view the dashboard.
        </Typography>
      </Box>
    );
  }

  return (
    <Box maxWidth={800} mx="auto" mt={6} p={3}>
      {/* Profile Card */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Your Profile
          </Typography>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              mb: 2,
            }}
          >
            <TextField
              fullWidth
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <TextField
              fullWidth
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Email"
              value={user.email || ''}
              disabled
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TextField label="User ID" fullWidth value={user.uid} disabled />
            <Tooltip title={copied ? 'Copied!' : 'Copy UID'}>
              <IconButton onClick={handleCopy}>
                {copied ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <ContentCopyIcon />
                )}
              </IconButton>
            </Tooltip>
          </Box>

          <Button
            variant="contained"
            onClick={handleSaveName}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Update Name'}
          </Button>
        </CardContent>
      </Card>

      {/* Dashboard Links */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 3,
        }}
      >
        <Link href="/user/manage" passHref>
          <Card
            sx={{
              p: 3,
              flex: 1,
              cursor: 'pointer',
              transition: '0.2s',
              '&:hover': { boxShadow: 6, backgroundColor: 'grey.100' },
            }}
          >
            <Typography variant="h6">Manage Users {firstName}</Typography>
            <Typography variant="body2">
              Invite, edit, or remove users
            </Typography>
          </Card>
        </Link>

        <Link href="/user/theme" passHref>
          <Card
            sx={{
              p: 3,
              flex: 1,
              cursor: 'pointer',
              transition: '0.2s',
              '&:hover': { boxShadow: 6, backgroundColor: 'grey.100' },
            }}
          >
            <Typography variant="h6">Theme Settings </Typography>
            <Typography variant="body2">Customize app appearance</Typography>
          </Card>
        </Link>
      </Box>
    </Box>
  );
}
