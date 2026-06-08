'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,

  Button,
  Stack,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { OnboardingData } from '@/app/lib/interface';

// Onboarding Steps
import NameStep from '@/app/components/onboarding/steps/NameStep';
import LocationStep from '@/app/components/onboarding/steps/LocationStep';
import ProfileDetailsStep from '@/app/components/onboarding/steps/ProfileDetailsStep';
import ProductivityStep from '@/app/components/onboarding/steps/ProductivityStep';
import NotificationStep from '@/app/components/onboarding/steps/NotificationStep';
import AIBehaviorStep from '@/app/components/onboarding/steps/AIBehaviorStep';
import PlanningStep from '@/app/components/onboarding/steps/PlanningStep';

export default function UserProfilePage() {
  const { user, onboardingData, updateOnboardingData, loading } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const router = useRouter();

  const [localData, setLocalData] = useState<OnboardingData>({});
  const [saving, setSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync firebase onboardingData to local state when loaded
  useEffect(() => {
    if (onboardingData) {
      setLocalData(onboardingData);
    } else if (user) {
      // Initialize with name fields from user object if onboardingData doesn't exist yet
      setLocalData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
      });
    }
  }, [onboardingData, user]);

  const handleChange = (val: Partial<OnboardingData>) => {
    setLocalData((prev) => ({ ...prev, ...val }));
  };

  const handleSave = async () => {
    if (!localData.firstName?.trim() || !localData.lastName?.trim()) {
      setErrorMessage('First Name and Last Name are required.');
      setErrorOpen(true);
      return;
    }
    setSaving(true);
    try {
      await updateOnboardingData(localData);
      setSuccessOpen(true);
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update profile data.');
      setErrorOpen(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" sx={{ bgcolor: isDark ? '#0f172a' : '#f8fafc' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" sx={{ bgcolor: isDark ? '#0f172a' : '#f8fafc', p: 3 }}>
        <Card sx={{ maxWidth: 400, width: '100%', borderRadius: 4 }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" gutterBottom fontWeight="700">Please Log In</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              You need to be logged in to view and edit your profile.
            </Typography>
            <Button variant="contained" onClick={() => router.push('/user/login')} sx={{ borderRadius: 3 }}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: isDark ? '#0f172a' : '#f8fafc',
        minHeight: '100vh',
        pb: 10,
        color: isDark ? '#f1f5f9' : '#0f172a',
      }}
    >
      {/* Header Bar */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(8px)',
          bgcolor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(248, 250, 252, 0.8)',
          borderBottom: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
          px: { xs: 2, md: 4 },
          py: 2,
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" maxWidth={900} mx="auto">
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton onClick={() => router.push('/user/dashboard')} sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6" fontWeight="800">
              Profile Settings
            </Typography>
          </Stack>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{
              borderRadius: 3,
              px: 3,
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Stack>
      </Box>

      {/* Main Profile Form */}
      <Box maxWidth={700} mx="auto" sx={{ px: { xs: 2, sm: 3 }, mt: 4 }}>
        <Stack spacing={4}>
          {/* Section 1: Name */}
          <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <CardContent sx={{ p: 4 }}>
              <NameStep
                value={{ firstName: localData.firstName, lastName: localData.lastName }}
                onChange={handleChange}
              />
            </CardContent>
          </Card>

          {/* Section 2: Location & Profession */}
          <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <CardContent sx={{ p: 4 }}>
              <LocationStep
                value={localData}
                onChange={handleChange}
              />
            </CardContent>
          </Card>

          {/* Section 3: Profile Details */}
          <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <CardContent sx={{ p: 4 }}>
              <ProfileDetailsStep
                value={localData}
                onChange={handleChange}
              />
            </CardContent>
          </Card>

          {/* Section 4: Productivity Style */}
          <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <CardContent sx={{ p: 4 }}>
              <ProductivityStep
                value={localData}
                onChange={handleChange}
              />
            </CardContent>
          </Card>

          {/* Section 5: Notifications & Focus */}
          <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <CardContent sx={{ p: 4 }}>
              <NotificationStep
                value={localData}
                onChange={handleChange}
              />
            </CardContent>
          </Card>

          {/* Section 6: AI Personality */}
          <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <CardContent sx={{ p: 4 }}>
              <AIBehaviorStep
                value={localData}
                onChange={handleChange}
              />
            </CardContent>
          </Card>

          {/* Section 7: Planning Preferences */}
          <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <CardContent sx={{ p: 4 }}>
              <PlanningStep
                value={localData}
                onChange={handleChange}
              />
            </CardContent>
          </Card>
        </Stack>
      </Box>

      {/* Snackbar Alert Notifications */}
      <Snackbar open={successOpen} autoHideDuration={4000} onClose={() => setSuccessOpen(false)}>
        <Alert onClose={() => setSuccessOpen(false)} severity="success" sx={{ width: '100%', borderRadius: 3 }}>
          Profile saved successfully!
        </Alert>
      </Snackbar>

      <Snackbar open={errorOpen} autoHideDuration={5000} onClose={() => setErrorOpen(false)}>
        <Alert onClose={() => setErrorOpen(false)} severity="error" sx={{ width: '100%', borderRadius: 3 }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
