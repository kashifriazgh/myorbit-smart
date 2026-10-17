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
  InputAdornment,
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
  Science as ScienceIcon,
  DeleteSweep as DeleteSweepIcon,
  VerifiedUser as VerifiedUserIcon,
  Search as SearchIcon,
  WarningAmber as WarningAmberIcon,
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
import { getValidityDate, isValidityExpired, isDemoUser } from '@/app/lib/guestUser';

export interface UserRecord {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'master' | 'editor' | 'viewer';
  status?: 'active' | 'pending' | 'rejected';
  accountStatus?: 'active' | 'disabled';
  validity?: unknown;
  createdAt?: { toDate: () => Date };
  isDemoUser?: boolean;
  accountType?: 'demo' | 'permanent';
  isPermanent?: boolean;
  signupDomain?: string;
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

  // Demo user management state
  const [demoSearchQuery, setDemoSearchQuery] = useState('');
  const [demoStatusFilter, setDemoStatusFilter] = useState<'all' | 'active' | 'expired' | 'disabled'>('all');
  const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState<{
    open: boolean;
    type: 'expired' | 'all';
    count: number;
    uids: string[];
  } | null>(null);

  // Auto-switch to demo tab if URL has ?tab=demo
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'demo') {
        setActiveTab(3);
      }
    }
  }, []);

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

  const formatValidityInfo = (validity: unknown, accountStatus?: string) => {
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
      setSnack({ open: true, msg: 'User record deleted successfully.', type: 'success' });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to delete user record.', type: 'error' });
    } finally {
      setActionLoading(null);
      setUserToDelete(null);
    }
  };

  const handleConvertToPermanent = async (uid: string) => {
    setActionLoading(`${uid}-convert`);
    try {
      await updateDoc(doc(db, 'users', uid), {
        isDemoUser: false,
        accountType: 'permanent',
        isPermanent: true,
        validity: null,
        accountStatus: 'active',
      });
      setSnack({
        open: true,
        msg: 'User converted to permanent user successfully (trial expiration removed)!',
        type: 'success',
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to convert user.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchDeleteDemoUsers = async () => {
    if (!batchDeleteConfirm || batchDeleteConfirm.uids.length === 0) return;
    setActionLoading('batch-delete');
    try {
      await Promise.all(
        batchDeleteConfirm.uids.map((id) => deleteDoc(doc(db, 'users', id)))
      );
      setSnack({
        open: true,
        msg: `Successfully deleted ${batchDeleteConfirm.count} demo user record(s)!`,
        type: 'success',
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to delete selected demo users.', type: 'error' });
    } finally {
      setActionLoading(null);
      setBatchDeleteConfirm(null);
    }
  };

  // Filter users based on tabs
  const pendingUsers = users.filter((u) => u.status === 'pending');
  const activeUsers = users.filter((u) => u.status === 'active');
  const rejectedUsers = users.filter((u) => u.status === 'rejected');
  const demoUsers = users.filter((u) => isDemoUser(u));

  const demoActiveUsers = demoUsers.filter(
    (u) => u.accountStatus !== 'disabled' && !isValidityExpired(u.validity)
  );
  const demoExpiredUsers = demoUsers.filter((u) => isValidityExpired(u.validity));
  const demoDisabledUsers = demoUsers.filter((u) => u.accountStatus === 'disabled');

  const filteredDemoUsers = demoUsers.filter((u) => {
    if (demoStatusFilter === 'active') {
      if (u.accountStatus === 'disabled' || isValidityExpired(u.validity)) return false;
    } else if (demoStatusFilter === 'expired') {
      if (!isValidityExpired(u.validity)) return false;
    } else if (demoStatusFilter === 'disabled') {
      if (u.accountStatus !== 'disabled') return false;
    }

    if (demoSearchQuery.trim()) {
      const q = demoSearchQuery.toLowerCase();
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const domain = (u.signupDomain || '').toLowerCase();
      return fullName.includes(q) || email.includes(q) || domain.includes(q);
    }

    return true;
  });

  const filteredUsers =
    activeTab === 0
      ? pendingUsers
      : activeTab === 1
      ? activeUsers
      : activeTab === 2
      ? rejectedUsers
      : filteredDemoUsers;

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
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <ScienceIcon sx={{ fontSize: '1.1rem' }} />
                  <span>Demo Users</span>
                  <Chip
                    label={demoUsers.length}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      bgcolor: demoUsers.length > 0 ? '#9333ea' : (isDark ? '#334155' : '#e2e8f0'),
                      color: demoUsers.length > 0 ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                    }}
                  />
                </Stack>
              }
              sx={{ textTransform: 'none', fontWeight: 800 }}
            />
          </Tabs>
        </Box>

        {/* Demo Users Overview & Controls Bar (Visible on Tab 3) */}
        {activeTab === 3 && (
          <Box mb={3}>
            {/* Demo Metric Stats */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2.5}>
              <Card sx={{ flex: 1, borderRadius: 3, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, boxShadow: 'none' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    TOTAL DEMO USERS
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#9333ea" mt={0.5}>
                    {demoUsers.length}
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, borderRadius: 3, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, boxShadow: 'none' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    ACTIVE IN TRIAL
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="success.main" mt={0.5}>
                    {demoActiveUsers.length}
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, borderRadius: 3, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, boxShadow: 'none' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    TRIAL EXPIRED
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="error.main" mt={0.5}>
                    {demoExpiredUsers.length}
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, borderRadius: 3, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, boxShadow: 'none' }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    DISABLED
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="text.secondary" mt={0.5}>
                    {demoDisabledUsers.length}
                  </Typography>
                </CardContent>
              </Card>
            </Stack>

            {/* Filter and Bulk Actions Bar */}
            <Card sx={{ p: 2, borderRadius: 3, bgcolor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, boxShadow: 'none' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
                <Stack direction="row" spacing={1} flex={1} alignItems="center" flexWrap="wrap">
                  <TextField
                    size="small"
                    placeholder="Search demo users..."
                    value={demoSearchQuery}
                    onChange={(e) => setDemoSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ maxWidth: { xs: '100%', md: 260 }, flex: { xs: 1, md: 'none' } }}
                  />
                  <Stack direction="row" spacing={0.5} sx={{ overflowX: 'auto', py: 0.5 }}>
                    {(['all', 'active', 'expired', 'disabled'] as const).map((filterKey) => (
                      <Chip
                        key={filterKey}
                        label={
                          filterKey === 'all'
                            ? `All (${demoUsers.length})`
                            : filterKey === 'active'
                            ? `Active (${demoActiveUsers.length})`
                            : filterKey === 'expired'
                            ? `Expired (${demoExpiredUsers.length})`
                            : `Disabled (${demoDisabledUsers.length})`
                        }
                        size="small"
                        clickable
                        color={demoStatusFilter === filterKey ? 'primary' : 'default'}
                        variant={demoStatusFilter === filterKey ? 'filled' : 'outlined'}
                        onClick={() => setDemoStatusFilter(filterKey)}
                        sx={{ fontWeight: 700 }}
                      />
                    ))}
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteSweepIcon />}
                    disabled={demoExpiredUsers.length === 0 || actionLoading !== null}
                    onClick={() =>
                      setBatchDeleteConfirm({
                        open: true,
                        type: 'expired',
                        count: demoExpiredUsers.length,
                        uids: demoExpiredUsers.map((u) => u.uid),
                      })
                    }
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                  >
                    Delete Expired ({demoExpiredUsers.length})
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    startIcon={<DeleteIcon />}
                    disabled={demoUsers.length === 0 || actionLoading !== null}
                    onClick={() =>
                      setBatchDeleteConfirm({
                        open: true,
                        type: 'all',
                        count: demoUsers.length,
                        uids: demoUsers.map((u) => u.uid),
                      })
                    }
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                  >
                    Delete All Demo ({demoUsers.length})
                  </Button>
                </Stack>
              </Stack>
            </Card>
          </Box>
        )}

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
                      const isDemo = isDemoUser(u);

                      return (
                        <TableRow key={u.uid} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Avatar sx={{ bgcolor: isDemo ? '#9333ea' : (isDark ? '#334155' : '#f1f5f9'), color: isDark || isDemo ? '#fff' : '#000' }}>
                                {isDemo ? <ScienceIcon fontSize="small" /> : <PersonIcon />}
                              </Avatar>
                              <Box>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <Typography variant="body2" fontWeight="700">
                                    {u.firstName} {u.lastName}
                                  </Typography>
                                  {isDemo && (
                                    <Chip
                                      label="DEMO"
                                      size="small"
                                      sx={{
                                        height: 18,
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        bgcolor: 'rgba(147, 51, 234, 0.15)',
                                        color: '#a855f7',
                                        border: '1px solid rgba(147, 51, 234, 0.3)',
                                      }}
                                    />
                                  )}
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  {u.email}
                                </Typography>
                                {u.signupDomain && (
                                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                                    Domain: {u.signupDomain}
                                  </Typography>
                                )}
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
                            {actionLoading === u.uid || actionLoading === `${u.uid}-role` || actionLoading === `${u.uid}-validity` || actionLoading === `${u.uid}-accountStatus` || actionLoading === `${u.uid}-convert` ? (
                              <CircularProgress size={24} />
                            ) : (
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                {/* Convert Demo User to Permanent User */}
                                {isDemo && (
                                  <Tooltip title="Convert to Permanent User (Removes demo trial limitations)">
                                    <IconButton
                                      color="secondary"
                                      onClick={() => handleConvertToPermanent(u.uid)}
                                      disabled={actionLoading !== null}
                                    >
                                      <VerifiedUserIcon />
                                    </IconButton>
                                  </Tooltip>
                                )}

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
                                  <Tooltip title="Re-Approve User">
                                    <IconButton
                                      color="success"
                                      onClick={() => handleApprove(u.uid)}
                                      disabled={actionLoading !== null}
                                    >
                                      <CheckCircleIcon />
                                    </IconButton>
                                  </Tooltip>
                                )}

                                {/* Permanently Delete Record (Demo users, Tab 3, or Rejected users) */}
                                {(activeTab === 3 || isDemo || u.status === 'rejected') && (
                                  <Tooltip title="Permanently Delete User Record">
                                    <IconButton
                                      color="error"
                                      onClick={() => setUserToDelete(u)}
                                      disabled={actionLoading !== null}
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </Tooltip>
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
                            <Avatar sx={{ bgcolor: isDemoUser(u) ? '#9333ea' : (isDark ? '#334155' : '#f1f5f9'), color: isDark || isDemoUser(u) ? '#fff' : '#000' }}>
                              {isDemoUser(u) ? <ScienceIcon fontSize="small" /> : <PersonIcon />}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="body2" fontWeight="855" noWrap>
                                  {u.firstName} {u.lastName}
                                </Typography>
                                {isDemoUser(u) && (
                                  <Chip
                                    label="DEMO"
                                    size="small"
                                    sx={{
                                      height: 18,
                                      fontSize: '0.65rem',
                                      fontWeight: 800,
                                      bgcolor: 'rgba(147, 51, 234, 0.15)',
                                      color: '#a855f7',
                                      border: '1px solid rgba(147, 51, 234, 0.3)',
                                    }}
                                  />
                                )}
                              </Stack>
                              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                {u.email}
                              </Typography>
                              {u.signupDomain && (
                                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.7rem', color: isDark ? '#94a3b8' : '#64748b' }}>
                                  Domain: {u.signupDomain}
                                </Typography>
                              )}
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
                            {actionLoading === u.uid || actionLoading === `${u.uid}-role` || actionLoading === `${u.uid}-convert` ? (
                              <CircularProgress size={20} />
                            ) : (
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                                {/* Convert Demo User to Permanent */}
                                {isDemoUser(u) && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<VerifiedUserIcon />}
                                    onClick={() => handleConvertToPermanent(u.uid)}
                                    disabled={actionLoading !== null}
                                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                                  >
                                    Make Permanent
                                  </Button>
                                )}

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
                                )}

                                {/* Delete User Record (Available for Demo users, Tab 3, or Rejected users) */}
                                {(activeTab === 3 || isDemoUser(u) || u.status === 'rejected') && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => setUserToDelete(u)}
                                    disabled={actionLoading !== null}
                                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                                  >
                                    Delete
                                  </Button>
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

              {/* Conversion Option for Demo Users inside Dialog */}
              {isDemoUser(validityDialogUser) && (
                <Box borderTop={`1px solid ${isDark ? '#334155' : '#e2e8f0'}`} pt={2} display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" fontWeight="700">
                      Convert to Permanent:
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Removes demo restriction & expiration
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="secondary"
                    size="small"
                    startIcon={<VerifiedUserIcon />}
                    onClick={() => {
                      handleConvertToPermanent(validityDialogUser.uid);
                      setValidityDialogUser(null);
                    }}
                  >
                    Make Permanent
                  </Button>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setValidityDialogUser(null)} color="inherit" sx={{ fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog
        open={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
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
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="error" />
          <span>Delete User Record</span>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          {userToDelete && (
            <Stack spacing={2}>
              <Typography variant="body2">
                Are you sure you want to permanently delete this user record? This action cannot be undone.
              </Typography>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: isDark ? '#0f172a' : '#f8fafc', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                <Typography variant="subtitle2" fontWeight="700">
                  {userToDelete.firstName} {userToDelete.lastName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {userToDelete.email}
                </Typography>
                {isDemoUser(userToDelete) && (
                  <Box mt={1}>
                    <Chip label="DEMO USER" size="small" sx={{ fontWeight: 800, fontSize: '0.65rem', bgcolor: '#9333ea', color: '#fff' }} />
                  </Box>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setUserToDelete(null)} color="inherit" sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            onClick={() => userToDelete && handleDelete(userToDelete.uid)}
            color="error"
            variant="contained"
            disabled={actionLoading !== null}
            startIcon={actionLoading === userToDelete?.uid ? <CircularProgress size={16} /> : <DeleteIcon />}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Delete Demo Users Confirmation Dialog */}
      <Dialog
        open={Boolean(batchDeleteConfirm?.open)}
        onClose={() => setBatchDeleteConfirm(null)}
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
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteSweepIcon color="error" />
          <span>
            {batchDeleteConfirm?.type === 'expired'
              ? 'Delete Expired Demo Users'
              : 'Delete All Demo Users'}
          </span>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
          <Stack spacing={2}>
            <Typography variant="body2">
              {batchDeleteConfirm?.type === 'expired'
                ? `Are you sure you want to permanently delete all ${batchDeleteConfirm?.count} expired demo user record(s)?`
                : `Are you sure you want to permanently delete all ${batchDeleteConfirm?.count} demo user record(s) from the system?`}
            </Typography>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              This will remove the selected demo user documents from the Firestore users database.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBatchDeleteConfirm(null)} color="inherit" sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            onClick={handleBatchDeleteDemoUsers}
            color="error"
            variant="contained"
            disabled={actionLoading === 'batch-delete'}
            startIcon={actionLoading === 'batch-delete' ? <CircularProgress size={16} /> : <DeleteSweepIcon />}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Delete {batchDeleteConfirm?.count} Users
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
