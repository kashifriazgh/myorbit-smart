'use client';

import moment from 'moment';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Card,
  CardContent,
  Button,
  Skeleton,
  Alert,
  Snackbar,
  Badge,
  styled,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  AccessTime as TimeIcon,
  CalendarMonth as CalendarIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useAuth } from '../../lib/context/userContext';
import { useCustomTheme } from '../../lib/context/themeContext';
import { SchedulesProps } from '../../lib/interface';
import SchedulesModal from './SchedulesModal';
import { useSchedules } from '../../lib/context/SchedulesContext';
import ReminderSendButton from '@/app/components/global/ReminderSendButton';

// Custom Styled Badge
const StyledBadge = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    right: -3,
    top: 3,
    border: `2px solid ${theme.palette.background.paper}`,
    padding: '0 4px',
  },
}));

// Custom SVGs for schedule cards
const ClockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    style={{ width: '14px', height: '14px' }}
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12L15 14" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    style={{ width: '16px', height: '16px' }}
    stroke="white"
    strokeWidth="3"
  >
    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CARD_STYLES = [
  {
    border: 'border-pink-200 dark:border-pink-900/30',
    bg: 'bg-pink-50 dark:bg-pink-950/15',
    checkBorder: 'border-pink-300 dark:border-pink-800',
    checkBorderHover: 'hover:border-pink-400 dark:hover:border-pink-700',
    checkedBg: 'bg-pink-400 dark:bg-pink-600',
  },
  {
    border: 'border-amber-200 dark:border-amber-900/30',
    bg: 'bg-amber-50 dark:bg-amber-950/15',
    checkBorder: 'border-amber-300 dark:border-amber-800',
    checkBorderHover: 'hover:border-amber-400 dark:hover:border-amber-700',
    checkedBg: 'bg-amber-400 dark:bg-amber-600',
  },
  {
    border: 'border-cyan-200 dark:border-cyan-900/30',
    bg: 'bg-cyan-50 dark:bg-cyan-950/15',
    checkBorder: 'border-cyan-300 dark:border-cyan-800',
    checkBorderHover: 'hover:border-cyan-400 dark:hover:border-cyan-700',
    checkedBg: 'bg-cyan-400 dark:bg-cyan-600',
  },
  {
    border: 'border-indigo-200 dark:border-indigo-900/30',
    bg: 'bg-indigo-50 dark:bg-indigo-950/15',
    checkBorder: 'border-indigo-300 dark:border-indigo-800',
    checkBorderHover: 'hover:border-indigo-400 dark:hover:border-indigo-700',
    checkedBg: 'bg-indigo-400 dark:bg-indigo-600',
  },
  {
    border: 'border-emerald-200 dark:border-emerald-900/30',
    bg: 'bg-emerald-50 dark:bg-emerald-950/15',
    checkBorder: 'border-emerald-300 dark:border-emerald-800',
    checkBorderHover: 'hover:border-emerald-400 dark:hover:border-emerald-700',
    checkedBg: 'bg-emerald-400 dark:bg-emerald-600',
  },
];

