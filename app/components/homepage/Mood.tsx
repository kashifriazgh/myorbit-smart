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
      <Box mt={4} className="px-4">
        <Card className="rounded-xl shadow-md transition mb-4">
          <CardContent>
            {/* Header (same width/structure as OverdueTasks header) */}
            <Box className="flex justify-between items-start mb-2">
              <Typography
                variant="h5"
                fontWeight="700"
                className="cursor-default"
                sx={{
                  color:
                    theme.palette.mode === 'dark'
                      ? '#fca5a5'
                      : theme.palette.primary.main,
                }}
              >
                How are you feeling this day?
              </Typography>

              <Stack direction="row" spacing={1}>
                <Tooltip
                  title={showMoodSelector ? 'Hide Mood Picker' : 'Select Mood'}
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
                        I’m feeling {selectedMood.replace('-', ' ')}
                      </Typography>
                    </Box>
                  )}

                  {/* Emoji row (wraps like Overdue Task's tags) */}
                  <Box className="flex flex-wrap gap-2 justify-center items-center mb-4">
                    {moodOptions.map((mood) => (
                      <Box
                        key={mood}
                        onClick={() => setSelectedMood(mood)}
                        className={`rounded-full p-1 cursor-pointer transition ${
                          selectedMood === mood
                            ? 'bg-yellow-200 scale-110'
                            : 'bg-transparent'
                        }`}
                        sx={{
                          transform:
                            selectedMood === mood ? 'scale(1.15)' : 'scale(1)',
                          transition: 'all 0.15s ease-in-out',
                        }}
                      >
                        <MoodEmoji mood={mood} size={30} />
                      </Box>
                    ))}
                  </Box>

                  {/* Slider + Submit (keeps same max width behaviour as OverdueTasks inputs) */}
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
                            'Save Mood Entry'
                          )}
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Fade>
  );
}
