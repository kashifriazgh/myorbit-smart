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
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  SwapHoriz as SwapHorizIcon,
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Shield as ShieldIcon,
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
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface UserRecord {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'master' | 'editor' | 'viewer';
  status?: 'active' | 'pending' | 'rejected';
  createdAt?: { toDate: () => Date };
}

export default function ManageUsersPage() {
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';
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
            variant="fullWidth"
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
          <TableContainer
            component={Paper}
            sx={{
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
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
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
                          <Typography variant="body2" color="text.secondary">
                            {regDate}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 3 }}>
                          {actionLoading === u.uid ? (
                            <CircularProgress size={24} />
                          ) : (
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
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
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <Typography variant="body2" color="text.secondary">
                        No users found in this section.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

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
