'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Stack,
  IconButton,
  Chip,
  Alert,
  Snackbar,
  Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ChecklistIcon from '@mui/icons-material/Checklist';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ContactPhoneIcon from '@mui/icons-material/ContactPhone';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { useAuth } from '@/app/lib/context/userContext';
import { useTodoContext } from '@/app/lib/context/todoContext';
import { useSchedules } from '@/app/lib/context/SchedulesContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

export default function UserContextPage() {
  const { user, onboardingData, contextParagraph } = useAuth();
  const { todos, refreshTodos } = useTodoContext();
  const { allSchedules, refreshSchedules } = useSchedules();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
  const router = useRouter();

  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' as 'success' | 'info' });
  const [recalculating, setRecalculating] = useState(false);

  // ── Retrieve Local Storage Cache for Finance info ──────────────────────────
  const cashSnapshot = useMemo(() => {
    try {
      const cached = localStorage.getItem('myorbit_cached_cash_snapshot');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }, []);

  const loans = useMemo(() => {
    try {
      const cached = localStorage.getItem('myorbit_cached_loans');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }, []);

  // ── Calculate metrics for details panel ─────────────────────────────────────
  const todoMetrics = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const completedToday = todos.filter(t => {
      if (t.status !== 'completed') return false;
      const compDate = t.completedAt ? new Date(t.completedAt) : null;
      return compDate && compDate >= startOfDay;
    });

    const active = todos.filter(t => t.status === 'in_progress' || t.status === 'hold');
    const urgent = todos.filter(t => t.status !== 'completed' && t.priority === 'urgent');
    
    const overdue = todos.filter(t => {
      if (t.status === 'completed') return false;
      if (!t.dueDate) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const due = t.dueDate instanceof Date ? t.dueDate : (t.dueDate as any).toDate?.() || new Date(t.dueDate as any);
      return due < new Date();
    });

    return {
      completedTodayCount: completedToday.length,
      activeCount: active.length,
      urgentCount: urgent.length,
      overdueCount: overdue.length
    };
  }, [todos]);

  const scheduleMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySchedules = allSchedules.filter(s => {
      if (s.status === 'cancelled') return false;
      if (s.isFlexible) return true;
      return s.date === todayStr;
    });
    return {
      todayCount: todaySchedules.length
    };
  }, [allSchedules]);

  const financeMetrics = useMemo(() => {
    const totalAmount = cashSnapshot?.totalAmount ?? 0;
    const freezeAmount = cashSnapshot?.freezeAmount ?? 0;
    const availableAmount = totalAmount - freezeAmount;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const borrowLoans = loans.filter((l: any) => !l.isSettled && l.type === 'borrow');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lendLoans = loans.filter((l: any) => !l.isSettled && l.type === 'lend');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payback = borrowLoans.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toReceive = lendLoans.reduce((sum: number, l: any) => sum + (l.amount || 0), 0);

    return {
      totalAmount,
      availableAmount,
      payback,
      toReceive
    };
  }, [cashSnapshot, loans]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!contextParagraph) return;
    navigator.clipboard.writeText(contextParagraph);
    setSnack({ open: true, message: 'Context paragraph copied to clipboard!', type: 'success' });
  };

  const handleRecalculate = () => {
    setRecalculating(true);
    refreshTodos();
    refreshSchedules();
    
    setTimeout(() => {
      setRecalculating(false);
      setSnack({ open: true, message: 'Triggered recalculation based on latest logs.', type: 'info' });
    }, 1500);
  };

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
        <Stack direction="row" justifyContent="space-between" alignItems="center" maxWidth={1000} mx="auto">
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
      <Box maxWidth={1000} mx="auto" sx={{ px: { xs: 2, sm: 3 }, mt: 4 }}>
        {/* Nudge Banner */}
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
            This Context Hub displays the centralized natural language profile summary cached locally. It is generated client-side from your profile, tasks, schedules, and finances, and shared automatically with the AI model for highly tailored responses without redundant database hits.
          </Typography>
        </Alert>

        <Grid container spacing={4}>
          {/* Left Panel: The Consolidated Context Paragraph */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={3}>
              <Typography variant="h6" fontWeight="800">
                Consolidated AI Prompt Context
              </Typography>

              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? '#1e1b4b' : '#f5f3ff',
                  border: `2px solid ${isDark ? '#818cf8' : '#6366f1'}`,
                  boxShadow: isDark
                    ? '0 0 25px rgba(129, 140, 248, 0.2)'
                    : '0 6px 24px rgba(99, 102, 241, 0.12)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: 4,
                    background: 'linear-gradient(90deg, #6366f1, #3b82f6, #10b981)',
                  }}
                />
                
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <AutoAwesomeIcon sx={{ color: '#818cf8' }} />
                      <Typography variant="subtitle1" fontWeight="800" color="#818cf8">
                        Active Natural Language Snapshot
                      </Typography>
                    </Stack>
                    <Chip
                      icon={<LockOpenIcon sx={{ fontSize: '14px !important', color: '#10b981' }} />}
                      label="Auto-Cached"
                      size="small"
                      sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#10b981',
                        bgcolor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.06)',
                        border: '1px solid rgba(16,185,129,0.3)',
                      }}
                    />
                  </Stack>

                  {contextParagraph ? (
                    <Box sx={{ mt: 2 }}>
                      <Box
                        sx={{
                          p: 3,
                          borderRadius: 3,
                          bgcolor: isDark ? '#0f172a' : '#f8fafc',
                          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                          mb: 3,
                        }}
                      >
                        <Typography
                          variant="body1"
                          sx={{
                            lineHeight: 1.8,
                            fontWeight: 500,
                            fontFamily: 'Outfit, Inter, sans-serif',
                            color: isDark ? '#e2e8f0' : '#1e293b',
                          }}
                        >
                          {contextParagraph}
                        </Typography>
                      </Box>
                      
                      <Stack direction="row" gap={2} justifyContent="flex-end">
                        <Button
                          variant="outlined"
                          startIcon={<ContentCopyIcon />}
                          onClick={handleCopy}
                          sx={{
                            borderRadius: 3,
                            textTransform: 'none',
                            fontWeight: 700,
                            borderColor: '#818cf8',
                            color: '#818cf8',
                          }}
                        >
                          Copy Text
                        </Button>
                        <Button
                          variant="contained"
                          disabled={recalculating}
                          onClick={handleRecalculate}
                          sx={{
                            borderRadius: 3,
                            textTransform: 'none',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                          }}
                        >
                          {recalculating ? 'Syncing...' : 'Force Sync'}
                        </Button>
                      </Stack>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, fontStyle: 'italic', textAlign: 'center' }}>
                      Context paragraph has not been cached yet. Try adding some tasks, schedules, or updating your profile to trigger calculations.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* Right Panel: Data Inputs Breakdown */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={3}>
              <Typography variant="h6" fontWeight="800">
                Context Signals Breakdown
              </Typography>

              {/* Profile Card */}
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <PersonOutlineIcon sx={{ color: '#6366f1' }} />
                    <Typography variant="subtitle2" fontWeight="800">
                      User Identity & Onboarding
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Name:</Typography>
                      <Typography variant="body2" fontWeight="700">
                        {onboardingData?.firstName || user?.firstName || 'Not Set'} {onboardingData?.lastName || user?.lastName || ''}
                      </Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Gender & Age:</Typography>
                      <Typography variant="body2" fontWeight="700">
                        {onboardingData?.gender?.value ? onboardingData.gender.value.toUpperCase() : 'Not Set'} • {onboardingData?.ageGroup?.value || 'Not Set'} y/o
                      </Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Education:</Typography>
                      <Typography variant="body2" fontWeight="700">{onboardingData?.education?.value || 'Not Set'}</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Profession:</Typography>
                      <Typography variant="body2" fontWeight="700">
                        {onboardingData?.profession?.value || onboardingData?.professionType?.value || 'Not Set'}
                      </Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" gap={0.5} alignItems="center">
                        <ContactPhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">Mobile:</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight="700">{onboardingData?.mobile?.value || 'Not Set'}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* Tasks Card */}
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <ChecklistIcon sx={{ color: '#06b6d4' }} />
                    <Typography variant="subtitle2" fontWeight="800">
                      Task Statistics
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Completed Today:</Typography>
                      <Typography variant="body2" fontWeight="700" color="#10b981">{todoMetrics.completedTodayCount} tasks</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">In Progress / Active:</Typography>
                      <Typography variant="body2" fontWeight="700" color="#0284c7">{todoMetrics.activeCount} tasks</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Overdue Tasks:</Typography>
                      <Typography variant="body2" fontWeight="700" color={todoMetrics.overdueCount > 0 ? '#f43f5e' : 'inherit'}>
                        {todoMetrics.overdueCount} tasks
                      </Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Urgent Priority Flag:</Typography>
                      <Typography variant="body2" fontWeight="700" color={todoMetrics.urgentCount > 0 ? '#f43f5e' : 'inherit'}>
                        {todoMetrics.urgentCount} tasks
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              {/* Schedules Card */}
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <CalendarTodayIcon sx={{ color: '#10b981' }} />
                    <Typography variant="subtitle2" fontWeight="800">
                      Schedule Statistics
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Active Schedules Today:</Typography>
                    <Typography variant="body2" fontWeight="700">{scheduleMetrics.todayCount} items</Typography>
                  </Stack>
                </CardContent>
              </Card>

              {/* Finance Card */}
              <Card sx={{ borderRadius: 4, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" gap={1} mb={2}>
                    <AccountBalanceWalletIcon sx={{ color: '#f59e0b' }} />
                    <Typography variant="subtitle2" fontWeight="800">
                      Finance Liquidity & Debt
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Overall Amount:</Typography>
                      <Typography variant="body2" fontWeight="700">PKR {financeMetrics.totalAmount.toLocaleString()}</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Own Cash (Available):</Typography>
                      <Typography variant="body2" fontWeight="700" color="#10b981">PKR {financeMetrics.availableAmount.toLocaleString()}</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Payback (What you owe):</Typography>
                      <Typography variant="body2" fontWeight="700" color={financeMetrics.payback > 0 ? '#f43f5e' : 'inherit'}>
                        PKR {financeMetrics.payback.toLocaleString()}
                      </Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Receivable (Owed to you):</Typography>
                      <Typography variant="body2" fontWeight="700" color="#10b981">PKR {financeMetrics.toReceive.toLocaleString()}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Box>

      {/* Snackbar Alert Notifications */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          severity={snack.type === 'success' ? 'success' : 'info'}
          sx={{ width: '100%', borderRadius: 3 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
