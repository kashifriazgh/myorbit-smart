'use client';

import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  IconButton,
  Button,
  Tooltip,
  Grid,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Link from 'next/link';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useEffect, useState } from 'react';

export default function ManageDashboard() {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
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
    <Box
      maxWidth={800}
      mx="auto"
      mt={6}
      p={3}
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      {/* Profile Card */}
      <Card
        sx={{
          mb: 4,
          backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
          color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        }}
      >
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
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Link href="/user/manage" passHref style={{ textDecoration: 'none' }}>
            <Card
              sx={{
                p: 3,
                height: '100%',
                cursor: 'pointer',
                transition: '0.2s',
                backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                '&:hover': {
                  boxShadow: 6,
                  backgroundColor:
                    theme?.mode === 'dark' ? '#475569' : 'grey.100',
                },
              }}
            >
              <Typography variant="h6" fontWeight="700">Manage Users</Typography>
              <Typography variant="body2" color="text.secondary">
                Invite, edit, or remove users
              </Typography>
            </Card>
          </Link>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Link href="/user/theme" passHref style={{ textDecoration: 'none' }}>
            <Card
              sx={{
                p: 3,
                height: '100%',
                cursor: 'pointer',
                transition: '0.2s',
                backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                '&:hover': {
                  boxShadow: 6,
                  backgroundColor:
                    theme?.mode === 'dark' ? '#475569' : 'grey.100',
                },
              }}
            >
              <Typography variant="h6" fontWeight="700">Theme Settings</Typography>
              <Typography variant="body2" color="text.secondary">
                Customize app appearance
              </Typography>
            </Card>
          </Link>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Link href="/user/profile" passHref style={{ textDecoration: 'none' }}>
            <Card
              sx={{
                p: 3,
                height: '100%',
                cursor: 'pointer',
                transition: '0.2s',
                backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                '&:hover': {
                  boxShadow: 6,
                  backgroundColor:
                    theme?.mode === 'dark' ? '#475569' : 'grey.100',
                },
              }}
            >
              <Typography variant="h6" fontWeight="700">Profile Settings</Typography>
              <Typography variant="body2" color="text.secondary">
                Edit your location, habits, and productivity preferences
              </Typography>
            </Card>
          </Link>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Link href="/user/user-context" passHref style={{ textDecoration: 'none' }}>
            <Card
              sx={{
                p: 3,
                height: '100%',
                cursor: 'pointer',
                transition: '0.2s',
                backgroundColor: theme?.mode === 'dark' ? '#334155' : '#ffffff',
                color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
                '&:hover': {
                  boxShadow: 6,
                  backgroundColor:
                    theme?.mode === 'dark' ? '#475569' : 'grey.100',
                },
              }}
            >
              <Typography variant="h6" fontWeight="700">AI Context Hub</Typography>
              <Typography variant="body2" color="text.secondary">
                View the active metadata sent to personalize AI suggestions
              </Typography>
            </Card>
          </Link>
        </Grid>
      </Grid>
    </Box>
  );
}
