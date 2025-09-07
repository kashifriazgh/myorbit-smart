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
} from '@mui/material';
import { useState } from 'react';
import JournalModal from '../components/journal/journalModal';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import JournalList from '../components/journal/journalList';

import EditIcon from '@mui/icons-material/Edit';
import BookIcon from '@mui/icons-material/Book';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

export default function JournalsPage() {
  const [open, setOpen] = useState(false);
  const { theme: customTheme } = useCustomTheme();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

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

      {/* Quick Stats */}
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
                <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                  <BookIcon sx={{ fontSize: 18 }} />
                </Avatar>
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    sx={{ lineHeight: 1.2 }}
                  >
                    Recent
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last 30 days
                  </Typography>
                </Box>
              </Box>

              <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                  <TrendingUpIcon sx={{ fontSize: 18 }} />
                </Avatar>
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    sx={{ lineHeight: 1.2 }}
                  >
                    Growth
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Track progress
                  </Typography>
                </Box>
              </Box>

              <Box display="flex" alignItems="center" gap={1.5} flex={1}>
                <Avatar sx={{ bgcolor: 'warning.main', width: 32, height: 32 }}>
                  <CalendarTodayIcon sx={{ fontSize: 18 }} />
                </Avatar>
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    sx={{ lineHeight: 1.2 }}
                  >
                    Daily
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Reflection habit
                  </Typography>
                </Box>
              </Box>
            </Stack>
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
