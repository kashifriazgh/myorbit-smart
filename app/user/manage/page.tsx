'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Snackbar,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  IconButton,
  Paper,
  TableContainer,
  Chip,
  Avatar,
  Stack,
  Card,
  CardContent,
  Tooltip,
  Button,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  SwapHoriz as SwapHorizIcon,
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Shield as ShieldIcon,
  EditCalendar as EditCalendarIcon,
  Block as BlockIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import { userAuth as auth, userDb as db } from '@/app/lib/firebase';
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { getValidityDate } from '@/app/lib/guestUser';

interface UserRecord {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'master' | 'editor' | 'viewer';
  status?: 'active' | 'pending' | 'rejected';
  accountStatus?: 'active' | 'disabled';
  validity?: any;
  createdAt?: { toDate: () => Date };
}

export default function ManageUsersPage() {
  const { theme: customTheme } = useCustomTheme();
  const isDark = customTheme?.mode === 'dark';
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, msg: '', type: 'success' });

  // 1. Fetch current user from auth & db
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserRecord;
            if (data.role !== 'master') {
              // Redirect non-master users to dashboard
              router.push('/user/dashboard');
              return;
            }
            setCurrentUser(data);
          } else {
            router.push('/user/login');
          }
        } catch (err) {
          console.error(err);
          router.push('/user/dashboard');
        }
      } else {
        router.push('/user/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch all registered users
  const fetchUsers = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs
        .map((doc) => doc.data() as UserRecord)
        // Exclude current master user
        .filter((u) => u.uid !== currentUser.uid);
      setUsers(list);
    } catch (err) {
      console.error(err);
      setSnack({
        open: true,
        msg: 'Failed to fetch registered users.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
    }
  }, [currentUser, fetchUsers]);

  // 3. User Actions
  const handleApprove = async (uid: string) => {
    setActionLoading(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'active' });
      setSnack({ open: true, msg: 'User approved successfully!', type: 'success' });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to approve user.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (uid: string) => {
    setActionLoading(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { status: 'rejected' });
      setSnack({ open: true, msg: 'User request rejected.', type: 'warning' });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to reject user.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRole = async (uid: string, currentRole: 'master' | 'editor' | 'viewer') => {
    const newRole = currentRole === 'editor' ? 'viewer' : 'editor';
    setActionLoading(`${uid}-role`);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      setSnack({ open: true, msg: `Role updated to ${newRole}.`, type: 'info' });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to update user role.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const [validityDialogUser, setValidityDialogUser] = useState<UserRecord | null>(null);
  const [customDaysInput, setCustomDaysInput] = useState<string>('7');

  const handleToggleAccountStatus = async (uid: string, currentAccountStatus?: 'active' | 'disabled') => {
    const newAccountStatus = currentAccountStatus === 'disabled' ? 'active' : 'disabled';
    setActionLoading(`${uid}-accountStatus`);
    try {
      await updateDoc(doc(db, 'users', uid), { accountStatus: newAccountStatus });
      setSnack({ open: true, msg: `Account status updated to ${newAccountStatus}.`, type: 'info' });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to update account status.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleExtendValidity = async (uid: string, daysToAdd: number | null) => {
    setActionLoading(`${uid}-validity`);
    try {
      let newValidityTimestamp: Timestamp | null = null;
      if (daysToAdd !== null) {
        const targetUser = users.find((u) => u.uid === uid);
        const currentVal = targetUser?.validity ? getValidityDate(targetUser.validity) : null;
        // Start extending from existing future expiration or from now if expired / missing
        const baseDate = currentVal && currentVal.getTime() > Date.now() ? currentVal : new Date();
        baseDate.setDate(baseDate.getDate() + daysToAdd);
        newValidityTimestamp = Timestamp.fromDate(baseDate);
      }

      await updateDoc(doc(db, 'users', uid), {
        validity: newValidityTimestamp,
        accountStatus: 'active', // Reset account status to active when extending validity
      });
      setSnack({ open: true, msg: 'User validity updated successfully!', type: 'success' });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to update user validity.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatValidityInfo = (validity: any, accountStatus?: string) => {
    if (accountStatus === 'disabled') {
      return { text: 'Disabled', isExpired: true, color: 'error' as const };
    }
    const date = getValidityDate(validity);
    if (!date) {
      return { text: 'Unlimited', isExpired: false, color: 'info' as const };
    }
    const diffMs = date.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const dateStr = date.toLocaleDateString();

    if (diffMs < 0) {
      return { text: `Expired (${dateStr})`, isExpired: true, color: 'error' as const };
    } else {
      return { text: `${diffDays}d left (${dateStr})`, isExpired: false, color: 'success' as const };
    }
  };
  const handleDelete = async (uid: string) => {
    setActionLoading(uid);
    try {
      await deleteDoc(doc(db, 'users', uid));
      setSnack({ open: true, msg: 'User registration canceled & removed.', type: 'success' });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to cancel registration.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Filter users based on tabs
  const pendingUsers = users.filter((u) => u.status === 'pending');
  const activeUsers = users.filter((u) => u.status === 'active');
  const rejectedUsers = users.filter((u) => u.status === 'rejected');

  const filteredUsers =
    activeTab === 0
      ? pendingUsers
      : activeTab === 1
      ? activeUsers
      : rejectedUsers;

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
              User Approvals & Registrations
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <Box maxWidth={1000} mx="auto" sx={{ px: { xs: 2, sm: 3 }, mt: 4 }}>
        {/* Master User Info Card */}
        {currentUser && (
          <Card
            sx={{
              mb: 4,
              borderRadius: 4,
              bgcolor: isDark ? '#1e293b' : '#ffffff',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              boxShadow: 'none',
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                sx={{
                  bgcolor: '#6366f1',
                  width: 56,
                  height: 56,
                  boxShadow: '0 8px 16px rgba(99, 102, 241, 0.25)',
                }}
              >
                <ShieldIcon fontSize="medium" />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight="800">
                  Master User Session
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Logged in as: <strong>{currentUser.email}</strong>
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Tab Controls */}
        <Box sx={{ borderBottom: 1, borderColor: isDark ? '#334155' : '#e2e8f0', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            textColor="primary"
            indicatorColor="primary"
            variant={isMobile ? 'scrollable' : 'fullWidth'}
            scrollButtons={isMobile ? 'auto' : undefined}
            allowScrollButtonsMobile={isMobile}
          >
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Pending Requests</span>
                  <Chip
                    label={pendingUsers.length}
                    size="small"
                    color={pendingUsers.length > 0 ? 'warning' : 'default'}
                    sx={{ height: 20, fontSize: '0.75rem', fontWeight: 'bold' }}
                  />
                </Stack>
              }
              sx={{ textTransform: 'none', fontWeight: 800 }}
            />
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Approved Users</span>
                  <Chip
                    label={activeUsers.length}
                    size="small"
                    color={activeUsers.length > 0 ? 'success' : 'default'}
                    sx={{ height: 20, fontSize: '0.75rem', fontWeight: 'bold' }}
                  />
                </Stack>
              }
              sx={{ textTransform: 'none', fontWeight: 800 }}
            />
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Rejected / Cancelled</span>
                  <Chip
                    label={rejectedUsers.length}
                    size="small"
                    sx={{ height: 20, fontSize: '0.75rem', fontWeight: 'bold' }}
                  />
                </Stack>
              }
              sx={{ textTransform: 'none', fontWeight: 800 }}
            />
          </Tabs>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={10}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Desktop Table View */}
            <TableContainer
              component={Paper}
              sx={{
                display: { xs: 'none', md: 'block' },
                borderRadius: 4,
                bgcolor: isDark ? '#1e293b' : '#ffffff',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                boxShadow: 'none',
                overflow: 'hidden',
              }}
            >
              <Table>
                <TableHead sx={{ bgcolor: isDark ? '#0f172a' : '#f1f5f9' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>User Details</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Approval</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Account Status</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Validity</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Registered At</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, pr: 3 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => {
                      const regDate = u.createdAt?.toDate
                        ? u.createdAt.toDate().toLocaleDateString()
                        : 'Unknown';
                      const valInfo = formatValidityInfo(u.validity, u.accountStatus);

                      return (
                        <TableRow key={u.uid} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Avatar sx={{ bgcolor: isDark ? '#334155' : '#f1f5f9', color: isDark ? '#fff' : '#000' }}>
                                <PersonIcon />
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="700">
                                  {u.firstName} {u.lastName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {u.email}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={u.role.toUpperCase()}
                              size="small"
                              color={u.role === 'editor' ? 'primary' : 'default'}
                              variant="outlined"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={u.status ? u.status.toUpperCase() : 'UNKNOWN'}
                              size="small"
                              color={
                                u.status === 'active'
                                  ? 'success'
                                  : u.status === 'pending'
                                  ? 'warning'
                                  : 'error'
                              }
                              sx={{ fontWeight: 'bold', color: '#fff' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={u.accountStatus === 'disabled' ? 'DISABLED' : 'ACTIVE'}
                              size="small"
                              color={u.accountStatus === 'disabled' ? 'error' : 'success'}
                              variant={u.accountStatus === 'disabled' ? 'filled' : 'outlined'}
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={valInfo.text}
                              size="small"
                              color={valInfo.color}
                              variant="outlined"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {regDate}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ pr: 3 }}>
                            {actionLoading === u.uid || actionLoading === `${u.uid}-role` || actionLoading === `${u.uid}-validity` || actionLoading === `${u.uid}-accountStatus` ? (
                              <CircularProgress size={24} />
                            ) : (
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                {/* Validity & Status Management Button */}
                                <Tooltip title="Manage Validity & Account Status">
                                  <IconButton
                                    color="info"
                                    onClick={() => setValidityDialogUser(u)}
                                    disabled={actionLoading !== null}
                                  >
                                    <EditCalendarIcon />
                                  </IconButton>
                                </Tooltip>

                                {/* Toggle Account Status */}
                                <Tooltip title={u.accountStatus === 'disabled' ? 'Enable Account' : 'Disable Account'}>
                                  <IconButton
                                    color={u.accountStatus === 'disabled' ? 'success' : 'warning'}
                                    onClick={() => handleToggleAccountStatus(u.uid, u.accountStatus)}
                                    disabled={actionLoading !== null}
                                  >
                                    {u.accountStatus === 'disabled' ? <CheckCircleIcon /> : <BlockIcon />}
                                  </IconButton>
                                </Tooltip>

                                {/* Pending Status Controls */}
                                {u.status === 'pending' && (
                                  <>
                                    <Tooltip title="Approve Request">
                                      <IconButton
                                        color="success"
                                        onClick={() => handleApprove(u.uid)}
                                        disabled={actionLoading !== null}
                                      >
                                        <CheckCircleIcon />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Reject Request">
                                      <IconButton
                                        color="error"
                                        onClick={() => handleReject(u.uid)}
                                        disabled={actionLoading !== null}
                                      >
                                        <CancelIcon />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}

                                {/* Approved Status Controls */}
                                {u.status === 'active' && (
                                  <>
                                    <Tooltip title="Change Role (Editor/Viewer)">
                                      <IconButton
                                        color="primary"
                                        onClick={() => handleToggleRole(u.uid, u.role)}
                                        disabled={actionLoading !== null}
                                      >
                                        <SwapHorizIcon />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Cancel Registration / Revoke Access">
                                      <IconButton
                                        color="error"
                                        onClick={() => handleReject(u.uid)}
                                        disabled={actionLoading !== null}
                                      >
                                        <CancelIcon />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}

                                {/* Rejected/Cancelled Status Controls */}
                                {u.status === 'rejected' && (
                                  <>
                                    <Tooltip title="Re-Approve User">
                                      <IconButton
                                        color="success"
                                        onClick={() => handleApprove(u.uid)}
                                        disabled={actionLoading !== null}
                                      >
                                        <CheckCircleIcon />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Permanently Delete Record">
                                      <IconButton
                                        color="error"
                                        onClick={() => handleDelete(u.uid)}
                                        disabled={actionLoading !== null}
                                      >
                                        <DeleteIcon />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </Stack>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                        <Typography variant="body2" color="text.secondary">
                          No users found in this section.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Mobile Card List View */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const regDate = u.createdAt?.toDate
                    ? u.createdAt.toDate().toLocaleDateString()
                    : 'Unknown';
                  const valInfo = formatValidityInfo(u.validity, u.accountStatus);

                  return (
                    <Card
                      key={u.uid}
                      sx={{
                        mb: 2,
                        borderRadius: 3,
                        bgcolor: isDark ? '#1e293b' : '#ffffff',
                        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                        boxShadow: 'none',
                      }}
                    >
                      <CardContent sx={{ p: 2.5 }}>
                        <Stack spacing={2}>
                          {/* User Details */}
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <Avatar sx={{ bgcolor: isDark ? '#334155' : '#f1f5f9', color: isDark ? '#fff' : '#000' }}>
                              <PersonIcon />
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" fontWeight="855" noWrap>
                                {u.firstName} {u.lastName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                {u.email}
                              </Typography>
                            </Box>
                          </Stack>

                          {/* Chips for Role & Status & Validity & Date */}
                          <Stack direction="row" flexWrap="wrap" gap={1}>
                            <Chip
                              label={u.role.toUpperCase()}
                              size="small"
                              color={u.role === 'editor' ? 'primary' : 'default'}
                              variant="outlined"
                              sx={{ fontWeight: 'bold' }}
                            />
                            <Chip
                              label={u.status ? u.status.toUpperCase() : 'UNKNOWN'}
                              size="small"
                              color={
                                u.status === 'active'
                                  ? 'success'
                                  : u.status === 'pending'
                                  ? 'warning'
                                  : 'error'
                              }
                              sx={{ fontWeight: 'bold', color: '#fff' }}
                            />
                            <Chip
                              label={u.accountStatus === 'disabled' ? 'DISABLED' : 'ACTIVE'}
                              size="small"
                              color={u.accountStatus === 'disabled' ? 'error' : 'success'}
                              variant="outlined"
                              sx={{ fontWeight: 'bold' }}
                            />
                            <Chip
                              label={valInfo.text}
                              size="small"
                              color={valInfo.color}
                              variant="outlined"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Registered: {regDate}
                          </Typography>

                          {/* Action Buttons */}
                          <Box sx={{ borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, pt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                            {actionLoading === u.uid || actionLoading === `${u.uid}-role` ? (
                              <CircularProgress size={20} />
                            ) : (
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="info"
                                  startIcon={<EditCalendarIcon />}
                                  onClick={() => setValidityDialogUser(u)}
                                  disabled={actionLoading !== null}
                                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                                >
                                  Manage Validity
                                </Button>

                                {/* Pending Status Controls */}
                                {u.status === 'pending' && (
                                  <>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="success"
                                      startIcon={<CheckCircleIcon />}
                                      onClick={() => handleApprove(u.uid)}
                                      disabled={actionLoading !== null}
                                      sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      startIcon={<CancelIcon />}
                                      onClick={() => handleReject(u.uid)}
                                      disabled={actionLoading !== null}
                                      sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}

                                {/* Approved Status Controls */}
                                {u.status === 'active' && (
                                  <>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="primary"
                                      startIcon={<SwapHorizIcon />}
                                      onClick={() => handleToggleRole(u.uid, u.role)}
                                      disabled={actionLoading !== null}
                                      sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                                    >
                                      Toggle Role
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      startIcon={<CancelIcon />}
                                      onClick={() => handleReject(u.uid)}
                                      disabled={actionLoading !== null}
                                      sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                                    >
                                      Revoke
                                    </Button>
                                  </>
                                )}

                                {/* Rejected/Cancelled Status Controls */}
                                {u.status === 'rejected' && (
                                  <>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      color="success"
                                      startIcon={<CheckCircleIcon />}
                                      onClick={() => handleApprove(u.uid)}
                                      disabled={actionLoading !== null}
                                      sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="error"
                                      startIcon={<DeleteIcon />}
                                      onClick={() => handleDelete(u.uid)}
                                      disabled={actionLoading !== null}
                                      sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                                    >
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </Stack>
                            )}
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card
                  sx={{
                    py: 6,
                    borderRadius: 3,
                    bgcolor: isDark ? '#1e293b' : '#ffffff',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                    boxShadow: 'none',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No users found in this section.
                  </Typography>
                </Card>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Dialog for Managing User Validity & Account Status */}
      <Dialog
        open={Boolean(validityDialogUser)}
        onClose={() => setValidityDialogUser(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#000000',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Manage User Validity & Status
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          {validityDialogUser && (
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="subtitle2" fontWeight="700">
                  User: {validityDialogUser.firstName} {validityDialogUser.lastName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {validityDialogUser.email}
                </Typography>
              </Box>

              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="body2" fontWeight="700">
                  Account Status:
                </Typography>
                <Chip
                  label={validityDialogUser.accountStatus === 'disabled' ? 'DISABLED' : 'ACTIVE'}
                  color={validityDialogUser.accountStatus === 'disabled' ? 'error' : 'success'}
                  size="small"
                  sx={{ fontWeight: 'bold' }}
                />
              </Box>

              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="body2" fontWeight="700">
                  Current Expiry:
                </Typography>
                {(() => {
                  const val = formatValidityInfo(validityDialogUser.validity, validityDialogUser.accountStatus);
                  return (
                    <Chip
                      label={val.text}
                      color={val.color}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 'bold' }}
                    />
                  );
                })()}
              </Box>

              <Box>
                <Typography variant="body2" fontWeight="700" mb={1}>
                  Quick Extend Validity:
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      handleExtendValidity(validityDialogUser.uid, 7);
                      setValidityDialogUser(null);
                    }}
                  >
                    +7 Days
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      handleExtendValidity(validityDialogUser.uid, 15);
                      setValidityDialogUser(null);
                    }}
                  >
                    +15 Days
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      handleExtendValidity(validityDialogUser.uid, 30);
                      setValidityDialogUser(null);
                    }}
                  >
                    +30 Days
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      handleExtendValidity(validityDialogUser.uid, 365);
                      setValidityDialogUser(null);
                    }}
                  >
                    +1 Year
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => {
                      handleExtendValidity(validityDialogUser.uid, null);
                      setValidityDialogUser(null);
                    }}
                  >
                    Unlimited
                  </Button>
                </Stack>
              </Box>

              <Box>
                <Typography variant="body2" fontWeight="700" mb={1}>
                  Custom Days Extension:
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    type="number"
                    label="Days"
                    value={customDaysInput}
                    onChange={(e) => setCustomDaysInput(e.target.value)}
                    sx={{ width: 120 }}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      const days = parseInt(customDaysInput, 10);
                      if (!isNaN(days) && days > 0) {
                        handleExtendValidity(validityDialogUser.uid, days);
                        setValidityDialogUser(null);
                      }
                    }}
                  >
                    Apply Custom
                  </Button>
                </Stack>
              </Box>

              <Box borderTop={`1px solid ${isDark ? '#334155' : '#e2e8f0'}`} pt={2} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" fontWeight="700">
                  Account Access:
                </Typography>
                <Button
                  variant="contained"
                  color={validityDialogUser.accountStatus === 'disabled' ? 'success' : 'error'}
                  size="small"
                  startIcon={validityDialogUser.accountStatus === 'disabled' ? <CheckCircleIcon /> : <BlockIcon />}
                  onClick={() => {
                    handleToggleAccountStatus(validityDialogUser.uid, validityDialogUser.accountStatus);
                    setValidityDialogUser(null);
                  }}
                >
                  {validityDialogUser.accountStatus === 'disabled' ? 'Enable Account' : 'Disable Account'}
                </Button>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setValidityDialogUser(null)} color="inherit" sx={{ fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Alert Notifications */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          severity={snack.type}
          sx={{ width: '100%', borderRadius: 3 }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
