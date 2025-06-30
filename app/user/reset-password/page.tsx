'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/app/lib/firebase';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [snack, setSnack] = useState({
    open: false,
    message: '',
    type: 'success' as 'success' | 'error',
  });
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      return setSnack({
        open: true,
        message: 'Please enter your email.',
        type: 'error',
      });
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSnack({
        open: true,
        message: 'Reset email sent. Please check your inbox.',
        type: 'success',
      });
    } catch (err) {
      console.error(err);
      let message = 'Failed to send reset email.';
      if (err.code === 'auth/user-not-found') {
        message = 'No user found with this email.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      }
      setSnack({ open: true, message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxWidth={400} mx="auto" mt={10}>
      <Typography variant="h5" mb={2}>
        Reset Password
      </Typography>

      <TextField
        fullWidth
        label="Email"
        margin="normal"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <Button
        variant="contained"
        fullWidth
        onClick={handleReset}
        disabled={loading}
        sx={{ mt: 2 }}
      >
        {loading ? 'Sending...' : 'Send Reset Email'}
      </Button>

      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.type} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