const DayTimeline = ({
  schedulesList,
  theme,
}: {
  schedulesList: SchedulesProps[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: any;
}) => {
  const isDark = theme?.mode === 'dark';
  
  const timedSchedules = schedulesList.filter(s => !s.isFlexible && s.startTime && s.endTime);
  
  const totalBusyMins = timedSchedules.reduce((acc, s) => {
    const [sh, sm] = s.startTime.split(':').map(Number);
    const [eh, em] = s.endTime.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    return acc + Math.max(0, duration);
  }, 0);
  
  const busyHours = (totalBusyMins / 60).toFixed(1);

  return (
    <Box 
      sx={{ 
        px: 2, 
        py: 1.5, 
        mb: 3, 
        bgcolor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc', 
        borderRadius: '16px', 
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` 
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="caption" sx={{ fontSize: '11px', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b' }}>
          📊 Busy/Free Timeline
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '11px', fontWeight: 700, color: isDark ? '#fbbf24' : '#d97706' }}>
          {totalBusyMins > 0 ? `${busyHours} hrs scheduled` : 'Free day'}
        </Typography>
      </Box>

      {/* Timeline track container */}
      <Box sx={{ position: 'relative', width: '100%', height: '10px', bgcolor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: '5px', overflow: 'hidden', mb: 1 }}>
        {/* Render busy slots */}
        {timedSchedules.map((s, idx) => {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const [eh, em] = s.endTime.split(':').map(Number);
          const startMin = sh * 60 + sm;
          const endMin = eh * 60 + em;
          
          const left = (startMin / 1440) * 100;
          const width = ((endMin - startMin) / 1440) * 100;
          
          const cardStyle = CARD_STYLES[schedulesList.indexOf(s) % CARD_STYLES.length];
          const bgClass = cardStyle.checkedBg;

          return (
            <Tooltip
              key={s.id || idx}
              title={`${s.title} (${sh % 12 || 12}:${String(sm).padStart(2, '0')} ${sh >= 12 ? 'PM' : 'AM'} - ${eh % 12 || 12}:${String(em).padStart(2, '0')} ${eh >= 12 ? 'PM' : 'AM'})`}
              arrow
            >
              <Box
                className={bgClass}
                sx={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${left}%`,
                  width: `${width}%`,
                  cursor: 'pointer',
                  opacity: s.status === 'completed' ? 0.4 : 0.95,
                  transition: 'opacity 0.2s',
                  '&:hover': { opacity: 1 },
                }}
              />
            </Tooltip>
          );
        })}
      </Box>

      {/* Hourly labels / tick marks below track */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5, position: 'relative', height: '14px' }}>
        <Typography variant="caption" sx={{ fontSize: '9px', fontWeight: 600, color: isDark ? '#64748b' : '#94a3b8', position: 'absolute', left: '0%' }}>12 AM</Typography>
        <Typography variant="caption" sx={{ fontSize: '9px', fontWeight: 600, color: isDark ? '#64748b' : '#94a3b8', position: 'absolute', left: '25%', transform: 'translateX(-50%)' }}>6 AM</Typography>
        <Typography variant="caption" sx={{ fontSize: '9px', fontWeight: 600, color: isDark ? '#64748b' : '#94a3b8', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>12 PM</Typography>
        <Typography variant="caption" sx={{ fontSize: '9px', fontWeight: 600, color: isDark ? '#64748b' : '#94a3b8', position: 'absolute', left: '75%', transform: 'translateX(-50%)' }}>6 PM</Typography>
        <Typography variant="caption" sx={{ fontSize: '9px', fontWeight: 600, color: isDark ? '#64748b' : '#94a3b8', position: 'absolute', right: '0%' }}>12 AM</Typography>
      </Box>
    </Box>
  );
};

