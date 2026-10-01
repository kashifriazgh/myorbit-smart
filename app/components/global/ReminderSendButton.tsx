'use client';

import React, { useState } from 'react';
import moment from 'moment';
import {
  IconButton,
  Button,
  Box,
  Divider,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogContent,
  Typography,
  TextField,
  Checkbox,
  FormControlLabel,
  FormGroup,
} from '@mui/material';
import {
  NotificationsActive as NotificationsIcon,
  Close as CloseIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, userDb } from '@/app/lib/firebase';

interface ReminderSendButtonProps {
  itemId: string;
  itemTitle: string;
  itemType: 'task' | 'schedule';
  itemDetailUrl: string;
  buttonType?: 'icon' | 'button';
  iconSize?: 'small' | 'medium' | 'large';
  buttonSx?: object;
  itemDateTime?: Date | string | { seconds: number } | null;
  customItemTypeName?: string;
  customTrigger?: (openDialog: (e: React.MouseEvent<HTMLElement>) => void) => React.ReactNode;
}

export interface TimePeriod {
  id: string;
  name: string;
  range: string;
  icon: string;
  hours: { value: string; label: string }[];
}

export const TIME_PERIODS: TimePeriod[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    range: '12 AM – 4 AM',
    icon: '🌙',
    hours: [
      { value: '01:00', label: '1 AM' },
      { value: '02:00', label: '2 AM' },
      { value: '03:00', label: '3 AM' },
    ],
  },
  {
    id: 'dawn',
    name: 'Dawn',
    range: '4 AM – 7 AM',
    icon: '🌅',
    hours: [
      { value: '04:00', label: '4 AM' },
      { value: '05:00', label: '5 AM' },
      { value: '06:00', label: '6 AM' },
    ],
  },
  {
    id: 'morning',
    name: 'Morning',
    range: '7 AM – 10 AM',
    icon: '☀️',
    hours: [
      { value: '07:00', label: '7 AM' },
      { value: '08:00', label: '8 AM' },
      { value: '09:00', label: '9 AM' },
    ],
  },
  {
    id: 'late_morning',
    name: 'Late Morning',
    range: '10 AM – 12 PM',
    icon: '🌤️',
    hours: [
      { value: '10:00', label: '10 AM' },
      { value: '11:00', label: '11 AM' },
      { value: '12:00', label: '12 PM' },
    ],
  },
  {
    id: 'afternoon',
    name: 'Afternoon',
    range: '12 PM – 4 PM',
    icon: '🌞',
    hours: [
      { value: '13:00', label: '1 PM' },
      { value: '14:00', label: '2 PM' },
      { value: '15:00', label: '3 PM' },
    ],
  },
  {
    id: 'evening',
    name: 'Evening',
    range: '4 PM – 7 PM',
    icon: '🌇',
    hours: [
      { value: '16:00', label: '4 PM' },
      { value: '17:00', label: '5 PM' },
      { value: '18:00', label: '6 PM' },
    ],
  },
  {
    id: 'night',
    name: 'Night',
    range: '7 PM – 10 PM',
    icon: '🌆',
    hours: [
      { value: '19:00', label: '7 PM' },
      { value: '20:00', label: '8 PM' },
      { value: '21:00', label: '9 PM' },
    ],
  },
  {
    id: 'late_night',
    name: 'Late Night',
    range: '10 PM – 12 AM',
    icon: '🌙',
    hours: [
      { value: '22:00', label: '10 PM' },
      { value: '23:00', label: '11 PM' },
      { value: '00:00', label: '12 AM' },
    ],
  },
];

