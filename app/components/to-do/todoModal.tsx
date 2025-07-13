'use client';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Typography,
  MenuItem,
  IconButton,
  Chip,
  Box,
} from '@mui/material';
import { useState } from 'react';
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { PRIORITY_OPTIONS } from '@/app/lib/constant';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ToDoModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const { theme } = useCustomTheme();
  const [title, setTitle] = useState('');
  const [subTasks, setSubTasks] = useState<string[]>([]);
  const [subInput, setSubInput] = useState('');
  const [priority, setPriority] = useState('routine');
  const [privacy, setPrivacy] = useState<'private' | 'public'>('private');
  const [dueDate, setDueDate] = useState<Date | null>(new Date());

  const [loading, setLoading] = useState(false);

  const handleAddStep = () => {
    if (subTasks.length >= 6 || !subInput.trim()) return;
    setSubTasks([...subTasks, subInput.trim()]);
    setSubInput('');
  };

  const handleDeleteStep = (index: number) => {
    setSubTasks(subTasks.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    setLoading(true);

    const docData = {
      title: title.trim(),
      steps: subTasks.map((text) => ({
        text,
        done: false,
        status: 'in_progress',
      })),
      priority,
      status: 'in_progress',
      progressPercent: 0,
      pinned: false,
      isArchived: false,
      authorId: user!.uid,
      authorName: user!.displayName || '',
      assignedUsers: [],
      sharedWith: [],
      startDate: Timestamp.fromDate(new Date()),
      dueDate: Timestamp.fromDate(dueDate || new Date()),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      privacy,
    };

    await addDoc(collection(db, 'todos'), docData);
    setLoading(false);
    onClose();
  };

  if (!theme) {
    return;
  }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>📝 New To-Do</DialogTitle>
      <DialogContent
        dividers
        sx={{ bgcolor: theme.mode === 'dark' ? '#1e293b' : '#fff' }}
      >
        <Stack spacing={2}>
          <TextField
            label="Title"
            fullWidth
            multiline
            maxRows={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Sub Task"
              fullWidth
              value={subInput}
              onChange={(e) => setSubInput(e.target.value)}
              disabled={subTasks.length >= 6}
            />
            <IconButton onClick={handleAddStep} disabled={subTasks.length >= 6}>
              <AddIcon />
            </IconButton>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            {subTasks.map((step, idx) => (
              <Chip
                key={idx}
                label={step}
                onDelete={() => handleDeleteStep(idx)}
                deleteIcon={<DeleteIcon />}
                sx={{
                  bgcolor: theme.mode === 'dark' ? '#334155' : undefined,
                  color: theme.mode === 'dark' ? '#e2e8f0' : undefined,
                }}
              />
            ))}
          </Stack>

          <TextField
            select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Privacy"
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value as 'private' | 'public')}
          >
            <MenuItem value="private">Only Me</MenuItem>
            <MenuItem value="public">Public</MenuItem>
          </TextField>

          <Box>
            <Typography variant="subtitle2" mb={1}>
              Select Due Date
            </Typography>
            <DatePicker
              selected={dueDate}
              onChange={(date: Date | null) => setDueDate(date)}
              className="custom-datepicker"
              dateFormat="MMMM d, yyyy"
              minDate={new Date()}
              wrapperClassName="date-picker-wrapper"
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
