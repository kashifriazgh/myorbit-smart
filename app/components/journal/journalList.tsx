'use client';

import {
  Card,
  CardContent,
  Stack,
  Typography,
  Skeleton,
  Box,
  Chip,
  Fade,
  Slide,
  useMediaQuery,
  useTheme,
  Avatar,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { db } from '@/app/lib/firebase';
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '@/app/lib/context/userContext';
import moment from 'moment';
import BookIcon from '@mui/icons-material/Book';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MoodIcon from '@mui/icons-material/Mood';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface JournalDoc {
  id: string;
  title: string;
  content?: string;
  mood?: {
    type: 'happy' | 'loving' | 'sad' | 'heart-broken' | 'angry';
    level: number;
  };
  productivityOfTheDay?: string;
  createdAt: Timestamp;
}

export default function JournalList() {
  const { user } = useAuth();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const [journals, setJournals] = useState<JournalDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const MOOD_COLORS: Record<
    string,
    { bg: string; text: string; emoji: string }
  > = {
    happy: { bg: '#fef3c7', text: '#92400e', emoji: '😊' },
    loving: { bg: '#fce7f3', text: '#be185d', emoji: '😍' },
    sad: { bg: '#dbeafe', text: '#1e40af', emoji: '😢' },
    'heart-broken': { bg: '#f3e8ff', text: '#7c3aed', emoji: '💔' },
    angry: { bg: '#fecaca', text: '#dc2626', emoji: '😠' },
  };

  useEffect(() => {
    if (!user) return;

    const fetchJournals = async () => {
      try {
        const now = moment();
        const past30 = now.clone().subtract(30, 'days').toDate();

        const q = query(
          collection(db, 'journals'),
          where('authorId', '==', user.uid),
          where('createdAt', '>=', past30),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const entries: JournalDoc[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.title && data.createdAt) {
            entries.push({
              id: doc.id,
              title: data.title,
              content: data.content,
              mood: data.mood,
              productivityOfTheDay: data.productivityOfTheDay,
              createdAt: data.createdAt,
            });
          }
        });

        setJournals(entries);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching journals:', err);
        setLoading(false);
      }
    };

    fetchJournals();
  }, [user]);

  if (loading) {
    return (
      <Stack spacing={2}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={120} />
        ))}
      </Stack>
    );
  }

  if (journals.length === 0) {
    return (
      <Fade in={true} timeout={800}>
        <Card
          elevation={2}
          sx={{
            textAlign: 'center',
            p: 6,
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            border: '2px dashed',
            borderColor: 'primary.main',
            opacity: 0.8,
          }}
        >
          <Avatar
            sx={{
              width: 80,
              height: 80,
              mx: 'auto',
              mb: 3,
              bgcolor: 'primary.main',
              opacity: 0.8,
            }}
          >
            <BookIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography
            variant="h5"
            fontWeight="bold"
            gutterBottom
            color="primary"
          >
            📝 No Journal Entries Yet
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Start your journaling journey by writing your first entry!
          </Typography>
        </Card>
      </Fade>
    );
  }

  return (
    <Stack spacing={3}>
      {journals.map((entry, index) => {
        const moodInfo = entry.mood ? MOOD_COLORS[entry.mood.type] : null;
        const createdDate = entry.createdAt.toDate();
        const isToday = moment(createdDate).isSame(moment(), 'day');
        const isYesterday = moment(createdDate).isSame(
          moment().subtract(1, 'day'),
          'day'
        );

        return (
          <Slide
            key={entry.id}
            direction="up"
            in={true}
            timeout={600 + index * 100}
          >
            <Link
              href={`/journals/${entry.id}`}
              style={{ textDecoration: 'none' }}
            >
              <Card
                elevation={2}
                sx={{
                  transition: 'all 0.3s ease',
                  border: `1px solid ${muiTheme.palette.divider}`,
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: muiTheme.shadows[8],
                    borderColor: muiTheme.palette.primary.main,
                  },
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Date Indicator */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    backgroundColor: isToday
                      ? muiTheme.palette.success.main
                      : isYesterday
                      ? muiTheme.palette.warning.main
                      : muiTheme.palette.primary.main,
                  }}
                />

                <CardContent sx={{ p: isMobile ? 2 : 3, pt: 3 }}>
                  <Box display="flex" alignItems="flex-start" gap={2}>
                    {/* Journal Icon */}
                    <Avatar
                      sx={{
                        bgcolor: muiTheme.palette.primary.main,
                        width: 40,
                        height: 40,
                        mt: 0.5,
                      }}
                    >
                      <BookIcon sx={{ fontSize: 20 }} />
                    </Avatar>

                    {/* Main Content */}
                    <Box flexGrow={1}>
                      {/* Title */}
                      <Typography
                        variant="h6"
                        fontWeight="bold"
                        sx={{
                          mb: 1,
                          color: 'inherit',
                          '&:hover': {
                            color: muiTheme.palette.primary.main,
                          },
                        }}
                      >
                        {entry.title}
                      </Typography>

                      {/* Content Preview */}
                      {entry.content && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 2,
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {entry.content}
                        </Typography>
                      )}

                      {/* Productivity Summary */}
                      {entry.productivityOfTheDay && (
                        <Box mb={2}>
                          <Chip
                            icon={<TrendingUpIcon sx={{ fontSize: 16 }} />}
                            label={entry.productivityOfTheDay}
                            size="small"
                            variant="outlined"
                            sx={{
                              borderColor: muiTheme.palette.success.main,
                              color: muiTheme.palette.success.main,
                              fontWeight: 500,
                            }}
                          />
                        </Box>
                      )}

                      {/* Tags and Info */}
                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        gap={1}
                        alignItems="center"
                      >
                        {/* Mood Chip */}
                        {moodInfo && (
                          <Chip
                            icon={<MoodIcon sx={{ fontSize: 16 }} />}
                            label={`${moodInfo.emoji} ${entry.mood?.type} (${entry.mood?.level}/10)`}
                            size="small"
                            sx={{
                              backgroundColor: moodInfo.bg,
                              color: moodInfo.text,
                              fontWeight: 600,
                              '& .MuiChip-icon': {
                                color: moodInfo.text,
                              },
                            }}
                          />
                        )}

                        {/* Date Chip */}
                        <Chip
                          icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                          label={
                            isToday
                              ? 'Today'
                              : isYesterday
                              ? 'Yesterday'
                              : moment(createdDate).format('MMM D, YYYY')
                          }
                          size="small"
                          variant="outlined"
                          sx={{
                            borderColor: muiTheme.palette.grey[400],
                            color: muiTheme.palette.text.secondary,
                            fontWeight: 500,
                          }}
                        />

                        {/* Time */}
                        <Chip
                          label={moment(createdDate).format('h:mm A')}
                          size="small"
                          variant="outlined"
                          sx={{
                            borderColor: muiTheme.palette.grey[300],
                            color: muiTheme.palette.text.secondary,
                            fontWeight: 400,
                          }}
                        />
                      </Stack>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Link>
          </Slide>
        );
      })}
    </Stack>
  );
}
