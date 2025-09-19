'use client';

import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  TableContainer,
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { auth, db } from '@/app/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import Link from 'next/link';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface MasterUser {
  uid: string;
  email: string;
  role?: string;
}

interface SubUser {
  id: string;
  email?: string;
  invitedBy?: string;
  role?: 'viewer' | 'editor';
  status?: 'invited' | 'accepted';
  invitedAt?: {
    toDate: () => Date;
  };
}

export default function ManageUsersPage() {
  const { theme } = useCustomTheme();
  const [showAddUser, setShowAddUser] = useState(false);

  const [masterUser, setMasterUser] = useState<MasterUser | null>(null);
  const [users, setUsers] = useState<SubUser[]>([]);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string | string | React.ReactNode;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, msg: '', type: 'success' });

  const [usersLimit, setUsersLimit] = useState(1);

  // Fetch users limit from API
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        const config = await response.json();
        setUsersLimit(config.usersLimit);
      } catch (error) {
        console.error('Failed to fetch config:', error);
        setUsersLimit(1); // fallback to default
      }
    };
    fetchConfig();
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!masterUser) return;
    const q = query(
      collection(db, 'invites'),
      where('invitedBy', '==', masterUser.uid)
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setUsers(list);
  }, [masterUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setMasterUser(user);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (masterUser) fetchUsers();
  }, [masterUser, fetchUsers]);

  const handleCreate = async () => {
    // 🔍 Verify master user role
    if (!masterUser) {
      setSnack({
        open: true,
        msg: 'You must be logged in to create users.',
        type: 'error',
      });
      return;
    }

    // Check if current user has master role
    const userDoc = await getDoc(doc(db, 'users', masterUser.uid));
    const userData = userDoc.data();
    if (!userData || userData.role !== 'master') {
      setSnack({
        open: true,
        msg: 'Only master users can create sub-users.',
        type: 'error',
      });
      return;
    }

    // 🔍 Check user limit
    if (users.length >= usersLimit) {
      setSnack({
        open: true,
        msg: `You have reached the maximum limit of ${usersLimit} sub-user(s).`,
        type: 'error',
      });
      return;
    }

    if (!email) {
      setSnack({ open: true, msg: 'Email is required.', type: 'error' });
      return;
    }

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidEmail) {
      setSnack({ open: true, msg: 'Invalid email address.', type: 'error' });
      return;
    }

    // 🔍 Check if email already invited
    const inviteSnap = await getDoc(doc(db, 'invites', email));
    if (inviteSnap.exists()) {
      setSnack({
        open: true,
        msg: 'This email is already invited.',
        type: 'error',
      });
      return;
    }

    // 🔍 Check if email already registered
    const userSnap = await getDocs(
      query(collection(db, 'users'), where('email', '==', email))
    );
    if (!userSnap.empty) {
      setSnack({
        open: true,
        msg: 'This email is already registered.',
        type: 'error',
      });
      return;
    }
    setLoading(true); // 🔸 START LOADING

    // Proceed to invite...
    try {
      await setDoc(doc(db, 'invites', email), {
        email,
        invitedBy: masterUser.uid,
        role,
        status: 'invited',
        invitedAt: Timestamp.now(),
      });

      setEmail('');
      setSnack({
        open: true,
        type: 'success',
        msg: (
          <>
            User invited successfully! Ask them to visit{' '}
            <Link href="/user/signup" style={{ color: 'lightblue' }}>
              /user/signup
            </Link>{' '}
            and register using the same email.
          </>
        ),
      });

      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to invite user.', type: 'error' });
    }
  };

  // handle create end here

  const handleChangeRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'viewer' ? 'editor' : 'viewer';
    try {
      const ref = doc(db, 'invites', id);
      await updateDoc(ref, { role: newRole });
      setSnack({
        open: true,
        msg: `Role changed to ${newRole}.`,
        type: 'info',
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to change role.', type: 'error' });
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'invites', id));
      setSnack({ open: true, msg: 'User deleted.', type: 'success' });
      fetchUsers();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: 'Failed to delete user.', type: 'error' });
    }
  };

  return (
    <Box
      maxWidth="1000px"
      mx="auto"
      mt={4}
      className="p-4"
      sx={{
        backgroundColor: theme?.mode === 'dark' ? '#1e293b' : '#ffffff',
        color: theme?.mode === 'dark' ? '#f1f5f9' : '#000000',
        minHeight: '100vh',
        borderRadius: theme?.mode === 'dark' ? '8px' : '0px',
      }}
    >
      <Typography variant="h5" mb={2}>
        Manage Users
      </Typography>

      {masterUser && (
        <Box mb={3} p={2} bgcolor="#f5f5f5" borderRadius={2} boxShadow={1}>
          <Typography variant="h6">Master Account Info</Typography>
          <Typography>
            Email: <strong>{masterUser.email}</strong>
          </Typography>
          <Typography>
            UID: <strong>{masterUser.uid}</strong>
          </Typography>
        </Box>
      )}

      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Button
          onClick={() => setShowAddUser((prev) => !prev)}
          endIcon={showAddUser ? <ExpandLess /> : <ExpandMore />}
          disabled={users.length >= usersLimit}
        >
          {showAddUser ? 'Hide Add User' : 'Add New Sub-User'}
        </Button>
        <Typography variant="body2" color="text.secondary">
          ({users.length}/{usersLimit} users)
        </Typography>
        {users.length >= usersLimit && (
          <Typography variant="body2" color="error">
            Limit reached
          </Typography>
        )}
      </Box>

      <Collapse in={showAddUser} timeout="auto" unmountOnExit>
        <Box mt={2}>
          <TextField
            fullWidth
            label="Sub-user Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
          />
          <Select
            fullWidth
            value={role}
            onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
          >
            <MenuItem value="viewer">Viewer</MenuItem>
            <MenuItem value="editor">Editor</MenuItem>
          </Select>
          <Button
            sx={{ mt: 2 }}
            onClick={handleCreate}
            variant="contained"
            disabled={loading || users.length >= usersLimit}
          >
            {loading ? <CircularProgress size={20} /> : 'Add User'}
          </Button>
          {users.length >= usersLimit && (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              Cannot add more users. Limit of {usersLimit} reached.
            </Typography>
          )}
        </Box>
      </Collapse>

      <Box mt={4}>
        <Typography variant="h6" mb={1}>
          Current Sub-Users ({users.length})
        </Typography>
        {users.length > 0 ? (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Invited At</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.role}</TableCell>
                    <TableCell>{u.status}</TableCell>
                    <TableCell>
                      {u.invitedAt?.toDate
                        ? u.invitedAt.toDate().toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={() => handleChangeRole(u.id, u.role)}
                      >
                        <SwapHorizIcon />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteUser(u.id)}>
                        <DeleteIcon color="error" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography>No sub-users found.</Typography>
        )}
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
