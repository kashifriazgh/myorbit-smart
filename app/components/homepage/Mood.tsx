'use client';

import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  Slider,
  Stack,
  Tooltip,
  Typography,
  useTheme,
  Fade,
  Card,
  CardContent,
} from '@mui/material';
import { useEffect, useState } from 'react';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import CloseIcon from '@mui/icons-material/Close';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/context/userContext';
import MoodEmoji from '../global/mood-emojis/MoodEmoji';
import { moodOptions, MoodType } from '@/app/lib/interface';
import { logFocusTime } from '@/app/lib/utilts';

const MOOD_SUBMISSION_KEY = 'lastMoodSubmission';

export default function Mood() {
  const theme = useTheme();
  const { user } = useAuth();

  const [showMoodSelector, setShowMoodSelector] = useState(true); // Changed to true by default
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
      return () => {
        clearTimeout(timeout);
      };
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
      // 1️⃣ Save mood entry
      await addDoc(collection(db, 'moods'), moodEntry);

      // 2️⃣ Log the focus time
      await logFocusTime(user.uid);

      // 3️⃣ Store last submission locally
      localStorage.setItem(MOOD_SUBMISSION_KEY, new Date().toISOString());

      // 4️⃣ Reset UI state after submit
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
      <Box mt={4} className="px-4">
        <Card className="rounded-xl shadow-md transition mb-4">
          <CardContent>
            {/* Header (same width/structure as OverdueTasks header) */}
            <Box className="flex justify-between items-start mb-2">
              <Typography
                variant="h6"
                fontWeight="700"
                className="cursor-default"
                sx={{
                  color:
                    theme.palette.mode === 'dark'
                      ? '#fca5a5'
                      : theme.palette.primary.main,
                }}
              >
                How are you feeling today?
              </Typography>

              <Stack direction="row" spacing={1}>
                <Tooltip
                  title={
                    showMoodSelector ? 'Hide Mood Picker' : 'Show Mood Picker'
                  }
                >
                  <span>
                    <IconButton onClick={toggleMoodSelector} size="small">
                      {showMoodSelector ? <CloseIcon /> : <EmojiEmotionsIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Box>

            {/* Body */}
            <Box className="mt-1">
              <Collapse in={showMoodSelector} timeout={500} unmountOnExit>
                <Box className="flex flex-col items-center">
                  <Typography
                    variant="body2"
                    sx={{ color: theme.palette.text.secondary, mb: 1.5 }}
                  >
                    Pick an emoji to get started.
                  </Typography>

                  {/* Segmented control for mood selection - Always visible when component is open */}
                  <Stack
                    direction="row"
                    spacing={1}
                    justifyContent="center"
                    flexWrap="wrap"
                    sx={{ mb: 2 }}
                  >
                    {moodOptions.map((mood) => {
                      const active = selectedMood === mood;
                      return (
                        <Button
                          key={mood}
                          onClick={() => setSelectedMood(mood)}
                          size="small"
                          variant={active ? 'contained' : 'outlined'}
                          color={active ? 'primary' : 'inherit'}
                          startIcon={<MoodEmoji mood={mood} size={20} />}
                          aria-pressed={active}
                          sx={{
                            borderRadius: 999,
                            textTransform: 'none',
                            px: 1.25,
                            py: 0.5,
                            ...(active
                              ? {}
                              : {
                                  borderColor: 'divider',
                                  color: 'text.secondary',
                                }),
                          }}
                        >
                          {mood.replace('-', ' ')}
                        </Button>
                      );
                    })}
                  </Stack>

                  {/* Submission controls - Only visible when a mood is selected */}
                  <Collapse in={!!selectedMood} timeout={300}>
                    <Box className="flex flex-col items-center w-full">
                      {/* Large emoji preview */}
                      {selectedMood && (
                        <Box className="mb-4 text-center">
                          <MoodEmoji
                            mood={selectedMood}
                            size={96}
                            level={moodLevel}
                          />
                          <Typography
                            variant="subtitle1"
                            mt={1}
                            textTransform="capitalize"
                            sx={{
                              color:
                                theme.palette.mode === 'dark'
                                  ? '#e2e8f0'
                                  : '#334155',
                            }}
                          >
                            I&#39;m feeling {selectedMood.replace('-', ' ')}
                          </Typography>
                        </Box>
                      )}

                      {/* Slider + Submit */}
                      {selectedMood && (
                        <Box className="w-full">
                          <Box className="mx-auto" sx={{ maxWidth: 640 }}>
                            <Typography
                              variant="subtitle2"
                              gutterBottom
                              sx={{
                                color:
                                  theme.palette.mode === 'dark'
                                    ? '#cbd5e1'
                                    : '#334155',
                              }}
                            >
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
                                height: 8,
                                '& .MuiSlider-track': { border: 'none' },
                                '& .MuiSlider-rail': {
                                  opacity: 1,
                                  bgcolor: 'action.hover',
                                },
                                '& .MuiSlider-thumb': {
                                  width: 18,
                                  height: 18,
                                  '&:focus, &:hover, &.Mui-active': {
                                    boxShadow: '0 0 0 6px rgba(99,102,241,.16)',
                                  },
                                },
                                color:
                                  moodLevel <= 2
                                    ? theme.palette.error.main
                                    : moodLevel >= 4
                                    ? theme.palette.success.main
                                    : theme.palette.warning.main,
                              }}
                            />

                            <Button
                              variant="contained"
                              color="primary"
                              fullWidth
                              onClick={handleMoodSubmit}
                              disabled={loading}
                              sx={{
                                mt: 2,
                                py: 1.1,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600,
                              }}
                            >
                              {loading ? (
                                <CircularProgress size={20} color="inherit" />
                              ) : (
                                'Save'
                              )}
                            </Button>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              </Collapse>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Fade>
  );
}
