'use client';

import {
  Box,
  TextField,
  Typography,
  Card,
  CardContent,
  Button,
  Fade,
  useMediaQuery,
  useTheme,
  Avatar,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import { useState, useEffect } from 'react';
import JournalModal from '../components/journal/journalModal';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import JournalList from '../components/journal/journalList';
import { useAuth } from '@/app/lib/context/userContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import moment from 'moment';

import EditIcon from '@mui/icons-material/Edit';
import BookIcon from '@mui/icons-material/Book';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

export default function JournalsPage() {
  const [open, setOpen] = useState(false);
  const { theme: customTheme } = useCustomTheme();
  const { user } = useAuth();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const [insights, setInsights] = useState({
    totalEntries: 0,
    last30Days: 0,
    currentStreak: 0,
    longestStreak: 0,
    loading: true,
  });

  useEffect(() => {
    const fetchJournalInsights = async () => {
      if (!user) return;

      try {
        const journalsSnap = await getDocs(
          query(collection(db, 'journals'), where('userId', '==', user.uid))
        );

        const journals = journalsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        }));

        const now = moment();
        const thirtyDaysAgo = moment().subtract(30, 'days');

        // Calculate insights
        const totalEntries = journals.length;
        const last30Days = journals.filter((journal) =>
          moment(journal.createdAt).isAfter(thirtyDaysAgo)
        ).length;

        // Calculate current streak
        let currentStreak = 0;
        const checkDate = now.clone().startOf('day');

        for (let i = 0; i < 365; i++) {
          // Check up to 1 year back
          const hasEntry = journals.some((journal) =>
            moment(journal.createdAt).isSame(checkDate, 'day')
          );

          if (hasEntry) {
            currentStreak++;
            checkDate.subtract(1, 'day');
          } else {
            break;
          }
        }

        // Calculate longest streak
        let longestStreak = 0;
        let tempStreak = 0;
        const sortedJournals = journals
          .sort((a, b) => moment(b.createdAt).diff(moment(a.createdAt)))
          .map((j) => moment(j.createdAt).startOf('day'));

        if (sortedJournals.length > 0) {
          const currentDate = sortedJournals[0].clone();
          let lastDate = currentDate.clone();

          for (let i = 1; i < sortedJournals.length; i++) {
            const journalDate = sortedJournals[i];
            const daysDiff = lastDate.diff(journalDate, 'days');

            if (daysDiff === 1) {
              tempStreak++;
            } else {
              longestStreak = Math.max(longestStreak, tempStreak + 1);
              tempStreak = 0;
            }
            lastDate = journalDate.clone();
          }
          longestStreak = Math.max(longestStreak, tempStreak + 1);
        }

        setInsights({
          totalEntries,
          last30Days,
          currentStreak,
          longestStreak,
          loading: false,
        });
      } catch (error) {
        console.error('Error fetching journal insights:', error);
        setInsights((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchJournalInsights();
  }, [user]);

  if (!customTheme) return null;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', my: 4, px: isMobile ? 1 : 3 }}>
      {/* Hero Header */}
      <Fade in={true} timeout={800}>
        <Card
          elevation={3}
          sx={{
            mb: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <CardContent sx={{ p: isMobile ? 3 : 4 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={2}
            >
              <Box>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                  📔 My Journal
                </Typography>
                <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                  Capture your thoughts, reflect on your day, and track your
                  growth
                </Typography>
              </Box>
              <Button
                onClick={() => setOpen(true)}
                variant="contained"
                size="large"
                startIcon={<EditIcon />}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                Write New Entry
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Fade>

      {/* Journal Insights */}
      <Fade in={true} timeout={1000}>
        <Box mb={4}>
          <Card
            elevation={0}
            sx={{
              p: 2,
              backgroundColor:
                muiTheme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.02)'
                  : 'rgba(0, 0, 0, 0.02)',
              border: `1px solid ${muiTheme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              mb={2}
              color="primary"
            >
              Journal Insights
            </Typography>

            {insights.loading ? (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Stack
                direction={isMobile ? 'column' : 'row'}
                spacing={2}
                divider={
                  !isMobile ? (
                    <Box
                      sx={{ width: 1, height: 1, backgroundColor: 'divider' }}
                    />
                  ) : null
                }
              >
                <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                  <Avatar
                    sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}
                  >
                    <BookIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      sx={{ lineHeight: 1.2 }}
                    >
                      {insights.last30Days}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Last 30 days
                    </Typography>
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                  <Avatar
                    sx={{ bgcolor: 'success.main', width: 32, height: 32 }}
                  >
                    <TrendingUpIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      sx={{ lineHeight: 1.2 }}
                    >
                      {insights.currentStreak}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Current streak
                    </Typography>
                  </Box>
                </Box>

                <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                  <Avatar
                    sx={{ bgcolor: 'warning.main', width: 32, height: 32 }}
                  >
                    <CalendarTodayIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      sx={{ lineHeight: 1.2 }}
                    >
                      {insights.totalEntries}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total entries
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            )}
          </Card>
        </Box>
      </Fade>

      {/* Quick Write Section */}
      <Fade in={true} timeout={1200}>
        <Card elevation={2} sx={{ mb: 4 }}>
          <CardContent sx={{ p: isMobile ? 2 : 3 }}>
            <Typography variant="h6" fontWeight="bold" mb={2} color="primary">
              Quick Write
            </Typography>
            <TextField
              variant="outlined"
              placeholder="🖊️ What's on your mind today? Share your thoughts..."
              fullWidth
              onClick={() => setOpen(true)}
              InputProps={{
                readOnly: true,
                sx: {
                  backgroundColor:
                    muiTheme.palette.mode === 'dark' ? '#1e293b' : '#f8fafc',
                  color:
                    muiTheme.palette.mode === 'dark' ? '#f1f5f9' : '#000000',
                  borderRadius: 2,
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0, 102, 255, 0.1)',
                  transition: 'all 0.25s ease',
                  fontSize: '1.1rem',
                  py: 1,

                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0, 102, 255, 0.2)',
                    transform: 'translateY(-1px)',
                  },

                  '&:focus-within': {
                    borderColor: muiTheme.palette.primary.main,
                    boxShadow: `0 0 0 2px ${muiTheme.palette.primary.main}20`,
                  },

                  '& fieldset': {
                    borderColor:
                      muiTheme.palette.mode === 'dark' ? '#374151' : '#e5e7eb',
                  },

                  '&:hover fieldset': {
                    borderColor:
                      muiTheme.palette.mode === 'dark' ? '#4b5563' : '#d1d5db',
                  },
                },
              }}
            />
            <Box
              mt={2}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="caption" color="text.secondary">
                Click to start writing your journal entry
              </Typography>
              <Chip
                label="New Entry"
                size="small"
                color="primary"
                variant="outlined"
                icon={<EditIcon />}
              />
            </Box>
          </CardContent>
        </Card>
      </Fade>

      {/* Journal Entries */}
      <Box>
        <Typography variant="h6" fontWeight="bold" mb={3} color="primary">
          Recent Entries
        </Typography>
        <JournalList />
      </Box>

      <JournalModal open={open} onClose={() => setOpen(false)} />
    </Box>
  );
}
