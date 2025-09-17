'use client';
import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Collapse,
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

export default function CreateStreakForm({
  onSave,
}: {
  onSave: (data: StreakProps) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [habitType, setHabitType] = useState<'daily' | 'weekly'>('daily');
  const [privacy] = useState<'private' | 'public'>('private');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderDay, setReminderDay] = useState('Monday'); // for weekly
  const [loading, setLoading] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

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
      setOpen(false);
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
    <>
      <Box
        onClick={() => setOpen(true)}
        sx={{
          width: '100%',
          cursor: 'pointer',
          border: '1px solid',
          borderColor: theme.mode === 'dark' ? '#f8fafc' : '#d0d7ff',
          borderRadius: 1.2,
          padding: '12px 16px',
          fontSize: '1rem',
          fontWeight: 400,
          backgroundColor: theme.mode === 'dark' ? '#334155' : '#ffffff',
          color: theme.mode === 'dark' ? '#f1f5f9' : '#000000',
          boxShadow: '0 1px 4px rgba(0, 102, 255, 0.1)',
          transition: 'all 0.25s ease',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(0, 102, 255, 0.2)',
            backgroundColor: theme.mode === 'dark' ? '#475569' : '#f8fafc',
          },
        }}
      >
        🔥 Create a streak...
      </Box>

      {/* Dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create New Streak 🔥</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleSave} sx={{ mt: 1 }}>
            <TextField
              label="Streak Title"
              fullWidth
              margin="normal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            {/* Collapsible Description */}
            <Box display="flex" alignItems="center" margin="normal">
              <Button
                startIcon={
                  descriptionExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />
                }
                onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                sx={{
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  p: 0,
                }}
              >
                Description (optional)
              </Button>
            </Box>
            <Collapse in={descriptionExpanded}>
              <TextField
                fullWidth
                multiline
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                sx={{ mb: 1 }}
              />
            </Collapse>

            {/* Type and Day on same line */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={habitType}
                  onChange={(e) =>
                    setHabitType(e.target.value as 'daily' | 'weekly')
                  }
                  label="Type"
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                </Select>
              </FormControl>

              {habitType === 'weekly' ? (
                <FormControl fullWidth>
                  <InputLabel>Day</InputLabel>
                  <Select
                    value={reminderDay}
                    onChange={(e) => setReminderDay(e.target.value)}
                    label="Day"
                  >
                    {daysOfWeek.map((day) => (
                      <MenuItem key={day} value={day}>
                        {day}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  label="Reminder Time"
                  type="time"
                  fullWidth
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              )}
            </div>

            {/* Reminder Time for weekly habits */}
            {habitType === 'weekly' && (
              <TextField
                label="Reminder Time"
                type="time"
                fullWidth
                margin="normal"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            )}

            {/* Privacy field commented out */}
            {/* <FormControl fullWidth margin="normal">
              <InputLabel>Privacy</InputLabel>
              <Select
                value={privacy}
                onChange={(e) =>
                  setPrivacy(e.target.value as 'private' | 'public')
                }
                label="Privacy"
              >
                <MenuItem value="private">Only Me</MenuItem>
                <MenuItem value="public">Public</MenuItem>
              </Select>
            </FormControl> */}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: '#845ef7',
              '&:hover': { backgroundColor: '#7048e8' },
            }}
          >
            {loading ? <CircularProgress size={18} /> : 'Save Streak'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
