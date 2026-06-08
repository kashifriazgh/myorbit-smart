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
  Collapse,
  InputAdornment,
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
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

export default function JournalsPage() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { theme: customTheme } = useCustomTheme();
  const { insights, loading } = useJournalContext();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const isDark = customTheme?.mode === 'dark';
  const hasActiveFilters = startDate || endDate;

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

      {/* Search & Filter Section */}
      <Fade in={true} timeout={1400}>
        <Box mb={6}>
          {/* ── Distinguished Search Bar ── */}
          <Box
            sx={{
              position: 'relative',
              mb: 2,
              borderRadius: '1.5rem',
              background: isDark
                ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)'
                : 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%)',
              border: `2px solid ${isDark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.25)'}`,
              boxShadow: isDark
                ? '0 0 0 0 rgba(99,102,241,0), 0 4px 24px rgba(0,0,0,0.3)'
                : '0 0 0 0 rgba(99,102,241,0), 0 4px 24px rgba(99,102,241,0.08)',
              transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
              '&:focus-within': {
                borderColor: isDark
                  ? 'rgba(99,102,241,0.8)'
                  : 'rgba(99,102,241,0.6)',
                boxShadow: isDark
                  ? '0 0 0 4px rgba(99,102,241,0.2), 0 8px 32px rgba(0,0,0,0.35)'
                  : '0 0 0 4px rgba(99,102,241,0.12), 0 8px 32px rgba(99,102,241,0.15)',
              },
            }}
          >
            <TextField
              fullWidth
              placeholder="Search by keywords, emotions, or #hashtags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon
                      sx={{
                        color: searchQuery
                          ? 'primary.main'
                          : isDark
                            ? 'rgba(148,163,184,0.7)'
                            : 'rgba(100,116,139,0.7)',
                        fontSize: 22,
                        transition: 'color 0.2s ease',
                      }}
                    />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: '1.5rem',
                  backgroundColor: 'transparent',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  fontSize: '1rem',
                  fontWeight: 500,
                  px: 1,
                  '& fieldset': { border: 'none' },
                  '& input': {
                    py: 1.6,
                    '&::placeholder': {
                      color: isDark
                        ? 'rgba(148,163,184,0.6)'
                        : 'rgba(100,116,139,0.6)',
                      fontWeight: 400,
                    },
                  },
                },
              }}
            />
          </Box>

          {/* ── Filter Toggle Row ── */}
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mb={1}
          >
            <Button
              size="small"
              startIcon={<TuneIcon sx={{ fontSize: 18 }} />}
              endIcon={
                filtersOpen ? (
                  <KeyboardArrowUpIcon />
                ) : (
                  <KeyboardArrowDownIcon />
                )
              }
              onClick={() => setFiltersOpen((v) => !v)}
              sx={{
                borderRadius: '1rem',
                px: 2,
                py: 0.75,
                fontWeight: 600,
                fontSize: '0.8rem',
                color: hasActiveFilters ? 'primary.main' : 'text.secondary',
                bgcolor: hasActiveFilters
                  ? isDark
                    ? 'rgba(99,102,241,0.15)'
                    : 'rgba(99,102,241,0.08)'
                  : 'transparent',
                border: `1px solid ${
                  hasActiveFilters
                    ? isDark
                      ? 'rgba(99,102,241,0.4)'
                      : 'rgba(99,102,241,0.3)'
                    : isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.08)'
                }`,
                '&:hover': {
                  bgcolor: isDark
                    ? 'rgba(99,102,241,0.12)'
                    : 'rgba(99,102,241,0.06)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              Date Filter
              {hasActiveFilters && (
                <Box
                  component="span"
                  sx={{
                    ml: 1,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    display: 'inline-block',
                    boxShadow: '0 0 6px rgba(99,102,241,0.6)',
                  }}
                />
              )}
            </Button>

            {(searchQuery || hasActiveFilters) && (
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setSearchQuery('');
                  setStartDate('');
                  setEndDate('');
                }}
                sx={{
                  borderRadius: '1rem',
                  px: 2,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'error.main',
                    bgcolor: 'rgba(239,68,68,0.08)',
                  },
                }}
              >
                Clear All
              </Button>
            )}
          </Box>

          {/* ── Collapsible Date Filters ── */}
          <Collapse in={filtersOpen} timeout={280}>
            <Box
              sx={{
                mt: 1.5,
                p: isMobile ? 2 : 3,
                borderRadius: '1.25rem',
                background: isDark
                  ? 'rgba(30, 41, 59, 0.6)'
                  : 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                boxShadow: isDark
                  ? '0 8px 24px rgba(0,0,0,0.25)'
                  : '0 8px 24px rgba(100,116,139,0.08)',
              }}
            >
              <Stack
                direction={isMobile ? 'column' : 'row'}
                spacing={3}
                alignItems="flex-end"
              >
                <Box flex={1} width="100%">
                  <Typography
                    variant="caption"
                    fontWeight="600"
                    color="text.secondary"
                    sx={{ ml: 0.5, mb: 0.5, display: 'block' }}
                  >
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
                        backgroundColor: isDark
                          ? 'rgba(15, 23, 42, 0.3)'
                          : 'rgba(248, 250, 252, 0.5)',
                      },
                    }}
                  />
                </Box>

                <Box flex={1} width="100%">
                  <Typography
                    variant="caption"
                    fontWeight="600"
                    color="text.secondary"
                    sx={{ ml: 0.5, mb: 0.5, display: 'block' }}
                  >
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
                        backgroundColor: isDark
                          ? 'rgba(15, 23, 42, 0.3)'
                          : 'rgba(248, 250, 252, 0.5)',
                      },
                    }}
                  />
                </Box>

                <Box width={isMobile ? '100%' : 'auto'}>
                  <Button
                    variant="text"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    sx={{
                      borderRadius: '1rem',
                      px: 3,
                      color: 'text.secondary',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      '&:hover': {
                        color: 'error.main',
                        bgcolor: 'rgba(239, 68, 68, 0.08)',
                      },
                    }}
                    fullWidth={isMobile}
                  >
                    Clear Dates
                  </Button>
                </Box>
              </Stack>
            </Box>
          </Collapse>
        </Box>
      </Fade>

      {/* Journal Entries */}
      <Box mb={10}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={4}
        >
          <Typography variant="h5" fontWeight="bold" color="primary">
            {searchQuery || startDate || endDate
              ? 'Search Results'
              : 'Recent Entries'}
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
        {/* minHeight prevents the section from collapsing when results change,
            which causes the cards-falling-from-top layout shift. overflow: hidden
            clips any stray animation that still escapes from child components. */}
        <Box sx={{ minHeight: 300, overflow: 'hidden' }}>
          <JournalList
            searchQuery={searchQuery}
            startDate={startDate}
            endDate={endDate}
          />
        </Box>
      </Box>

      <JournalModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
