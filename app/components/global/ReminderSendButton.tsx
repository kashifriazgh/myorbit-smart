'use client';

import React, { useState } from 'react';
import {
  IconButton,
  Button,
  Menu,
  MenuItem,
  Box,
  Divider,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/NotificationsActive';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface ReminderSendButtonProps {
  itemId: string;
  itemTitle: string;
  itemType: 'task' | 'schedule';
  itemDetailUrl: string;
  buttonType?: 'icon' | 'button';
  iconSize?: 'small' | 'medium' | 'large';
  buttonSx?: object;
}

export default function ReminderSendButton({
  itemId: _itemId,
  itemTitle,
  itemType,
  itemDetailUrl,
  buttonType = 'icon',
  iconSize = 'medium',
  buttonSx = {},
}: ReminderSendButtonProps) {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = (event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setAnchorEl(null);
  };

  const handleSendReminder = async (targetUid: string) => {
    if (!user) return;
    handleCloseMenu();
    setSending(true);

    try {
      const { userAuth } = await import('@/app/lib/firebase');
      const idToken = await userAuth.currentUser?.getIdToken(true);
      if (!idToken) {
        throw new Error('Could not retrieve authentication session token.');
      }

      const senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName || 'User';

      const res = await fetch('/api/send-test-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          targetUid,
          title: `Reminder: ${itemType === 'task' ? 'Task' : 'Schedule'} Alert ⏰`,
          bodyText: `${senderName} wants to remind you about: "${itemTitle}"`,
          appUrl: itemDetailUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch notification.');
      }

      setFeedback({
        open: true,
        message: 'Reminder notification sent successfully!',
        severity: 'success',
      });
    } catch (err) {
      console.error('Failed to send reminder notification:', err);
      setFeedback({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to send reminder.',
        severity: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const handleCloseFeedback = () => {
    setFeedback((prev) => ({ ...prev, open: false }));
  };

  // If there are no shared users, we don't display the reminder send button/icon
  if (!user?.sharedWith || user.sharedWith.length === 0) {
    return null;
  }

  return (
    <>
      {buttonType === 'icon' ? (
        <IconButton
          size={iconSize}
          disabled={sending}
          onClick={handleOpenMenu}
          title="Send Reminder Notification"
          sx={{
            color: isDark ? '#94a3b8' : '#64748b',
            '&:hover': { color: '#6366f1' },
            ...buttonSx,
          }}
        >
          {sending ? (
            <CircularProgress size={iconSize === 'small' ? 14 : 20} color="inherit" />
          ) : (
            <NotificationsIcon sx={{ fontSize: iconSize === 'small' ? '1rem' : '1.25rem' }} />
          )}
        </IconButton>
      ) : (
        <Button
          variant="outlined"
          disabled={sending}
          onClick={handleOpenMenu}
          startIcon={
            sending ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <NotificationsIcon />
            )
          }
          sx={{
            borderRadius: '14px',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.9rem',
            px: 3,
            py: 1.5,
            borderColor: '#e2e8f0',
            color: isDark ? '#f1f5f9' : '#475569',
            backgroundColor: isDark ? '#1e293b' : '#f8fafc',
            '&:hover': {
              borderColor: '#6366f1',
              backgroundColor: isDark ? '#334155' : '#eff6ff',
              color: '#6366f1',
            },
            ...buttonSx,
          }}
        >
          {sending ? 'Sending...' : 'Send Reminder'}
        </Button>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => handleCloseMenu()}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: {
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#0f172a',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: '12px',
            minWidth: '200px',
            py: 0.5,
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 0.75,
            opacity: 0.6,
            fontSize: '0.65rem',
            fontWeight: 850,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Send Reminder
        </Box>
        <Divider sx={{ my: 0.5, borderColor: isDark ? '#334155' : '#e2e8f0' }} />
        {user.sharedWith.map((su) => (
          <MenuItem
            key={su.uid}
            onClick={() => handleSendReminder(su.uid)}
            sx={{ fontSize: '0.8rem', fontWeight: 600, py: 1 }}
          >
            💬 Send to {su.displayName}
          </MenuItem>
        ))}
      </Menu>

      <Snackbar
        open={feedback.open}
        autoHideDuration={3000}
        onClose={handleCloseFeedback}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseFeedback}
          severity={feedback.severity}
          sx={{ width: '100%', borderRadius: '12px' }}
        >
          {feedback.message}
        </Alert>
      </Snackbar>
    </>
  );
}