const groupSchedulesByHour = (schedulesList: SchedulesProps[]) => {
  const groups: { [key: string]: SchedulesProps[] } = {};
  
  schedulesList.forEach((s) => {
    if (s.isFlexible) {
      const key = "Flexible";
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    } else {
      const [hoursStr] = s.startTime.split(':');
      const hour = parseInt(hoursStr);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      const paddedHour = String(displayHour).padStart(2, '0');
      const key = `${paddedHour}:00 ${ampm}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
  });
  
  return groups;
};

const sortHourSlots = (a: string, b: string) => {
  if (a === 'Flexible') return 1;
  if (b === 'Flexible') return -1;
  
  const [timeA, ampmA] = a.split(' ');
  const [timeB, ampmB] = b.split(' ');
  
  let hourA = parseInt(timeA.split(':')[0]);
  let hourB = parseInt(timeB.split(':')[0]);
  
  if (ampmA === 'PM' && hourA !== 12) hourA += 12;
  if (ampmA === 'AM' && hourA === 12) hourA = 0;
  
  if (ampmB === 'PM' && hourB !== 12) hourB += 12;
  if (ampmB === 'AM' && hourB === 12) hourB = 0;
  
  return hourA - hourB;
};

interface HourlySchedulesGroupedListProps {
  items: SchedulesProps[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: any;
  getTimeRange: (startTime: string, endTime: string, isFlexible?: boolean) => string;
  handleToggleStatus: (schedule: SchedulesProps) => void;
  handleEditSchedule: (scheduleId: string) => void;
  getPriorityColor: (priority: string) => string;
}

const HourlySchedulesGroupedList: React.FC<HourlySchedulesGroupedListProps> = ({
  items,
  theme,
  getTimeRange,
  handleToggleStatus,
  handleEditSchedule,
  getPriorityColor,
}) => {
  const hourlyGroups = groupSchedulesByHour(items);
  const sortedSlots = Object.keys(hourlyGroups).sort(sortHourSlots);

  return (
    <Box sx={{ width: '100%' }}>
      {sortedSlots.map((slot) => (
        <Box key={slot} sx={{ mb: 2.5 }}>
          {/* Time slot header row */}
          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 2, pl: 1 }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: '12px',
                fontWeight: 700,
                color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
                flexShrink: 0,
              }}
            >
              {slot}
            </Typography>
            <Box sx={{ height: '1px', flex: 1, bgcolor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0' }} />
          </Box>

          {/* Cards for this slot */}
          {hourlyGroups[slot].map((schedule) => {
            const styleIndex = items.indexOf(schedule);
            const cardStyle = CARD_STYLES[styleIndex % CARD_STYLES.length];
            const done = schedule.status === 'completed';

            return (
              <Box
                key={schedule.id}
                className={`flex min-h-[68px] items-center gap-3 rounded-xl border ${cardStyle.border} ${cardStyle.bg} px-3 py-2 mb-2`}
                sx={{
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: theme?.mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.03)',
                  },
                }}
              >
                {/* Checkbox button */}
                <button
                  type="button"
                  onClick={() => handleToggleStatus(schedule)}
                  aria-pressed={done}
                  aria-label={`Mark ${schedule.title} as done`}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    done
                      ? `${cardStyle.checkedBg} border-transparent`
                      : `${theme?.mode === 'dark' ? 'bg-slate-800' : 'bg-white'} ${cardStyle.checkBorder} ${cardStyle.checkBorderHover}`
                  }`}
                >
                  {done && <CheckIcon />}
                </button>

                {/* Content */}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="body2"
                    className={`truncate font-semibold ${
                      done
                        ? 'text-slate-400 dark:text-slate-500 line-through'
                        : theme?.mode === 'dark' ? 'text-slate-200' : 'text-slate-800'
                    }`}
                    sx={{ fontSize: '15px' }}
                  >
                    {schedule.title}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b' }}>
                      <ClockIcon />
                      <Typography variant="caption" sx={{ fontSize: '11px', fontWeight: 600 }}>
                        {getTimeRange(schedule.startTime, schedule.endTime, schedule.isFlexible)}
                      </Typography>
                    </Box>
                    
                    {schedule.isFlexible && (
                      <Chip
                        label="Flexible"
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '9px',
                          fontWeight: 800,
                          borderColor: '#8b5cf6',
                          color: '#8b5cf6',
                          borderWidth: '1.5px',
                          backgroundColor: 'transparent',
                        }}
                      />
                    )}
                    {schedule.objective && (
                      <Chip
                        label={schedule.objective}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '9px',
                          fontWeight: 800,
                          backgroundColor: getPriorityColor(schedule.priority || 'low'),
                          color: 'white',
                        }}
                      />
                    )}
                  </Box>
                </Box>

                {/* Actions on the right */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, shrink: 0, ml: 'auto' }}>
                  <ReminderSendButton
                    itemId={schedule.id!}
                    itemTitle={schedule.title}
                    itemType="schedule"
                    itemDetailUrl="/"
                    buttonType="icon"
                    iconSize="small"
                    itemDateTime={schedule.date && schedule.startTime ? new Date(`${schedule.date}T${schedule.startTime}`) : null}
                    buttonSx={{
                      p: 0.5,
                      color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
                      '&:hover': { color: '#6366f1' },
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleEditSchedule(schedule.id!)}
                    sx={{
                      p: 0.5,
                      color: theme?.mode === 'dark' ? '#94a3b8' : '#64748b',
                      '&:hover': { color: '#fbbf24' },
                    }}
                    title="Edit Schedule"
                  >
                    <EditIcon sx={{ fontSize: '1.05rem' }} />
                  </IconButton>
                </Box>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
};

// ─── QuickAddScheduleRow ────────────────────────────────────────────────────
interface QuickAddScheduleRowProps {
  selectedDate: string;
  isDark: boolean;
  schedules: SchedulesProps[];
  onAdd: (title: string, startTime: string) => void;
}

