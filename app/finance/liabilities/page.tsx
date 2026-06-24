'use client';

import {
  Box,
  Typography,
  Button,
  Container,
  Card,
  CardContent,
  Chip,
  Stack,
  Skeleton,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tabs,
  Tab,
  Tooltip,
  Fade,
  Avatar,
} from '@mui/material';
import { useState, useMemo } from 'react';
import { Liability } from '@/app/lib/interface';
import { useAuth } from '@/app/lib/context/userContext';
import Link from 'next/link';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import LockIcon from '@mui/icons-material/LockOutlined';
import LoginIcon from '@mui/icons-material/Login';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { useLiabilities } from '@/app/lib/hooks/useLiabilities';
import LiabilityDialog from '@/app/components/finance/TotalCashSnapshot/LiabilityDialog';
import { Timestamp } from 'firebase/firestore';

export default function LiabilitiesPage() {
  const { user, loading: authLoading } = useAuth();
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';

  const {
    liabilities,
    loading: hookLoading,
    error,
    updateLiability,
    deleteLiability,
  } = useLiabilities();

  // Tab control: 0 = Active, 1 = Settled
  const [tabValue, setTabValue] = useState(0);

  // Dialog States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLiabilityForDelete, setSelectedLiabilityForDelete] = useState<Liability | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Formatting date helper
  const formatDate = (dateVal?: Timestamp | Date | null): string => {
    if (!dateVal) return 'N/A';
    const d = dateVal instanceof Timestamp ? dateVal.toDate() : new Date(dateVal);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Helper to check if a liability is overdue
  const isOverdue = (l: Liability): boolean => {
    if (l.status === 'settled') return false;
    if (l.status === 'overdue') return true;
    if (!l.dueDate) return false;
    const dueDateObj = l.dueDate instanceof Timestamp ? l.dueDate.toDate() : new Date(l.dueDate);
    return dueDateObj < new Date();
  };

  // Aggregated totals for Active/Overdue liabilities
  const totals = useMemo(() => {
    let toPay = 0;
    let toReceive = 0;

    liabilities.forEach((l) => {
      if (l.status !== 'settled') {
        if (l.type === 'borrowed') {
          toPay += l.amount;
        } else if (l.type === 'lend') {
          toReceive += l.amount;
        }
      }
    });

    return { toPay, toReceive };
  }, [liabilities]);

  // Grouped liabilities
  const activeList = useMemo(() => {
    return liabilities.filter((l) => l.status !== 'settled');
  }, [liabilities]);

  const settledList = useMemo(() => {
    return liabilities.filter((l) => l.status === 'settled');
  }, [liabilities]);

  const handleSettle = async (l: Liability) => {
    if (!l.id) return;
    try {
      setActionLoading(true);
      await updateLiability(l.id, {
        status: 'settled',
        settledOn: Timestamp.now(),
      });
    } catch (err) {
      console.error('Failed to settle liability:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLiabilityForDelete?.id) return;
    try {
      setActionLoading(true);
      await deleteLiability(selectedLiabilityForDelete.id);
      setDeleteDialogOpen(false);
      setSelectedLiabilityForDelete(null);
    } catch (err) {
      console.error('Failed to delete liability:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = (l: Liability) => {
    setEditingLiability(l);
    setDialogOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingLiability(null);
    setDialogOpen(true);
  };

  if (authLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
        <Skeleton variant="circular" width={60} height={60} sx={{ mx: 'auto', mb: 2 }} />
        <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 4 }} />
      </Container>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 10 }}>
        <Fade in={true}>
          <Card
            sx={{
              borderRadius: 6,
              textAlign: 'center',
              p: 4,
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: isDark ? 'rgba(236, 72, 153, 0.1)' : '#fdf2f8',
                color: '#ec4899',
                mx: 'auto',
                mb: 3,
              }}
            >
              <LockIcon sx={{ fontSize: 40 }} />
            </Avatar>
            <Typography variant="h5" fontWeight="900" mb={1}>
              Authentication Required
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={4}>
              Please sign in to your account to view and manage your peer-to-peer liabilities securely.
            </Typography>
            <Link href="/auth/signin" passHref>
              <Button
                variant="contained"
                size="large"
                startIcon={<LoginIcon />}
                fullWidth
                sx={{
                  borderRadius: 3,
                  py: 1.5,
                  fontWeight: 800,
                  bgcolor: '#ec4899',
                  '&:hover': { bgcolor: '#be185d' },
                  textTransform: 'none',
                }}
              >
                Sign In Now
              </Button>
            </Link>
          </Card>
        </Fade>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="md"
      sx={{
        mt: 4,
        mb: 4,
        py: 4,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f1f5f9' : '#0f172a',
        borderRadius: isDark ? '24px' : '0px',
        minHeight: '100vh',
        boxShadow: isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.3)' : 'none',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Link href="/finance" passHref>
            <Button
              startIcon={<ArrowBackIcon />}
              variant="outlined"
              sx={{
                textTransform: 'none',
                borderRadius: 3,
                fontWeight: 700,
                color: isDark ? '#cbd5e1' : '#475569',
                borderColor: isDark ? '#334155' : '#cbd5e1',
                '&:hover': {
                  borderColor: isDark ? '#475569' : '#94a3b8',
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                },
              }}
            >
              Back
            </Button>
          </Link>
          <Box>
            <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: '-0.025em' }}>
              Liabilities
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Track peer-to-peer debts (lent & borrowed)
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          sx={{
            borderRadius: 3,
            fontWeight: 800,
            textTransform: 'none',
            background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
            boxShadow: '0 4px 14px 0 rgba(236, 72, 153, 0.4)',
            px: 3,
            py: 1,
            '&:hover': {
              background: 'linear-gradient(135deg, #be185d 0%, #9d174d 100%)',
            },
          }}
        >
          Add Liability
        </Button>
      </Box>

      {/* Aggregate Totals Summary */}
      {hookLoading ? (
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Skeleton variant="rectangular" width="100%" height={100} sx={{ borderRadius: 4 }} />
          <Skeleton variant="rectangular" width="100%" height={100} sx={{ borderRadius: 4 }} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <Card
            sx={{
              flex: 1,
              minWidth: 200,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
              color: 'white',
              boxShadow: '0 10px 15px -3px rgba(244, 63, 94, 0.3)',
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 700, mb: 0.5 }}>
                Total To Pay Back
              </Typography>
              <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: '-0.03em' }}>
                ₨{totals.toPay.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>

          <Card
            sx={{
              flex: 1,
              minWidth: 200,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              color: 'white',
              boxShadow: '0 10px 15px -3px rgba(13, 148, 136, 0.3)',
            }}
          >
            <CardContent>
              <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 700, mb: 0.5 }}>
                Total To Receive
              </Typography>
              <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: '-0.03em' }}>
                ₨{totals.toReceive.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: isDark ? '#334155' : '#e2e8f0', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, val) => setTabValue(val)}
          textColor="inherit"
          indicatorColor="secondary"
          sx={{
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              bgcolor: '#ec4899',
            },
          }}
        >
          <Tab
            label={`Active (${activeList.length})`}
            sx={{
              fontWeight: 800,
              textTransform: 'none',
              fontSize: '0.95rem',
              color: tabValue === 0 ? (isDark ? '#f1f5f9' : '#0f172a') : 'text.secondary',
            }}
          />
          <Tab
            label={`Settled (${settledList.length})`}
            sx={{
              fontWeight: 800,
              textTransform: 'none',
              fontSize: '0.95rem',
              color: tabValue === 1 ? (isDark ? '#f1f5f9' : '#0f172a') : 'text.secondary',
            }}
          />
        </Tabs>
      </Box>

      {/* Main Content Area */}
      {hookLoading ? (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 4 }} />
          ))}
        </Stack>
      ) : error ? (
        <Card sx={{ p: 3, textAlign: 'center', bgcolor: 'error.light', color: 'error.contrastText' }}>
          <Typography fontWeight="700">Error loading liabilities: {error}</Typography>
        </Card>
      ) : (
        <Box>
          {tabValue === 0 ? (
            activeList.length === 0 ? (
              <Card
                sx={{
                  borderRadius: 4,
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                  border: `2px dashed ${isDark ? '#334155' : '#cbd5e1'}`,
                  py: 6,
                  textAlign: 'center',
                }}
              >
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                    color: 'text.secondary',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <AssignmentOutlinedIcon sx={{ fontSize: 32 }} />
                </Avatar>
                <Typography variant="h6" fontWeight="800" color="text.secondary">
                  No Active Liabilities
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3, px: 2 }}>
                  All your peer-to-peer debts are settled. Great job!
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleOpenCreate}
                  sx={{
                    borderRadius: 3,
                    fontWeight: 700,
                    textTransform: 'none',
                    borderColor: '#ec4899',
                    color: '#ec4899',
                    '&:hover': {
                      borderColor: '#be185d',
                      bgcolor: 'rgba(236,72,153,0.04)',
                    },
                  }}
                >
                  Add Your First Record
                </Button>
              </Card>
            ) : (
              <Stack spacing={2}>
                {activeList.map((liability) => {
                  const overdue = isOverdue(liability);
                  const isLend = liability.type === 'lend';

                  return (
                    <Card
                      key={liability.id}
                      elevation={0}
                      sx={{
                        borderRadius: 4,
                        border: `1px solid ${
                          overdue
                            ? '#ef4444'
                            : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : '#e2e8f0'
                        }`,
                        backgroundColor: overdue
                          ? isDark
                            ? 'rgba(239, 68, 68, 0.07)'
                            : '#fef2f2'
                          : isDark
                          ? isLend
                            ? 'rgba(13, 148, 136, 0.04)'
                            : 'rgba(244, 63, 94, 0.04)'
                          : isLend
                          ? '#f0fdf4'
                          : '#fff5f5',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: isDark
                            ? '0 12px 20px -8px rgba(0, 0, 0, 0.4)'
                            : '0 8px 16px -6px rgba(0, 0, 0, 0.06)',
                          borderColor: overdue
                            ? '#ef4444'
                            : isLend
                            ? '#0d9488'
                            : '#ec4899',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            flexWrap: 'wrap',
                            gap: 2,
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
                              <Typography variant="h6" fontWeight="900" sx={{ letterSpacing: '-0.015em' }}>
                                {liability.personName}
                              </Typography>
                              <Chip
                                label={isLend ? 'Lend (To Receive)' : 'Borrowed (To Pay)'}
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  bgcolor: isLend ? '#0d9488' : '#ec4899',
                                  color: 'white',
                                  fontSize: '0.72rem',
                                  height: 22,
                                }}
                              />
                              {overdue && (
                                <Chip
                                  icon={<WarningAmberIcon sx={{ fontSize: '0.9rem !important', color: 'white !important' }} />}
                                  label="OVERDUE"
                                  size="small"
                                  sx={{
                                    fontWeight: 900,
                                    bgcolor: '#ef4444',
                                    color: 'white',
                                    fontSize: '0.72rem',
                                    height: 22,
                                  }}
                                />
                              )}
                            </Box>

                            <Stack spacing={0.8} sx={{ mt: 1.5 }}>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ opacity: 0.85 }}>
                                <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Typography variant="caption" fontWeight="700" color="text.secondary">
                                  Given: {formatDate(liability.date)}
                                  {liability.dueDate && (
                                    <> • Due: <span style={{ color: overdue ? '#ef4444' : 'inherit', fontWeight: overdue ? 800 : 700 }}>{formatDate(liability.dueDate)}</span></>
                                  )}
                                </Typography>
                              </Stack>

                              {liability.source && (
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ opacity: 0.85 }}>
                                  <AccountBalanceWalletIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  <Typography variant="caption" fontWeight="700" color="text.secondary">
                                    Source: {liability.source.replace('bank:', 'Bank (').replace('custom:', 'Custom (').concat(liability.source.includes(':') ? ')' : '')}
                                  </Typography>
                                </Stack>
                              )}

                              {liability.description && (
                                <Box sx={{ mt: 1, p: 1.5, bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', borderRadius: 2 }}>
                                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                    &quot;{liability.description}&quot;
                                  </Typography>
                                </Box>
                              )}
                            </Stack>
                          </Box>

                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-end',
                              justifyContent: 'space-between',
                              height: '100%',
                              gap: 2,
                              alignSelf: 'stretch',
                            }}
                          >
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="h5" fontWeight="950" sx={{ letterSpacing: '-0.02em', color: overdue ? '#ef4444' : 'inherit' }}>
                                ₨{liability.amount.toLocaleString()}
                              </Typography>
                              <Typography variant="caption" fontWeight="800" color="text.secondary">
                                ACTIVE AMOUNT
                              </Typography>
                            </Box>

                            <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
                              <Tooltip title="Mark Settled">
                                <IconButton
                                  color="success"
                                  onClick={() => handleSettle(liability)}
                                  disabled={actionLoading}
                                  sx={{
                                    bgcolor: isDark ? '#1e293b' : '#ffffff',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    '&:hover': {
                                      bgcolor: '#10b981',
                                      color: 'white',
                                    },
                                  }}
                                >
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Edit">
                                <IconButton
                                  onClick={() => handleOpenEdit(liability)}
                                  disabled={actionLoading}
                                  sx={{
                                    bgcolor: isDark ? '#1e293b' : '#ffffff',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    '&:hover': {
                                      bgcolor: '#3b82f6',
                                      color: 'white',
                                    },
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Delete">
                                <IconButton
                                  color="error"
                                  onClick={() => {
                                    setSelectedLiabilityForDelete(liability);
                                    setDeleteDialogOpen(true);
                                  }}
                                  disabled={actionLoading}
                                  sx={{
                                    bgcolor: isDark ? '#1e293b' : '#ffffff',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                    '&:hover': {
                                      bgcolor: '#ef4444',
                                      color: 'white',
                                    },
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )
          ) : settledList.length === 0 ? (
            <Card
              sx={{
                borderRadius: 4,
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                border: `2px dashed ${isDark ? '#334155' : '#cbd5e1'}`,
                py: 6,
                textAlign: 'center',
              }}
            >
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                  color: 'text.secondary',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 32 }} />
              </Avatar>
              <Typography variant="h6" fontWeight="800" color="text.secondary">
                No Settled Liabilities
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Settled records will be saved here for your records.
              </Typography>
            </Card>
          ) : (
            <Stack spacing={2}>
              {settledList.map((liability) => {
                const isLend = liability.type === 'lend';
                return (
                  <Card
                    key={liability.id}
                    elevation={0}
                    sx={{
                      borderRadius: 4,
                      opacity: 0.8,
                      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`,
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.01)' : '#f8fafc',
                      position: 'relative',
                    }}
                  >
                    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 2,
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle1" fontWeight="800">
                              {liability.personName}
                            </Typography>
                            <Chip
                              label={isLend ? 'Lend (Settled)' : 'Borrowed (Paid)'}
                              size="small"
                              sx={{
                                fontWeight: 800,
                                bgcolor: '#94a3b8',
                                color: 'white',
                                fontSize: '0.65rem',
                                height: 18,
                              }}
                            />
                            <Chip
                              label="SETTLED"
                              size="small"
                              color="success"
                              sx={{
                                fontWeight: 900,
                                fontSize: '0.65rem',
                                height: 18,
                              }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary" fontWeight="700">
                            Given: {formatDate(liability.date)} • Settled On: {formatDate(liability.settledOn || liability.createdAt)}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography
                              variant="h6"
                              fontWeight="900"
                              sx={{ textDecoration: 'line-through', opacity: 0.6 }}
                            >
                              ₨{liability.amount.toLocaleString()}
                            </Typography>
                          </Box>
                          <Tooltip title="Delete Permanently">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setSelectedLiabilityForDelete(liability);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={actionLoading}
                              sx={{
                                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                                '&:hover': {
                                  bgcolor: '#ef4444',
                                  color: 'white',
                                },
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 4,
            bgcolor: isDark ? '#1e293b' : '#ffffff',
          },
        }}
      >
        <DialogTitle fontWeight="900">Delete Liability Record?</DialogTitle>
        <DialogContent>
          <DialogContentText color="text.secondary" fontWeight="600">
            Are you sure you want to permanently delete this liability record for{' '}
            <strong>{selectedLiabilityForDelete?.personName}</strong> of amount{' '}
            <strong>₨{selectedLiabilityForDelete?.amount.toLocaleString()}</strong>? This action cannot
            be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={actionLoading}
            sx={{ fontWeight: 700, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={actionLoading}
            sx={{ borderRadius: 2, fontWeight: 800 }}
          >
            Delete Record
          </Button>
        </DialogActions>
      </Dialog>

      {/* LiabilityDialog Form (Create / Edit) */}
      <LiabilityDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        liability={editingLiability}
      />
    </Container>
  );
}
