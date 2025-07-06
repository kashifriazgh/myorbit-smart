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
  Slider,
  Chip,
  Box,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/app/lib/context/userContext';
import { useCustomTheme } from '@/app/lib/context/themeContext';

import DeleteIcon from '@mui/icons-material/Delete';
import moment from 'moment';
import { useMediaQuery, useTheme } from '@mui/material';
import MoodSelector from './moodSelector';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function JournalModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const { theme } = useCustomTheme();

  const [mood, setMood] = useState<string | null>(null);
  const [moodLevel, setMoodLevel] = useState<number>(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [prompt, setPrompt] = useState<{ id: string; question: string } | null>(
    null
  );
  const [promptAnswer, setPromptAnswer] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);

  const muiTheme = useTheme();
  const fullScreen = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const currentDate = moment().format('D MMMM YY, dddd h:mm A');

  // 🧠 Example prompt (in real case, fetch randomly from Firestore)
  useEffect(() => {
    setPrompt({
      id: 'demo',
      question: 'What’s one thing you’re grateful for today?',
    });
  }, []);

  const handleSave = async () => {
    if (!title.trim()) return;

    setLoading(true);
    const journal = {
      authorId: user!.uid,
      authorName: user?.displayName || '',
      createdAt: serverTimestamp(),
      mood: mood ? { type: mood, level: moodLevel } : null,
      title: title.trim(),
      content: body.trim(),
      promptAnswers:
        prompt && promptAnswer.trim()
          ? [
              {
                promptId: prompt.id,
                question: prompt.question,
                answer: promptAnswer.trim(),
              },
            ]
          : [],
      tags,
      privacy: 'private',
    };
    await addDoc(collection(db, 'journals'), journal);
    setLoading(false);
    onClose();
  };

  const handleAddTag = () => {
    const clean = tagInput.trim();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleDeleteTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen} // 👈 makes it full on small screens
    >
      <DialogTitle>📔 Today&#39;s Reflection</DialogTitle>
      <DialogContent
        sx={{ bgcolor: theme.mode === 'dark' ? '#1e293b' : '#fff' }}
      >
        <Stack spacing={3}>
          <Typography variant="h5" textAlign="center" fontWeight="bold">
            {currentDate}
          </Typography>

          {/* Mood Icons */}
          <MoodSelector selectedMood={mood} onSelect={(val) => setMood(val)} />

          {/* Mood Level Slider */}
          {mood && (
            <Box px={4}>
              <Typography gutterBottom>
                How strong is your {mood} feeling?
              </Typography>
              <Slider
                value={moodLevel}
                onChange={(_, val) => setMoodLevel(val as number)}
                min={1}
                max={10}
              />
            </Box>
          )}

          <TextField
            label="Title of the Day or Activity"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <TextField
            label="What happened today?"
            fullWidth
            multiline
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          {/* Optional Prompt */}
          {prompt && (
            <Box>
              <Button onClick={() => setPromptAnswer('')}>
                🧠 {prompt.question}
              </Button>
              {promptAnswer !== undefined && (
                <TextField
                  fullWidth
                  multiline
                  label="Your thoughts..."
                  value={promptAnswer}
                  onChange={(e) => setPromptAnswer(e.target.value)}
                />
              )}
            </Box>
          )}

          {/* Tags */}
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Add Tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            />
            <Button onClick={handleAddTag}>Add</Button>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {tags.map((tag, idx) => (
              <Chip
                key={idx}
                label={`#${tag}`}
                onDelete={() => handleDeleteTag(idx)}
                deleteIcon={<DeleteIcon />}
                sx={{
                  bgcolor: theme.mode === 'dark' ? '#334155' : undefined,
                  color: theme.mode === 'dark' ? '#e2e8f0' : undefined,
                }}
              />
            ))}
          </Stack>
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
