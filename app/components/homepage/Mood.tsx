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
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import MoodEmoji from '../global/mood-emojis/MoodEmoji';
import { moodOptions, MoodType } from '@/app/lib/interface';

const MOOD_SUBMISSION_KEY = 'lastMoodSubmission';

export default function Mood() {
  const theme = useTheme();
  const { user } = useAuth();

  const [showMoodSelector, setShowMoodSelector] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
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

  const toggleMoodSelector = () => {
    setShowMoodSelector((prev) => {
      if (prev) {
        // Reset states when closing
        setSelectedMood(null);
        setMoodLevel(5);
      }
      return !prev;
    });
  };

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

    try {
      await addDoc(collection(db, 'moods'), moodEntry);
      localStorage.setItem(MOOD_SUBMISSION_KEY, new Date().toISOString());

      // Reset UI state after submit
      setSelectedMood(null);
      setMoodLevel(5);
      setShowMoodSelector(false);
      setAllowedToShow(false);
      setTimeout(() => setAllowedToShow(true), 60 * 60 * 1000);
    } catch (err) {
      console.error('Failed to submit mood:', err);
    } finally {
      setLoading(false);
    }
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
          boxShadow: theme.shadows[3],
          transition: 'all 0.3s ease-in-out',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography
            variant="h5"
            fontWeight="bold"
            align="center"
            sx={{ width: '100%', fontSize: '1.75rem', mt: 1 }}
          >
            How are you feeling this day?
          </Typography>

          <Tooltip
            title={showMoodSelector ? 'Hide Mood Picker' : 'Select Mood'}
          >
            <IconButton onClick={toggleMoodSelector} size="small">
              {showMoodSelector ? <CloseIcon /> : <EmojiEmotionsIcon />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Collapse in={showMoodSelector} timeout={500} unmountOnExit>
          <Box mt={3} display="flex" flexDirection="column" alignItems="center">
            {/* Large emoji preview */}
            {selectedMood && (
              <Box mb={2} textAlign="center">
                <MoodEmoji mood={selectedMood} size={96} level={moodLevel} />
                <Typography
                  variant="subtitle1"
                  mt={1}
                  textTransform="capitalize"
                >
                  I’m feeling {selectedMood.replace('-', ' ')}
                </Typography>
              </Box>
            )}

            {/* Mood emojis row */}
            <Box
              display="flex"
              gap={1}
              flexWrap="wrap"
              justifyContent="center"
              alignItems="center"
              mb={3}
            >
              {moodOptions.map((mood) => (
                <Box
                  key={mood}
                  onClick={() => setSelectedMood(mood)}
                  sx={{
                    borderRadius: '50%',
                    padding: 1,
                    cursor: 'pointer',
                    backgroundColor:
                      selectedMood === mood ? '#fde68a' : 'transparent',
                    transform:
                      selectedMood === mood ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  <MoodEmoji mood={mood} size={30} />
                </Box>
              ))}
            </Box>

            {/* Mood intensity slider */}
            {selectedMood && (
              <>
                <Box width="100%" maxWidth="400px">
                  <Typography variant="subtitle2" gutterBottom>
                    How strong is your feeling?
                  </Typography>
                  <Slider
                    value={moodLevel}
                    onChange={(_, val) => setMoodLevel(val as number)}
                    min={1}
                    max={5}
                    marks
                    step={1}
                    sx={{
                      color:
                        moodLevel <= 2
                          ? theme.palette.error.main
                          : moodLevel >= 4
                          ? theme.palette.success.main
                          : theme.palette.warning.main,
                    }}
                  />
                </Box>

                {/* Submit button */}
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
