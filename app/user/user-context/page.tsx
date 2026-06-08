'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Divider,
  Button,
  Stack,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FlagIcon from '@mui/icons-material/Flag';
import BookIcon from '@mui/icons-material/Book';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function UserContextPage() {
  const { user, onboardingData } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const router = useRouter();

  // Format the structured context JSON that would be sent to the AI
  const aiContextPayload = useMemo(() => {
    if (!onboardingData) return {};
    
    // We parse and extract only the relevant filled values to send to the AI
    const data = onboardingData;
    return {
      userInfo: {
        name: `${data.firstName || user?.firstName || ''} ${data.lastName || user?.lastName || ''}`.trim() || 'User',
        ageGroup: data.ageGroup?.value || 'Not specified',
        gender: data.gender?.value || 'Not specified',
      },
      regionalContext: {
        country: data.country?.value || 'Not specified',
        city: data.city?.value || 'Not specified',
      },
      professionalProfile: {
        professionType: data.professionType?.value || 'Not specified',
        field: data.profession?.value || 'Not specified',
        skills: data.skills?.value || [],
        hobby: data.hobby?.value || 'Not specified',
        education: data.education?.value || 'Not specified',
      },
      productivityStyle: {
        workStyle: data.workStyle?.value || 'Not specified',
        peakEnergyHours: data.peakHours?.value || [],
        deadlinePreference: data.deadlineType?.value || 'Flexible',
        activityTracking: data.activityTracking?.value || 'Allow',
      },
      socialPreferences: {
        frequency: data.socialPreference?.value || 'Not specified',
        preferredTime: data.preferredSocialTime?.value || 'Not specified',
        hourRange: data.socialHourRange?.value || null,
      },
      silenceQuitHours: data.quitHours?.value ? `${data.quitHours.value[0]}:00 to ${data.quitHours.value[1]}:00` : 'Not specified',
      aiInteraction: {
        preferredTone: data.aiTone?.value || 'Friendly',
        autoSuggestEnabled: data.autoSuggest?.value ?? true,
        smartReschedulingEnabled: data.smartRescheduling?.value ?? true,
      }
    };
  }, [onboardingData, user]);

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
        <Stack direction="row" justifyContent="space-between" alignItems="center" maxWidth={950} mx="auto">
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton onClick={() => router.push('/user/dashboard')} sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6" fontWeight="800">
              AI User Context Hub
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => router.push('/user/profile')}
            sx={{
              borderRadius: 3,
              px: 2.5,
              textTransform: 'none',
              fontWeight: 700,
            }}
          >
            Edit Profile Data
          </Button>
        </Stack>
      </Box>

      {/* Content Area */}
      <Box maxWidth={950} mx="auto" sx={{ px: { xs: 2, sm: 3 }, mt: 4 }}>
        {/* Banner Nudge */}
        <Alert
          icon={<AutoAwesomeIcon sx={{ color: '#6366f1' }} />}
          severity="info"
          sx={{
            mb: 4,
            borderRadius: 4,
            border: `1px solid ${isDark ? '#312e81' : '#c7d2fe'}`,
            bgcolor: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
            color: isDark ? '#c7d2fe' : '#312e81',
            alignItems: 'center',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 650 }}>
            This Context Hub displays the personalized data payload sent along with AI prompts (such as goals suggestions and smart rescheduling). By giving the AI structured context about your habits, region, skills, and work styles, the system generates highly personalized, contextual recommendations tailored directly to you.
          </Typography>
        </Alert>

        <Grid container spacing={4}>
          {/* Left Panel: Context Cards */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={3}>
              <Typography variant="h6" fontWeight="800" sx={{ mb: -1 }}>
                Active Context Profiles
              </Typography>

              {/* Personal & Professional Profile */}
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" fontWeight="800" color="primary" gutterBottom>
                    👤 Personal & Professional
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Full Name</Typography>
                      <Typography variant="body2" fontWeight="600">{aiContextPayload.userInfo?.name || 'User'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Age & Gender</Typography>
                      <Typography variant="body2" fontWeight="600">{aiContextPayload.userInfo?.ageGroup || '—'} ({aiContextPayload.userInfo?.gender || '—'})</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Location</Typography>
                      <Typography variant="body2" fontWeight="600">{aiContextPayload.regionalContext?.city || '—'}, {aiContextPayload.regionalContext?.country || '—'}</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Profession Type</Typography>
                      <Typography variant="body2" fontWeight="600" sx={{ textTransform: 'capitalize' }}>{aiContextPayload.professionalProfile?.professionType || '—'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Field</Typography>
                      <Typography variant="body2" fontWeight="600">{aiContextPayload.professionalProfile?.field || '—'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="body2" color="text.secondary">Skills</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end', maxWidth: '70%' }}>
                        {aiContextPayload.professionalProfile?.skills?.length > 0 ? (
                          aiContextPayload.professionalProfile.skills.map((skill: string) => (
                            <Chip key={skill} label={skill} size="small" variant="outlined" sx={{ borderRadius: 2 }} />
                          ))
                        ) : (
                          <Typography variant="body2" fontWeight="600">—</Typography>
                        )}
                      </Box>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* Productivity & Schedule Styles */}
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" fontWeight="800" color="secondary" gutterBottom>
                    ⚡ Productivity & Habits
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Work Style</Typography>
                      <Typography variant="body2" fontWeight="600">{aiContextPayload.productivityStyle?.workStyle || '—'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="body2" color="text.secondary">Peak Hours</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '70%' }}>
                        {aiContextPayload.productivityStyle?.peakEnergyHours?.length > 0 ? (
                          aiContextPayload.productivityStyle.peakEnergyHours.map((hr: string) => (
                            <Chip key={hr} label={hr} size="small" variant="outlined" sx={{ borderRadius: 2 }} />
                          ))
                        ) : (
                          <Typography variant="body2" fontWeight="600">—</Typography>
                        )}
                      </Box>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Deadline Preferences</Typography>
                      <Typography variant="body2" fontWeight="600">{aiContextPayload.productivityStyle?.deadlinePreference || '—'}</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">AI Assistant Tone</Typography>
                      <Typography variant="body2" fontWeight="600">{aiContextPayload.aiInteraction?.preferredTone || '—'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Quiet Sleep Hours</Typography>
                      <Typography variant="body2" fontWeight="600">{aiContextPayload.silenceQuitHours || '—'}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* Upcoming Context Features Banner */}
              <Typography variant="h6" fontWeight="800" sx={{ pt: 1, mb: -1 }}>
                Upcoming Context Integrations
              </Typography>
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, opacity: 0.85 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    These modules will be fully integrated next to feed user metrics directly into your Orbit AI profile, allowing live, contextual analysis of your daily habits.
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 3, bgcolor: isDark ? '#334155' : 'grey.100' }}>
                        <FlagIcon color="primary" />
                        <Typography variant="caption" fontWeight="700">Active Goals & Milestones</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 3, bgcolor: isDark ? '#334155' : 'grey.100' }}>
                        <AssignmentTurnedInIcon color="success" />
                        <Typography variant="caption" fontWeight="700">Recently Completed Tasks</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 3, bgcolor: isDark ? '#334155' : 'grey.100' }}>
                        <CalendarTodayIcon color="warning" />
                        <Typography variant="caption" fontWeight="700">Daily Events & Schedules</Typography>
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 3, bgcolor: isDark ? '#334155' : 'grey.100' }}>
                        <BookIcon color="secondary" />
                        <Typography variant="caption" fontWeight="700">Journal Reflection Moods</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* Right Panel: Structured JSON Viewer */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={2} sx={{ position: { md: 'sticky' }, top: { md: 100 } }}>
              <Typography variant="h6" fontWeight="800">
                AI Prompt JSON Payload
              </Typography>
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#090d16' : '#1e293b',
                  color: '#34d399',
                  fontFamily: 'monospace',
                  p: 3,
                  boxShadow: 8,
                  border: `1px solid ${isDark ? '#1e293b' : '#334155'}`,
                  maxHeight: '75vh',
                  overflowY: 'auto',
                }}
              >
                <pre style={{ margin: 0, fontSize: 12.5, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(aiContextPayload, null, 2)}
                </pre>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
