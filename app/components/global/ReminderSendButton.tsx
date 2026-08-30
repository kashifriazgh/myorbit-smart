'use client';

import React, { useState } from 'react';
import moment from 'moment';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  Typography,
  TextField,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/NotificationsActive';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { collection, getDocs } from 'firebase/firestore';
import { userDb } from '@/app/lib/firebase';

interface ReminderSendButtonProps {
  itemId: string;
  itemTitle: string;
  itemType: 'task' | 'schedule';
  itemDetailUrl: string;
  buttonType?: 'icon' | 'button';
  iconSize?: 'small' | 'medium' | 'large';
  buttonSx?: object;
  itemDateTime?: Date | string | null;
  customItemTypeName?: string;
}

export default function ReminderSendButton({
  itemId: _itemId,
  itemTitle,
  itemType,
  itemDetailUrl,
  buttonType = 'icon',
  iconSize = 'medium',
  buttonSx = {},
  itemDateTime = null,
  customItemTypeName: _customItemTypeName,
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

  // Scheduling states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>('15_before');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [customMinutes, setCustomMinutes] = useState<number>(45);

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

      const isSelf = targetUid === user.uid;
      const notificationMessage = isSelf
        ? `${itemType === 'task' ? 'Task Reminder' : 'Schedule Reminder'} : ${itemTitle}`
        : `${senderName} wants you to remind about ${itemType === 'task' ? 'task' : 'schedule'}: "${itemTitle}"`;

      const res = await fetch('/api/send-test-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          targetUid,
          title: 'MyOrbit Reminder ⏰',
          bodyText: notificationMessage,
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

  const parsedDateTime = itemDateTime ? new Date(itemDateTime) : null;
  const isDateTimeValid = parsedDateTime && !isNaN(parsedDateTime.getTime());

  const calculateReminderDate = () => {
    const baseDate = isDateTimeValid ? parsedDateTime! : new Date();
    
    switch (selectedSlot) {
      case '2_now':
        return new Date(Date.now() + 2 * 60000);
      case 'at_time':
        return baseDate;
      case '5_before':
        return new Date(baseDate.getTime() - 5 * 60000);
      case '15_before':
        return new Date(baseDate.getTime() - 15 * 60000);
      case '30_before':
        return new Date(baseDate.getTime() - 30 * 60000);
      case '1h_before':
        return new Date(baseDate.getTime() - 60 * 60000);
      case '1d_before':
        return new Date(baseDate.getTime() - 24 * 60 * 60000);
      case 'custom':
        return new Date(Date.now() + customMinutes * 60000);
      default:
        return new Date(Date.now() + 15 * 60000);
    }
  };

  const handleScheduleSubmit = async () => {
    if (!user || selectedRecipients.length === 0) return;
    setSending(true);
    setDialogOpen(false);

    try {
      const { createWhatsAppReminder } = await import('@/app/lib/utils/whatsapp-reminder');
      
      const computedDate = calculateReminderDate();
      // If calculated date is in the past, fall back to 2 minutes from now
      const reminderDate = computedDate.getTime() <= Date.now()
        ? new Date(Date.now() + 2 * 60000)
        : computedDate;
        
      const senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName || 'User';

      // Schedule for each selected user
      const promises = selectedRecipients.map(async (targetUid) => {
        const isSelf = targetUid === user.uid;
        const messageText = isSelf
          ? `${itemType === 'task' ? 'Task Reminder' : 'Schedule Reminder'} : ${itemTitle}`
          : `${senderName} wants you to remind about ${itemType === 'task' ? 'task' : 'schedule'}: "${itemTitle}"`;

        // Fetch target user's active device tokens (FIDs) from Firestore once
        const deviceCol = collection(userDb, 'users', targetUid, 'notificationDevices');
        const deviceSnapshot = await getDocs(deviceCol);
        const activeTokens: string[] = [];
        deviceSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.enabled && data.fid) {
            activeTokens.push(data.fid);
          }
        });

        if (activeTokens.length === 0) {
          console.warn(`No active device tokens found in Firestore for user ${targetUid}`);
        }

        const config = {
          userId: targetUid,
          phone: '',
          clientId: `user_${user.uid}`,
          itemType: (itemType === 'task' ? 'todo' : 'schedule') as 'todo' | 'schedule',
          customMessage: messageText,
          notificationTitle: 'MyOrbit Reminder ⏰',
          method: 'push' as const,
          tokens: activeTokens,
        };

        return createWhatsAppReminder(
          {
            id: _itemId,
            title: itemTitle,
            reminderDate,
            priority: 'medium',
          },
          config
        );
      });

      await Promise.all(promises);

      setFeedback({
        open: true,
        message: `Successfully scheduled reminder for ${moment(reminderDate).format('hh:mm A (MMM D)')}!`,
        severity: 'success',
      });
    } catch (err) {
      console.error('Failed to schedule reminder:', err);
      setFeedback({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to schedule reminder.',
        severity: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const handleCloseFeedback = () => {
    setFeedback((prev) => ({ ...prev, open: false }));
  };

  if (!user) {
    return null;
  }

  const hasSharedUsers = user.sharedWith && user.sharedWith.length > 0;
  const computedReminderDate = calculateReminderDate();
  const isPast = computedReminderDate.getTime() <= Date.now();

  return (
    <>
      {buttonType === 'icon' ? (
        <IconButton
          size={iconSize}
          disabled={sending}
          onClick={handleOpenMenu}
          title="Send / Schedule Reminder"
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
          {sending ? 'Sending...' : 'Reminder Options'}
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
            minWidth: '220px',
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
          Notification Options
        </Box>
        <Divider sx={{ my: 0.5, borderColor: isDark ? '#334155' : '#e2e8f0' }} />
        
        {hasSharedUsers && [
          <Box key="instant-title" sx={{ px: 2, py: 0.5, fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary' }}>
            ⚡ Send Instant Reminder
          </Box>,
          ...user.sharedWith.map((su) => (
            <MenuItem
              key={su.uid}
              onClick={() => handleSendReminder(su.uid)}
              sx={{ fontSize: '0.8rem', fontWeight: 600, py: 0.75, pl: 3 }}
            >
              📲 Send to {su.displayName}
            </MenuItem>
          )),
          <Divider key="instant-divider" sx={{ my: 0.5, borderColor: isDark ? '#334155' : '#e2e8f0' }} />
        ]}

        {/* Scheduled Notification section */}
        <MenuItem
          onClick={() => {
            handleCloseMenu();
            setSelectedRecipients([user.uid]);
            setSelectedSlot(isDateTimeValid ? '15_before' : '2_now');
            setDialogOpen(true);
          }}
          sx={{ fontSize: '0.8rem', fontWeight: 700, py: 1 }}
        >
          ⏰ Schedule Reminder...
        </MenuItem>
      </Menu>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1.5,
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#0f172a',
            backgroundImage: 'none',
            maxWidth: '400px',
            width: '100%',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 1 }}>
          ⏰ Schedule Reminder
        </DialogTitle>
        <DialogContent sx={{ py: 1 }}>
          <Typography variant="body2" sx={{ mb: 3, opacity: 0.8, fontSize: '0.85rem' }}>
            Set a scheduled push reminder for <strong>&quot;{itemTitle}&quot;</strong>.
          </Typography>

          {/* Guidance / Help banner */}
          <Box 
            sx={{ 
              p: 1.5, 
              mb: 2.5, 
              borderRadius: '12px', 
              bgcolor: isDark ? '#1e293b' : '#f8fafc', 
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` 
            }}
          >
            <Typography variant="caption" sx={{ display: 'flex', gap: 1, fontWeight: 700, color: isDark ? '#94a3b8' : '#475569' }}>
              💡 Predefined time slots selection
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.8, color: 'inherit', lineHeight: 1.4 }}>
              Predefined slots schedule reminders relative to the current time or scheduled/due time. If a selected slot falls in the past, it automatically triggers in 2 minutes as a safe fallback.
            </Typography>
          </Box>

          {/* Time delay select */}
          <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
            <FormLabel 
              component="legend" 
              sx={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: isDark ? '#94a3b8' : '#475569',
                mb: 1,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              🗓 When to remind?
            </FormLabel>
            <RadioGroup
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
              sx={{ gap: 1 }}
            >
              {/* Quick test option */}
              <FormControlLabel
                value="2_now"
                control={<Radio size="small" sx={{ color: isDark ? '#475569' : '#cbd5e1', '&.Mui-checked': { color: '#6366f1' } }} />}
                label="⚡ Quick Test: In 2 minutes from now"
                sx={{
                  m: 0,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '12px',
                  border: `1.5px solid ${selectedSlot === '2_now' ? '#6366f1' : (isDark ? '#334155' : '#e2e8f0')}`,
                  bgcolor: selectedSlot === '2_now' ? (isDark ? 'rgba(99, 102, 241, 0.15)' : '#eff6ff') : 'transparent',
                  '& .MuiTypography-root': { fontSize: '0.8rem', fontWeight: 700, color: selectedSlot === '2_now' ? '#6366f1' : 'inherit' }
                }}
              />

              {/* Relative options section header */}
              <Box sx={{ mt: 1, mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: isDark ? '#94a3b8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🕒 Relative to start/due time
                </Typography>
              </Box>

              {[
                { label: 'At time', value: 'at_time' },
                { label: '5 min before', value: '5_before' },
                { label: '15 min before (default)', value: '15_before' },
                { label: '30 min before', value: '30_before' },
                { label: '1 hour before', value: '1h_before' },
                { label: '1 day before', value: '1d_before' },
              ].map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  value={opt.value}
                  disabled={!isDateTimeValid}
                  control={
                    <Radio 
                      size="small" 
                      sx={{
                        color: isDark ? '#475569' : '#cbd5e1',
                        '&.Mui-checked': { color: '#6366f1' },
                        '&.Mui-disabled': { color: isDark ? '#1e293b' : '#f1f5f9' }
                      }}
                    />
                  }
                  label={opt.label}
                  sx={{
                    m: 0,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: '12px',
                    border: `1.5px solid ${selectedSlot === opt.value ? '#6366f1' : (isDark ? '#334155' : '#e2e8f0')}`,
                    bgcolor: selectedSlot === opt.value ? (isDark ? 'rgba(99, 102, 241, 0.15)' : '#eff6ff') : 'transparent',
                    opacity: isDateTimeValid ? 1 : 0.5,
                    '& .MuiTypography-root': {
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: selectedSlot === opt.value ? '#6366f1' : 'inherit'
                    }
                  }}
                />
              ))}

              {/* Custom option */}
              <Box sx={{ mt: 1, mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: isDark ? '#94a3b8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ⚙️ Custom interval
                </Typography>
              </Box>

              <FormControlLabel
                value="custom"
                control={<Radio size="small" sx={{ color: isDark ? '#475569' : '#cbd5e1', '&.Mui-checked': { color: '#6366f1' } }} />}
                label="Custom delay in minutes..."
                sx={{
                  m: 0,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '12px',
                  border: `1.5px solid ${selectedSlot === 'custom' ? '#6366f1' : (isDark ? '#334155' : '#e2e8f0')}`,
                  bgcolor: selectedSlot === 'custom' ? (isDark ? 'rgba(99, 102, 241, 0.15)' : '#eff6ff') : 'transparent',
                  '& .MuiTypography-root': { fontSize: '0.8rem', fontWeight: 700, color: selectedSlot === 'custom' ? '#6366f1' : 'inherit' }
                }}
              />
            </RadioGroup>
          </FormControl>

          {selectedSlot === 'custom' && (
            <Box sx={{ mb: 2.5 }}>
              <TextField
                label="Custom Delay (Minutes)"
                type="number"
                fullWidth
                size="small"
                value={customMinutes}
                onChange={(e) => {
                  const val = Math.max(5, Math.round(Number(e.target.value) / 5) * 5); // force 5 minute interval
                  setCustomMinutes(val);
                }}
                inputProps={{
                  min: 5,
                  step: 5,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                  },
                }}
              />
            </Box>
          )}

          {/* Time Preview Box */}
          <Box 
            sx={{ 
              p: 1.5, 
              mb: 3, 
              borderRadius: '12px', 
              bgcolor: isPast ? (isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2') : (isDark ? 'rgba(99, 102, 241, 0.05)' : '#f5f3ff'), 
              border: `1px dashed ${isPast ? '#ef4444' : (isDark ? '#4f46e5' : '#c7d2fe')}`,
              textAlign: 'center'
            }}
          >
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: isPast ? '#ef4444' : '#6366f1' }}>
              {isPast ? '⚠️ trigger fall-back (past selected time):' : '⏰ Reminder will trigger at:'}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: isPast ? '#ef4444' : (isDark ? '#f1f5f9' : '#1e293b'), mt: 0.5 }}>
              {moment(isPast ? new Date(Date.now() + 2 * 60000) : computedReminderDate).format('hh:mm A (dddd, MMMM D)')}
            </Typography>
          </Box>

          {/* Recipient select checkboxes */}
          <FormControl component="fieldset" fullWidth>
            <FormLabel 
              component="legend" 
              sx={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: isDark ? '#94a3b8' : '#475569',
                mb: 1,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              👤 Send reminder to:
            </FormLabel>
            <FormGroup sx={{ gap: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedRecipients.includes(user.uid)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedRecipients(prev => 
                        checked ? [...prev, user.uid] : prev.filter(id => id !== user.uid)
                      );
                    }}
                    size="small"
                    sx={{ color: isDark ? '#475569' : '#cbd5e1', '&.Mui-checked': { color: '#6366f1' } }}
                  />
                }
                label="Myself (Self)"
                sx={{
                  m: 0,
                  px: 1,
                  py: 0.5,
                  borderRadius: '8px',
                  '&:hover': { bgcolor: isDark ? '#273549' : '#f8fafc' },
                  '& .MuiTypography-root': { fontSize: '0.8rem', fontWeight: 600 }
                }}
              />
              
              {user.sharedWith && user.sharedWith.map((su) => (
                <FormControlLabel
                  key={su.uid}
                  control={
                    <Checkbox
                      checked={selectedRecipients.includes(su.uid)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedRecipients(prev => 
                          checked ? [...prev, su.uid] : prev.filter(id => id !== su.uid)
                        );
                      }}
                      size="small"
                      sx={{ color: isDark ? '#475569' : '#cbd5e1', '&.Mui-checked': { color: '#6366f1' } }}
                    />
                  }
                  label={su.displayName}
                  sx={{
                    m: 0,
                    px: 1,
                    py: 0.5,
                    borderRadius: '8px',
                    '&:hover': { bgcolor: isDark ? '#273549' : '#f8fafc' },
                    '& .MuiTypography-root': { fontSize: '0.8rem', fontWeight: 600 }
                  }}
                />
              ))}
            </FormGroup>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pt: 2, pb: 1, gap: 1 }}>
          <Button
            onClick={() => setDialogOpen(false)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: isDark ? '#94a3b8' : '#64748b',
              borderRadius: '12px',
              px: 2.5,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleScheduleSubmit}
            variant="contained"
            disabled={selectedRecipients.length === 0 || sending}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '12px',
              px: 3,
              bgcolor: '#6366f1',
              '&:hover': { bgcolor: '#4f46e5' },
              '&.Mui-disabled': {
                bgcolor: isDark ? '#334155' : '#cbd5e1',
                color: isDark ? '#64748b' : '#94a3b8',
              }
            }}
          >
            {sending ? 'Scheduling...' : 'Schedule'}
          </Button>
        </DialogActions>
      </Dialog>

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
