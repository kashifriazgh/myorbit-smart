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
import { useState } from 'react';
import JournalModal from '../components/journal/journalModal';
import { useCustomTheme } from '@/app/lib/context/themeContext';
import JournalList from '../components/journal/journalList';
import { useJournalContext } from '@/app/lib/context/JournalContext';

import EditIcon from '@mui/icons-material/Edit';
import BookIcon from '@mui/icons-material/Book';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

export default function JournalsPage() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { theme: customTheme } = useCustomTheme();
  const { insights, loading } = useJournalContext();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const isDark = customTheme?.mode === 'dark';

  if (!customTheme) return null;

  return (
    <div
      className={`max-w-6xl mx-auto my-8 ${isMobile ? 'px-1' : 'px-6'}`}
      style={{
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        minHeight: '100vh',
        color: isDark ? '#f1f5f9' : '#0f172a',
      }}
    >
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
        <div className="mb-8">
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.02)',
              borderColor: isDark ? '#1e293b' : '#e2e8f0',
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

            {loading ? (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                {/* Last 30 Days */}
                <div className="flex items-center gap-3 flex-1">
                  <Avatar
                    sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}
                  >
                    <BookIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <div>
                    <p
                      className="text-lg font-bold leading-tight"
                      style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
                    >
                      {insights.last30Days}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Last 30 days
                    </p>
                  </div>
                </div>

                {/* Current Streak */}
                <div className="flex items-center gap-3 flex-1">
                  <Avatar
                    sx={{ bgcolor: 'success.main', width: 32, height: 32 }}
                  >
                    <TrendingUpIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <div>
                    <p
                      className="text-lg font-bold leading-tight"
                      style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
                    >
                      {insights.currentStreak}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Current streak
                    </p>
                  </div>
                </div>

                {/* Total Entries */}
                <div className="flex items-center gap-3 flex-1">
                  <Avatar
                    sx={{ bgcolor: 'warning.main', width: 32, height: 32 }}
                  >
                    <CalendarTodayIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                  <div>
                    <p
                      className="text-lg font-bold leading-tight"
                      style={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
                    >
                      {insights.totalEntries}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Total entries
                    </p>
                  </div>
                </div>
              </Stack>
            )}
          </div>
        </div>
      </Fade>

      {/* Quick Write Section */}
      <Fade in={true} timeout={1200}>
        <div
          className="rounded-xl shadow-md mb-8 p-4 md:p-6"
          style={{
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
          }}
        >
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
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                color: isDark ? '#f1f5f9' : '#0f172a',
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
                  borderColor: isDark ? '#374151' : '#e5e7eb',
                },
                '&:hover fieldset': {
                  borderColor: isDark ? '#4b5563' : '#d1d5db',
                },
              },
            }}
          />
          <div className="mt-3 flex justify-between items-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click to start writing your journal entry
            </p>
            <Chip
              label="New Entry"
              size="small"
              color="primary"
              variant="outlined"
              icon={<EditIcon />}
            />
          </div>
        </div>
      </Fade>

      {/* Search Section */}
      <Fade in={true} timeout={1400}>
        <Box
          mb={6}
          p={isMobile ? 2 : 4}
          sx={{
            background: isDark 
              ? 'rgba(30, 41, 59, 0.7)' 
              : 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(12px)',
            borderRadius: '2rem',
            boxShadow: isDark 
              ? '0 10px 30px rgba(0,0,0,0.3)' 
              : '0 10px 30px rgba(100,116,139,0.1)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
          }}
        >
          <Typography
            variant="h6"
            fontWeight="bold"
            mb={3}
            color="primary"
            display="flex"
            alignItems="center"
            gap={1.5}
          >
            <Box 
              component="span" 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: 36, 
                height: 36, 
                borderRadius: '10px',
                bgcolor: 'primary.main',
                color: 'white',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
              }}
            >
              🔍
            </Box>
            Filter Your Thoughts
          </Typography>
          
          <Stack spacing={3}>
            <TextField
              fullWidth
              placeholder="Search by keywords, emotions, or #hashtags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="outlined"
              InputProps={{
                sx: { 
                  borderRadius: '1.25rem',
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(248, 250, 252, 0.8)',
                  fontSize: '1rem',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(248, 250, 252, 1)',
                  },
                  '& fieldset': { border: 'none' },
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                },
              }}
            />
            
            <Stack direction={isMobile ? 'column' : 'row'} spacing={3} alignItems="center">
              <Box flex={1} width="100%">
                <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ ml: 1, mb: 0.5, display: 'block' }}>
                  From
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  size="small"
                  InputProps={{
                    sx: { 
                      borderRadius: '1rem',
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.3)' : 'rgba(248, 250, 252, 0.5)',
                    },
                  }}
                />
              </Box>
              
              <Box flex={1} width="100%">
                <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ ml: 1, mb: 0.5, display: 'block' }}>
                  Until
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  size="small"
                  InputProps={{
                    sx: { 
                      borderRadius: '1rem',
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.3)' : 'rgba(248, 250, 252, 0.5)',
                    },
                  }}
                />
              </Box>
              
              <Box pt={isMobile ? 1 : 2.5} width={isMobile ? '100%' : 'auto'}>
                <Button
                  variant="text"
                  onClick={() => {
                    setSearchQuery('');
                    setStartDate('');
                    setEndDate('');
                  }}
                  sx={{ 
                    borderRadius: '1rem', 
                    px: 3,
                    color: 'text.secondary',
                    fontWeight: 600,
                    '&:hover': { color: 'error.main', bgcolor: 'rgba(239, 68, 68, 0.1)' }
                  }}
                  fullWidth={isMobile}
                >
                  Clear Filters
                </Button>
              </Box>
            </Stack>
          </Stack>
        </Box>
      </Fade>

      {/* Journal Entries */}
      <Box mb={10}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h5" fontWeight="bold" color="primary">
            {searchQuery || startDate || endDate ? 'Search Results' : 'Recent Entries'}
          </Typography>
          {(searchQuery || startDate || endDate) && (
            <Chip 
              label="Filtered" 
              color="primary" 
              size="small" 
              onDelete={() => {
                setSearchQuery('');
                setStartDate('');
                setEndDate('');
              }}
            />
          )}
        </Box>
        <JournalList 
          searchQuery={searchQuery} 
          startDate={startDate} 
          endDate={endDate} 
        />
      </Box>

      <JournalModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