function getComingSundayStr(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 7 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
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
  customTrigger,
}: ReminderSendButtonProps) {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'success' });

  // Unsubscribed Notice Dialog State
  const [unsubscribedNotice, setUnsubscribedNotice] = useState<{
    open: boolean;
    userName: string;
  }>({ open: false, userName: '' });

  // Dialog & Minimal Picker States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);

  // Predefined Dates
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const sundayStr = getComingSundayStr();

  const [dateChoice, setDateChoice] = useState<'today' | 'tomorrow' | 'sunday' | 'custom'>('today');
  const [customDateVal, setCustomDateVal] = useState<string>(todayStr);

  // Time Period & Hour Selector States
  const [activePeriodId, setActivePeriodId] = useState<string>('morning');
  const [timeChoice, setTimeChoice] = useState<string>('07:00');
  const [customTimeVal, setCustomTimeVal] = useState<string>('09:00');

  // Sync date & time from itemDateTime if provided
  React.useEffect(() => {
    if (itemDateTime) {
      let parsed: Date | null = null;
      if (itemDateTime instanceof Date) {
        parsed = itemDateTime;
      } else if (typeof itemDateTime === 'object' && itemDateTime !== null && 'seconds' in itemDateTime) {
        parsed = new Date(itemDateTime.seconds * 1000);
      } else if (typeof itemDateTime === 'string') {
        const d = new Date(itemDateTime);
        if (!isNaN(d.getTime())) parsed = d;
      }

      if (parsed) {
        const yyyy = parsed.getFullYear();
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        const hours = String(parsed.getHours()).padStart(2, '0');
        const minutes = String(parsed.getMinutes()).padStart(2, '0');
        const ds = `${yyyy}-${mm}-${dd}`;
        const ts = `${hours}:${minutes}`;

        if (ds === todayStr) setDateChoice('today');
        else if (ds === tomorrowStr) setDateChoice('tomorrow');
        else if (ds === sundayStr) setDateChoice('sunday');
        else {
          setDateChoice('custom');
          setCustomDateVal(ds);
        }

        // Find which period contains this hour
        const matchingPeriod = TIME_PERIODS.find((p) => p.hours.some((h) => h.value === ts));
        if (matchingPeriod) {
          setActivePeriodId(matchingPeriod.id);
          setTimeChoice(ts);
        } else {
          setTimeChoice('custom');
          setCustomTimeVal(ts);
        }
      }
    }
  }, [itemDateTime, todayStr, tomorrowStr, sundayStr]);

  const handleOpenDialog = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (user && selectedRecipients.length === 0) {
      setSelectedRecipients([user.uid]);
    }
    setDialogOpen(true);
  };

  const handleSendReminder = async (targetUid: string) => {
    if (!user) return;
    setSending(true);
    setDialogOpen(false);

    try {
      const { userAuth } = await import('@/app/lib/firebase');
      const idToken = await userAuth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error('Could not retrieve authentication session token.');

      const senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName || 'User';
      const isSelf = targetUid === user.uid;
      const notificationMessage = isSelf
        ? `${itemType === 'task' ? 'Task Reminder' : 'Schedule Reminder'} : ${itemTitle}`
        : `${senderName} wants you to remind about ${itemType === 'task' ? 'task' : 'schedule'}: "${itemTitle}"`;

      const res = await fetch('/api/send-test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          targetUid,
          title: 'MyOrbit Reminder ⏰',
          bodyText: notificationMessage,
          appUrl: itemDetailUrl,
          notificationType: itemType === 'task' ? 'todo' : 'schedule',
          entityId: _itemId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (
          res.status === 404 ||
          data.code === 'NO_ACTIVE_SUBSCRIPTIONS' ||
          (data.error && String(data.error).includes('No active device subscriptions'))
        ) {
          const targetUserObj = user.sharedWith?.find((u) => u.uid === targetUid);
          const targetName = isSelf ? 'You' : targetUserObj?.displayName || 'This user';
          setUnsubscribedNotice({
            open: true,
            userName: targetName,
          });
          return;
        }
        throw new Error(data.error || 'Failed to dispatch notification.');
      }

      setFeedback({ open: true, message: 'Reminder notification sent successfully!', severity: 'success' });
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

  // Helper to compute effective date
  const getEffectiveDateStr = (): string => {
    if (dateChoice === 'today') return todayStr;
    if (dateChoice === 'tomorrow') return tomorrowStr;
    if (dateChoice === 'sunday') return sundayStr;
    return customDateVal || todayStr;
  };

  // Helper to compute effective time WITH 2-MINUTE OFFSET (e.g. 7:00 AM -> 7:02 AM)
  // to avoid cron/worker job delay misses when checking hour window
  const getEffectiveTimeStr = (): string => {
    let rawTime = '07:00';
    if (timeChoice === 'custom') {
      rawTime = customTimeVal || '09:00';
    } else {
      rawTime = timeChoice;
    }

    const [h, m] = rawTime.split(':').map(Number);
    // If exact hour selected (0 minutes), set minute to 2 (e.g., 07:02) for reliable cron pickup
    if (m === 0) {
      const paddedH = String(h).padStart(2, '0');
      return `${paddedH}:02`;
    }
    return rawTime;
  };

  const handleScheduleSubmit = async () => {
    if (!user || selectedRecipients.length === 0) return;
    setSending(true);
    setDialogOpen(false);

    try {
      const { createWhatsAppReminder } = await import('@/app/lib/utils/whatsapp-reminder');

      const dateStr = getEffectiveDateStr();
      const timeStr = getEffectiveTimeStr(); // contains +2 minute offset

      const [hours, minutes] = timeStr.split(':').map(Number);
      const targetDate = new Date(`${dateStr}T${timeStr}`);
      if (isNaN(targetDate.getTime())) {
        targetDate.setHours(hours, minutes, 0, 0);
      }

      const reminderDate = targetDate.getTime() <= Date.now() ? new Date(Date.now() + 2 * 60000) : targetDate;

      // Update Firestore document with reminder date & flag
      if (_itemId) {
        const colName = itemType === 'task' ? 'todos' : 'schedules';
        const docRef = doc(db, colName, _itemId);
        await updateDoc(docRef, {
          hasReminder: true,
          reminderDate: Timestamp.fromDate(reminderDate),
          updatedAt: new Date(),
        }).catch((err) => console.error('Failed to update Firestore reminder fields:', err));
      }

      const senderName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName || 'User';

      const unsubscribedNames: string[] = [];

      const promises = selectedRecipients.map(async (targetUid) => {
        const isSelf = targetUid === user.uid;
        const messageText = isSelf
          ? `${itemType === 'task' ? 'Task Reminder' : 'Schedule Reminder'} : ${itemTitle}`
          : `${senderName} wants you to remind about ${itemType === 'task' ? 'task' : 'schedule'}: "${itemTitle}"`;

        const deviceCol = collection(userDb, 'users', targetUid, 'notificationDevices');
        const deviceSnapshot = await getDocs(deviceCol);
        const activeTokens: string[] = [];
        deviceSnapshot.forEach((d) => {
          const data = d.data();
          if (data.enabled && data.fid) activeTokens.push(data.fid);
        });

        if (activeTokens.length === 0 && !isSelf) {
          const targetUserObj = user.sharedWith?.find((u) => u.uid === targetUid);
          if (targetUserObj?.displayName) unsubscribedNames.push(targetUserObj.displayName);
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

      if (unsubscribedNames.length > 0) {
        setFeedback({
          open: true,
          message: `Scheduled! Note: ${unsubscribedNames.join(', ')} has not enabled push notifications on their device yet.`,
          severity: 'warning',
        });
      } else {
        setFeedback({
          open: true,
          message: `Successfully scheduled reminder for ${moment(reminderDate).format('ddd, MMM D @ hh:mm A')}!`,
          severity: 'success',
        });
      }
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

  const handleCloseFeedback = () => setFeedback((prev) => ({ ...prev, open: false }));

  if (!user) return null;

  const hasSharedUsers = user.sharedWith && user.sharedWith.length > 0;
  const effectiveDateStr = getEffectiveDateStr();
  const effectiveTimeStr = getEffectiveTimeStr();
  const displayPreviewStr = moment(`${effectiveDateStr}T${effectiveTimeStr}`).format('dddd, MMM D @ hh:mm A');

  const activePeriod = TIME_PERIODS.find((p) => p.id === activePeriodId) || TIME_PERIODS[2];

  return (
    <>
      {customTrigger ? (
        customTrigger(handleOpenDialog)
      ) : buttonType === 'icon' ? (
        <IconButton
          size={iconSize}
          disabled={sending}
          onClick={handleOpenDialog}
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
          onClick={handleOpenDialog}
          startIcon={
            sending ? <CircularProgress size={14} color="inherit" /> : <NotificationsIcon sx={{ fontSize: '1.1rem' }} />
          }
          sx={{
            borderRadius: '14px',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.8rem',
            px: 2,
            py: 1,
            whiteSpace: 'nowrap',
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

      {/* Sleek & Minimal Reminder Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          className:
            'rounded-[28px] overflow-hidden shadow-2xl border outline-none bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800',
          sx: {
            p: 0,
            width: '92%',
            maxWidth: '420px',
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#0f172a',
            borderRadius: '28px',
          },
        }}
      >
        {/* Header with Close Button matching Schedule Details modal */}
        <Box className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <Typography
            variant="h6"
            className="font-extrabold text-slate-800 dark:text-slate-100"
            sx={{ fontSize: '1.05rem' }}
          >
            ⏰ Reminder Options
          </Typography>
          <IconButton
            size="small"
            onClick={() => setDialogOpen(false)}
            sx={{
              bgcolor: isDark ? '#1e293b' : '#f1f5f9',
              color: isDark ? '#94a3b8' : '#64748b',
              '&:hover': { bgcolor: isDark ? '#334155' : '#e2e8f0' },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Minimal Body Content */}
        <DialogContent className="p-5" sx={{ p: 2.5 }}>
          {/* Item Title Chip */}
          <Box
            className="rounded-2xl p-3 mb-4"
            sx={{
              bgcolor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            }}
          >
            <Typography
              variant="caption"
              className="text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider block mb-0.5"
            >
              {itemType === 'task' ? 'Task' : 'Schedule'}
            </Typography>
            <Typography variant="body2" className="font-bold text-slate-800 dark:text-slate-100 truncate">
              {itemTitle}
            </Typography>
          </Box>

          {/* ⚡ Instant Push Section */}
          <Box className="mb-4">
            <Typography className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
              <span>⚡</span> INSTANT PUSH NOTIFICATION
            </Typography>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => handleSendReminder(user.uid)}
                className="flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 active:scale-95 disabled:opacity-50"
              >
                <span>📲</span> Push to Myself Now
              </button>
              {hasSharedUsers &&
                user.sharedWith.map((su) => (
                  <button
                    key={su.uid}
                    type="button"
                    disabled={sending}
                    onClick={() => handleSendReminder(su.uid)}
                    className="flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 active:scale-95 disabled:opacity-50"
                  >
                    <span>👥</span> Send to {su.displayName || 'User'}
                  </button>
                ))}
            </div>
          </Box>

          <Divider sx={{ my: 2.5, borderColor: isDark ? '#1e293b' : '#f1f5f9' }} />

          {/* ⏰ Scheduled Reminder Section */}
          <Typography className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-1">
            <span>⏰</span> SCHEDULE REMINDER FOR LATER
          </Typography>

          {/* 1. Predefined Day / Date Selection */}
          <Box className="mb-4">
            <Typography className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 block">
              Day / Date
            </Typography>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'today', label: 'Today' },
                { id: 'tomorrow', label: 'Tomorrow' },
                { id: 'sunday', label: 'Coming Sunday' },
                { id: 'custom', label: 'Custom Date' },
              ].map((item) => {
                const active = dateChoice === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDateChoice(item.id as 'today' | 'tomorrow' | 'sunday' | 'custom')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all text-center border ${
                      active
                        ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {dateChoice === 'custom' && (
              <Box className="mt-2">
                <TextField
                  type="date"
                  fullWidth
                  size="small"
                  value={customDateVal}
                  onChange={(e) => setCustomDateVal(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '13px' } }}
                />
              </Box>
            )}
          </Box>

          {/* 2. 24-Hour Time Period & Sub-Hour Picker */}
          <Box className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <Typography className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                24-Hour Time Schedule
              </Typography>
              {timeChoice !== 'custom' && (
                <span className="text-[10px] font-medium text-amber-500 dark:text-amber-400">
                  +2 min offset applied
                </span>
              )}
            </div>

            {/* 8 Time Periods Grid (24 Hours) */}
            <div className="grid grid-cols-2 gap-1.5 mb-2.5">
              {TIME_PERIODS.map((period) => {
                const isPeriodActive = activePeriodId === period.id && timeChoice !== 'custom';
                return (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => {
                      setActivePeriodId(period.id);
                      // Default selection to first hour of chosen period
                      setTimeChoice(period.hours[0].value);
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-start text-left border ${
                      isPeriodActive
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1 w-full justify-between">
                      <span className="truncate">
                        {period.icon} {period.name}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-medium mt-0.5 ${
                        isPeriodActive ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {period.range}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sub-hours for active period */}
            {timeChoice !== 'custom' && activePeriod && (
              <Box className="p-2.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 mb-2">
                <Typography className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-1.5 block">
                  Select Hour for {activePeriod.icon} {activePeriod.name} ({activePeriod.range}):
                </Typography>
                <div className="grid grid-cols-3 gap-1.5">
                  {activePeriod.hours.map((h) => {
                    const isSelected = timeChoice === h.value;
                    return (
                      <button
                        key={h.value}
                        type="button"
                        onClick={() => setTimeChoice(h.value)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-extrabold transition-all text-center border ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm scale-105'
                            : 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                        }`}
                      >
                        {h.label}
                      </button>
                    );
                  })}
                </div>
              </Box>
            )}

            {/* Custom Time Option */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setTimeChoice(timeChoice === 'custom' ? '07:00' : 'custom')}
                className={`text-[11px] font-bold transition-colors flex items-center gap-1 ${
                  timeChoice === 'custom'
                    ? 'text-indigo-600 dark:text-indigo-400 underline'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <AccessTimeIcon sx={{ fontSize: 13 }} />
                {timeChoice === 'custom' ? 'Switch back to 24-Hr Presets' : 'Or set Custom Time'}
              </button>
            </div>

            {timeChoice === 'custom' && (
              <Box className="mt-2">
                <TextField
                  type="time"
                  fullWidth
                  size="small"
                  value={customTimeVal}
                  onChange={(e) => setCustomTimeVal(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '13px' } }}
                />
              </Box>
            )}
          </Box>

          {/* Optional Shared Recipient Selector */}
          {hasSharedUsers && (
            <Box className="mb-4">
              <Typography className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                RECIPIENTS
              </Typography>
              <FormGroup sx={{ gap: 0.25 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedRecipients.includes(user.uid)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedRecipients((prev) =>
                          checked ? [...prev, user.uid] : prev.filter((id) => id !== user.uid)
                        );
                      }}
                      size="small"
                      sx={{ color: isDark ? '#475569' : '#cbd5e1', '&.Mui-checked': { color: '#6366f1' } }}
                    />
                  }
                  label="Myself"
                  sx={{ m: 0, '& .MuiTypography-root': { fontSize: '12px', fontWeight: 600 } }}
                />
                {user.sharedWith.map((su) => (
                  <FormControlLabel
                    key={su.uid}
                    control={
                      <Checkbox
                        checked={selectedRecipients.includes(su.uid)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedRecipients((prev) =>
                            checked ? [...prev, su.uid] : prev.filter((id) => id !== su.uid)
                          );
                        }}
                        size="small"
                        sx={{ color: isDark ? '#475569' : '#cbd5e1', '&.Mui-checked': { color: '#6366f1' } }}
                      />
                    }
                    label={su.displayName}
                    sx={{ m: 0, '& .MuiTypography-root': { fontSize: '12px', fontWeight: 600 } }}
                  />
                ))}
              </FormGroup>
            </Box>
          )}

          {/* Live Preview Box */}
          <Box className="rounded-2xl p-2.5 text-center mb-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
            <Typography variant="caption" className="text-indigo-600 dark:text-indigo-400 font-bold block text-[11px]">
              ⏰ Scheduled for {displayPreviewStr}
            </Typography>
          </Box>

          {/* Submit Action Button */}
          <Button
            onClick={handleScheduleSubmit}
            variant="contained"
            disabled={sending || selectedRecipients.length === 0}
            fullWidth
            sx={{
              borderRadius: '16px',
              py: 1.4,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '14px',
              bgcolor: '#f59e0b',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
              '&:hover': { bgcolor: '#d97706' },
            }}
          >
            {sending ? 'Saving Reminder...' : 'Confirm & Set Reminder'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Friendly Notice Dialog for Unsubscribed Target User */}
      <Dialog
        open={unsubscribedNotice.open}
        onClose={() => setUnsubscribedNotice({ open: false, userName: '' })}
        onClick={(e) => e.stopPropagation()}
        PaperProps={{
          className:
            'rounded-[24px] overflow-hidden shadow-2xl border outline-none bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800',
          sx: {
            p: 0,
            width: '90%',
            maxWidth: '360px',
            bgcolor: isDark ? '#0f172a' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#0f172a',
            borderRadius: '24px',
          },
        }}
      >
        <Box className="p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 border border-amber-200 dark:border-amber-800/60 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-500 text-2xl shadow-sm">
            🔔
          </div>
          <Typography
            variant="h6"
            className="font-extrabold text-slate-800 dark:text-slate-100 mb-1"
            sx={{ fontSize: '1.1rem' }}
          >
            Notifications Not Enabled
          </Typography>
          <Typography
            variant="body2"
            className="text-slate-600 dark:text-slate-400 mb-4 text-xs font-medium leading-relaxed"
          >
            <strong className="text-slate-900 dark:text-slate-100">{unsubscribedNotice.userName}</strong> has not enabled
            or subscribed to push notifications on their device yet.
          </Typography>
          <Box className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 mb-5 text-left text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
            💡 <strong>Tip:</strong> Ask {unsubscribedNotice.userName} to open{' '}
            <strong>MyOrbit ➔ Settings ➔ Push Notifications</strong> on their device to enable notifications.
          </Box>
          <Button
            onClick={() => setUnsubscribedNotice({ open: false, userName: '' })}
            variant="contained"
            fullWidth
            sx={{
              borderRadius: '14px',
              py: 1.2,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '13px',
              bgcolor: isDark ? '#334155' : '#0f172a',
              color: '#ffffff',
              boxShadow: 'none',
              '&:hover': { bgcolor: isDark ? '#475569' : '#1e293b' },
            }}
          >
            Got it
          </Button>
        </Box>
      </Dialog>

      <Snackbar
        open={feedback.open}
        autoHideDuration={3500}
        onClose={handleCloseFeedback}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseFeedback} severity={feedback.severity} sx={{ width: '100%', borderRadius: '12px' }}>
          {feedback.message}
        </Alert>
      </Snackbar>
    </>
  );
}
