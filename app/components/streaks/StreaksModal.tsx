'use client';
import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  Dialog,
  DialogContent,
  DialogActions,
  CircularProgress,
  Collapse,
  Typography,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import { StreakProps } from '@/app/lib/interface';

const daysOfWeek = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function StreaksModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: StreakProps) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [habitType, setHabitType] = useState<
    'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly'
  >('daily');
  const [privacy] = useState<'private' | 'public'>('private');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderDay, setReminderDay] = useState('Monday'); // for weekly
  const [loading, setLoading] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const { user } = useAuth();
  const { theme } = useCustomTheme();

  if (!theme) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user?.uid) return;

    setLoading(true);

    const streakData: StreakProps = {
      userId: user.uid,
      title: title.trim(),
      description: description.trim() || '',
      category: '', // Removed category field
      habitType,
      target: '',
      startDate: Timestamp.now(),
      ...(reminderTime ? { reminderTime } : {}), // only if exists
      privacy,
      reminder: { time: reminderTime || '' }, // must conform to { time: string }
      ...(habitType === 'weekly' ? { reminderDay } : {}), // store separately
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      attendance: [],
      streaksCount: 0,
    };

    try {
      await addDoc(collection(db, 'streaks'), streakData);
      onSave(streakData);
      onClose();
      setTitle('');
      setDescription('');
      setReminderTime('');
      setDescriptionExpanded(false);
    } catch (err) {
      console.error('❌ Error saving streak:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        className: "rounded-[28px] overflow-hidden shadow-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800",
        sx: { borderRadius: '28px' }
      }}
    >
      {/* ── Premium Gradient Header ── */}
      <Box className="p-6 bg-gradient-to-br from-orange-500 to-rose-600 text-white flex justify-between items-center">
        <Box>
          <Typography variant="h6" className="font-extrabold">
            {user ? 'Unleash Your Potential 🔥' : 'Create New Streak'}
          </Typography>
          <Typography variant="body2" className="opacity-90">
            Build consistency, one day at a time
          </Typography>
        </Box>
        <IconButton onClick={onClose} className="text-white hover:bg-white/20 transition-colors">
          <ExpandMoreIcon className="rotate-90" />
        </IconButton>
      </Box>

      <DialogContent className="p-6">
        <Box component="form" onSubmit={handleSave} className="flex flex-col gap-8 pt-4">
          {/* ── Title ── */}
          <Box>
            <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
              🏷️ Streak Title <span className="text-red-500">*</span>
            </Typography>
            <TextField
              inputRef={titleInputRef}
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="What habit are we building?"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '16px',
                  backgroundColor: theme?.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '& fieldset': { borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0' },
                  '&:hover fieldset': { borderColor: '#f97316' },
                  '&.Mui-focused fieldset': { borderColor: '#f97316', borderWidth: '2px' },
                  '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(249, 115, 22, 0.1)' }
                }
              }}
            />
          </Box>

          {/* ── Type and Timing ── */}
          <Box className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                🔄 Frequency
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={habitType}
                  onChange={(e) =>
                    setHabitType(
                      e.target.value as
                        | 'daily'
                        | 'weekly'
                        | 'bi-weekly'
                        | 'monthly'
                        | 'quarterly'
                    )
                  }
                  sx={{
                    borderRadius: '16px',
                    backgroundColor: theme?.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                    fontWeight: 700,
                    '& fieldset': { borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0' },
                  }}
                >
                  <MenuItem value="daily" className="font-bold">Daily</MenuItem>
                  <MenuItem value="weekly" className="font-bold">Weekly</MenuItem>
                  <MenuItem value="bi-weekly" className="font-bold">Bi-Weekly</MenuItem>
                  <MenuItem value="monthly" className="font-bold">Monthly</MenuItem>
                  <MenuItem value="quarterly" className="font-bold">Quarterly</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                ⏰ Reminder
              </Typography>
              {habitType === 'weekly' ? (
                <FormControl fullWidth>
                  <Select
                    value={reminderDay}
                    onChange={(e) => setReminderDay(e.target.value)}
                    sx={{
                      borderRadius: '16px',
                      backgroundColor: theme?.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                      fontWeight: 700,
                      '& fieldset': { borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0' },
                    }}
                  >
                    {daysOfWeek.map((day) => (
                      <MenuItem key={day} value={day} className="font-bold">
                        {day}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  type="time"
                  fullWidth
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '16px',
                      backgroundColor: theme?.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                      fontWeight: 700,
                      '& fieldset': { borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0' },
                    },
                    '& .MuiInputBase-input': { textAlign: 'center' }
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Weekly Reminder Time */}
          {habitType === 'weekly' && (
            <Box>
              <Typography className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">
                ⏲️ Reminder Time
              </Typography>
              <TextField
                type="time"
                fullWidth
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    backgroundColor: theme?.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                    fontWeight: 700,
                    '& fieldset': { borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0' },
                  }
                }}
              />
            </Box>
          )}

          {/* ── Description ── */}
          <Box>
            <Button
              startIcon={descriptionExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              className="normal-case font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl py-2 px-4 mb-2"
            >
              Add Description (optional)
            </Button>
            <Collapse in={descriptionExpanded}>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's the motivation behind this streak?"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    backgroundColor: theme?.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                    '& fieldset': { borderColor: theme?.mode === 'dark' ? '#334155' : '#e2e8f0' },
                  }
                }}
              />
            </Collapse>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions className="p-6 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800 gap-3">
        <Button onClick={onClose} className="rounded-xl font-bold px-6 py-2 normal-case text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          type="submit"
          variant="contained"
          disabled={loading}
          className="rounded-xl font-extrabold px-8 py-2 normal-case bg-gradient-to-r from-orange-500 to-rose-600 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all"
        >
          {loading ? <CircularProgress size={20} className="text-white" /> : 'Ignite Streak 🔥'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