const QuickAddScheduleRow = ({ isDark, schedules, onAdd }: QuickAddScheduleRowProps) => {
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState('');

  /** Compute default time: 30 mins after the latest schedule, or next rounded hour */
  const computeDefaultTime = () => {
    if (schedules.length > 0) {
      const latestTime = schedules
        .map((s) => s.startTime)
        .sort()
        .at(-1)!;
      const [h, m] = latestTime.split(':').map(Number);
      const totalMins = h * 60 + m + 30;
      const newH = Math.floor(totalMins / 60) % 24;
      const newM = totalMins % 60;
      return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    }
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    return now.toTimeString().slice(0, 5);
  };

  const [startTime, setStartTime] = useState(computeDefaultTime);

  // Recompute the default time whenever schedules change and row is inactive
  useEffect(() => {
    if (!active) setStartTime(computeDefaultTime());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, active]);

  const commit = () => {
    if (title.trim()) {
      onAdd(title.trim(), startTime);
      // Reset immediately — no await
      setTitle('');
      setStartTime(computeDefaultTime());
    }
    setActive(false);
  };

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className={`
          flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 w-full text-left
          focus:outline-none focus:ring-2 focus:ring-amber-300 mb-2
          ${isDark
            ? 'text-slate-500 hover:text-amber-400 hover:bg-slate-800/50'
            : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'}
        `}
      >
        <span
          className={`w-6 h-6 rounded-md border-2 border-dashed flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
            isDark ? 'border-slate-700' : 'border-slate-300'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
        </span>
        Quickly add a schedule…
      </button>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.75,
        mb: 2,
        borderRadius: '14px',
        border: `1.5px solid ${isDark ? '#f59e0b44' : '#fcd34d88'}`,
        bgcolor: isDark ? '#0f172a' : '#fffbeb',
        boxShadow: isDark
          ? 'inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 3px rgba(245,158,11,0.07)'
          : '0 0 0 3px rgba(251,191,36,0.1)',
        overflow: 'hidden',
      }}
    >
      {/* Compact time badge */}
      <Box sx={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 0.4,
        bgcolor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(253,211,77,0.25)',
        borderRadius: '8px',
        px: 0.8,
        py: 0.3,
      }}>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className={`bg-transparent border-none text-sm outline-none cursor-pointer font-bold ${
            isDark ? 'text-amber-400' : 'text-amber-700'
          }`}
          style={{ colorScheme: isDark ? 'dark' : 'light', width: 78 }}
        />
      </Box>

      {/* Slim vertical divider */}
      <Box sx={{ width: '1px', height: 18, bgcolor: isDark ? '#1e293b' : '#fde68a', flexShrink: 0 }} />

      {/* Title — minWidth:0 is the key fix so it never overflows */}
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setActive(false); setTitle(''); }
        }}
        placeholder="What's scheduled…"
        style={{ minWidth: 0, flex: 1, background: 'transparent', border: 'none', outline: 'none' }}
        className={`text-[0.93rem] placeholder:text-slate-400 ${
          isDark ? 'text-slate-100' : 'text-slate-800'
        }`}
      />

      {/* Circular glowing submit — always pinned, never overflows */}
      <Box
        component="button"
        onClick={commit}
        disabled={!title.trim()}
        sx={{
          flexShrink: 0,
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: 'none',
          cursor: title.trim() ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: title.trim()
            ? '#f59e0b'
            : (isDark ? '#1e293b' : '#f1f5f9'),
          color: title.trim() ? '#1a0a00' : (isDark ? '#334155' : '#cbd5e1'),
          boxShadow: title.trim() ? '0 0 10px rgba(245,158,11,0.55)' : 'none',
          outline: `2px solid ${title.trim() ? '#fbbf24' : 'transparent'}`,
          outlineOffset: '2px',
          transition: 'all 0.18s ease',
          '&:hover': {
            transform: title.trim() ? 'scale(1.1)' : 'none',
            boxShadow: title.trim() ? '0 0 16px rgba(245,158,11,0.7)' : 'none',
          },
        }}
      >
        {/* Checkmark icon */}
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,7 5.5,11 12,3" />
        </svg>
      </Box>
    </Box>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────
const Schedules: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [viewMode, setViewMode] = useState<'quick' | 'daily' | 'future'>('quick');
  const [isLoaded, setIsLoaded] = useState(false);

  // Use new context provider
  const {
    schedules,
    allSchedules,
    loading,
    selectedDate,
    setSelectedDate,
    addSchedule,
    editSchedule,
    removeSchedule,
  } = useSchedules();

  // Load view mode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('schedules_view_mode');
    if (savedMode === 'quick' || savedMode === 'daily' || savedMode === 'future') {
      setViewMode(savedMode);
    }
    setIsLoaded(true);
  }, []);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('schedules_view_mode', viewMode);
    }
  }, [viewMode, isLoaded]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SchedulesProps | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  const isDark = theme?.mode === 'dark';

  // Generate 5 dates starting from today
  const dates = useMemo(() => {
    const d = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      d.push({
        date: date.getDate().toString(),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: date.toISOString().split('T')[0],
      });
    }
    return d;
  }, []);

  useEffect(() => {
    if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0].fullDate);
  }, [dates, selectedDate, setSelectedDate]);

  // Compute counts locally from context's cached allSchedules list
  const counts = useMemo(() => {
    const countsMap: { [date: string]: number } = {};
    const todayStr = new Date().toISOString().split('T')[0];

    allSchedules.forEach((s) => {
      const effectiveDate = s.isFlexible ? todayStr : s.date;
      countsMap[effectiveDate] = (countsMap[effectiveDate] || 0) + 1;
    });

    return countsMap;
  }, [allSchedules]);

  // Derive future schedules list locally
  const futureSchedules = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return allSchedules
      .filter((s) => {
        if (s.isFlexible) return false;
        return s.date >= todayStr;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [allSchedules]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTimeRange = (startTime: string, endTime: string, isFlexible?: boolean) => {
    if (isFlexible) return 'Flexible';
    return `${formatTime(startTime)} – ${formatTime(endTime)}`;
  };

  const handleAddSchedule = () => { setEditingSchedule(null); setModalOpen(true); };

  const handleEditSchedule = (scheduleId: string) => {
    const schedule = allSchedules.find(s => s.id === scheduleId);
    if (schedule) { setEditingSchedule(schedule); setModalOpen(true); }
  };

  const handleSaveSchedule = async (scheduleData: SchedulesProps) => {
    setIsSaving(true);
    try {
      if (!scheduleData.title || !scheduleData.startTime) throw new Error('Title and start time are required');
      if (scheduleData.id) {
        await editSchedule(scheduleData.id, scheduleData);
        setSnackbar({ open: true, message: 'Schedule updated successfully', severity: 'success' });
      } else {
        await addSchedule(scheduleData);
        setSnackbar({ open: true, message: 'Schedule created successfully', severity: 'success' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save schedule';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    setIsSaving(true);
    try {
      await removeSchedule(scheduleId);
      setSnackbar({ open: true, message: 'Schedule deleted successfully', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete schedule', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => { setModalOpen(false); setEditingSchedule(null); };
  const handleCloseSnackbar = () => setSnackbar(prev => ({ ...prev, open: false }));

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'medium': return '#2196f3';
      case 'low': return '#4caf50';
      default: return '#9e9e9e';
    }
  };



  const handleQuickAdd = (title: string, startTime: string) => {
    if (!user) return;
    const endHour = (parseInt(startTime.split(':')[0]) + 1) % 24;
    const endTime = `${String(endHour).padStart(2, '0')}:${startTime.split(':')[1]}`;
    // Fire-and-forget — UI already updated optimistically via the row resetting
    addSchedule({
      userId: user.uid,
      title,
      date: selectedDate,
      startTime,
      endTime,
      status: 'pending',
      isFlexible: false,
    }).catch((err) => {
      console.error('Failed to quick-add schedule:', err);
    });
  };

  const handleToggleStatus = async (schedule: SchedulesProps) => {
    if (!schedule.id) return;
    const newStatus = schedule.status === 'completed' ? 'pending' : 'completed';
    try {
      await editSchedule(schedule.id, { status: newStatus });
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const DateTabStrip = () => (
    <Box display="flex" justifyContent="center" mb={2}>
      <Box display="flex" alignItems="center" gap={1}>
        {dates.map((dateInfo) => {
          const isSelected = selectedDate === dateInfo.fullDate;
          const count = counts[dateInfo.fullDate] || 0;
          return (
            <StyledBadge
              key={dateInfo.fullDate}
              badgeContent={count}
              color="secondary"
              invisible={count === 0}
            >
              <Box
                onClick={() => setSelectedDate(dateInfo.fullDate)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 64,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease-in-out',
                  backgroundColor: isSelected
                    ? '#fbbf24'
                    : isDark ? '#374151' : '#f3f4f6',
                  '&:hover': {
                    backgroundColor: isSelected
                      ? '#f59e0b'
                      : isDark ? '#4b5563' : '#e5e7eb',
                  },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: isSelected ? '#000' : isDark ? '#d1d5db' : '#6b7280' }}
                >
                  {dateInfo.date}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: '0.7rem', color: isSelected ? '#000' : '#9ca3af' }}
                >
                  {dateInfo.day}
                </Typography>
              </Box>
            </StyledBadge>
          );
        })}
      </Box>
    </Box>
  );

  return (
    <Card
      sx={{
        height: '100%',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        position: 'relative',
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Box mb={1.5}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
            📅 Schedules
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              bgcolor: isDark ? '#0f172a' : '#f1f5f9',
              p: '4px',
              borderRadius: '10px',
            }}
          >
            {(['quick', 'daily', 'future'] as const).map((mode) => (
              <Button
                key={mode}
                size="small"
                onClick={() => setViewMode(mode)}
                sx={{
                  borderRadius: '7px',
                  px: 1.5,
                  py: 0.4,
                  minWidth: 60,
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  fontWeight: 700,
                  color: viewMode === mode
                    ? (isDark ? '#fff' : '#0f172a')
                    : '#64748b',
                  bgcolor: viewMode === mode
                    ? (isDark ? '#1e293b' : '#fff')
                    : 'transparent',
                  boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: viewMode === mode
                      ? (isDark ? '#1e293b' : '#fff')
                      : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                  },
                }}
              >
                {mode === 'quick' ? '⚡ Quick' : mode === 'daily' ? '📋 Daily' : '🗓 Future'}
              </Button>
            ))}
          </Box>

          <IconButton size="small" onClick={handleAddSchedule} sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>

        {viewMode === 'quick' && (
          <>
            <DateTabStrip />
            <DayTimeline schedulesList={schedules} theme={theme} />

            <QuickAddScheduleRow
              selectedDate={selectedDate}
              isDark={isDark}
              schedules={schedules}
              onAdd={handleQuickAdd}
            />

            {loading ? (
              <Box>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={44} sx={{ borderRadius: 2, mb: 1 }} />
                ))}
              </Box>
            ) : schedules.length === 0 ? (
              <Box display="flex" flexDirection="column" alignItems="center" py={3} textAlign="center">
                <TimeIcon sx={{ fontSize: 36, color: 'grey.400', mb: 1 }} />
                <Typography variant="body2" color="text.secondary" fontSize="0.8rem">
                  No schedules for this day
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <HourlySchedulesGroupedList
                  items={schedules.slice(0, 8)}
                  theme={theme}
                  getTimeRange={getTimeRange}
                  handleToggleStatus={handleToggleStatus}
                  handleEditSchedule={handleEditSchedule}
                  getPriorityColor={getPriorityColor}
                />
              </Box>
            )}

            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button
                variant="text"
                size="small"
                onClick={() => setViewMode('daily')}
                sx={{ textTransform: 'none', fontSize: '0.75rem', color: isDark ? '#64748b' : '#94a3b8' }}
              >
                Full View →
              </Button>
            </Box>
          </>
        )}

        {viewMode === 'daily' && (
          <>
            <DateTabStrip />
            <DayTimeline schedulesList={schedules} theme={theme} />

            <Box sx={{ maxHeight: '420px', overflowY: 'auto', pr: 1 }}>
              {isSaving && (
                <Box mb={2} p={1.5} sx={{
                  borderRadius: 2,
                  border: '1px dashed #fbbf24',
                  backgroundColor: isDark ? 'rgba(251,191,36,0.05)' : 'rgba(251,191,36,0.1)',
                  display: 'flex', alignItems: 'center', gap: 2,
                }}>
                  <Box className="animate-spin" sx={{ width: 14, height: 14, border: '2px solid transparent', borderTopColor: '#fbbf24', borderRadius: '50%' }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: isDark ? '#fbbf24' : '#b45309' }}>
                    Saving schedule…
                  </Typography>
                </Box>
              )}

              {loading ? (
                <Box>
                  {[...Array(4)].map((_, i) => (
                    <Box key={i} mb={2}>
                      <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
                    </Box>
                  ))}
                </Box>
              ) : schedules.length === 0 ? (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={4} textAlign="center">
                  <TimeIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No schedules found</Typography>
                  <Button size="small" onClick={handleAddSchedule} sx={{ mt: 1 }}>Add your first schedule</Button>
                </Box>
              ) : (
                <ScheduleDetailList
                  schedules={schedules}
                  viewMode="daily"
                  theme={theme}
                  getTimeRange={getTimeRange}
                  getPriorityColor={getPriorityColor}
                  handleEditSchedule={handleEditSchedule}
                  handleToggleStatus={handleToggleStatus}
                />
              )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setViewMode('future')}
                startIcon={<CalendarIcon />}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                View All Future
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddSchedule}
                sx={{
                  backgroundColor: isDark ? '#3b82f6' : '#2563eb',
                  '&:hover': { backgroundColor: isDark ? '#2563eb' : '#1d4ed8' },
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                Add Schedule
              </Button>
            </Box>
          </>
        )}

        {viewMode === 'future' && (
          <>
            <Box sx={{ maxHeight: '420px', overflowY: 'auto', pr: 1 }}>
              {loading ? (
                <Box>
                  {[...Array(4)].map((_, i) => (
                    <Box key={i} mb={2}>
                      <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
                    </Box>
                  ))}
                </Box>
              ) : futureSchedules.length === 0 ? (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={4} textAlign="center">
                  <TimeIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">No future schedules found</Typography>
                  <Button size="small" onClick={handleAddSchedule} sx={{ mt: 1 }}>Add your first schedule</Button>
                </Box>
              ) : (
                <ScheduleDetailList
                  schedules={futureSchedules}
                  viewMode="future"
                  theme={theme}
                  getTimeRange={getTimeRange}
                  getPriorityColor={getPriorityColor}
                  handleEditSchedule={handleEditSchedule}
                  handleToggleStatus={handleToggleStatus}
                />
              )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setViewMode('daily')}
                startIcon={<ArrowIcon sx={{ transform: 'rotate(180deg)' }} />}
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                Back to Daily
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddSchedule}
                sx={{
                  backgroundColor: isDark ? '#3b82f6' : '#2563eb',
                  '&:hover': { backgroundColor: isDark ? '#2563eb' : '#1d4ed8' },
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                Add Schedule
              </Button>
            </Box>
          </>
        )}
      </CardContent>

      <SchedulesModal
        open={modalOpen}
        onClose={handleCloseModal}
        schedule={editingSchedule}
        selectedDate={selectedDate}
        onSave={handleSaveSchedule}
        onDelete={handleDeleteSchedule}
        onDateChange={setSelectedDate}
        existingSchedules={schedules}
      />



      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
};

// ─── Shared Detail List (used by Daily + Future views) ──────────────────────
interface ScheduleDetailListProps {
  schedules: SchedulesProps[];
  viewMode: 'daily' | 'future';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: any;
  getTimeRange: (startTime: string, endTime: string, isFlexible?: boolean) => string;
  getPriorityColor: (priority: string) => string;
  handleEditSchedule: (id: string) => void;
  handleToggleStatus: (schedule: SchedulesProps) => void;
}

const ScheduleDetailList = ({
  schedules,
  viewMode,
  theme,
  getTimeRange,
  getPriorityColor,
  handleEditSchedule,
  handleToggleStatus,
}: ScheduleDetailListProps) => {
  const groups: { [date: string]: SchedulesProps[] } = {};
  const todayStr = new Date().toISOString().split('T')[0];

  schedules.forEach(s => {
    const effectiveDate = s.isFlexible ? todayStr : s.date;
    if (!groups[effectiveDate]) groups[effectiveDate] = [];
    groups[effectiveDate].push(s);
  });

  return (
    <Box>
      {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
        <Box key={date} sx={{ mb: 3 }}>
          {viewMode === 'future' && (
            <Box sx={{ mb: 2, ml: 1, borderLeft: '4px solid #fbbf24', pl: 1 }}>
              <Typography variant="caption" fontWeight="bold" color="primary">
                {moment(date).format('dddd, MMM DD')}
              </Typography>
            </Box>
          )}
          <HourlySchedulesGroupedList
            items={items}
            theme={theme}
            getTimeRange={getTimeRange}
            handleToggleStatus={handleToggleStatus}
            handleEditSchedule={handleEditSchedule}
            getPriorityColor={getPriorityColor}
          />
        </Box>
      ))}
    </Box>
  );
};

export default Schedules;
