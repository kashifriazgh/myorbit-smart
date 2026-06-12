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
  CircularProgress,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FlagIcon from '@mui/icons-material/Flag';
import BookIcon from '@mui/icons-material/Book';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RefreshIcon from '@mui/icons-material/Refresh';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ChecklistIcon from '@mui/icons-material/Checklist';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function UserContextPage() {
  const {
    user,
    onboardingData,
    journalContextData,
    journalContextStatus,
    journalContextLocked,
    generateJournalContext,
    toggleJournalContextLock,
    todoContextData,
    todoContextStatus,
    todoContextLocked,
    generateTodoContext,
    toggleTodoContextLock,
    goalContextData,
    goalContextStatus,
    goalContextLocked,
    generateGoalContext,
    toggleGoalContextLock,
    financeContextData,
    financeContextStatus,
    financeContextLocked,
    generateFinanceContext,
    toggleFinanceContextLock,
    consolidatedContextData,
    consolidatedContextStatus,
    consolidatedContextLocked,
    generateConsolidatedContext,
    toggleConsolidatedContextLock,
    streakContextData,
    streakContextStatus,
    streakContextLocked,
    generateStreakContext,
    toggleStreakContextLock,
    scheduleContextData,
    scheduleContextStatus,
    scheduleContextLocked,
    generateScheduleContext,
    toggleScheduleContextLock,
  } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const router = useRouter();
  const [showAnalysis, setShowAnalysis] = React.useState(false);
  const [showScheduleAnalysis, setShowScheduleAnalysis] = React.useState(false);

  // Format the structured context JSON that would be sent to the AI
  const aiContextPayload = useMemo(() => {
    if (!onboardingData) return {};

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
      },
    };
  }, [onboardingData, user]);

  // Journal status helpers
  const isLoading = journalContextStatus === 'fetching' || journalContextStatus === 'generating';
  const statusLabel =
    journalContextStatus === 'fetching'
      ? 'Fetching journals…'
      : journalContextStatus === 'generating'
      ? 'Generating AI summary…'
      : journalContextStatus === 'saved'
      ? 'Saved successfully'
      : journalContextStatus === 'error'
      ? 'Error occurred'
      : null;
  const generatedAtFormatted = journalContextData?.generatedAt
    ? new Date(journalContextData.generatedAt).toLocaleString()
    : null;

  // Todo status helpers
  const isTodoLoading = todoContextStatus === 'fetching' || todoContextStatus === 'generating';
  const todoStatusLabel =
    todoContextStatus === 'fetching'
      ? 'Fetching active tasks…'
      : todoContextStatus === 'generating'
      ? 'Generating AI summary…'
      : todoContextStatus === 'saved'
      ? 'Saved successfully'
      : todoContextStatus === 'error'
      ? 'Error occurred'
      : null;
  const todoGeneratedAtFormatted = todoContextData?.generatedAt
    ? new Date(todoContextData.generatedAt).toLocaleString()
    : null;

  // Goal status helpers
  const isGoalLoading = goalContextStatus === 'fetching' || goalContextStatus === 'generating';
  const goalStatusLabel =
    goalContextStatus === 'fetching'
      ? 'Fetching goals & check-ins…'
      : goalContextStatus === 'generating'
      ? 'Analyzing goals and frequency…'
      : goalContextStatus === 'saved'
      ? 'Saved successfully'
      : goalContextStatus === 'error'
      ? 'Error occurred'
      : null;
  const goalGeneratedAtFormatted = goalContextData?.generatedAt
    ? new Date(goalContextData.generatedAt).toLocaleString()
    : null;

  // Finance status helpers
  const isFinanceLoading = financeContextStatus === 'fetching' || financeContextStatus === 'generating';
  const financeStatusLabel =
    financeContextStatus === 'fetching'
      ? 'Fetching cash, expenses & loans…'
      : financeContextStatus === 'generating'
      ? 'Analyzing financial liquidity…'
      : financeContextStatus === 'saved'
      ? 'Saved successfully'
      : financeContextStatus === 'error'
      ? 'Error occurred'
      : null;
  const financeGeneratedAtFormatted = financeContextData?.generatedAt
    ? new Date(financeContextData.generatedAt).toLocaleString()
    : null;

  // Consolidated status helpers
  const isConsolidatedLoading = consolidatedContextStatus === 'fetching' || consolidatedContextStatus === 'generating';
  const consolidatedStatusLabel =
    consolidatedContextStatus === 'fetching'
      ? 'Fetching all sub-contexts…'
      : consolidatedContextStatus === 'generating'
      ? 'Generating master consolidated context…'
      : consolidatedContextStatus === 'saved'
      ? 'Saved successfully'
      : consolidatedContextStatus === 'error'
      ? 'Error occurred'
      : null;
  const consolidatedGeneratedAtFormatted = consolidatedContextData?.generatedAt
    ? new Date(consolidatedContextData.generatedAt).toLocaleString()
    : null;

  // Streak status helpers
  const isStreakLoading = streakContextStatus === 'fetching' || streakContextStatus === 'generating';
  const streakStatusLabel =
    streakContextStatus === 'fetching'
      ? 'Fetching habit streaks…'
      : streakContextStatus === 'generating'
      ? 'Analyzing streak consistency…'
      : streakContextStatus === 'saved'
      ? 'Saved successfully'
      : streakContextStatus === 'error'
      ? 'Error occurred'
      : null;
  const streakGeneratedAtFormatted = streakContextData?.generatedAt
    ? new Date(streakContextData.generatedAt).toLocaleString()
    : null;

  // Schedule status helpers
  const isScheduleLoading = scheduleContextStatus === 'fetching' || scheduleContextStatus === 'generating';
  const scheduleStatusLabel =
    scheduleContextStatus === 'fetching'
      ? 'Fetching schedules…'
      : scheduleContextStatus === 'generating'
      ? 'Analyzing daily schedules…'
      : scheduleContextStatus === 'saved'
      ? 'Saved successfully'
      : scheduleContextStatus === 'error'
      ? 'Error occurred'
      : null;
  const scheduleGeneratedAtFormatted = scheduleContextData?.generatedAt
    ? new Date(scheduleContextData.generatedAt).toLocaleString()
    : null;

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
            This Context Hub displays the personalized data payload sent along with AI prompts. The AI Journal Context section below analyzes your recent journal entries to build a live behavioral snapshot — helping the AI understand your emotional state, focus, and habits for more personalized responses.
          </Typography>
        </Alert>

        <Grid container spacing={4}>
          {/* Left Panel: Context Cards */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={3}>
              <Typography variant="h6" fontWeight="800" sx={{ mb: -1 }}>
                Active Context Profiles
              </Typography>

              {/* ── MASTER CONSOLIDATED PROFILE CARD ── */}
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#1e1b4b' : '#f5f3ff', // Deep indigo/violet theme
                  border: `2px solid ${isDark ? '#818cf8' : '#6366f1'}`,
                  boxShadow: isDark
                    ? '0 0 25px rgba(129, 140, 248, 0.3)'
                    : '0 6px 24px rgba(99, 102, 241, 0.15)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Master profile accent bar */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: 4,
                    background: 'linear-gradient(90deg, #6366f1, #3b82f6, #10b981, #f43f5e)',
                  }}
                />
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <PsychologyIcon sx={{ color: '#818cf8', fontSize: 24 }} />
                      <Typography variant="subtitle1" fontWeight="900" sx={{ color: '#818cf8', fontSize: 18 }}>
                        Master Behavioral Profile
                      </Typography>
                      <Chip
                        label="Consolidated Snapshot"
                        size="small"
                        sx={{
                          fontSize: 10, height: 20, fontWeight: 700,
                          bgcolor: isDark ? 'rgba(129,140,248,0.15)' : 'rgba(99,102,241,0.1)',
                          color: '#818cf8', border: '1px solid #818cf8',
                        }}
                      />
                    </Stack>

                    {/* Lock/Unlock toggle */}
                    <Tooltip title={consolidatedContextLocked ? 'Locked: click to unlock' : 'Unlocked: click to lock'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleConsolidatedContextLock(!consolidatedContextLocked)}
                        sx={{
                          color: consolidatedContextLocked ? '#f59e0b' : '#10b981',
                          bgcolor: isDark
                            ? consolidatedContextLocked ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)'
                            : consolidatedContextLocked ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                          border: `1px solid ${consolidatedContextLocked ? '#f59e0b' : '#10b981'}`,
                          '&:hover': { opacity: 0.85 },
                        }}
                      >
                        {consolidatedContextLocked ? <LockIcon sx={{ fontSize: 16 }} /> : <LockOpenIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  {/* Lock status badge */}
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <Chip
                      icon={consolidatedContextLocked ? <LockIcon sx={{ fontSize: '14px !important' }} /> : <LockOpenIcon sx={{ fontSize: '14px !important' }} />}
                      label={consolidatedContextLocked ? 'Locked — Re-fetch Blocked' : 'Unlocked — Will Refresh on Next Load'}
                      size="small"
                      sx={{
                        fontSize: 10, fontWeight: 700,
                        color: consolidatedContextLocked ? '#f59e0b' : '#10b981',
                        bgcolor: consolidatedContextLocked
                          ? isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)'
                          : isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                        border: `1px solid ${consolidatedContextLocked ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
                      }}
                    />
                  </Stack>

                  {/* Content */}
                  {isConsolidatedLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                      <CircularProgress size={32} sx={{ color: '#818cf8' }} />
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        {consolidatedStatusLabel}
                      </Typography>
                    </Box>
                  ) : consolidatedContextData?.summary ? (
                    <Box>
                      <Box
                        sx={{
                          p: 2.5, borderRadius: 3,
                          bgcolor: isDark ? '#0f172a' : '#f8fafc',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          mb: 2,
                        }}
                      >
                        <pre
                          style={{
                            margin: 0,
                            fontFamily: 'inherit',
                            fontSize: '13.5px',
                            lineHeight: 1.8,
                            color: isDark ? '#cbd5e1' : '#374151',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {consolidatedContextData.summary}
                        </pre>
                      </Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                          {consolidatedGeneratedAtFormatted && (
                            <Chip
                              icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important', color: '#10b981 !important' }} />}
                              label={`Generated: ${consolidatedGeneratedAtFormatted}`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10 }}
                            />
                          )}
                        </Stack>
                        <Button
                          size="small"
                          startIcon={<RefreshIcon />}
                          onClick={async () => {
                            await toggleConsolidatedContextLock(false);
                            await generateConsolidatedContext();
                          }}
                          disabled={isConsolidatedLoading}
                          sx={{
                            textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: 2,
                            color: '#818cf8', border: '1px solid #818cf8', px: 1.5,
                            '&:hover': { bgcolor: 'rgba(129,140,248,0.08)' },
                          }}
                        >
                          Regenerate
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Box>
                      {consolidatedContextStatus === 'error' ? (
                        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                          <ErrorOutlineIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                          <Typography variant="body2" color="error">
                            Failed to generate consolidated profile. Please try again.
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                          No consolidated profile generated yet. Click below to compile your profile data, journals, tasks, goals, and finances into a unified behavioral snapshot.
                        </Typography>
                      )}
                      <Button
                        variant="contained"
                        startIcon={isConsolidatedLoading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                        onClick={generateConsolidatedContext}
                        disabled={isConsolidatedLoading}
                        sx={{
                          textTransform: 'none', fontWeight: 700, borderRadius: 3,
                          background: 'linear-gradient(135deg, #818cf8, #4f46e5)',
                          boxShadow: '0 4px 12px rgba(129,140,248,0.35)',
                          '&:hover': { background: 'linear-gradient(135deg, #6366f1, #4338ca)' },
                        }}
                      >
                        Generate Consolidated Profile
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* ── AI JOURNAL CONTEXT CARD ── */}
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  border: `2px solid ${isDark ? '#4f46e5' : '#6366f1'}`,
                  boxShadow: isDark
                    ? '0 0 20px rgba(99, 102, 241, 0.25)'
                    : '0 4px 20px rgba(99, 102, 241, 0.12)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Purple accent bar */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)',
                  }}
                />
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <PsychologyIcon sx={{ color: '#6366f1', fontSize: 22 }} />
                      <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#6366f1' }}>
                        AI Journal Context
                      </Typography>
                      <Chip
                        label="Last 15 Days"
                        size="small"
                        sx={{
                          fontSize: 10,
                          height: 20,
                          bgcolor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
                          color: '#6366f1',
                          border: '1px solid #6366f1',
                          fontWeight: 700,
                        }}
                      />
                    </Stack>

                    {/* Lock/Unlock toggle */}
                    <Tooltip
                      title={
                        journalContextLocked
                          ? 'Locked: auto-regeneration blocked. Click to unlock.'
                          : 'Unlocked: will regenerate on next load. Click to lock.'
                      }
                    >
                      <IconButton
                        size="small"
                        onClick={() => toggleJournalContextLock(!journalContextLocked)}
                        sx={{
                          color: journalContextLocked ? '#f59e0b' : '#10b981',
                          bgcolor: isDark
                            ? journalContextLocked
                              ? 'rgba(245,158,11,0.12)'
                              : 'rgba(16,185,129,0.12)'
                            : journalContextLocked
                            ? 'rgba(245,158,11,0.08)'
                            : 'rgba(16,185,129,0.08)',
                          border: `1px solid ${journalContextLocked ? '#f59e0b' : '#10b981'}`,
                          '&:hover': { opacity: 0.85 },
                        }}
                      >
                        {journalContextLocked ? (
                          <LockIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <LockOpenIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  {/* Lock status badge */}
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <Chip
                      icon={
                        journalContextLocked ? (
                          <LockIcon sx={{ fontSize: '14px !important' }} />
                        ) : (
                          <LockOpenIcon sx={{ fontSize: '14px !important' }} />
                        )
                      }
                      label={journalContextLocked ? 'Locked — Re-fetch Blocked' : 'Unlocked — Will Refresh on Next Load'}
                      size="small"
                      sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: journalContextLocked ? '#f59e0b' : '#10b981',
                        bgcolor: journalContextLocked
                          ? isDark
                            ? 'rgba(245,158,11,0.12)'
                            : 'rgba(245,158,11,0.08)'
                          : isDark
                          ? 'rgba(16,185,129,0.12)'
                          : 'rgba(16,185,129,0.08)',
                        border: `1px solid ${journalContextLocked ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
                      }}
                    />
                  </Stack>

                  {/* AI Summary content */}
                  {isLoading ? (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        py: 4,
                      }}
                    >
                      <CircularProgress size={32} sx={{ color: '#6366f1' }} />
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        {statusLabel}
                      </Typography>
                    </Box>
                  ) : journalContextData?.summary ? (
                    <Box>
                      <Box
                        sx={{
                          p: 2.5,
                          borderRadius: 3,
                          bgcolor: isDark ? '#0f172a' : '#f8fafc',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          mb: 2,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            lineHeight: 1.8,
                            color: isDark ? '#cbd5e1' : '#374151',
                            fontStyle: 'italic',
                          }}
                        >
                          &ldquo;{journalContextData.summary}&rdquo;
                        </Typography>
                      </Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                          <Chip
                            icon={<BookIcon sx={{ fontSize: '14px !important' }} />}
                            label={`${journalContextData.journalCount} journal${journalContextData.journalCount !== 1 ? 's' : ''} analyzed`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: 10, fontWeight: 700 }}
                          />
                          {generatedAtFormatted && (
                            <Chip
                              icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important', color: '#10b981 !important' }} />}
                              label={`Generated: ${generatedAtFormatted}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: 10 }}
                            />
                          )}
                        </Stack>
                        <Button
                          size="small"
                          startIcon={<RefreshIcon />}
                          onClick={async () => {
                            await toggleJournalContextLock(false);
                            await generateJournalContext();
                          }}
                          disabled={isLoading}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: 12,
                            borderRadius: 2,
                            color: '#6366f1',
                            border: '1px solid #6366f1',
                            px: 1.5,
                            '&:hover': { bgcolor: 'rgba(99,102,241,0.08)' },
                          }}
                        >
                          Regenerate
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Box>
                      {journalContextStatus === 'error' ? (
                        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                          <ErrorOutlineIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                          <Typography variant="body2" color="error">
                            Failed to generate context. Please try again.
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                          No journal context generated yet. Click below to analyze your last 15 days of journals and build a personalized AI context.
                        </Typography>
                      )}
                      <Button
                        variant="contained"
                        startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                        onClick={generateJournalContext}
                        disabled={isLoading}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                          boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #4f46e5, #9333ea)',
                          },
                        }}
                      >
                        Generate Journal Context
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* ── AI TODO CONTEXT CARD ── */}
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  border: `2px solid ${isDark ? '#0891b2' : '#06b6d4'}`,
                  boxShadow: isDark
                    ? '0 0 20px rgba(6, 182, 212, 0.2)'
                    : '0 4px 20px rgba(6, 182, 212, 0.1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Cyan accent bar */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)',
                  }}
                />
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <ChecklistIcon sx={{ color: '#06b6d4', fontSize: 22 }} />
                      <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#06b6d4' }}>
                        AI Task Context
                      </Typography>
                      {(todoContextData?.totalActiveCount != null || todoContextData?.totalCompletedCount != null) && (
                        <>
                          {todoContextData.totalCompletedCount > 0 && (
                            <Chip
                              label={`${todoContextData.totalCompletedCount} completed`}
                              size="small"
                              sx={{
                                fontSize: 10, height: 20, fontWeight: 700,
                                bgcolor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
                                color: '#10b981', border: '1px solid #10b981',
                              }}
                            />
                          )}
                          {todoContextData.totalActiveCount > 0 && (
                            <Chip
                              label={`${todoContextData.totalActiveCount} active`}
                              size="small"
                              sx={{
                                fontSize: 10, height: 20, fontWeight: 700,
                                bgcolor: isDark ? 'rgba(6,182,212,0.15)' : 'rgba(6,182,212,0.1)',
                                color: '#06b6d4', border: '1px solid #06b6d4',
                              }}
                            />
                          )}
                        </>
                      )}
                    </Stack>

                    {/* Lock/Unlock toggle */}
                    <Tooltip title={todoContextLocked ? 'Locked: click to unlock' : 'Unlocked: click to lock'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleTodoContextLock(!todoContextLocked)}
                        sx={{
                          color: todoContextLocked ? '#f59e0b' : '#10b981',
                          bgcolor: isDark
                            ? todoContextLocked ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)'
                            : todoContextLocked ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                          border: `1px solid ${todoContextLocked ? '#f59e0b' : '#10b981'}`,
                          '&:hover': { opacity: 0.85 },
                        }}
                      >
                        {todoContextLocked ? <LockIcon sx={{ fontSize: 16 }} /> : <LockOpenIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  {/* Lock status badge */}
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <Chip
                      icon={todoContextLocked ? <LockIcon sx={{ fontSize: '14px !important' }} /> : <LockOpenIcon sx={{ fontSize: '14px !important' }} />}
                      label={todoContextLocked ? 'Locked — Re-fetch Blocked' : 'Unlocked — Will Refresh on Next Load'}
                      size="small"
                      sx={{
                        fontSize: 10, fontWeight: 700,
                        color: todoContextLocked ? '#f59e0b' : '#10b981',
                        bgcolor: todoContextLocked
                          ? isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)'
                          : isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                        border: `1px solid ${todoContextLocked ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
                      }}
                    />
                  </Stack>

                  {/* Content */}
                  {isTodoLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                      <CircularProgress size={32} sx={{ color: '#06b6d4' }} />
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        {todoStatusLabel}
                      </Typography>
                    </Box>
                  ) : todoContextData?.summary ? (
                    <Box>
                      <Box
                        sx={{
                          p: 2.5, borderRadius: 3,
                          bgcolor: isDark ? '#0f172a' : '#f8fafc',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          mb: 2,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ lineHeight: 1.8, color: isDark ? '#cbd5e1' : '#374151', fontStyle: 'italic' }}
                        >
                          &ldquo;{todoContextData.summary}&rdquo;
                        </Typography>
                      </Box>
                      {(todoContextData.sampledActive || todoContextData.sampledCompleted) && (
                        <Box sx={{ mb: 2 }}>
                          <Button
                            size="small"
                            onClick={() => setShowAnalysis(!showAnalysis)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 12,
                              color: '#06b6d4',
                              mb: showAnalysis ? 1.5 : 0,
                            }}
                          >
                            {showAnalysis ? 'Hide Manually Calculated Analysis' : 'Show Manually Calculated Analysis'}
                          </Button>
                          {showAnalysis && (
                            <Stack spacing={2.5} sx={{ mt: 1 }}>
                              {todoContextData.aggregateSummary && (
                                <Box
                                  sx={{
                                    p: 2.5,
                                    borderRadius: 3,
                                    bgcolor: isDark ? 'rgba(6, 182, 212, 0.06)' : 'rgba(6, 182, 212, 0.03)',
                                    border: `1px solid ${isDark ? '#0891b2' : '#22d3ee'}`,
                                  }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    fontWeight="900"
                                    sx={{
                                      mb: 1,
                                      color: isDark ? '#22d3ee' : '#0891b2',
                                      textTransform: 'uppercase',
                                      fontSize: 11,
                                      letterSpacing: '0.5px'
                                    }}
                                  >
                                    Comprehensive Trajectory & Trend Analysis
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      lineHeight: 1.6,
                                      mb: 2.5,
                                      fontWeight: 550,
                                      color: isDark ? '#cbd5e1' : '#334155'
                                    }}
                                  >
                                    {todoContextData.aggregateSummary.trendStatement}
                                  </Typography>
                                  <Grid container spacing={1.5}>
                                    <Grid size={{ xs: 6, sm: 3 }}>
                                      <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: isDark ? '#0f172a' : '#f8fafc', border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}` }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, fontSize: 10 }}>Avg Active Progress</Typography>
                                        <Typography variant="subtitle1" fontWeight="800" color="primary">{todoContextData.aggregateSummary.averageProgress}%</Typography>
                                      </Box>
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 3 }}>
                                      <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: isDark ? '#0f172a' : '#f8fafc', border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}` }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, fontSize: 10 }}>Task Completion Rate</Typography>
                                        <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#10b981' }}>{todoContextData.aggregateSummary.completionRate}%</Typography>
                                      </Box>
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 3 }}>
                                      <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: isDark ? '#0f172a' : '#f8fafc', border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}` }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, fontSize: 10 }}>Overdue / Behind</Typography>
                                        <Typography
                                          variant="subtitle1"
                                          fontWeight="800"
                                          sx={{
                                            color: (todoContextData.aggregateSummary.paceDistribution.Overdue + todoContextData.aggregateSummary.paceDistribution.Behind) > 0 ? '#ef4444' : 'text.primary'
                                          }}
                                        >
                                          {todoContextData.aggregateSummary.paceDistribution.Overdue + todoContextData.aggregateSummary.paceDistribution.Behind}
                                        </Typography>
                                      </Box>
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 3 }}>
                                      <Box sx={{ textAlign: 'center', p: 1, borderRadius: 2, bgcolor: isDark ? '#0f172a' : '#f8fafc', border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}` }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, fontSize: 10 }}>Ahead / On Track</Typography>
                                        <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#10b981' }}>
                                          {todoContextData.aggregateSummary.paceDistribution.Ahead + todoContextData.aggregateSummary.paceDistribution.OnTrack}
                                        </Typography>
                                      </Box>
                                    </Grid>
                                  </Grid>
                                </Box>
                              )}

                              {todoContextData.sampledActive && todoContextData.sampledActive.length > 0 && (
                                <Box>
                                  <Typography variant="caption" fontWeight="800" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                    ACTIVE TASKS METRICS
                                  </Typography>
                                  <Stack spacing={1}>
                                    {todoContextData.sampledActive.map((task, idx) => (
                                      <Box
                                        key={idx}
                                        sx={{
                                          p: 1.5,
                                          borderRadius: 2.5,
                                          bgcolor: isDark ? '#0f172a' : '#f8fafc',
                                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        }}
                                      >
                                        <Typography variant="body2" fontWeight="700" sx={{ mb: 1, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                                          {task.title}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                          <Chip label={`Priority: ${task.priority}`} size="small" sx={{ fontSize: 9, height: 18, fontWeight: 600 }} />
                                          <Chip
                                            label={`Progress: ${task.progressPercent}% (${task.progressLabel})`}
                                            size="small"
                                            color={task.progressPercent === 100 ? 'success' : 'primary'}
                                            sx={{ fontSize: 9, height: 18, fontWeight: 750 }}
                                          />
                                          {task.pace && (
                                            <Chip
                                              label={`Pace: ${task.pace}`}
                                              size="small"
                                              color={task.pace === 'Ahead' ? 'success' : task.pace === 'Overdue' ? 'error' : task.pace === 'Behind' ? 'warning' : 'default'}
                                              sx={{ fontSize: 9, height: 18, fontWeight: 750 }}
                                            />
                                          )}
                                          <Chip
                                            label={`Rescheduling: ${task.rescheduleStatus}`}
                                            size="small"
                                            color={task.rescheduleStatus === 'Stable' ? 'default' : task.rescheduleStatus === 'Minor Slippage' ? 'warning' : 'error'}
                                            sx={{ fontSize: 9, height: 18, fontWeight: 600 }}
                                          />
                                          {task.staleness && (
                                            <Chip
                                              label={`Staleness: ${task.staleness}`}
                                              size="small"
                                              color={task.staleness === 'Fresh' ? 'success' : task.staleness === 'Needs Review' ? 'error' : 'default'}
                                              sx={{ fontSize: 9, height: 18, fontWeight: 750 }}
                                            />
                                          )}
                                          <Chip label={`Days Passed: ${task.daysPassed}`} size="small" variant="outlined" sx={{ fontSize: 9, height: 18 }} />
                                        </Stack>
                                      </Box>
                                    ))}
                                  </Stack>
                                </Box>
                              )}

                              {todoContextData.sampledCompleted && todoContextData.sampledCompleted.length > 0 && (
                                <Box>
                                  <Typography variant="caption" fontWeight="800" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                    COMPLETED TASKS METRICS
                                  </Typography>
                                  <Stack spacing={1}>
                                    {todoContextData.sampledCompleted.map((task, idx) => (
                                      <Box
                                        key={idx}
                                        sx={{
                                          p: 1.5,
                                          borderRadius: 2.5,
                                          bgcolor: isDark ? '#0f172a' : '#f8fafc',
                                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        }}
                                      >
                                        <Typography variant="body2" fontWeight="700" sx={{ mb: 1, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                                          {task.title}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                          <Chip label={`Completed: ${task.completedAt}`} size="small" color="success" sx={{ fontSize: 9, height: 18, fontWeight: 750 }} />
                                          <Chip label={`Priority: ${task.priority}`} size="small" sx={{ fontSize: 9, height: 18 }} />
                                          <Chip
                                            label={`Rescheduling: ${task.rescheduleStatus}`}
                                            size="small"
                                            color={task.rescheduleStatus === 'Stable' ? 'default' : 'error'}
                                            sx={{ fontSize: 9, height: 18, fontWeight: 600 }}
                                          />
                                        </Stack>
                                      </Box>
                                    ))}
                                  </Stack>
                                </Box>
                              )}
                            </Stack>
                          )}
                        </Box>
                      )}
                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                          {todoContextData.sampledCompletedCount > 0 && (
                            <Chip
                              icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important', color: '#10b981 !important' }} />}
                              label={`${todoContextData.sampledCompletedCount} of ${todoContextData.totalCompletedCount} completed sampled`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10, fontWeight: 700 }}
                            />
                          )}
                          {todoContextData.sampledActiveCount > 0 && (
                            <Chip
                              icon={<ChecklistIcon sx={{ fontSize: '14px !important' }} />}
                              label={`${todoContextData.sampledActiveCount} of ${todoContextData.totalActiveCount} active sampled`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10, fontWeight: 700 }}
                            />
                          )}
                          {todoGeneratedAtFormatted && (
                            <Chip
                              icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important', color: '#10b981 !important' }} />}
                              label={`Generated: ${todoGeneratedAtFormatted}`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10 }}
                            />
                          )}
                        </Stack>
                        <Button
                          size="small"
                          startIcon={<RefreshIcon />}
                          onClick={async () => {
                            await toggleTodoContextLock(false);
                            await generateTodoContext();
                          }}
                          disabled={isTodoLoading}
                          sx={{
                            textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: 2,
                            color: '#06b6d4', border: '1px solid #06b6d4', px: 1.5,
                            '&:hover': { bgcolor: 'rgba(6,182,212,0.08)' },
                          }}
                        >
                          Regenerate
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Box>
                      {todoContextStatus === 'error' ? (
                        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                          <ErrorOutlineIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                          <Typography variant="body2" color="error">
                            Failed to generate task context. Please try again.
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                          No task context generated yet. Click below to analyze your active tasks.
                        </Typography>
                      )}
                      <Button
                        variant="contained"
                        startIcon={isTodoLoading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                        onClick={generateTodoContext}
                        disabled={isTodoLoading}
                        sx={{
                          textTransform: 'none', fontWeight: 700, borderRadius: 3,
                          background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                          boxShadow: '0 4px 12px rgba(6,182,212,0.35)',
                          '&:hover': { background: 'linear-gradient(135deg, #0891b2, #2563eb)' },
                        }}
                      >
                        Generate Task Context
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* AI Goal Context */}
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <FlagIcon sx={{ color: '#ec4899', fontSize: 22 }} />
                      <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#ec4899' }}>
                        AI Goal Context
                      </Typography>
                      {(goalContextData?.totalActiveCount != null || goalContextData?.totalCompletedCount != null) && (
                        <>
                          {goalContextData.totalCompletedCount > 0 && (
                            <Chip
                              label={`${goalContextData.totalCompletedCount} completed`}
                              size="small"
                              sx={{
                                fontSize: 10, height: 20, fontWeight: 700,
                                bgcolor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
                                color: '#10b981', border: '1px solid #10b981',
                              }}
                            />
                          )}
                          {goalContextData.totalActiveCount > 0 && (
                            <Chip
                              label={`${goalContextData.totalActiveCount} active`}
                              size="small"
                              sx={{
                                fontSize: 10, height: 20, fontWeight: 700,
                                bgcolor: isDark ? 'rgba(236,72,153,0.15)' : 'rgba(236,72,153,0.1)',
                                color: '#ec4899', border: '1px solid #ec4899',
                              }}
                            />
                          )}
                        </>
                      )}
                    </Stack>

                    {/* Lock/Unlock toggle */}
                    <Tooltip title={goalContextLocked ? 'Locked: click to unlock' : 'Unlocked: click to lock'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleGoalContextLock(!goalContextLocked)}
                        sx={{
                          color: goalContextLocked ? '#f59e0b' : '#10b981',
                          bgcolor: isDark
                            ? goalContextLocked ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)'
                            : goalContextLocked ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                          border: `1px solid ${goalContextLocked ? '#f59e0b' : '#10b981'}`,
                          '&:hover': { opacity: 0.85 },
                        }}
                      >
                        {goalContextLocked ? <LockIcon sx={{ fontSize: 16 }} /> : <LockOpenIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  {/* Lock status badge */}
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <Chip
                      icon={goalContextLocked ? <LockIcon sx={{ fontSize: '14px !important' }} /> : <LockOpenIcon sx={{ fontSize: '14px !important' }} />}
                      label={goalContextLocked ? 'Locked — Re-fetch Blocked' : 'Unlocked — Will Refresh on Next Load'}
                      size="small"
                      sx={{
                        fontSize: 10, fontWeight: 700,
                        color: goalContextLocked ? '#f59e0b' : '#10b981',
                        bgcolor: goalContextLocked
                          ? isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)'
                          : isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                        border: `1px solid ${goalContextLocked ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
                      }}
                    />
                  </Stack>

                  {/* Content */}
                  {isGoalLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                      <CircularProgress size={32} sx={{ color: '#ec4899' }} />
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        {goalStatusLabel}
                      </Typography>
                    </Box>
                  ) : goalContextData?.summary ? (
                    <Box>
                      <Box
                        sx={{
                          p: 2.5, borderRadius: 3,
                          bgcolor: isDark ? '#0f172a' : '#f8fafc',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          mb: 2,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ lineHeight: 1.8, color: isDark ? '#cbd5e1' : '#374151', fontStyle: 'italic' }}
                        >
                          &ldquo;{goalContextData.summary}&rdquo;
                        </Typography>
                      </Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                          {goalContextData.sampledCompletedCount > 0 && (
                            <Chip
                              icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important', color: '#10b981 !important' }} />}
                              label={`${goalContextData.sampledCompletedCount} of ${goalContextData.totalCompletedCount} completed sampled`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10, fontWeight: 700 }}
                            />
                          )}
                          {goalContextData.sampledActiveCount > 0 && (
                            <Chip
                              icon={<FlagIcon sx={{ fontSize: '14px !important', color: '#ec4899 !important' }} />}
                              label={`${goalContextData.sampledActiveCount} of ${goalContextData.totalActiveCount} active sampled`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10, fontWeight: 700 }}
                            />
                          )}
                          {goalContextData.checkInsLast30Days > 0 && (
                            <Chip
                              label={`${goalContextData.checkInsLast30Days} check-ins (30d)`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10, fontWeight: 700 }}
                            />
                          )}
                          {goalContextData.overallConsistency !== undefined && (
                            <Chip
                              label={`Consistency: ${goalContextData.overallConsistency}%`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10, fontWeight: 700 }}
                            />
                          )}
                          {goalGeneratedAtFormatted && (
                            <Chip
                              icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important', color: '#10b981 !important' }} />}
                              label={`Generated: ${goalGeneratedAtFormatted}`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10 }}
                            />
                          )}
                        </Stack>
                        <Button
                          size="small"
                          startIcon={<RefreshIcon />}
                          onClick={async () => {
                            await toggleGoalContextLock(false);
                            await generateGoalContext();
                          }}
                          disabled={isGoalLoading}
                          sx={{
                            textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: 2,
                            color: '#ec4899', border: '1px solid #ec4899', px: 1.5,
                            '&:hover': { bgcolor: 'rgba(236,72,153,0.08)' },
                          }}
                        >
                          Regenerate
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Box>
                      {goalContextStatus === 'error' ? (
                        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                          <ErrorOutlineIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                          <Typography variant="body2" color="error">
                            Failed to generate goals context. Please try again.
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                          No goals context generated yet. Click below to analyze your goals & habits.
                        </Typography>
                      )}
                      <Button
                        variant="contained"
                        startIcon={isGoalLoading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                        onClick={generateGoalContext}
                        disabled={isGoalLoading}
                        sx={{
                          textTransform: 'none', fontWeight: 700, borderRadius: 3,
                          background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                          boxShadow: '0 4px 12px rgba(236,72,153,0.35)',
                          '&:hover': { background: 'linear-gradient(135deg, #db2777, #e11d48)' },
                        }}
                      >
                        Generate Goal Context
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* AI Finance Context */}
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <AccountBalanceWalletIcon sx={{ color: '#10b981', fontSize: 22 }} />
                      <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#10b981' }}>
                        AI Finance Context
                      </Typography>
                      {financeContextData?.totalAmount != null && (
                        <Chip
                          label={`Total: PKR ${financeContextData.totalAmount.toLocaleString()}`}
                          size="small"
                          sx={{
                            fontSize: 10, height: 20, fontWeight: 700,
                            bgcolor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
                            color: '#10b981', border: '1px solid #10b981',
                          }}
                        />
                      )}
                    </Stack>

                    {/* Lock/Unlock toggle */}
                    <Tooltip title={financeContextLocked ? 'Locked: click to unlock' : 'Unlocked: click to lock'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleFinanceContextLock(!financeContextLocked)}
                        sx={{
                          color: financeContextLocked ? '#f59e0b' : '#10b981',
                          bgcolor: isDark
                            ? financeContextLocked ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)'
                            : financeContextLocked ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                          border: `1px solid ${financeContextLocked ? '#f59e0b' : '#10b981'}`,
                          '&:hover': { opacity: 0.85 },
                        }}
                      >
                        {financeContextLocked ? <LockIcon sx={{ fontSize: 16 }} /> : <LockOpenIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  {/* Lock status badge */}
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <Chip
                      icon={financeContextLocked ? <LockIcon sx={{ fontSize: '14px !important' }} /> : <LockOpenIcon sx={{ fontSize: '14px !important' }} />}
                      label={financeContextLocked ? 'Locked — Re-fetch Blocked' : 'Unlocked — Will Refresh on Next Load'}
                      size="small"
                      sx={{
                        fontSize: 10, fontWeight: 700,
                        color: financeContextLocked ? '#f59e0b' : '#10b981',
                        bgcolor: financeContextLocked
                          ? isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)'
                          : isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                        border: `1px solid ${financeContextLocked ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
                      }}
                    />
                  </Stack>

                  {/* Content */}
                  {isFinanceLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                      <CircularProgress size={32} sx={{ color: '#10b981' }} />
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        {financeStatusLabel}
                      </Typography>
                    </Box>
                  ) : financeContextData?.summary ? (
                    <Box>
                      <Box
                        sx={{
                          p: 2.5, borderRadius: 3,
                          bgcolor: isDark ? '#0f172a' : '#f8fafc',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          mb: 2,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ lineHeight: 1.8, color: isDark ? '#cbd5e1' : '#374151', fontStyle: 'italic' }}
                        >
                          &ldquo;{financeContextData.summary}&rdquo;
                        </Typography>
                      </Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                          <Chip
                            label={`Available: PKR ${financeContextData.availableAmount.toLocaleString()}`}
                            size="small" variant="outlined"
                            sx={{ fontSize: 10, fontWeight: 700 }}
                          />
                          {financeContextData.freezeAmount > 0 && (
                            <Chip
                              label={`Freezed: PKR ${financeContextData.freezeAmount.toLocaleString()}`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10, fontWeight: 700, borderColor: '#ef4444', color: '#ef4444' }}
                            />
                          )}
                          {financeContextData.upcomingExpensesCount > 0 && (
                            <Chip
                              label={`Expenses: ${financeContextData.upcomingExpensesCount} (PKR ${financeContextData.upcomingExpensesTotal.toLocaleString()})`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10, fontWeight: 700, borderColor: '#f59e0b', color: '#f59e0b' }}
                            />
                          )}
                          {financeContextData.outstandingBorrowTotal > 0 && (
                            <Chip
                              label={`Owes: PKR ${financeContextData.outstandingBorrowTotal.toLocaleString()}`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10, fontWeight: 700, borderColor: '#e11d48', color: '#e11d48' }}
                            />
                          )}
                          {financeContextData.outstandingLendTotal > 0 && (
                            <Chip
                              label={`Owed: PKR ${financeContextData.outstandingLendTotal.toLocaleString()}`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10, fontWeight: 700, borderColor: '#0ea5e9', color: '#0ea5e9' }}
                            />
                          )}
                          {financeGeneratedAtFormatted && (
                            <Chip
                              icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important', color: '#10b981 !important' }} />}
                              label={`Generated: ${financeGeneratedAtFormatted}`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10 }}
                            />
                          )}
                        </Stack>
                        <Button
                          size="small"
                          startIcon={<RefreshIcon />}
                          onClick={async () => {
                            await toggleFinanceContextLock(false);
                            await generateFinanceContext();
                          }}
                          disabled={isFinanceLoading}
                          sx={{
                            textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: 2,
                            color: '#10b981', border: '1px solid #10b981', px: 1.5,
                            '&:hover': { bgcolor: 'rgba(16,185,129,0.08)' },
                          }}
                        >
                          Regenerate
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Box>
                      {financeContextStatus === 'error' ? (
                        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                          <ErrorOutlineIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                          <Typography variant="body2" color="error">
                            Failed to generate finance context. Please try again.
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                          No finance context generated yet. Click below to analyze your cash, expenses & loans.
                        </Typography>
                      )}
                      <Button
                        variant="contained"
                        startIcon={isFinanceLoading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                        onClick={generateFinanceContext}
                        disabled={isFinanceLoading}
                        sx={{
                          textTransform: 'none', fontWeight: 700, borderRadius: 3,
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
                          '&:hover': { background: 'linear-gradient(135deg, #059669, #047857)' },
                        }}
                      >
                        Generate Finance Context
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* ── AI STREAK CONTEXT CARD ── */}
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <WhatshotIcon sx={{ color: '#ff7043', fontSize: 22 }} />
                      <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#ff7043' }}>
                        AI Streak Context
                      </Typography>
                      {streakContextData?.totalCount != null && (
                        <Chip
                          label={`${streakContextData.totalCount} streaks`}
                          size="small"
                          sx={{
                            fontSize: 10, height: 20, fontWeight: 700,
                            bgcolor: isDark ? 'rgba(255,112,67,0.15)' : 'rgba(255,112,67,0.1)',
                            color: '#ff7043', border: '1px solid #ff7043',
                          }}
                        />
                      )}
                    </Stack>

                    {/* Lock/Unlock toggle */}
                    <Tooltip title={streakContextLocked ? 'Locked: click to unlock' : 'Unlocked: click to lock'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleStreakContextLock(!streakContextLocked)}
                        sx={{
                          color: streakContextLocked ? '#f59e0b' : '#10b981',
                          bgcolor: isDark
                            ? streakContextLocked ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)'
                            : streakContextLocked ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                          border: `1px solid ${streakContextLocked ? '#f59e0b' : '#10b981'}`,
                          '&:hover': { opacity: 0.85 },
                        }}
                      >
                        {streakContextLocked ? <LockIcon sx={{ fontSize: 16 }} /> : <LockOpenIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  {/* Lock status badge */}
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <Chip
                      icon={streakContextLocked ? <LockIcon sx={{ fontSize: '14px !important' }} /> : <LockOpenIcon sx={{ fontSize: '14px !important' }} />}
                      label={streakContextLocked ? 'Locked — Re-fetch Blocked' : 'Unlocked — Will Refresh on Next Load'}
                      size="small"
                      sx={{
                        fontSize: 10, fontWeight: 700,
                        color: streakContextLocked ? '#f59e0b' : '#10b981',
                        bgcolor: streakContextLocked
                          ? isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)'
                          : isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                        border: `1px solid ${streakContextLocked ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
                      }}
                    />
                  </Stack>

                  {/* Content */}
                  {isStreakLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                      <CircularProgress size={32} sx={{ color: '#ff7043' }} />
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        {streakStatusLabel}
                      </Typography>
                    </Box>
                  ) : streakContextData?.summary ? (
                    <Box>
                      <Box
                        sx={{
                          p: 2.5, borderRadius: 3,
                          bgcolor: isDark ? '#0f172a' : '#f8fafc',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          mb: 2,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ lineHeight: 1.8, color: isDark ? '#cbd5e1' : '#374151', fontStyle: 'italic' }}
                        >
                          &ldquo;{streakContextData.summary}&rdquo;
                        </Typography>
                      </Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                          <Chip
                            label={`Avg Streak: ${streakContextData.averageStreak} days`}
                            size="small" variant="outlined"
                            sx={{ fontSize: 10, fontWeight: 700 }}
                          />
                          <Chip
                            label={`Longest Streak: ${streakContextData.longestStreak} days`}
                            size="small" variant="outlined"
                            sx={{ fontSize: 10, fontWeight: 700 }}
                          />
                          {streakGeneratedAtFormatted && (
                            <Chip
                              icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important', color: '#10b981 !important' }} />}
                              label={`Generated: ${streakGeneratedAtFormatted}`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10 }}
                            />
                          )}
                        </Stack>
                        <Button
                          size="small"
                          startIcon={<RefreshIcon />}
                          onClick={async () => {
                            await toggleStreakContextLock(false);
                            await generateStreakContext();
                          }}
                          disabled={isStreakLoading}
                          sx={{
                            textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: 2,
                            color: '#ff7043', border: '1px solid #ff7043', px: 1.5,
                            '&:hover': { bgcolor: 'rgba(255,112,67,0.08)' },
                          }}
                        >
                          Regenerate
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Box>
                      {streakContextStatus === 'error' ? (
                        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                          <ErrorOutlineIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                          <Typography variant="body2" color="error">
                            Failed to generate streak context. Please try again.
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                          No streak context generated yet. Click below to analyze your habit streaks.
                        </Typography>
                      )}
                      <Button
                        variant="contained"
                        startIcon={isStreakLoading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                        onClick={generateStreakContext}
                        disabled={isStreakLoading}
                        sx={{
                          textTransform: 'none', fontWeight: 700, borderRadius: 3,
                          background: 'linear-gradient(135deg, #ff7043, #f4511e)',
                          boxShadow: '0 4px 12px rgba(255,112,67,0.35)',
                          '&:hover': { background: 'linear-gradient(135deg, #f4511e, #d84315)' },
                        }}
                      >
                        Generate Streak Context
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* ── AI SCHEDULE CONTEXT CARD ── */}
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <CalendarTodayIcon sx={{ color: '#fbbf24', fontSize: 22 }} />
                      <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#fbbf24' }}>
                        AI Schedule Context
                      </Typography>
                      {scheduleContextData?.totalCount != null && (
                        <Chip
                          label={`${scheduleContextData.totalCount} schedules`}
                          size="small"
                          sx={{
                            fontSize: 10, height: 20, fontWeight: 700,
                            bgcolor: isDark ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.1)',
                            color: '#fbbf24', border: '1px solid #fbbf24',
                          }}
                        />
                      )}
                    </Stack>

                    {/* Lock/Unlock toggle */}
                    <Tooltip title={scheduleContextLocked ? 'Locked: click to unlock' : 'Unlocked: click to lock'}>
                      <IconButton
                        size="small"
                        onClick={() => toggleScheduleContextLock(!scheduleContextLocked)}
                        sx={{
                          color: scheduleContextLocked ? '#f59e0b' : '#10b981',
                          bgcolor: isDark
                            ? scheduleContextLocked ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)'
                            : scheduleContextLocked ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                          border: `1px solid ${scheduleContextLocked ? '#f59e0b' : '#10b981'}`,
                          '&:hover': { opacity: 0.85 },
                        }}
                      >
                        {scheduleContextLocked ? <LockIcon sx={{ fontSize: 16 }} /> : <LockOpenIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  {/* Lock status badge */}
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <Chip
                      icon={scheduleContextLocked ? <LockIcon sx={{ fontSize: '14px !important' }} /> : <LockOpenIcon sx={{ fontSize: '14px !important' }} />}
                      label={scheduleContextLocked ? 'Locked — Re-fetch Blocked' : 'Unlocked — Will Refresh on Next Load'}
                      size="small"
                      sx={{
                        fontSize: 10, fontWeight: 700,
                        color: scheduleContextLocked ? '#f59e0b' : '#10b981',
                        bgcolor: scheduleContextLocked
                          ? isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)'
                          : isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                        border: `1px solid ${scheduleContextLocked ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
                      }}
                    />
                  </Stack>

                  {/* Content */}
                  {isScheduleLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                      <CircularProgress size={32} sx={{ color: '#fbbf24' }} />
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        {scheduleStatusLabel}
                      </Typography>
                    </Box>
                  ) : scheduleContextData?.summary ? (
                    <Box>
                      <Box
                        sx={{
                          p: 2.5, borderRadius: 3,
                          bgcolor: isDark ? '#0f172a' : '#f8fafc',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          mb: 2,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ lineHeight: 1.8, color: isDark ? '#cbd5e1' : '#374151', fontStyle: 'italic' }}
                        >
                          &ldquo;{scheduleContextData.summary}&rdquo;
                        </Typography>
                      </Box>
                      {scheduleContextData.manualMetrics && (
                        <Box sx={{ mb: 2 }}>
                          <Button
                            size="small"
                            onClick={() => setShowScheduleAnalysis(!showScheduleAnalysis)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 12,
                              color: '#fbbf24',
                              mb: showScheduleAnalysis ? 1.5 : 0,
                            }}
                          >
                            {showScheduleAnalysis ? 'Hide Manually Calculated Analysis' : 'Show Manually Calculated Analysis'}
                          </Button>
                          {showScheduleAnalysis && (
                            <Stack spacing={2.5} sx={{ mt: 1 }}>
                              {/* Summary Stats */}
                              <Box
                                sx={{
                                  p: 2.5,
                                  borderRadius: 3,
                                  bgcolor: isDark ? 'rgba(251, 191, 36, 0.06)' : 'rgba(251, 191, 36, 0.03)',
                                  border: `1px solid ${isDark ? '#d97706' : '#fcd34d'}`,
                                }}
                              >
                                <Typography variant="subtitle2" fontWeight="800" sx={{ mb: 1.5, color: isDark ? '#fbbf24' : '#b45309', fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                  Schedules Workload Overview (30 Days)
                                </Typography>
                                <Grid container spacing={2}>
                                  <Grid size={{ xs: 6, sm: 4 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, fontSize: 10 }}>Avg Daily Count</Typography>
                                    <Typography variant="subtitle1" fontWeight="800">{scheduleContextData.manualMetrics.dailyAverageCount} items/day</Typography>
                                  </Grid>
                                  <Grid size={{ xs: 6, sm: 4 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, fontSize: 10 }}>Avg Daily Duration</Typography>
                                    <Typography variant="subtitle1" fontWeight="800">{scheduleContextData.manualMetrics.dailyAverageDuration} mins/day</Typography>
                                  </Grid>
                                  <Grid size={{ xs: 12, sm: 4 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, fontSize: 10 }}>Preferred TimeSpan</Typography>
                                    <Typography variant="subtitle1" fontWeight="800" sx={{ color: '#fbbf24' }}>
                                      {scheduleContextData.manualMetrics.preferredTimeSpan.preferredSpan}
                                    </Typography>
                                  </Grid>
                                </Grid>
                              </Box>

                              {/* Weekly Breakdown */}
                              <Box>
                                <Typography variant="caption" fontWeight="800" color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase', fontSize: 10 }}>
                                  Weekly Workload Breakdown (Avg Daily load)
                                </Typography>
                                <Grid container spacing={1.5}>
                                  {scheduleContextData.manualMetrics.weeklyBreakdown.map((week) => (
                                    <Grid key={week.weekIndex} size={{ xs: 12, sm: 6 }}>
                                      <Box
                                        sx={{
                                          p: 1.5,
                                          borderRadius: 2.5,
                                          bgcolor: isDark ? '#0f172a' : '#f8fafc',
                                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                        }}
                                      >
                                        <Typography variant="body2" fontWeight="800">
                                          Week {week.weekIndex} ({week.startDate} to {week.endDate})
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                                          <Chip label={`Count: ${week.avgScheduleCount}/day`} size="small" sx={{ fontSize: 9, height: 18 }} />
                                          <Chip label={`Duration: ${week.avgDuration}m/day`} size="small" sx={{ fontSize: 9, height: 18 }} />
                                          <Chip
                                            label={`Load: ${week.loadLabel}`}
                                            size="small"
                                            color={week.loadLabel === 'Light' ? 'success' : week.loadLabel === 'Balanced' ? 'primary' : week.loadLabel === 'Busy' ? 'warning' : 'error'}
                                            sx={{ fontSize: 9, height: 18, fontWeight: 750 }}
                                          />
                                        </Stack>
                                      </Box>
                                    </Grid>
                                  ))}
                                </Grid>
                              </Box>

                              {/* Time Bucket Counts */}
                              <Box>
                                <Typography variant="caption" fontWeight="800" color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase', fontSize: 10 }}>
                                  Preferred Hour Ranges Breakdown
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  {Object.entries(scheduleContextData.manualMetrics.preferredTimeSpan.breakdown).map(([span, count]) => (
                                    <Chip
                                      key={span}
                                      label={`${span}: ${count} schedule${count !== 1 ? 's' : ''}`}
                                      size="small"
                                      variant={scheduleContextData.manualMetrics!.preferredTimeSpan.preferredSpan === span ? 'filled' : 'outlined'}
                                      color={scheduleContextData.manualMetrics!.preferredTimeSpan.preferredSpan === span ? 'warning' : 'default'}
                                      sx={{ fontSize: 10, fontWeight: 600 }}
                                    />
                                  ))}
                                </Stack>
                              </Box>
                            </Stack>
                          )}
                        </Box>
                      )}
                      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                          <Chip
                            label={`Avg Daily: ${scheduleContextData.averageDailySchedules} schedules`}
                            size="small" variant="outlined"
                            sx={{ fontSize: 10, fontWeight: 700 }}
                          />
                          <Chip
                            label={`Flexible: ${scheduleContextData.flexibleCount}`}
                            size="small" variant="outlined"
                            sx={{ fontSize: 10, fontWeight: 700 }}
                          />
                          {scheduleGeneratedAtFormatted && (
                            <Chip
                              icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important', color: '#10b981 !important' }} />}
                              label={`Generated: ${scheduleGeneratedAtFormatted}`}
                              size="small" variant="outlined"
                              sx={{ fontSize: 10 }}
                            />
                          )}
                        </Stack>
                        <Button
                          size="small"
                          startIcon={<RefreshIcon />}
                          onClick={async () => {
                            await toggleScheduleContextLock(false);
                            await generateScheduleContext();
                          }}
                          disabled={isScheduleLoading}
                          sx={{
                            textTransform: 'none', fontWeight: 700, fontSize: 12, borderRadius: 2,
                            color: '#fbbf24', border: '1px solid #fbbf24', px: 1.5,
                            '&:hover': { bgcolor: 'rgba(251,191,36,0.08)' },
                          }}
                        >
                          Regenerate
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Box>
                      {scheduleContextStatus === 'error' ? (
                        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2 }}>
                          <ErrorOutlineIcon sx={{ color: '#ef4444', fontSize: 20 }} />
                          <Typography variant="body2" color="error">
                            Failed to generate schedule context. Please try again.
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                          No schedule context generated yet. Click below to analyze your schedules.
                        </Typography>
                      )}
                      <Button
                        variant="contained"
                        startIcon={isScheduleLoading ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                        onClick={generateScheduleContext}
                        disabled={isScheduleLoading}
                        sx={{
                          textTransform: 'none', fontWeight: 700, borderRadius: 3,
                          background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                          boxShadow: '0 4px 12px rgba(251,191,36,0.35)',
                          '&:hover': { background: 'linear-gradient(135deg, #f59e0b, #b45309)' },
                        }}
                      >
                        Generate Schedule Context
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Personal & Professional Profile */}
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" fontWeight="800" color="primary" gutterBottom>
                    👤 Personal &amp; Professional
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Full Name</Typography>
                      <Typography variant="body2" fontWeight="600">{aiContextPayload.userInfo?.name || 'User'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Age &amp; Gender</Typography>
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
                    ⚡ Productivity &amp; Habits
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
                        <Typography variant="caption" fontWeight="700">Active Goals &amp; Milestones</Typography>
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
                        <Typography variant="caption" fontWeight="700">Daily Events &amp; Schedules</Typography>
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
                   {JSON.stringify(
                     {
                       ...aiContextPayload,
                       ...(journalContextData?.summary
                         ? {
                             journalContext: {
                               summary: journalContextData.summary,
                               journalCount: journalContextData.journalCount,
                               generatedAt: journalContextData.generatedAt,
                             },
                           }
                         : {}),
                       ...(todoContextData?.summary
                         ? {
                             taskContext: {
                               summary: todoContextData.summary,
                               totalCompletedTasks: todoContextData.totalCompletedCount,
                               totalActiveTasks: todoContextData.totalActiveCount,
                               sampledCompletedCount: todoContextData.sampledCompletedCount,
                               sampledActiveCount: todoContextData.sampledActiveCount,
                               generatedAt: todoContextData.generatedAt,
                             },
                           }
                         : {}),
                       ...(goalContextData?.summary
                         ? {
                             goalContext: {
                               summary: goalContextData.summary,
                               totalCompletedGoals: goalContextData.totalCompletedCount,
                               totalActiveGoals: goalContextData.totalActiveCount,
                               sampledCompletedCount: goalContextData.sampledCompletedCount,
                               sampledActiveCount: goalContextData.sampledActiveCount,
                               checkInsLast30Days: goalContextData.checkInsLast30Days,
                               overallConsistency: goalContextData.overallConsistency,
                               generatedAt: goalContextData.generatedAt,
                             },
                           }
                         : {}),
                       ...(financeContextData?.summary
                         ? {
                             financeContext: {
                               summary: financeContextData.summary,
                               availableAmount: financeContextData.availableAmount,
                               freezeAmount: financeContextData.freezeAmount,
                               totalAmount: financeContextData.totalAmount,
                               upcomingExpensesCount: financeContextData.upcomingExpensesCount,
                               upcomingExpensesTotal: financeContextData.upcomingExpensesTotal,
                               outstandingBorrowTotal: financeContextData.outstandingBorrowTotal,
                               outstandingLendTotal: financeContextData.outstandingLendTotal,
                               generatedAt: financeContextData.generatedAt,
                             },
                           }
                         : {}),
                       ...(streakContextData?.summary
                         ? {
                             streakContext: {
                               summary: streakContextData.summary,
                               totalCount: streakContextData.totalCount,
                               averageStreak: streakContextData.averageStreak,
                               longestStreak: streakContextData.longestStreak,
                               generatedAt: streakContextData.generatedAt,
                             },
                           }
                         : {}),
                       ...(scheduleContextData?.summary
                         ? {
                             scheduleContext: {
                               summary: scheduleContextData.summary,
                               totalCount: scheduleContextData.totalCount,
                               averageDailySchedules: scheduleContextData.averageDailySchedules,
                               flexibleCount: scheduleContextData.flexibleCount,
                               generatedAt: scheduleContextData.generatedAt,
                             },
                           }
                         : {}),
                       ...(consolidatedContextData?.summary
                         ? {
                             consolidatedContext: {
                               summary: consolidatedContextData.summary,
                               generatedAt: consolidatedContextData.generatedAt,
                             },
                           }
                         : {}),
                     },
                     null,
                     2
                   )}
                 </pre>
              </Card>

              {/* Journal Context Lock Controls */}
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  p: 2.5,
                }}
              >
                <Typography variant="subtitle2" fontWeight="800" gutterBottom>
                  🔒 Journal Context Lock Controls
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Manage re-fetch lock on both localStorage and Firestore. When locked, the app won&apos;t re-fetch or re-generate the journal context automatically.
                </Typography>
                <Stack spacing={1.5}>
                  <Button
                    fullWidth
                    variant={journalContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockIcon />}
                    onClick={() => toggleJournalContextLock(true)}
                    disabled={journalContextLocked}
                    size="small"
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2.5,
                      ...(journalContextLocked
                        ? {}
                        : { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }),
                    }}
                  >
                    Lock Re-fetch (Both)
                  </Button>
                  <Button
                    fullWidth
                    variant={!journalContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockOpenIcon />}
                    onClick={() => toggleJournalContextLock(false)}
                    disabled={!journalContextLocked}
                    size="small"
                    color="success"
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2.5,
                    }}
                  >
                    Unlock Re-fetch (Both)
                  </Button>
                  <Divider />
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={async () => {
                      await toggleJournalContextLock(false);
                      await generateJournalContext();
                    }}
                    disabled={isLoading}
                    size="small"
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: 2.5,
                      color: '#6366f1',
                      borderColor: '#6366f1',
                    }}
                  >
                    {isLoading ? 'Generating…' : 'Force Regenerate Context'}
                  </Button>
                </Stack>
              </Card>

              {/* Todo Context Lock Controls */}
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  p: 2.5,
                }}
              >
                <Typography variant="subtitle2" fontWeight="800" gutterBottom>
                  📋 Task Context Lock Controls
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Manage re-fetch lock for todo context on both localStorage and Firestore.
                </Typography>
                <Stack spacing={1.5}>
                  <Button
                    fullWidth
                    variant={todoContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockIcon />}
                    onClick={() => toggleTodoContextLock(true)}
                    disabled={todoContextLocked}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      ...(todoContextLocked ? {} : { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }),
                    }}
                  >
                    Lock Re-fetch (Both)
                  </Button>
                  <Button
                    fullWidth
                    variant={!todoContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockOpenIcon />}
                    onClick={() => toggleTodoContextLock(false)}
                    disabled={!todoContextLocked}
                    size="small" color="success"
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2.5 }}
                  >
                    Unlock Re-fetch (Both)
                  </Button>
                  <Divider />
                  <Button
                    fullWidth variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={async () => {
                      await toggleTodoContextLock(false);
                      await generateTodoContext();
                    }}
                    disabled={isTodoLoading}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      color: '#06b6d4', borderColor: '#06b6d4',
                    }}
                  >
                    {isTodoLoading ? 'Generating…' : 'Force Regenerate Task Context'}
                  </Button>
                </Stack>
              </Card>

              {/* Goal Context Lock Controls */}
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  p: 2.5,
                }}
              >
                <Typography variant="subtitle2" fontWeight="800" gutterBottom sx={{ color: '#ec4899' }}>
                  🎯 Goal Context Lock Controls
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Manage re-fetch lock for goals context on both localStorage and Firestore.
                </Typography>
                <Stack spacing={1.5}>
                  <Button
                    fullWidth
                    variant={goalContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockIcon />}
                    onClick={() => toggleGoalContextLock(true)}
                    disabled={goalContextLocked}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      ...(goalContextLocked ? {} : { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }),
                    }}
                  >
                    Lock Re-fetch (Both)
                  </Button>
                  <Button
                    fullWidth
                    variant={!goalContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockOpenIcon />}
                    onClick={() => toggleGoalContextLock(false)}
                    disabled={!goalContextLocked}
                    size="small" color="success"
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2.5 }}
                  >
                    Unlock Re-fetch (Both)
                  </Button>
                  <Divider />
                  <Button
                    fullWidth variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={async () => {
                      await toggleGoalContextLock(false);
                      await generateGoalContext();
                    }}
                    disabled={isGoalLoading}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      color: '#ec4899', borderColor: '#ec4899',
                    }}
                  >
                    {isGoalLoading ? 'Generating…' : 'Force Regenerate Goal Context'}
                  </Button>
                </Stack>
              </Card>

              {/* Finance Context Lock Controls */}
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  p: 2.5,
                }}
              >
                <Typography variant="subtitle2" fontWeight="800" gutterBottom sx={{ color: '#10b981' }}>
                  💵 Finance Context Lock Controls
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Manage re-fetch lock for finance context on both localStorage and Firestore.
                </Typography>
                <Stack spacing={1.5}>
                  <Button
                    fullWidth
                    variant={financeContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockIcon />}
                    onClick={() => toggleFinanceContextLock(true)}
                    disabled={financeContextLocked}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      ...(financeContextLocked ? {} : { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }),
                    }}
                  >
                    Lock Re-fetch (Both)
                  </Button>
                  <Button
                    fullWidth
                    variant={!financeContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockOpenIcon />}
                    onClick={() => toggleFinanceContextLock(false)}
                    disabled={!financeContextLocked}
                    size="small" color="success"
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2.5 }}
                  >
                    Unlock Re-fetch (Both)
                  </Button>
                  <Divider />
                  <Button
                    fullWidth variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={async () => {
                      await toggleFinanceContextLock(false);
                      await generateFinanceContext();
                    }}
                    disabled={isFinanceLoading}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      color: '#10b981', borderColor: '#10b981',
                    }}
                  >
                    {isFinanceLoading ? 'Generating…' : 'Force Regenerate Finance Context'}
                  </Button>
                </Stack>
              </Card>

              {/* Streak Context Lock Controls */}
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  p: 2.5,
                }}
              >
                <Typography variant="subtitle2" fontWeight="800" gutterBottom sx={{ color: '#ff7043' }}>
                  🔥 Streak Context Lock Controls
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Manage re-fetch lock for streak context on both localStorage and Firestore.
                </Typography>
                <Stack spacing={1.5}>
                  <Button
                    fullWidth
                    variant={streakContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockIcon />}
                    onClick={() => toggleStreakContextLock(true)}
                    disabled={streakContextLocked}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      ...(streakContextLocked ? {} : { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }),
                    }}
                  >
                    Lock Re-fetch (Both)
                  </Button>
                  <Button
                    fullWidth
                    variant={!streakContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockOpenIcon />}
                    onClick={() => toggleStreakContextLock(false)}
                    disabled={!streakContextLocked}
                    size="small" color="success"
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2.5 }}
                  >
                    Unlock Re-fetch (Both)
                  </Button>
                  <Divider />
                  <Button
                    fullWidth variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={async () => {
                      await toggleStreakContextLock(false);
                      await generateStreakContext();
                    }}
                    disabled={isStreakLoading}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      color: '#ff7043', borderColor: '#ff7043',
                    }}
                  >
                    {isStreakLoading ? 'Generating…' : 'Force Regenerate Streak Context'}
                  </Button>
                </Stack>
              </Card>

              {/* Schedule Context Lock Controls */}
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  p: 2.5,
                }}
              >
                <Typography variant="subtitle2" fontWeight="800" gutterBottom sx={{ color: '#fbbf24' }}>
                  📅 Schedule Context Lock Controls
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Manage re-fetch lock for schedule context on both localStorage and Firestore.
                </Typography>
                <Stack spacing={1.5}>
                  <Button
                    fullWidth
                    variant={scheduleContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockIcon />}
                    onClick={() => toggleScheduleContextLock(true)}
                    disabled={scheduleContextLocked}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      ...(scheduleContextLocked ? {} : { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }),
                    }}
                  >
                    Lock Re-fetch (Both)
                  </Button>
                  <Button
                    fullWidth
                    variant={!scheduleContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockOpenIcon />}
                    onClick={() => toggleScheduleContextLock(false)}
                    disabled={!scheduleContextLocked}
                    size="small" color="success"
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2.5 }}
                  >
                    Unlock Re-fetch (Both)
                  </Button>
                  <Divider />
                  <Button
                    fullWidth variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={async () => {
                      await toggleScheduleContextLock(false);
                      await generateScheduleContext();
                    }}
                    disabled={isScheduleLoading}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      color: '#fbbf24', borderColor: '#fbbf24',
                    }}
                  >
                    {isScheduleLoading ? 'Generating…' : 'Force Regenerate Schedule Context'}
                  </Button>
                </Stack>
              </Card>

              {/* Consolidated Context Lock Controls */}
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  p: 2.5,
                }}
              >
                <Typography variant="subtitle2" fontWeight="800" gutterBottom sx={{ color: '#818cf8' }}>
                  🧠 Master Profile Lock Controls
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Manage lock for the consolidated master profile context. When locked, it won&apos;t automatically refresh.
                </Typography>
                <Stack spacing={1.5}>
                  <Button
                    fullWidth
                    variant={consolidatedContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockIcon />}
                    onClick={() => toggleConsolidatedContextLock(true)}
                    disabled={consolidatedContextLocked}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      ...(consolidatedContextLocked ? {} : { background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }),
                    }}
                  >
                    Lock Re-fetch (Both)
                  </Button>
                  <Button
                    fullWidth
                    variant={!consolidatedContextLocked ? 'outlined' : 'contained'}
                    startIcon={<LockOpenIcon />}
                    onClick={() => toggleConsolidatedContextLock(false)}
                    disabled={!consolidatedContextLocked}
                    size="small" color="success"
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2.5 }}
                  >
                    Unlock Re-fetch (Both)
                  </Button>
                  <Divider />
                  <Button
                    fullWidth variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={async () => {
                      await toggleConsolidatedContextLock(false);
                      await generateConsolidatedContext();
                    }}
                    disabled={isConsolidatedLoading}
                    size="small"
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: 2.5,
                      color: '#818cf8', borderColor: '#818cf8',
                    }}
                  >
                    {isConsolidatedLoading ? 'Generating…' : 'Force Regenerate Master Profile'}
                  </Button>
                </Stack>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
