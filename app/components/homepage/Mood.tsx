'use client';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Slider,
  Stack,
  Tooltip,
  Typography,
  useTheme,
  Fade,
} from '@mui/material';
import { useEffect, useState } from 'react';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import CloseIcon from '@mui/icons-material/Close';
import MoodSelector from '../journal/moodSelector';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';

const MOOD_SUBMISSION_KEY = 'lastMoodSubmission';

export default function Mood() {
  const theme = useTheme();
  const { user } = useAuth();

  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodLevel, setMoodLevel] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [allowedToShow, setAllowedToShow] = useState(false);

  useEffect(() => {
    const lastSubmit = localStorage.getItem(MOOD_SUBMISSION_KEY);
    if (!lastSubmit) {
      setAllowedToShow(true);
      return;
    }

    const lastSubmitTime = new Date(lastSubmit).getTime();
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (now - lastSubmitTime >= oneHour) {
      setAllowedToShow(true);
    } else {
      setAllowedToShow(false);
      const remaining = oneHour - (now - lastSubmitTime);
      const timeout = setTimeout(() => {
        setAllowedToShow(true);
      }, remaining);
      return () => clearTimeout(timeout);
    }
  }, []);

  const toggleMoodSelector = () => setShowMoodSelector((prev) => !prev);

  const handleMoodSubmit = async () => {
    if (!selectedMood || !user?.uid) return;
    setLoading(true);

    const moodEntry = {
      userId: user.uid,
      mood: selectedMood,
      level: moodLevel,
      source: 'manual',
      recordedAt: new Date(),
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'moods'), moodEntry);
    localStorage.setItem(MOOD_SUBMISSION_KEY, new Date().toISOString());

    setLoading(false);
    setSelectedMood(null);
    setMoodLevel(5);
    setShowMoodSelector(false);
    setAllowedToShow(false);

    setTimeout(() => setAllowedToShow(true), 60 * 60 * 1000);
  };

  if (!allowedToShow) return null;

  return (
    <Fade in={true} timeout={800}>
      <Paper
        elevation={3}
        sx={{
          p: 3,
          borderRadius: 3,
          background: theme.palette.mode === 'dark' ? '#1e293b' : '#f9fafb',
          borderLeft: `6px solid ${theme.palette.primary.main}`,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h6" fontWeight="bold">
            🧠 Track Your Mood
          </Typography>
          <Tooltip
            title={showMoodSelector ? 'Hide Mood Picker' : 'Select Mood'}
          >
            <IconButton onClick={toggleMoodSelector} size="small">
              {showMoodSelector ? <CloseIcon /> : <EmojiEmotionsIcon />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Your emotions matter — check in and reflect.
        </Typography>

        <Collapse in={showMoodSelector} timeout={500} unmountOnExit>
          <Box mt={3}>
            <MoodSelector
              selectedMood={selectedMood}
              onSelect={setSelectedMood}
            />

            {selectedMood && (
              <>
                <Box mt={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    How strong is your feeling? ({selectedMood})
                  </Typography>

                  <Slider
                    value={moodLevel}
                    onChange={(_, val) => setMoodLevel(val as number)}
                    min={1}
                    max={10}
                    marks
                    size="small"
                    sx={{
                      color:
                        moodLevel <= 3
                          ? theme.palette.error.main
                          : moodLevel >= 8
                          ? theme.palette.success.main
                          : theme.palette.warning.main,
                    }}
                  />
                </Box>

                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={handleMoodSubmit}
                  disabled={loading}
                  sx={{
                    mt: 3,
                    py: 1.2,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  {loading ? (
                    <CircularProgress size={22} color="inherit" />
                  ) : (
                    'Save Mood Entry'
                  )}
                </Button>
              </>
            )}
          </Box>
        </Collapse>
      </Paper>
    </Fade>
  );
}
